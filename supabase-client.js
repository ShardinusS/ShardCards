import { createClient } from './supabase-js.js';

const SUPABASE_URL = 'https://kwvdseqaljdwqbrjtarh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y2EXyAtUtiHgN5RDpofCpA_j_nCHiS1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const AuthService = {
  currentUser: null,
  _listeners: [],

  init() {
    supabase.auth.onAuthStateChange((event, session) => {
      const prevUser = this.currentUser;
      this.currentUser = session?.user ?? null;
      this._listeners.forEach(cb => cb(event, this.currentUser, prevUser));
    });
    supabase.auth.getSession().then(({ data }) => {
      this.currentUser = data.session?.user ?? null;
    });
  },

  onChange(callback) {
    this._listeners.push(callback);
    return () => { this._listeners = this._listeners.filter(cb => cb !== callback); };
  },

  isLoggedIn() { return this.currentUser !== null; },

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  async signInWithMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/index.html`
    });
    if (error) throw error;
  },

  getUserId() { return this.currentUser?.id ?? null; },
  getUserEmail() { return this.currentUser?.email ?? null; }
};

export const SupabaseStorage = {
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

  async deleteDeck(deckId) {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');
    const { error } = await supabase.from('decks').delete().eq('id', deckId).eq('user_id', AuthService.getUserId());
    if (error) throw error;
  },

  async fetchAllDecks() {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');
    const { data, error } = await supabase.rpc('get_all_decks_with_cards');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async uploadImage(base64DataUrl, cardId, side) {
    if (!AuthService.isLoggedIn()) throw new Error('Not authenticated');
    if (!base64DataUrl?.startsWith('data:image')) return base64DataUrl;
    const userId = AuthService.getUserId();
    const blob   = await fetch(base64DataUrl).then(r => r.blob());
    const path   = `${userId}/${cardId}_${side}.jpg`;
    const { error: uploadError } = await supabase.storage.from('card-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('card-images').getPublicUrl(path);
    return data.publicUrl;
  }
};