// review.js - SM-2 algorithm and review session management
// Uses store (window.AppState) for state

export const SM2 = {
  calculateNextReview(card, quality) {
    const now = Date.now();
    card.easeFactor  ??= 2.5;
    card.interval ??= 1;
    card.repetitions ??= 0;
    card.againCount ??= 0;
    card.cardScore ??= 0;

    if (quality === 0) {
      card.againCount++;
      card.cardScore = Math.max(0, card.cardScore - 10);
      card.interval = 1;
      card.repetitions = 0;
    } else {
      card.cardScore += quality === 1 ? 5 : 20;
      card.easeFactor = Math.max(1.3, card.easeFactor + (quality === 1 ? -0.15 : 0.15));
      card.repetitions++;

      if (card.repetitions === 1) card.interval = 1;
      else if (card.repetitions === 2) card.interval = 6;
      else card.interval = Math.round(card.interval * card.easeFactor);
    }

    card.nextReview = now + card.interval * 86_400_000;
    card.lastReview = now;
    return card;
  },

  getCardsToReview(deck, limit = null) {
    const now = Date.now();
    if (!deck?.cards?.length) return [];

    const scored = deck.cards.map(card => {
      const score = card.cardScore ?? 0;
      const isDue = !card.nextReview || card.nextReview <= now;
      const daysSince = card.lastReview ? Math.floor((now - card.lastReview) / 86_400_000) : 999;
      return { card, finalScore: score - (isDue ? 5 : 0) + Math.min(daysSince, 30) };
    });

    scored.sort((a, b) => a.finalScore - b.finalScore);
    const result = scored.map(s => s.card);
    return limit ? result.slice(0, limit) : result;
  }
};

export const ColorZones = {
  getCardColor(score) {
    if (score < 10) return '#F44336';
    if (score < 20) return '#FF9800';
    if (score < 30) return '#FFC107';
    return '#4CAF50';
  },

  getZoneName(score) {
    if (score < 10) return 'Très difficile';
    if (score < 20) return 'Difficile';
    if (score < 30) return 'Moyen';
    return 'Facile';
  }
};

export const ReviewSession = {
  cards: [],
  currentIndex: 0,
  isRevealed: false,
  reviewed: 0,
  ratings: [],

  start(deckId, cardsPerSession = 10) {
    const store = window.AppState;
    const deck = store.getDeck(deckId);
    if (!deck) {
      window.UI.showToast('Deck introuvable.', 'error');
      window.UI.showDecksView();
      return;
    }

    const cards = SM2.getCardsToReview(deck, cardsPerSession);
    if (cards.length === 0) {
      window.UI.showToast('Aucune carte à réviser !', 'info');
      return;
    }

    this.cards = cards;
    this.currentIndex = 0;
    this.isRevealed = false;
    this.reviewed = 0;
    this.ratings = [];

    store.reviewCards = cards;
    store.currentReviewIndex = 0;
    store.isRevealed = false;
    window.UI.showReviewView();
  },

  renderCardContent(text, image) {
    const img = safeImageUrl(image);
    const txt = escapeHtml(text);
    if (img) return `<img src="${img}" alt="Carte" class="card-image">`;
    return txt ? `<div class="card-text">${txt}</div>` : '';
  },

  showCard() {
    if (this.currentIndex >= this.cards.length) {
      this.complete();
      return;
    }

    const card = this.cards[this.currentIndex];
    const frontEl = document.getElementById('front-content');
    const backEl = document.getElementById('back-content');
    const cardEl = document.querySelector('.review-card');

    if (frontEl) frontEl.innerHTML = this.renderCardContent(card.front, card.frontImage);
    if (backEl) backEl.innerHTML = this.renderCardContent(card.back, card.backImage);

    if (cardEl) {
      cardEl.classList.remove('flipped');
      cardEl.style.transform = '';
    }

    this.isRevealed = false;
    window.AppState.isRevealed = false;

    this.updateProgress();
  },

  reveal() {
    const cardEl = document.querySelector('.review-card');
    if (!cardEl) return;

    this.isRevealed = true;
    window.AppState.isRevealed = true;
    cardEl.classList.add('flipped');

    const bc = document.getElementById('review-buttons');
    if (bc) bc.style.visibility = 'hidden';
  },

  rateCard(quality) {
    const store = window.AppState;
    const card = this.cards[this.currentIndex];
    if (!card) return;

    SM2.calculateNextReview(card, quality);
    this.ratings.push(quality);
    this.reviewed++;

    const deck = store.getCurrentDeck();
    if (deck && !deck.id.startsWith('base-')) {
      const idx = deck.cards.findIndex(c => c.id === card.id);
      if (idx !== -1) deck.cards[idx] = card;
      store.savePendingDeck(deck);
    }

    this.nextCard();
  },

  nextCard() {
    this.currentIndex++;
    if (this.currentIndex >= this.cards.length) {
      this.complete();
    } else {
      const cardEl = document.querySelector('.review-card');
      if (cardEl) {
        cardEl.style.opacity = '0';
        setTimeout(() => {
          this.showCard();
          if (cardEl) cardEl.style.opacity = '';
        }, 200);
      } else {
        this.showCard();
      }
    }
  },

  complete() {
    const stats = {
      total: this.cards.length,
      again: this.ratings.filter(r => r === 0).length,
      good: this.ratings.filter(r => r === 1).length,
      easy: this.ratings.filter(r => r === 2).length
    };

    const content = `
      <div class="review-complete">
        <h2>Révision terminée !</h2>
        <div class="review-stats">
          <div class="stat-item">
            <span class="stat-num">${stats.total}</span>
            <span class="stat-label">cartes révisées</span>
          </div>
          <div class="stat-item again">
            <span class="stat-num">${stats.again}</span>
            <span class="stat-label">Encore</span>
          </div>
          <div class="stat-item good">
            <span class="stat-num">${stats.good}</span>
            <span class="stat-label">Bien</span>
          </div>
          <div class="stat-item easy">
            <span class="stat-num">${stats.easy}</span>
            <span class="stat-label">Facile</span>
          </div>
        </div>
        <div class="review-complete-actions">
          <button class="btn secondary" id="review-complete-back-btn">Retour au deck</button>
          <button class="btn primary" id="review-complete-again-btn">Réviser encore</button>
        </div>
      </div>
    `;

    window.UI.showModalWithContent('Résumé', content);

    document.getElementById('review-complete-back-btn')?.addEventListener('click', () => {
      window.UI.hideModal();
      window.DeckManager.renderCards();
    });
    document.getElementById('review-complete-again-btn')?.addEventListener('click', () => {
      window.UI.hideModal();
      ReviewSession.start(window.AppState.currentDeckId, window.AppState.cardsPerSession);
    });
  },

  updateProgress() {
    const progressEl = document.getElementById('review-progress');
    if (progressEl) {
      const pct = this.cards.length > 0 ? Math.round((this.currentIndex / this.cards.length) * 100) : 0;
      progressEl.textContent = `${this.currentIndex + 1} / ${this.cards.length}`;
    }
  },

  setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (window.AppState.currentView !== 'review') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!this.isRevealed) this.reveal();
      } else if (e.key === '1' && this.isRevealed) {
        this.rateCard(0);
      } else if (e.key === '2' && this.isRevealed) {
        this.rateCard(1);
      } else if (e.key === '3' && this.isRevealed) {
        this.rateCard(2);
      } else if (e.key === 'Escape') {
        window.UI.hideModal();
      }
    });
  }
};

const escHtml = window.Utils?.escapeHtml || ((text) => {
  if (text == null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
});

const safeImageUrl = window.Utils?.safeImageUrl || ((url) => {
  if (typeof url !== 'string') return '';
  const t = url.trim();
  if (t.startsWith('data:image/')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return '';
});

window.SM2 = SM2;
window.ColorZones = ColorZones;
window.ReviewSession = ReviewSession;