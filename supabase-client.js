// ============================================================
// supabase-client.js – Utilise la version UMD chargée globalement
// ============================================================

const SUPABASE_URL = 'https://kwvdseqaljdwqbrjtarh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y2EXyAtUtiHgN5RDpofCpA_j_nCHiS1';

// La variable globale supabase est fournie par supabase-umd.js
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
      p_deck_id: deck.id,
      p_name: deck.name,
      p_tags: deck.tags || [],
      p_created_at: deck.createdAt || Date.now(),
      p_updated_at: deck.updatedAt || Date.now(),
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

    function dataURLtoBlob(dataurl) {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    }

    const blob = dataURLtoBlob(base64DataUrl);
    const mime = blob.type.split('/')[1] || 'jpeg';
    const path = `${userId}/${cardId}_${side}.${mime}`;
    const { error: uploadError } = await supabase.storage.from('card-images').upload(path, blob, { upsert: true, contentType: blob.type });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('card-images').getPublicUrl(path);
    return data.publicUrl;
  }
};
