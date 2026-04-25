// ============================================================
// storage-manager.js — Façade de stockage hybride (offline-first)
// ============================================================
// Interface identique à l'ancien objet `Storage` — drop-in replacement.
// Les données sont TOUJOURS lues et écrites localement en premier.
// La synchronisation Supabase se fait en arrière-plan de façon transparente.
// ============================================================

import { AuthService, SupabaseStorage } from './supabase-client.js';

// ============================================================
// LocalStorage — adaptateur local (conserve le comportement original)
// ============================================================
const LocalStorage = {
  _KEY: 'flashcards_decks',

  getDecks() {
    try {
      const raw = localStorage.getItem(this._KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveDecks(decks) {
    try {
      localStorage.setItem(this._KEY, JSON.stringify(decks));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('Espace de stockage plein. Supprimez des decks ou des images.');
      }
      throw e;
    }
  },

  getDeck(id) {
    return this.getDecks().find(d => d.id === id) ?? null;
  },

  saveDeck(deck) {
    const decks = this.getDecks();
    const idx   = decks.findIndex(d => d.id === deck.id);
    if (idx >= 0) decks[idx] = deck; else decks.push(deck);
    this.saveDecks(decks);
  },

  deleteDeck(id) {
    this.saveDecks(this.getDecks().filter(d => d.id !== id));
  }
};

// ============================================================
// SyncQueue — file d'attente des mutations offline
// ============================================================
const SyncQueue = {
  _KEY: 'flashcards_sync_queue',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch {
      return [];
    }
  },

  enqueue(operation, payload) {
    const queue = this.getAll();
    queue.push({ operation, payload, timestamp: Date.now() });
    localStorage.setItem(this._KEY, JSON.stringify(queue));
  },

  clear() {
    localStorage.removeItem(this._KEY);
  }
};

// ============================================================
// StorageManager — façade principale (exportée)
// ============================================================
export const StorageManager = {

  // ---- API publique (identique à l'ancien Storage) ----

  getDecks()     { return LocalStorage.getDecks(); },
  getDeck(id)    { return LocalStorage.getDeck(id); },

  /**
   * Sauvegarde un deck localement, puis sync cloud en arrière-plan.
   * @param {Object} deck
   */
  saveDeck(deck) {
    // S'assurer que le deck a un updatedAt pour la résolution de conflits
    deck.updatedAt = Date.now();
    LocalStorage.saveDeck(deck);
    this._syncDeckToCloud(deck);
  },

  /**
   * Sauvegarde plusieurs decks d'un coup (utilisé après sync cloud → local).
   * @param {Array} decks
   */
  saveDecks(decks) {
    LocalStorage.saveDecks(decks);
  },

  /**
   * Supprime un deck localement, puis sync la suppression vers le cloud.
   * @param {string} id
   */
  deleteDeck(id) {
    LocalStorage.deleteDeck(id);
    if (AuthService.isLoggedIn()) {
      SupabaseStorage.deleteDeck(id).catch(err => {
        console.warn('[StorageManager] deleteDeck cloud failed:', err.message);
        SyncQueue.enqueue('delete_deck', { id });
      });
    }
  },

  // ---- Synchronisation cloud ----

  /**
   * Synchronise un deck vers Supabase (fire-and-forget avec queue de retry).
   * @param {Object} deck
   * @private
   */
  _syncDeckToCloud(deck) {
    if (!AuthService.isLoggedIn()) return;
    SupabaseStorage.syncDeck(deck).catch(err => {
      console.warn('[StorageManager] syncDeck failed, queuing:', err.message);
      SyncQueue.enqueue('upsert_deck', deck);
    });
  },

  /**
   * Rejoue toutes les opérations en attente dans la file de sync.
   * Appelé au retour en ligne (`online` event) et au login.
   */
  async flushSyncQueue() {
    if (!AuthService.isLoggedIn()) return;
    const queue = SyncQueue.getAll();
    if (queue.length === 0) return;

    // console.log(`[StorageManager] Flushing ${queue.length} queued operation(s)…`); // LIGNE SUPPRIMÉE
    const failed = [];
    // ... le reste est inchangé

    for (const item of queue) {
      try {
        if (item.operation === 'upsert_deck') {
          // Re-lire la version locale la plus récente avant d'uploader
          const freshDeck = LocalStorage.getDeck(item.payload.id) ?? item.payload;
          await SupabaseStorage.syncDeck(freshDeck);
        } else if (item.operation === 'delete_deck') {
          await SupabaseStorage.deleteDeck(item.payload.id);
        }
      } catch (err) {
        console.warn('[StorageManager] Flush item failed:', err.message);
        failed.push(item);
      }
    }

    // Conserver uniquement les items qui ont échoué
    if (failed.length > 0) {
      localStorage.setItem('flashcards_sync_queue', JSON.stringify(failed));
    } else {
      SyncQueue.clear();
      console.log('[StorageManager] Sync queue flushed successfully.');
    }
  },

  /**
   * Synchronisation complète depuis le cloud.
   * Fusionne les decks cloud avec les decks locaux (Last-Write-Wins par updatedAt).
   * @returns {Promise<{merged: number, local: number, cloud: number}>}
   */
  async syncFromCloud() {
    if (!AuthService.isLoggedIn()) return null;

    // console.log('[StorageManager] Syncing from cloud…'); // LIGNE SUPPRIMÉE
    const cloudDecks = await SupabaseStorage.fetchAllDecks();
    // ...
    const localDecks = LocalStorage.getDecks();

    const result = this._mergeDecks(localDecks, cloudDecks);
    LocalStorage.saveDecks(result.decks);

    // Pousser vers le cloud les decks locaux jamais synchronisés
    for (const localDeck of localDecks) {
      const inCloud = cloudDecks.find(d => d.id === localDeck.id);
      if (!inCloud) {
        await SupabaseStorage.syncDeck(localDeck).catch(err => {
          console.warn('[StorageManager] Push local deck failed:', err.message);
        });
      }
    }

    console.log(`[StorageManager] Sync done — ${result.decks.length} deck(s).`);
    return { merged: result.decks.length, local: localDecks.length, cloud: cloudDecks.length };
  },

  /**
   * Fusionne decks locaux et cloud par Last-Write-Wins (updatedAt).
   * @private
   */
  _mergeDecks(local, cloud) {
    const byId = new Map(local.map(d => [d.id, d]));

    for (const cloudDeck of cloud) {
      const localDeck = byId.get(cloudDeck.id);
      const cloudTs   = new Date(cloudDeck.updated_at ?? 0).getTime();
      const localTs   = localDeck?.updatedAt ?? 0;

      if (!localDeck || cloudTs > localTs) {
        // Le cloud est plus récent — prendre la version cloud
        byId.set(cloudDeck.id, {
          ...cloudDeck,
          updatedAt: cloudTs
        });
      }
      // Sinon : le local est plus récent, on le conserve (il sera poussé par flushSyncQueue)
    }

    return { decks: Array.from(byId.values()) };
  }
};

// ============================================================
// Connexion aux événements réseau et auth
// ============================================================

// Retour en ligne → vider la file de sync
window.addEventListener('online', () => {
    // console.log('[StorageManager] Back online — flushing sync queue…'); // SUPPRIMÉ
    StorageManager.flushSyncQueue().catch(console.error);
});

// Connexion / déconnexion Supabase
AuthService.onChange(async (event) => {
  if (event === 'SIGNED_IN') {
    try {
      await StorageManager.flushSyncQueue();
      await StorageManager.syncFromCloud();
      // Notifier l'app principale pour un re-render
      window.dispatchEvent(new CustomEvent('shardcards:synced'));
    } catch (err) {
      console.error('[StorageManager] Sync on login failed:', err);
    }
  }
});
