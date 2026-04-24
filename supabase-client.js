// ============================================================
// supabase-client.js — Client Supabase + Service d'authentification
// ============================================================
// ⚙️  CONFIGURATION : remplacez les deux constantes ci-dessous
//     Supabase Dashboard > Settings > API
// ============================================================

const SUPABASE_URL = 'https://kwvdseqaljdwqbrjtarh.supabase.co';   // ← À remplacer
const SUPABASE_ANON_KEY = 'sb_publishable_y2EXyAtUtiHgN5RDpofCpA_j_nCHiS1';        // ← À remplacer

// ============================================================
// Chargement du SDK Supabase (CDN — compatible PWA offline via SW cache)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Client singleton — partagé dans toute l'application
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,       // Session persistée dans localStorage
    detectSessionInUrl: true    // Gère les magic links / OAuth callbacks
  }
});

// ============================================================
// AuthService — façade d'authentification
// ============================================================
export const AuthService = {

  /** Utilisateur actuellement connecté (null si non authentifié) */
  currentUser: null,

  /** Callbacks enregistrés sur le changement d'état d'auth */
  _listeners: [],

  /**
   * Initialise l'écoute des changements d'authentification.
   * À appeler UNE SEULE FOIS au démarrage de l'application.
   */
  init() {
    supabase.auth.onAuthStateChange((event, session) => {
      const prevUser = this.currentUser;
      this.currentUser = session?.user ?? null;

      console.log(`[Auth] ${event} — user: ${this.currentUser?.email ?? 'none'}`);

      // Notifier tous les listeners
      this._listeners.forEach(cb => cb(event, this.currentUser, prevUser));
    });

    // Charger la session existante immédiatement
    supabase.auth.getSession().then(({ data }) => {
      this.currentUser = data.session?.user ?? null;
    });
  },

  /**
   * Enregistre un callback appelé à chaque changement d'état d'auth.
   * @param {Function} callback (event, newUser, prevUser) => void
   * @returns {Function} unsubscribe
   */
  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  },

  /** @returns {boolean} */
  isLoggedIn() {
    return this.currentUser !== null;
  },

  /**
   * Inscription avec email + mot de passe
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user, error}>}
   */
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  },

  /**
   * Connexion avec email + mot de passe
   * @param {string} email
   * @param {string} password
   * @returns {Promise<User>}
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  /**
   * Connexion par magic link (email)
   * @param {string} email
   */
  async signInWithMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  },

  /** Déconnexion */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
  },

  /** Réinitialiser le mot de passe */
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/index.html`
    });
    if (error) throw error;
  },

  /** Retourne l'ID de l'utilisateur courant */
  getUserId() {
    return this.currentUser?.id ?? null;
  },

  /** Retourne l'email de l'utilisateur courant */
  getUserEmail() {
    return this.currentUser?.email ?? null;
  }
};

// ============================================================
// SupabaseStorage — opérations cloud sur decks et cartes
// ============================================================
export const SupabaseStorage = {

  /**
   * Synchronise un deck complet (deck + toutes ses cartes) vers Supabase.
   * Utilise la RPC `sync_deck_with_cards` pour un upsert atomique.
   * @param {Object} deck — format localStorage
   */
  async syncDeck(deck) {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');

    const cardsWithIds = deck.cards.map((card, index) => ({
      ...card,
      id: card.id ?? `${deck.id}_${index}`
    }));

    const { data, error } = await supabase.rpc('sync_deck_with_cards', {
      p_deck:  deck,
      p_cards: cardsWithIds
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? 'Sync RPC failed');
    return data;
  },

  /**
   * Supprime un deck (et ses cartes via CASCADE) dans Supabase.
   * @param {string} deckId
   */
  async deleteDeck(deckId) {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId)
      .eq('user_id', AuthService.getUserId());
    if (error) throw error;
  },

  /**
   * Récupère tous les decks (avec leurs cartes) depuis Supabase.
   * @returns {Promise<Array>} — format identique à localStorage
   */
  async fetchAllDecks() {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_all_decks_with_cards');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Upload une image vers Supabase Storage.
   * @param {string} base64DataUrl
   * @param {string} cardId
   * @param {string} side  — 'front' | 'back'
   * @returns {Promise<string>} URL publique
   */
  async uploadImage(base64DataUrl, cardId, side) {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');
    if (!base64DataUrl?.startsWith('data:image')) return base64DataUrl;

    const userId = AuthService.getUserId();
    const blob   = await fetch(base64DataUrl).then(r => r.blob());
    const path   = `${userId}/${cardId}_${side}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('card-images').getPublicUrl(path);
    return data.publicUrl;
  }
};
