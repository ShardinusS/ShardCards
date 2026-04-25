// store.js - Centralized state management
export const store = {
  currentDeckId: null,
  currentIsBaseDeck: false,
  baseDecks: [],
  currentView: 'decks',
  isGridView: true,
  reviewCards: [],
  currentReviewIndex: 0,
  isRevealed: false,
  cardsPerSession: 10,
  isReversedMode: false,
  currentSearchQuery: '',
  currentSortOption: 'default',
  currentTagFilter: 'all',
  currentMenuActions: [],
  localDecks: [],
  _cardCleanupFns: [],
  _modalKeydownHandlers: [],
  _pendingSaveTimer: null,
  _editingCardIndex: null,
  baseDecksData: [],
  isDarkMode: false,

  // Getters
  getCurrentDeck() {
    if (!this.currentDeckId) return null;
    if (this.currentIsBaseDeck) {
      return this.baseDecks.find(d => d.id === this.currentDeckId);
    }
    return this.localDecks.find(d => d.id === this.currentDeckId);
  },

  getDeck(deckId, isBase = false) {
    if (isBase) {
      return this.baseDecks.find(d => d.id === deckId);
    }
    return this.localDecks.find(d => d.id === deckId);
  },

  // Setters
  setCurrentDeckId(id) { this.currentDeckId = id; },
  setCurrentView(view) { this.currentView = view; },
  setDarkMode(value) { this.isDarkMode = value; },

  // Actions
  savePendingDeck(deck) {
    if (this._pendingSaveTimer) clearTimeout(this._pendingSaveTimer);
    this._pendingSaveTimer = setTimeout(async () => {
      const { StorageManager } = window;
      if (StorageManager) {
        await StorageManager.saveDeck(deck);
      }
    }, 500);
  },

  flushPendingSave() {
    if (this._pendingSaveTimer) {
      clearTimeout(this._pendingSaveTimer);
      this._pendingSaveTimer = null;
      document.dispatchEvent(new Event('flush-pending-save'));
    }
  },

  setBaseDecksData(data) {
    this.baseDecksData = data;
    this.baseDecks = data;
  },

  // Subscribe for reactivity (optional simple pub/sub)
  _listeners: new Map(),

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  },

  emit(event, data) {
    const callbacks = this._listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
};

window.AppState = store;