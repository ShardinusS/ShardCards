// deck-manager.js - Deck and card CRUD management
// Uses window.AppState for shared state

const MAX_CARD_TEXT = 1000;
const MAX_DECK_NAME = 100;
const { escapeHtml, safeImageUrl } = window.Utils || {};

export const DeckManager = {
  async renderDecks() {
    const store = window.AppState;
    const StorageManager = window.StorageManager;
    
    store.localDecks = await StorageManager.getDecks();
    const allDecks = store.localDecks;
    const decks = window.SearchSort?.filterDecksByTag?.(allDecks) || allDecks;
    const container = document.getElementById('decks-container');
    if (!container) return;

    if (decks.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${window.Icons?.getIcon?.('books', 64, 'var(--text-secondary)') || '📚'}</div>
        <div class="empty-state-text">${allDecks.length === 0 ? 'Aucun deck. Créez-en un !' : 'Aucun deck avec ce tag.'}</div>
      </div>`;
      return;
    }

    const now = Date.now();
    container.innerHTML = decks.map(deck => {
      if (!Array.isArray(deck.cards)) deck.cards = [];
      const due = deck.cards.filter(c => !c.nextReview || c.nextReview <= now).length;
      const total = deck.cards.length;
      const tagsHtml = deck.tags?.length ? `<div class="deck-tags">${deck.tags.map(t => `<span class="deck-tag">${escHtml(t)}</span>`).join('')}</div>` : '';
      return `<div class="deck-card" data-deck-id="${deck.id}" role="button" tabindex="0" aria-label="${escHtml(deck.name)}, ${total} carte${total !== 1 ? 's' : ''}${due > 0 ? `, ${due} à réviser` : ''}">
        <div class="deck-actions">
          <button class="deck-action-btn" data-deck-id="${deck.id}" data-action="delete" title="Supprimer">${window.Icons?.getIcon?.('delete', 16) || '×'}</button>
          <button class="deck-action-btn" data-deck-id="${deck.id}" data-action="review" title="Réviser">${window.Icons?.getIcon?.('refresh', 16) || '↻'}</button>
        </div>
        <h3>${escHtml(deck.name)}</h3>
        ${tagsHtml}
        <div class="deck-info">
          <span>${total} carte${total !== 1 ? 's' : ''}</span>
          ${due > 0 ? `<span class="cards-due-badge">${due} à réviser</span>` : ''}
        </div>
      </div>`;
    }).join('');

    this.attachDeckListeners(container, false);
  },

  attachDeckListeners(container, isBase) {
    const store = window.AppState;
    const cleanupFns = store._cardCleanupFns || [];
    cleanupFns.forEach(fn => fn?.());
    store._cardCleanupFns = [];

    container.querySelectorAll('.deck-card').forEach(card => {
      const id = card.dataset.deckId;
      if (!id) return;

      // Long press
      if (window.addLongPress) {
        const cleanup = window.addLongPress(
          card,
          () => window.App.showDeckActionsModal?.(id, isBase),
          () => DeckManager.openDeck(id, isBase)
        );
        store._cardCleanupFns.push(cleanup);
      }

      // Context menu (right click)
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.App?.showDeckActionsModal?.(id, isBase);
      });

      // Keyboard navigation
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          DeckManager.openDeck(id, isBase);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!isBase) {
            e.preventDefault();
            window.App?.showDeckActionsModal?.(id, isBase);
          }
        }
      });

      // Action buttons
      card.querySelectorAll('.deck-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === 'delete') {
            window.App?.showDeckActionsModal?.(id, isBase);
          } else if (action === 'review') {
            window.ReviewSession?.start?.(id);
          }
        });
      });
    });
  },

  async renderBaseDecks() {
    const store = window.AppState;
    const container = document.getElementById('base-decks-grid');
    if (!container) return;

    store.baseDecks = store.baseDecksData || [];
    const now = Date.now();

    container.innerHTML = store.baseDecks.map(deck => {
      const total = deck.cards.length;
      const scores = JSON.parse(localStorage.getItem(`baseDeckScores_${deck.id}`) || '{}');
      const due = Object.keys(scores).length > 0
        ? Object.values(scores).filter(s => !s.nextReview || s.nextReview <= now).length
        : total;
      return `<div class="deck-card" data-deck-id="${deck.id}" data-is-base="true" role="button" tabindex="0" aria-label="${escHtml(deck.name)}, ${total} carte${total !== 1 ? 's' : ''}${due > 0 ? `, ${due} à réviser` : ''}">
        <div class="deck-actions">
          <button class="deck-action-btn" data-deck-id="${deck.id}" data-action="review" title="Réviser">${window.Icons?.getIcon?.('refresh', 16) || '↻'}</button>
        </div>
        <h3>${escHtml(deck.name)}</h3>
        <div class="deck-info">
          <span>${total} carte${total !== 1 ? 's' : ''}</span>
          ${due > 0 ? `<span class="cards-due-badge">${due} à réviser</span>` : ''}
        </div>
      </div>`;
    }).join('');

    this.attachDeckListeners(container, true);
  },

  async renderCards() {
    const store = window.AppState;
    const deck = store.getCurrentDeck();
    if (!deck) return;

    const container = document.getElementById('cards-container');
    if (!container) return;

    if (!deck.cards?.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">${window.Icons?.getIcon?.('cards', 64, 'var(--text-secondary)') || '🃏'}</div>
        <div class="empty-state-text">Aucune carte. Ajoutez-en une !</div>
      </div>`;
      return;
    }

    const filtered = window.SearchSort?.filterAndSortCards?.(deck.cards) || deck.cards;
    container.innerHTML = filtered.map((card, idx) => {
      const frontImg = safeImageUrl(card.frontImage);
      const backImg = safeImageUrl(card.backImage);
      const frontText = escHtml(card.front);
      const backText = escHtml(card.back);
      const score = card.cardScore ?? 0;
      const color = window.ColorZones?.getCardColor?.(score) || '#4CAF50';

      return `<div class="card-item" data-card-id="${card.id}" data-index="${idx}" role="button" tabindex="0">
        <div class="card-content">
          ${frontImg ? `<img src="${frontImg}" alt="Recto" class="card-thumb">` : (frontText ? `<div class="card-text">${frontText.substring(0, 50)}</div>` : '')}
          ${backImg ? `<img src="${backImg}" alt="Verso" class="card-thumb">` : (backText ? `<div class="card-text">${backText.substring(0, 50)}</div>` : '')}
        </div>
        <div class="card-score" style="background:${color}"></div>
      </div>`;
    }).join('');

    this.attachCardListeners(container, filtered);
  },

  attachCardListeners(container, filteredCards) {
    container.querySelectorAll('.card-item').forEach(cardEl => {
      const cardId = cardEl.dataset.cardId;
      const idx = parseInt(cardEl.dataset.index);
      if (!cardId) return;

      const showEdit = () => window.App?.showEditCardModal?.(cardId, idx);
      cardEl.addEventListener('click', showEdit);
      cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showEdit();
        }
      });
      cardEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showEdit();
      });
    });
  },

  async openDeck(deckId, isBase = false) {
    const store = window.AppState;
    if (!deckId) { window.UI.showToast('Aucun deck sélectionné.', 'error'); return; }

    store.currentDeckId = deckId;
    store.currentIsBaseDeck = isBase;
    const addCardBtn = document.getElementById('add-card-btn');
    if (addCardBtn) addCardBtn.style.display = isBase ? 'none' : 'flex';

    window.UI.showDeckDetailView(deckId);
    this.renderCards();
  },

  async addDeck(name, tags = []) {
    if (!name) { window.UI.showToast('Veuillez entrer un nom.', 'error'); return; }
    if (name.length > MAX_DECK_NAME) { window.UI.showToast(`Nom trop long (max ${MAX_DECK_NAME} caractères).`, 'error'); return; }

    const store = window.AppState;
    const StorageManager = window.StorageManager;
    
    const newDeck = {
      id: crypto.randomUUID(),
      name: name.trim(),
      cards: [],
      tags: tags.filter(t => t.trim()),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await StorageManager.saveDeck(newDeck);
    window.UI.showToast('Deck créé avec succès', 'success');
    await this.renderDecks();
    window.SearchSort?.renderTagsFilter?.();
  },

  async updateDeck(id, name, tags = []) {
    const store = window.AppState;
    const StorageManager = window.StorageManager;
    
    if (!store.currentDeckId || store.currentIsBaseDeck) { window.UI.showToast('Non modifiable.', 'error'); return; }
    if (!name) { window.UI.showToast('Nom requis.', 'error'); return; }

    const deck = store.getDeck(id);
    if (!deck) { window.UI.showToast('Deck introuvable.', 'error'); return; }

    deck.name = name.trim();
    deck.tags = tags.filter(t => t.trim());
    deck.updatedAt = Date.now();

    await StorageManager.saveDeck(deck);
    window.UI.showToast('Deck modifié', 'success');
    await this.renderDecks();
    window.SearchSort?.renderTagsFilter?.();
  },

  async deleteDeck(id) {
    const store = window.AppState;
    const StorageManager = window.StorageManager;
    
    if (store.baseDecks?.find(d => d.id === id)) { window.UI.showToast('Les decks de base ne sont pas supprimables.', 'error'); return; }

    await StorageManager.deleteDeck(id);
    window.UI.showToast('Deck supprimé', 'success');
    window.UI.showView('decks');
    await this.renderDecks();
    window.SearchSort?.renderTagsFilter?.();
  },

  async addCard(front, back, frontImage, backImage) {
    const store = window.AppState;
    const fi = safeImageUrl(frontImage);
    const bi = safeImageUrl(backImage);
    if (!front && !fi) { window.UI.showToast('Recto requis (texte ou image).', 'error'); return; }
    if (!back && !bi) { window.UI.showToast('Verso requis (texte ou image).', 'error'); return; }

    if (front?.length > MAX_CARD_TEXT) { window.UI.showToast(`Texte trop long (max ${MAX_CARD_TEXT} caractères).`, 'error'); return; }
    if (back?.length > MAX_CARD_TEXT) { window.UI.showToast(`Texte trop long (max ${MAX_CARD_TEXT} caractères).`, 'error'); return; }

    const deck = store.getCurrentDeck();
    if (!deck) return;

    const newCard = {
      id: crypto.randomUUID(),
      front: front?.trim() || '',
      back: back?.trim() || '',
      frontImage: fi || null,
      backImage: bi || null,
      createdAt: Date.now()
    };

    deck.cards.push(newCard);
    deck.updatedAt = Date.now();

    store.savePendingDeck(deck);
    window.UI.showToast('Carte créée', 'success');
    this.renderCards();
  },

  async updateCard(cardId, front, back, frontImage, backImage) {
    const store = window.AppState;
    const deck = store.getCurrentDeck();
    if (!deck) return;

    const cardIndex = deck.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const fi = safeImageUrl(frontImage);
    const bi = safeImageUrl(backImage);
    if (!front && !fi) { window.UI.showToast('Recto requis.', 'error'); return; }
    if (!back && !bi) { window.UI.showToast('Verso requis.', 'error'); return; }

    if (front?.length > MAX_CARD_TEXT) { window.UI.showToast(`Texte trop long (max ${MAX_CARD_TEXT} caractères).`, 'error'); return; }
    if (back?.length > MAX_CARD_TEXT) { window.UI.showToast(`Texte trop long (max ${MAX_CARD_TEXT} caractères).`, 'error'); return; }

    deck.cards[cardIndex] = {
      ...deck.cards[cardIndex],
      front: front?.trim() || '',
      back: back?.trim() || '',
      frontImage: fi || deck.cards[cardIndex].frontImage,
      backImage: bi || deck.cards[cardIndex].backImage,
      updatedAt: Date.now()
    };
    deck.updatedAt = Date.now();

    store.savePendingDeck(deck);
    window.UI.showToast('Carte modifiée', 'success');
    this.renderCards();
  },

  async deleteCard(index) {
    const store = window.AppState;
    const deck = store.getCurrentDeck();
    if (!deck || !deck.cards[index]) return;

    deck.cards.splice(index, 1);
    deck.updatedAt = Date.now();

    store.savePendingDeck(deck);
    window.UI.showToast('Carte supprimée', 'success');
    this.renderCards();
  },

  async exportDeck() {
    const store = window.AppState;
    if (!store.currentDeckId || store.currentIsBaseDeck) { window.UI.showToast('Non exportable.', 'error'); return; }

    const deck = store.getCurrentDeck();
    if (!deck) return;

    const data = {
      name: deck.name,
      cards: deck.cards.map(c => ({
        front: c.front,
        back: c.back,
        frontImage: c.frontImage,
        backImage: c.backImage
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importDeck(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.name || !Array.isArray(data.cards)) { window.UI.showToast('Format invalide.', 'error'); return; }

      const StorageManager = window.StorageManager;
      const newDeck = {
        id: crypto.randomUUID(),
        name: data.name,
        cards: data.cards.map(c => ({
          id: crypto.randomUUID(),
          front: c.front || '',
          back: c.back || '',
          frontImage: c.frontImage || null,
          backImage: c.backImage || null,
          createdAt: Date.now()
        })),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await StorageManager.saveDeck(newDeck);
      window.UI.showToast(`Deck "${data.name}" importé !`, 'success');
      await this.renderDecks();
    } catch { window.UI.showToast("Erreur d'importation.", 'error'); }
  }
};

const safeImageUrl = window.Utils?.safeImageUrl || ((url) => {
  if (typeof url !== 'string') return '';
  const t = url.trim();
  if (t.startsWith('data:image/')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return '';
});
const escHtml = window.Utils?.escapeHtml || ((text) => {
  if (text == null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
});

window.DeckManager = DeckManager;