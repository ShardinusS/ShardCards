// storage-manager.js - Async facade backed by IndexedDB
import { AuthService, SupabaseStorage } from './supabase-client.js';
import { DB } from './db.js';

export const StorageManager = {
  async init() {
    await DB.init();
  },

  async getDecks() {
    return DB.getDecks();
  },

  async getDeck(id) {
    return DB.getDeck(id);
  },

  async saveDeck(deck, options = {}) {
    const deckWithTs = { ...deck, updatedAt: Date.now() };
    await DB.saveDeck(deckWithTs);
    if (!options?.skipCloudSync) this._syncDeckToCloud(deckWithTs).catch(console.warn);
  },

  async saveDecks(decks) {
    for (const deck of decks) {
      // Sauvegarder localement sans forcer la synchronisation cloud (skipCloudSync)
      await DB.saveDeck({ ...deck, updatedAt: Date.now() }, { skipCloudSync: true });
    }
  },

  async deleteDeck(id) {
    await DB.deleteDeck(id);
    if (AuthService.isLoggedIn()) {
      try {
        await SupabaseStorage.deleteDeck(id);
      } catch (err) {
        console.warn('[StorageManager] deleteDeck cloud failed, queuing:', err.message);
        await DB.enqueueSync('delete_deck', { id });
      }
    }
  },

  _syncDeckToCloud(deck) {
    if (!AuthService.isLoggedIn()) return Promise.resolve();
    return SupabaseStorage.syncDeck(deck).catch((err) => {
      console.warn('[StorageManager] syncDeck failed, queuing:', err.message);
      return DB.enqueueSync('upsert_deck', deck);
    });
  },

  async flushSyncQueue() {
    if (!AuthService.isLoggedIn()) return;

    const queue = await DB.getSyncQueue();
    if (queue.length === 0) return;

    const failed = [];

    for (const item of queue) {
      try {
        if (item.operation === 'upsert_deck') {
          const freshDeck = await this.getDeck(item.payload.id);
          if (freshDeck) {
            await SupabaseStorage.syncDeck(freshDeck);
          }
        } else if (item.operation === 'delete_deck') {
          await SupabaseStorage.deleteDeck(item.payload.id);
        }
      } catch (err) {
        console.warn('[StorageManager] Flush item failed:', err.message);
        failed.push(item);
      }
    }

    await DB.clearSyncQueue();
    for (const f of failed) {
      await DB.enqueueSync(f.operation, f.payload);
    }

    if (failed.length === 0) {
      console.log('[StorageManager] Sync queue flushed successfully');
    }
  },

  async syncFromCloud() {
    if (!AuthService.isLoggedIn()) return null;

    const [cloudDecks, localDecks] = await Promise.all([
      SupabaseStorage.fetchAllDecks(),
      DB.getDecks()
    ]);

    const result = this._mergeDecks(localDecks, cloudDecks);
    // Fusion: sauvegarder localement sans déclencher de re-sync cloud (évite doublons)
    await this.saveDecks(result.decks);

    for (const localDeck of localDecks) {
      if (!cloudDecks.find((d) => d.id === localDeck.id)) {
        await SupabaseStorage.syncDeck(localDeck).catch(console.warn);
      }
    }

    return {
      merged: result.decks.length,
      local: localDecks.length,
      cloud: cloudDecks.length
    };
  },

  _mergeDecks(local, cloud) {
    const byId = new Map(local.map((d) => [d.id, { ...d, source: 'local' }]));

    for (const cloudDeck of cloud) {
      const localDeck = byId.get(cloudDeck.id);
      const cloudTs = new Date(cloudDeck.updated_at || cloudDeck.updatedAt || 0).getTime();
      const localTs = localDeck?.updatedAt || 0;

      if (!localDeck || cloudTs > localTs) {
        byId.set(cloudDeck.id, {
          ...cloudDeck,
          updatedAt: cloudTs,
          source: 'cloud'
        });
      }
    }

    const decks = Array.from(byId.values()).map(({ source, ...deck }) => deck);
    return { decks };
  },

  async getDueReminders() {
    return DB.getDueNotifications();
  },

  async getAllReminders() {
    return DB.getAllNotifications();
  },

  async scheduleReminder({ deckId, deckName, intervalMinutes, id = null }) {
    const now = Date.now();
    const notification = {
      id: id ? String(id) : `${deckId}_${now}`,
      deckId,
      deckName,
      intervalMinutes,
      nextNotification: now + intervalMinutes * 60000,
      lastNotification: null,
      createdAt: now
    };

    await DB.updateNotification(notification);
    return notification.id;
  },

  async cancelReminder(id) {
    await DB.deleteNotification(id);
  },

  async cancelDeckReminders(deckId) {
    const reminders = await DB.getAllNotifications();
    for (const r of reminders.filter((n) => n.deckId === deckId)) {
      await DB.deleteNotification(r.id);
    }
  }
};

window.addEventListener('online', () => {
  StorageManager.flushSyncQueue().catch(console.error);
});

AuthService.onChange(async (event) => {
  if (event === 'SIGNED_IN') {
    try {
      await StorageManager.flushSyncQueue();
      await StorageManager.syncFromCloud();
      window.dispatchEvent(new CustomEvent('shardcards:synced'));
    } catch (err) {
      console.error('[StorageManager] Sync on login failed:', err);
    }
  }
});

window.StorageManager = StorageManager;
