// ============================================================
// script.js — ShardCards (ES Module, refactorisé)
// ============================================================
import { StorageManager } from './storage-manager.js';
import { AuthService, SupabaseStorage } from './supabase-client.js';

// ============================================================
// UTILITAIRES
// ============================================================
function debounce(fn, delay = 250) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function addLongPress(el, onLongPress, onClick, delay = 500) {
  let timer = null, fired = false, startTime = 0;
  const start  = e => { fired = false; startTime = Date.now(); timer = setTimeout(() => { fired = true; e.preventDefault(); onLongPress(e); }, delay); };
  const end    = e => { clearTimeout(timer); timer = null; if (!fired && Date.now() - startTime < delay) setTimeout(() => { if (!fired) onClick(e); }, 50); fired = false; };
  const cancel = () => { clearTimeout(timer); timer = null; fired = false; };
  const noCtx  = e => e.preventDefault();
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', start); el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', cancel); el.addEventListener('contextmenu', noCtx);
  return () => {
    el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end);
    el.removeEventListener('touchcancel', cancel); el.removeEventListener('mousedown', start);
    el.removeEventListener('mouseup', end); el.removeEventListener('mouseleave', cancel);
    el.removeEventListener('contextmenu', noCtx);
  };
}

// ============================================================
// SYSTÈME D'ICÔNES SVG
// ============================================================
const Icons = {
  getIcon(name, size = 20, color = 'currentColor') {
    const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const icons = {
      menu:      `<svg ${s}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
      delete:    `<svg ${s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
      refresh:   `<svg ${s}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
      download:  `<svg ${s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      upload:    `<svg ${s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
      edit:      `<svg ${s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      chart:     `<svg ${s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      settings:  `<svg ${s}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      books:     `<svg ${s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      card:      `<svg ${s}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      success:   `<svg ${s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      help:      `<svg ${s}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      plus:      `<svg ${s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      arrowLeft: `<svg ${s}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
      arrowRight:`<svg ${s}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
      close:     `<svg ${s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      list:      `<svg ${s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
      grid:      `<svg ${s}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
      clock:     `<svg ${s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      bell:      `<svg ${s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      arrowDown: `<svg ${s}><polyline points="6 9 12 15 18 9"/></svg>`,
      moon:      `<svg ${s}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
      sun:       `<svg ${s}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
      user:      `<svg ${s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      logout:    `<svg ${s}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
      cloud:     `<svg ${s}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
      wifi:      `<svg ${s}><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`,
      zap:       `<svg ${s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      flame:     `<svg ${s}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
      target:    `<svg ${s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
      rocket:    `<svg ${s}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
      award:     `<svg ${s}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
      check:     `<svg ${s}><polyline points="20 6 9 17 4 12"/></svg>`,
      layers:    `<svg ${s}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
      volume:    `<svg ${s}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
      undo:      `<svg ${s}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
      pause:     `<svg ${s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
      play:      `<svg ${s}><polygon points="5 3 19 12 5 21 5 3"/></svg>`
    };
    return icons[name] ?? '';
  }
};

// ============================================================
// SCHEDULER — répétition espacée façon Anki
// 4 notes : 0=Encore, 1=Difficile, 2=Bien, 3=Facile
// + étapes d'apprentissage (sub-jour), rechute (lapse) et détection de "leech".
// Rétro-compatible avec l'ancien modèle SM-2 (easeFactor/interval/repetitions).
// ============================================================
const Scheduler = {
  LEARN_STEPS_MIN: [1, 10],   // étapes d'apprentissage en minutes
  GRADUATING_INTERVAL: 1,     // jours après graduation (Bien)
  EASY_INTERVAL: 4,           // jours après graduation directe (Facile)
  MIN_EASE: 1.3,
  LEECH_THRESHOLD: 8,         // nb de rechutes → carte mise en suspens
  DAY: 86_400_000,
  MIN: 60_000,

  _ensure(card) {
    card.easeFactor  ??= 2.5;
    card.interval    ??= 0;
    card.repetitions ??= 0;
    card.againCount  ??= 0;
    card.lapses      ??= 0;
    card.cardScore   ??= 0;
    card.learnStep   ??= 0;
    card.state       ??= (card.repetitions > 0 ? 'review' : 'new'); // new | learning | review
  },

  /**
   * Applique une note à une carte (mutation in place).
   * @returns {{reappear: boolean}} reappear = la carte doit réapparaître dans la session
   */
  answer(card, grade) {
    this._ensure(card);
    const now = Date.now();
    card.lastReview = now;
    card.updatedAt  = now;   // pour la fusion de sync (résolution de conflits par carte)
    let reappear = false;

    // ----- Phase apprentissage (new / learning) -----
    if (card.state === 'new' || card.state === 'learning') {
      const steps = this.LEARN_STEPS_MIN;
      if (grade === 0) {                       // Encore → retour étape 0
        card.againCount++;
        card.cardScore = Math.max(0, card.cardScore - 5);
        card.state = 'learning'; card.learnStep = 0; card.interval = 0;
        card.nextReview = now + steps[0] * this.MIN; reappear = true;
      } else if (grade === 1) {                // Difficile → reste sur l'étape
        card.state = 'learning';
        card.nextReview = now + steps[Math.min(card.learnStep, steps.length - 1)] * this.MIN;
        reappear = true;
      } else if (grade === 2) {                // Bien → étape suivante / graduation
        card.learnStep++;
        if (card.learnStep >= steps.length) {
          card.state = 'review'; card.repetitions = 1;
          card.interval = this.GRADUATING_INTERVAL;
          card.nextReview = now + card.interval * this.DAY;
          card.cardScore += 5;
        } else {
          card.state = 'learning';
          card.nextReview = now + steps[card.learnStep] * this.MIN; reappear = true;
        }
      } else {                                 // Facile → graduation immédiate
        card.state = 'review'; card.repetitions = 1;
        card.interval = this.EASY_INTERVAL;
        card.nextReview = now + card.interval * this.DAY;
        card.cardScore += 15;
      }
      return { reappear };
    }

    // ----- Phase révision (review) -----
    if (grade === 0) {                          // rechute
      card.againCount++; card.lapses++;
      card.repetitions = 0;
      card.easeFactor = Math.max(this.MIN_EASE, card.easeFactor - 0.2);
      card.cardScore = Math.max(0, card.cardScore - 10);
      card.state = 'learning'; card.learnStep = 0; card.interval = 0;
      card.nextReview = now + this.LEARN_STEPS_MIN[0] * this.MIN;
      reappear = true;
      if (card.lapses >= this.LEECH_THRESHOLD) {  // leech → suspens auto
        card.suspended = true; card.isLeech = true; reappear = false;
      }
    } else {
      card.repetitions++;
      const ease = card.easeFactor;
      const base = card.interval || 1;
      if (grade === 1) {                        // Difficile
        card.easeFactor = Math.max(this.MIN_EASE, ease - 0.15);
        card.interval = Math.max(1, Math.round(base * 1.2));
        card.cardScore += 3;
      } else if (grade === 2) {                 // Bien
        card.interval = Math.max(1, Math.round(base * ease));
        card.cardScore += 5;
      } else {                                  // Facile
        card.easeFactor = ease + 0.15;
        card.interval = Math.max(1, Math.round(base * ease * 1.3));
        card.cardScore += 15;
      }
      card.nextReview = now + card.interval * this.DAY;
    }
    return { reappear };
  },

  /** Aperçu (sans mutation) de l'intervalle pour une note donnée — affiché sur les boutons. */
  preview(card, grade) {
    const clone = JSON.parse(JSON.stringify(card));
    this.answer(clone, grade);
    if (clone.state === 'learning' || clone.state === 'new') {
      const min = Math.max(1, Math.round((clone.nextReview - Date.now()) / this.MIN));
      return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
    }
    return this._fmtDays(clone.interval);
  },
  _fmtDays(d) {
    if (d < 1)   return '<1 j';
    if (d < 30)  return `${d} j`;
    if (d < 365) return `${Math.round(d / 30)} mois`;
    return `${(d / 365).toFixed(1)} an`;
  },

  /** Compatibilité : ancienne signature à 3 notes (0/1/2). */
  calculateNextReview(card, quality) {
    // Remap : 0→Encore, 1→Bien, 2→Facile
    this.answer(card, quality === 0 ? 0 : quality === 1 ? 2 : 3);
    return card;
  },

  getCardsToReview(deck, limit = null) {
    const now = Date.now();
    const scored = deck.cards
      .filter(card => !card.suspended)
      .map(card => {
        const score     = card.cardScore ?? 0;
        const isDue     = !card.nextReview || card.nextReview <= now;
        const daysSince = card.lastReview ? Math.floor((now - card.lastReview) / 86_400_000) : 999;
        return { card, finalScore: score - (isDue ? 5 : 0) + Math.min(daysSince, 30) };
      });
    scored.sort((a, b) => a.finalScore - b.finalScore);
    const result = scored.map(s => s.card);
    return limit ? result.slice(0, limit) : result;
  }
};

// ============================================================
// ZONES DE COULEURS
// ============================================================
const ColorZones = {
  getCardColor(score) { if (score < 10) return '#F44336'; if (score < 20) return '#FF9800'; if (score < 30) return '#FFC107'; return '#4CAF50'; },
  getZoneName(score) { if (score < 10) return 'Très difficile'; if (score < 20) return 'Difficile'; if (score < 30) return 'Moyen'; return 'Facile'; }
};

// ============================================================
// CLOZE — texte à trous façon Anki : {{c1::réponse}} ou {{c1::réponse::indice}}
// v1 : toutes les occlusions sont masquées au recto, révélées au verso.
// L'entrée est échappée (escapeHtml) AVANT le remplacement → injection sûre.
// ============================================================
const Cloze = {
  RE: /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g,
  isCloze(card) { return card?.type === 'cloze'; },
  has(text)     { return /\{\{c\d+::/.test(text || ''); },
  front(escapedText) {
    return escapedText.replace(this.RE, (_, _content, hint) =>
      `<span class="cloze-blank">[${hint ? hint : '…'}]</span>`);
  },
  back(escapedText) {
    return escapedText.replace(this.RE, (_, content) =>
      `<span class="cloze-answer">${content}</span>`);
  }
};

// ============================================================
// APPLICATION PRINCIPALE
// ============================================================
const App = {
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
  _cardCleanupFns: [],
  _remindersSynced: false,
  _undoStack: [],
  ttsEnabled: false,

  // ---- Init ----
  async init() {
    this.cardsPerSession = parseInt(localStorage.getItem('flashcards_cardsPerSession') || '10') || 10;
    this.isReversedMode  = localStorage.getItem('flashcards_reversedMode') === 'true';
    const savedSort      = localStorage.getItem('flashcards_sortOption');
    if (savedSort) this.currentSortOption = savedSort;
    this._setupViewportSizing();
    this.initDarkMode();
    this.initIcons();
    this.initAuth();
    this.setupEventListeners();
    this.setupCardToolbar();
    this.renderDecks();
    this.renderTagsFilter();
    const addDeckBtn = document.getElementById('add-deck-btn');
    if (addDeckBtn) addDeckBtn.style.display = 'flex';
    this.registerServiceWorker();
    this.restoreReviewReminders();
    this.setupServiceWorkerMessageListener();
    this.checkFirstVisit();
    this.setupOnboarding();
    this.setupQuizBackBtn();
    window.addEventListener('shardcards:synced', () => {
      this.renderDecks();
      this.renderTagsFilter();
    });
    window.addEventListener('shardcards:quota-exceeded', () => {
      this.showToast('Espace de stockage plein. Supprimez des decks ou des images.', 'error');
    });
    // MathJax chargé en différé : re-typeset la vue active dès qu'il est prêt
    // (couvre le cas où on ouvre un deck/révision avant la fin du chargement).
    window.MathJax?.startup?.promise?.then(() => {
      const active = document.querySelector('.view.active');
      if (active) this.renderMath(active);
    });
  },

  // ---- Mode Sombre ----
  initDarkMode() {
    const saved = localStorage.getItem('flashcards_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // Default is light (no attribute = clean white/blue theme)
    this._updateThemeColor();
  },
  toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('flashcards_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('flashcards_theme', 'dark');
    }
    this._updateThemeColor();
    this.hideHamburgerMenu();
  },
  _updateThemeColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const meta   = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark ? '#0b1220' : '#f4f8ff';
  },
  isDarkMode() { return document.documentElement.getAttribute('data-theme') === 'dark'; },

  // ---- Auth ----
  initAuth() {
    AuthService.init();
    // Le 1er événement émis par Supabase correspond à la restauration de session
    // (au chargement de la page) : on ne doit PAS afficher de toast dans ce cas.
    let isInitialAuthEvent = true;
    AuthService.onChange((event, user, prevUser) => {
      this._updateAuthUI(user);
      const initial = isInitialAuthEvent;
      isInitialAuthEvent = false;
      // Toast uniquement sur une vraie connexion (transition déconnecté → connecté),
      // pas à la restauration de session ni au rafraîchissement de token (prevUser déjà présent).
      if (event === 'SIGNED_IN' && !prevUser && !initial) {
        this.showToast('Connecté', 'success');
      } else if (event === 'SIGNED_OUT' && prevUser) {
        this.showToast('Déconnecté', 'info');
        this.renderDecks();
      }
    });
    this._updateAuthUI(AuthService.currentUser);
  },

  _updateAuthUI(user) {
    // Indicateur online/cloud dans le header
    let indicator = document.getElementById('auth-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = 'auth-indicator';
      indicator.className = 'auth-indicator';
      document.querySelector('#decks-view header .header-actions')?.prepend(indicator);
    }
    if (user) {
      indicator.innerHTML = Icons.getIcon('cloud', 18, 'currentColor');
      indicator.title = `Connecté : ${user.email}`;
      indicator.classList.add('connected');
    } else {
      indicator.innerHTML = '';
      indicator.title = '';
      indicator.classList.remove('connected');
    }
  },

  showAuthModal() {
    const isLogged = AuthService.isLoggedIn();

    if (isLogged) {
      // Afficher options déconnexion
      const content = `
        <div style="text-align:center; padding: 10px 0;">
          <div style="margin-bottom: 16px;">${Icons.getIcon('user', 48, 'var(--primary-color)')}</div>
          <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;"><strong>${escapeHtml(AuthService.getUserEmail())}</strong></p>
          <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">Compte synchronisé</p>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <button id="auth-sync-btn" class="btn btn-primary btn-with-icon">
              ${Icons.getIcon('cloud', 20, 'white')} <span>Synchroniser maintenant</span>
            </button>
            <button id="auth-logout-btn" class="btn btn-secondary btn-with-icon">
              ${Icons.getIcon('logout', 20, 'currentColor')} <span>Se déconnecter</span>
            </button>
          </div>
        </div>`;
      this.showModalWithContent('Mon compte', content);
      requestAnimationFrame(() => {
        document.getElementById('auth-sync-btn')?.addEventListener('click', async () => {
          this.hideModal();
          this.showToast('Synchronisation en cours…', 'info');
          try {
            await StorageManager.flushSyncQueue();
            await StorageManager.syncFromCloud();
            this.renderDecks();
            this.showToast('Synchronisation terminée', 'success');
          } catch (e) {
            this.showToast('Erreur de synchronisation', 'error');
          }
        });
        document.getElementById('auth-logout-btn')?.addEventListener('click', async () => {
          this.hideModal();
          await AuthService.signOut();
        });
      });
      return;
    }

    // Formulaire connexion / inscription
    const content = `
      <div id="auth-tabs" style="display:flex; gap:8px; margin-bottom:20px;">
        <button id="tab-signin" class="btn btn-primary" style="flex:1">Connexion</button>
        <button id="tab-signup" class="btn btn-secondary" style="flex:1">Inscription</button>
      </div>
      <form id="auth-form">
        <div class="form-group">
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" required placeholder="votre@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label for="auth-password">Mot de passe</label>
          <input type="password" id="auth-password" required placeholder="••••••••" autocomplete="current-password">
        </div>
        <div id="auth-error" style="color:var(--error);font-size:14px;margin-bottom:8px;display:none;"></div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="auth-cancel-btn">Annuler</button>
          <button type="submit" class="btn btn-primary" id="auth-submit-btn">Se connecter</button>
        </div>
      </form>
      <p style="text-align:center;margin-top:12px;font-size:13px;color:var(--text-secondary);">
        <a href="#" id="auth-reset-link" style="color:var(--primary-color)">Mot de passe oublié ?</a>
      </p>`;

    this.showModalWithContent('Connexion / Inscription', content);

    requestAnimationFrame(() => {
      let mode = 'signin';
      const form       = document.getElementById('auth-form');
      const submitBtn  = document.getElementById('auth-submit-btn');
      const errorEl    = document.getElementById('auth-error');
      const tabSignin  = document.getElementById('tab-signin');
      const tabSignup  = document.getElementById('tab-signup');

      const setMode = m => {
        mode = m;
        submitBtn.textContent = m === 'signin' ? 'Se connecter' : "S'inscrire";
        tabSignin.className = m === 'signin' ? 'btn btn-primary' : 'btn btn-secondary';
        tabSignup.className = m === 'signup' ? 'btn btn-primary' : 'btn btn-secondary';
      };

      tabSignin.addEventListener('click', () => setMode('signin'));
      tabSignup.addEventListener('click', () => setMode('signup'));
      document.getElementById('auth-cancel-btn')?.addEventListener('click', () => this.hideModal());
      document.getElementById('auth-reset-link')?.addEventListener('click', async e => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        if (!email) { errorEl.textContent = 'Entrez votre email.'; errorEl.style.display = 'block'; return; }
        try { await AuthService.resetPassword(email); this.hideModal(); this.showToast('Email de réinitialisation envoyé', 'success'); }
        catch (e) { errorEl.textContent = e.message; errorEl.style.display = 'block'; }
      });

      form.addEventListener('submit', async e => {
        e.preventDefault();
        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Chargement…';
        const email    = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        try {
          if (mode === 'signin') await AuthService.signIn(email, password);
          else                   await AuthService.signUp(email, password);
          this.hideModal();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.style.display = 'block';
          submitBtn.disabled = false;
          setMode(mode);
        }
      });
    });
  },

  // ---- Icônes statiques ----

  initIcons() {
    document.querySelectorAll('.icon-menu').forEach(el => { el.innerHTML = Icons.getIcon('menu', 20, 'currentColor'); });
    document.querySelectorAll('.icon-arrow-left').forEach(el => { el.innerHTML = Icons.getIcon('arrowLeft', 20, 'currentColor'); });
    document.querySelectorAll('.icon-bell').forEach(el => { el.innerHTML = Icons.getIcon('bell', 24, 'currentColor'); });
    document.querySelectorAll('.icon-close').forEach(el => { el.innerHTML = Icons.getIcon('close', 24, 'currentColor'); });
    document.querySelectorAll('.icon-help').forEach(el => { el.innerHTML = Icons.getIcon('help', 24, 'currentColor'); });
    document.querySelectorAll('.icon-plus').forEach(el => { el.innerHTML = Icons.getIcon('plus', 24, 'currentColor'); });
  },

  // ---- Event listeners ----

  setupEventListeners() {
    // Sections
    document.querySelectorAll('.deck-section-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.switchDeckSection(e.currentTarget.dataset.section); });
    });

    // Navigation
    document.getElementById('add-deck-btn')?.addEventListener('click', e => { e.preventDefault(); this.showAddDeckModal(); });
    document.getElementById('help-btn')?.addEventListener('click', e => { e.preventDefault(); this.showHelpModal(); });
    document.getElementById('back-btn')?.addEventListener('click', e => { e.preventDefault(); this.showDecksView(); });
    document.getElementById('review-back-btn')?.addEventListener('click', e => { e.preventDefault(); this.currentDeckId ? this.showDeckDetailView() : this.showDecksView(); });

    // Hamburger
    document.getElementById('hamburger-menu-btn')?.addEventListener('click', () => this.showHamburgerMenu('decks'));
    document.getElementById('hamburger-menu-btn-detail')?.addEventListener('click', () => this.showHamburgerMenu('deck-detail'));
    document.getElementById('hamburger-close-btn')?.addEventListener('click', () => this.hideHamburgerMenu());
    document.getElementById('hamburger-menu')?.addEventListener('click', e => { if (e.target.id === 'hamburger-menu' || e.target.classList.contains('hamburger-menu-overlay')) this.hideHamburgerMenu(); });

    // Import
    document.getElementById('import-file-input')?.addEventListener('change', e => this.importDeck(e));

    // Cartes
    document.getElementById('add-card-btn')?.addEventListener('click', () => this.showAddCardModal());

    // Révision
    document.getElementById('review-card')?.addEventListener('click', () => this.revealAnswer());
    const grade = (e, g) => { e.preventDefault(); e.stopPropagation(); if (this.isRevealed) { this.addButtonFeedback(e.currentTarget); this.rateCard(g); } };
    document.getElementById('again-btn')?.addEventListener('click', e => grade(e, 0));
    document.getElementById('hard-btn')?.addEventListener('click',  e => grade(e, 1));
    document.getElementById('good-btn')?.addEventListener('click',  e => grade(e, 2));
    document.getElementById('easy-btn')?.addEventListener('click',  e => grade(e, 3));
    document.getElementById('review-undo-btn')?.addEventListener('click', e => { e.preventDefault(); this.undoReview(); });
    document.getElementById('review-tts-btn')?.addEventListener('click', e => { e.preventDefault(); this.toggleTts(); });

    // Raccourcis clavier (révision) : Espace = retourner, 1-4 = noter, Z = annuler
    document.addEventListener('keydown', e => {
      if (this.currentView !== 'review') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.isRevealed ? null : this.revealCard(); }
      else if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); this.undoReview(); }
      else if (['1', '2', '3', '4'].includes(e.key) && this.isRevealed) { e.preventDefault(); this.rateCard(parseInt(e.key, 10) - 1); }
    });

    // Modal
    document.querySelector('.modal-close')?.addEventListener('click', () => this.hideModal());
    document.getElementById('modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'modal-overlay') this.hideModal(); });
  },

  // ---- Navigation ----

  showView(viewName) {
    const current = document.querySelector('.view.active');
    const next    = document.getElementById(`${viewName}-view`);
    if (!next || current === next) return;
    if (current) {
      current.classList.remove('active');
      current.style.display = '';   // laisser .view (sans .active) → display:none via CSS
    }
    // On laisse l'animation CSS `.view.active { animation: viewEnter }` gérer la transition.
    // display piloté par les classes pour ne pas écraser le display:grid de #decks-view.active.
    next.style.display = '';
    next.classList.remove('active');
    void next.offsetWidth;          // force un reflow pour rejouer l'animation proprement
    next.classList.add('active');
    this.currentView = viewName;
  },

  showDecksView() { this.showView('decks'); this.currentDeckId = null; this.currentIsBaseDeck = false; this.renderDecks(); },

  showDeckDetailView(deckId = null) {
    if (deckId) {
      this.currentDeckId = deckId;
      this.currentIsBaseDeck = !!(this.baseDecks?.find(d => d.id === deckId));
    } else if (!this.currentDeckId) { this.showDecksView(); return; }
    const addCardBtn = document.getElementById('add-card-btn');
    if (addCardBtn) addCardBtn.style.display = this.currentIsBaseDeck ? 'none' : 'flex';
    this.showView('deck-detail');
    this.renderCards();
  },

  toggleView() { this.isGridView = !this.isGridView; document.getElementById('decks-container')?.classList.toggle('list-view', !this.isGridView); this.hideHamburgerMenu(); },

  // ---- Menu hamburger ----

  showHamburgerMenu(viewType) {
    const menu      = document.getElementById('hamburger-menu');
    const menuItems = document.getElementById('hamburger-menu-items');
    if (!menu || !menuItems) return;

    const items  = [];
    const isDark = this.isDarkMode();
    if (viewType === 'decks') {
      items.push(
        { icon: 'user',     text: AuthService.isLoggedIn() ? `Compte (${AuthService.getUserEmail()})` : 'Connexion / Inscription', action: () => { this.showAuthModal(); this.hideHamburgerMenu(); } },
        { icon: isDark ? 'sun' : 'moon', text: isDark ? 'Mode clair' : 'Mode sombre', action: () => this.toggleDarkMode() },
        { icon: 'download', text: 'Importer un deck', action: () => { document.getElementById('import-file-input').click(); this.hideHamburgerMenu(); } },
        { icon: this.isGridView ? 'list' : 'grid', text: this.isGridView ? 'Vue liste' : 'Vue grille', action: () => this.toggleView() },
        { icon: 'bell',     text: 'Rappels de révision', action: () => { this.configureReviewReminders(); this.hideHamburgerMenu(); } }
      );
    } else if (viewType === 'deck-detail') {
      items.push(
        { icon: 'refresh',  text: 'Réviser',             action: () => { this.startReview(this.currentDeckId); this.hideHamburgerMenu(); } },
        { icon: 'card',     text: 'Examen',               action: () => { this.showQuizSetupModal(); this.hideHamburgerMenu(); } },
        { icon: 'settings', text: 'Paramètres révision',  action: () => { this.showReviewSettingsModal(); this.hideHamburgerMenu(); } },
        { icon: 'chart',    text: 'Statistiques du deck', action: () => { this.showStatsModal(); this.hideHamburgerMenu(); } },
        { icon: isDark ? 'sun' : 'moon', text: isDark ? 'Mode clair' : 'Mode sombre', action: () => this.toggleDarkMode() }
      );
      if (!this.currentIsBaseDeck) {
        items.push(
          { icon: 'upload', text: 'Exporter', action: () => { this.exportDeck(); this.hideHamburgerMenu(); } },
          { icon: 'edit',   text: 'Modifier le deck', action: () => { this.showEditDeckModal(); this.hideHamburgerMenu(); } }
        );
      }
    }

    this.currentMenuActions = items.map(i => i.action);
    menuItems.innerHTML = items.map((item, index) => `
      <button class="hamburger-menu-item" data-menu-index="${index}">
        <span class="hamburger-menu-item-icon">${Icons.getIcon(item.icon, 20, 'currentColor')}</span>
        <span>${item.text}</span>
      </button>`).join('');

    menuItems.querySelectorAll('.hamburger-menu-item').forEach((btn, index) => {
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.currentMenuActions[index]?.(); });
    });

    menu.classList.remove('hidden');
  },

  hideHamburgerMenu() { document.getElementById('hamburger-menu')?.classList.add('hidden'); },
  hamburgerMenuAction(index) { this.currentMenuActions[index]?.(); },

  // ---- Helpers ----

  getDeck(deckId, isBase = false) {
    if (isBase) {
      if (!this.baseDecks?.length) this.baseDecks = this.getBaseDecksData();
      return this.baseDecks.find(d => d.id === deckId) ?? null;
    }
    return StorageManager.getDeck(deckId);
  },

  getCurrentDeck() { return this.currentDeckId ? this.getDeck(this.currentDeckId, this.currentIsBaseDeck) : null; },

  escapeHtml,

  // ---- Decks de base (externalisables vers /data/base-decks.json) ----
  getBaseDecksData() {
    return [
      {
        id: 'base-chapitre-1', name: 'Chapitre 1 - Suites Numériques',
        cards: [
          { front: "Qu'est-ce qu'une suite numérique ?", back: "Une application définie de IN dans IR, notée (Un)." },
          { front: "Comment note-t-on le terme général d'une suite ?", back: "Un, où n est l'indice du terme." },
          { front: "Différence formule explicite vs récurrence ?", back: "Explicite : Un = f(n). Récurrence : Un+1 = f(Un), premier terme donné." },
          { front: "Comment définit-on la croissance d'une suite (Un) ?", back: "Pour tout n, Un+1 ≥ Un." },
          { front: "Trois méthodes pour étudier les variations d'une suite ?", back: "1) Signe de Un+1-Un. 2) Si Un=f(n), étudier f. 3) Si Un>0, comparer Un+1/Un à 1." },
          { front: "Définir une suite arithmétique.", back: "Suite où Un+1 = Un + r, r étant la raison." },
          { front: "Formule explicite suite arithmétique U0, raison r ?", back: "Un = U0 + n×r" },
          { front: "Définir une suite géométrique.", back: "Suite où Vn+1 = q×Vn, q raison." },
          { front: "Formule explicite suite géométrique V0, raison q ?", back: "Vn = V0 × qⁿ" },
          { front: "Somme 1+q+q²+…+qⁿ (q≠1) ?", back: "(1-qⁿ⁺¹)/(1-q)" }
        ]
      },
      {
        id: 'base-chapitre-2', name: 'Chapitre 2 - Limites de fonctions',
        cards: [
          { front: "Asymptote horizontale", back: "Droite y=k si lim f(x)=k en ±∞" },
          { front: "Asymptote verticale", back: "Droite x=a si lim f(x)=±∞ en a" },
          { front: "Limite de 1/x en ±∞", back: "0" },
          { front: "Limite de 1/x en 0⁺", back: "+∞" },
          { front: "Limite de 1/x en 0⁻", back: "-∞" },
          { front: "Limite somme f→+∞ et g→+∞", back: "f+g → +∞" },
          { front: "Forme indéterminée somme", back: "f→-∞ et g→+∞" },
          { front: "Forme indéterminée produit", back: "f→0 et g→±∞" },
          { front: "Continuité en a", back: "lim f(x) = f(a)" }
        ]
      },
      {
        id: 'base-chapitre-3', name: 'Chapitre 3 - Dérivation et Variations',
        cards: [
          { front: "Taux de variation entre a et b", back: "[f(b)-f(a)]/(b-a)" },
          { front: "Définition du nombre dérivé f'(x₀)", back: "lim h→0 [f(x₀+h)-f(x₀)]/h" },
          { front: "Équation de la tangente en x₀", back: "y = f'(x₀)(x-x₀)+f(x₀)" },
          { front: "Dérivée de xⁿ (n entier>0)", back: "nxⁿ⁻¹" },
          { front: "Dérivée de 1/x", back: "-1/x²" },
          { front: "Dérivée de √x", back: "1/(2√x)" },
          { front: "Dérivée d'un produit (uv)'", back: "u'v + uv'" },
          { front: "Dérivée d'un quotient (u/v)'", back: "(u'v - uv')/v²" },
          { front: "f'>0 implique quoi ?", back: "f croissante" }
        ]
      },
      {
        id: 'base-chapitre-4', name: 'Chapitre 4 - Loi binomiale',
        cards: [
          { front: "Épreuve de Bernoulli", back: "Expérience aléatoire à 2 issues : succès ou échec" },
          { front: "Loi binomiale B(n,p) — formule P(X=k)", back: "P(X=k) = (n k) × pᵏ × (1-p)ⁿ⁻ᵏ" },
          { front: "Espérance E(X) pour B(n,p)", back: "n×p" },
          { front: "Variance V(X) pour B(n,p)", back: "n×p×(1-p)" },
          { front: "Écart-type σ(X) pour B(n,p)", back: "√[n×p×(1-p)]" },
          { front: "Relation triangle de Pascal", back: "(n k)+(n k+1)=(n+1 k+1)" }
        ]
      },
      {
        id: 'base-cours-php', name: 'Cours PHP',
        cards: [
          { front: "Balises PHP", back: "<?php ... ?>" },
          { front: "Afficher", back: 'echo "texte";' },
          { front: "Variable", back: '$nom = "valeur";' },
          { front: "Paramètre URL", back: "$_GET['param']" },
          { front: "Condition", back: "if (...) { } else { }" },
          { front: "Choix multiple", back: "switch ($var) { case: ... break; }" },
          { front: "Session", back: "session_start() + $_SESSION" },
          { front: "Hash password", back: "password_hash($pwd, PASSWORD_DEFAULT)" }
        ]
      },
      {
        id: "base-go-q1", name: "Grand Oral Q1 — IA & sécurité des véhicules", tags: ["Grand Oral","STI2D SIN"],
        cards: [
          { type: "basic", front: "Problématique Q1", back: "Dans quelle mesure l'IA améliore-t-elle RÉELLEMENT la sécurité des véhicules modernes ? — mot clé « réellement » = oui mesuré vs limites." },
          { type: "basic", front: "Plan en 3 parties (Q1)", back: "I. L'IA améliore (le « oui ») · II. Limites techniques (le « mais ») · III. Au-delà de la machine : l'humain et le droit." },
          { type: "basic", front: "Accroche Q1 (par cœur)", back: "Selon Euro NCAP, le freinage d'urgence auto réduit ~38 % des collisions arrière. Mais en 2018 une voiture autonome Uber a tué un piéton mal classé à temps. Même techno, deux résultats opposés." },
          { type: "basic", front: "Partie I — arguments « l'IA améliore »", back: "Perception : fusion caméra+radar+LiDAR, un CNN classe la scène. ADAS : AEB, maintien de voie (LKA), angle mort, régulateur adaptatif. Preuve : baisse accidents (Euro NCAP), réaction machine ~100 ms < ~1 s humain." },
          { type: "basic", front: "Exemple développé : l'AEB", back: "La caméra repère un obstacle, l'IA estime distance + vitesse de rapprochement ; collision imminente sans réaction du conducteur → freine seule. IIHS : jusqu'à ~50 % de collisions arrière en moins. L'IA ne fatigue pas, ne se déconcentre pas." },
          { type: "basic", front: "Transition 1 (après partie I)", back: "« Ces résultats sont réels et mesurés. Mais le mot \"réellement\" invite à regarder l'autre face : la technique elle-même a des limites. »" },
          { type: "basic", front: "Partie II — limites techniques", back: "Edge cases : cas non appris (objet rare, scène inhabituelle) → mauvaise classification (ex. Uber 2018). Conditions : pluie, brouillard, nuit, contre-jour dégradent les capteurs. Cyber : véhicule connecté = surface d'attaque (Jeep Cherokee 2015 → 1,4 M de rappels)." },
          { type: "basic", front: "Transition 2 (après partie II)", back: "« Et même si la technique était parfaite, un dernier problème dépasse la machine : l'humain derrière, et la question de la responsabilité. »" },
          { type: "basic", front: "Partie III — l'humain et le droit", back: "Excès de confiance : le conducteur délègue trop, baisse sa vigilance (Uber : conductrice de sécurité distraite). Responsabilité juridique floue : niveau ≤2 = conducteur, 3+ = constructeur, pas tranché → frein à l'autonome. Boîte noire : un CNN décide sans toujours pouvoir s'expliquer." },
          { type: "basic", front: "Conclusion Q1", back: "Oui, l'IA améliore réellement la sécurité active (chiffres à l'appui), mais elle plafonne sur la fiabilité, ouvre un risque cyber, et déplace la responsabilité vers l'humain et le droit." },
          { type: "basic", front: "Ouverture Q1", back: "Niveau 5 — accepter de confier sa vie à une IA « boîte noire » qu'on ne sait pas expliquer ?" },
          { type: "basic", front: "Comment un CNN détecte un piéton ?", back: "Image = pixels → couches de convolution extraient des motifs (bords → formes → silhouette) → dernière couche sort une probabilité (« 92 % piéton ») → si seuil dépassé + distance critique → ordre de freinage. Entraîné sur des milliers d'images étiquetées.", backImage: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MjAgMzAwIiB3aWR0aD0iNjIwIiBoZWlnaHQ9IjMwMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYyMCIgaGVpZ2h0PSIzMDAiIHJ4PSIyMCIgZmlsbD0iI2Y1ZjhmZCIvPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFoIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI3IiByZWZZPSI0LjUiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMOSw0LjUgTDAsOSB6IiBmaWxsPSIjMDA3MWUzIi8+PC9tYXJrZXI+PC9kZWZzPjx0ZXh0IHg9IjMxMCIgeT0iMzgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q29tbWVudCB1biBDTk4gZMOpdGVjdGUgdW4gcGnDqXRvbjwvdGV4dD48cmVjdCB4PSIyNSIgeT0iOTUiIHdpZHRoPSIxMTAiIGhlaWdodD0iOTAiIHJ4PSIxMiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDA3MWUzIiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjgwIiB5PSIxMjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SW1hZ2U8L3RleHQ+PHRleHQgeD0iODAiIHk9IjE0NyIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4ocGl4ZWxzKTwvdGV4dD48cmVjdCB4PSI1NSIgeT0iMTUzIiB3aWR0aD0iNTAiIGhlaWdodD0iMjIiIGZpbGw9IiNkNmU2ZmIiLz48bGluZSB4MT0iMTQwIiB5MT0iMTQwIiB4Mj0iMTc1IiB5Mj0iMTQwIiBzdHJva2U9IiMwMDcxZTMiIHN0cm9rZS13aWR0aD0iMi41IiBtYXJrZXItZW5kPSJ1cmwoI2FoKSIvPjxyZWN0IHg9IjE4MCIgeT0iOTUiIHdpZHRoPSIxMzAiIGhlaWdodD0iOTAiIHJ4PSIxMiIgZmlsbD0iI2VhZjNmZSIgc3Ryb2tlPSIjMDA3MWUzIiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjI0NSIgeT0iMTIzIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMwMDcxZTMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNvdWNoZXMgZGU8L3RleHQ+PHRleHQgeD0iMjQ1IiB5PSIxNDEiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iIzAwNzFlMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Y29udm9sdXRpb248L3RleHQ+PHRleHQgeD0iMjQ1IiB5PSIxNjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Ym9yZHPihpJmb3JtZXPihpJzaWxob3VldHRlPC90ZXh0PjxsaW5lIHgxPSIzMTUiIHkxPSIxNDAiIHgyPSIzNTAiIHkyPSIxNDAiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIyLjUiIG1hcmtlci1lbmQ9InVybCgjYWgpIi8+PHJlY3QgeD0iMzU1IiB5PSI5NSIgd2lkdGg9IjExMCIgaGVpZ2h0PSI5MCIgcng9IjEyIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMzNGM3NTkiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iNDEwIiB5PSIxMjciIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iIzM0Yzc1OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+OTIgJTwvdGV4dD48dGV4dCB4PSI0MTAiIHk9IjE1MSIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEzIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5wacOpdG9uPC90ZXh0PjxsaW5lIHgxPSI0NzAiIHkxPSIxNDAiIHgyPSI1MDUiIHkyPSIxNDAiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIyLjUiIG1hcmtlci1lbmQ9InVybCgjYWgpIi8+PHJlY3QgeD0iNTEwIiB5PSI5NSIgd2lkdGg9IjkwIiBoZWlnaHQ9IjkwIiByeD0iMTIiIGZpbGw9IiNmZmU4ZTYiIHN0cm9rZT0iI2ZmM2IzMCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSI1NTUiIHk9IjEzMyIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjZmYzYjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TZXVpbCArPC90ZXh0Pjx0ZXh0IHg9IjU1NSIgeT0iMTUxIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNmZjNiMzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPmRpc3RhbmNlPC90ZXh0Pjx0ZXh0IHg9IjMxMCIgeT0iMjQ1IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiMxZDFkMWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkVudHJhw65uw6kgc3VyIGRlcyBtaWxsaWVycyBkJ2ltYWdlcyDDqXRpcXVldMOpZXMuPC90ZXh0Pjx0ZXh0IHg9IjMxMCIgeT0iMjcyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPklsIHJlY29ubmHDrnQgZGVzIG1vdGlmcyBzdGF0aXN0aXF1ZXMg4oCUIGlsIG5lIMKrIGNvbXByZW5kIMK7IHBhcy48L3RleHQ+Cjwvc3ZnPg==" },
          { type: "basic", front: "C'est quoi un ADAS ?", back: "Système d'aide à la conduite : le conducteur garde le contrôle, le système assiste (freinage d'urgence, maintien de voie, angle mort). Différent d'une voiture autonome qui conduit seule." },
          { type: "basic", front: "Les niveaux d'autonomie (0 → 5)", back: "0 = tout humain · 1-2 = assistance (conducteur responsable) · 3 = délégué sous conditions · 4 = autonome en zone définie · 5 = autonome partout. Aujourd'hui : niveau 2, parfois 3.", backImage: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MjAgMzIwIiB3aWR0aD0iNjIwIiBoZWlnaHQ9IjMyMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYyMCIgaGVpZ2h0PSIzMjAiIHJ4PSIyMCIgZmlsbD0iI2Y1ZjhmZCIvPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFoIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI3IiByZWZZPSI0LjUiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMOSw0LjUgTDAsOSB6IiBmaWxsPSIjMDA3MWUzIi8+PC9tYXJrZXI+PC9kZWZzPjx0ZXh0IHg9IjMxMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tml2ZWF1eCBkJ2F1dG9ub21pZSAoU0FFKTwvdGV4dD48cmVjdCB4PSIzMCIgeT0iOTAiIHdpZHRoPSI5MiIgaGVpZ2h0PSI3MCIgcng9IjEyIiBmaWxsPSIjOGU4ZTkzIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iNzYiIHk9IjEyNSIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iODAwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4wPC90ZXh0Pjx0ZXh0IHg9Ijc2IiB5PSIxNDgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QXVjdW5lPC90ZXh0PjxyZWN0IHg9IjEyNiIgeT0iOTAiIHdpZHRoPSI5MiIgaGVpZ2h0PSI3MCIgcng9IjEyIiBmaWxsPSIjNWFjOGZhIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iMTcyIiB5PSIxMjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+MTwvdGV4dD48dGV4dCB4PSIxNzIiIHk9IjE0OCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Bc3Npc3RhbmNlPC90ZXh0PjxyZWN0IHg9IjIyMiIgeT0iOTAiIHdpZHRoPSI5MiIgaGVpZ2h0PSI3MCIgcng9IjEyIiBmaWxsPSIjMzRjNzU5IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iMjY4IiB5PSIxMjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+MjwvdGV4dD48dGV4dCB4PSIyNjgiIHk9IjE0OCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QYXJ0aWVsbGU8L3RleHQ+PHJlY3QgeD0iMzE4IiB5PSI5MCIgd2lkdGg9IjkyIiBoZWlnaHQ9IjcwIiByeD0iMTIiIGZpbGw9IiNmZmNjMDAiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSIzNjQiIHk9IjEyNSIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iODAwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4zPC90ZXh0Pjx0ZXh0IHg9IjM2NCIgeT0iMTQ4IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNvbmRpdGlvbm5lbGxlPC90ZXh0PjxyZWN0IHg9IjQxNCIgeT0iOTAiIHdpZHRoPSI5MiIgaGVpZ2h0PSI3MCIgcng9IjEyIiBmaWxsPSIjZmY5NTAwIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iNDYwIiB5PSIxMjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+NDwvdGV4dD48dGV4dCB4PSI0NjAiIHk9IjE0OCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7DiWxldsOpZTwvdGV4dD48cmVjdCB4PSI1MTAiIHk9IjkwIiB3aWR0aD0iOTIiIGhlaWdodD0iNzAiIHJ4PSIxMiIgZmlsbD0iI2ZmM2IzMCIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjU1NiIgeT0iMTI1IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPjU8L3RleHQ+PHRleHQgeD0iNTU2IiB5PSIxNDgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VG90YWxlPC90ZXh0PjxsaW5lIHgxPSIzMCIgeTE9IjE4NSIgeDI9IjU2MCIgeTI9IjE4NSIgc3Ryb2tlPSIjMDA3MWUzIiBzdHJva2Utd2lkdGg9IjIuNSIgbWFya2VyLWVuZD0idXJsKCNhaCkiLz48dGV4dCB4PSI0MCIgeT0iMjEwIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJzdGFydCI+Q29uZHVjdGV1ciByZXNwb25zYWJsZTwvdGV4dD48dGV4dCB4PSI1NjAiIHk9IjIxMCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEzIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0iZW5kIj5Wb2l0dXJlIHNldWxlPC90ZXh0PjxyZWN0IHg9IjE1MCIgeT0iMjQwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjUwIiByeD0iMTIiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSIzMTAiIHk9IjI2MyIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMDA3MWUzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BdWpvdXJkJ2h1aSA6IG5pdmVhdSAyLCBwYXJmb2lzIDM8L3RleHQ+PHRleHQgeD0iMzEwIiB5PSIyODIiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+KDUgPSBwbHVzIGRlIHZvbGFudCk8L3RleHQ+Cjwvc3ZnPg==" },
          { type: "basic", front: "L'IA peut-elle se tromper ? Pourquoi ?", back: "Oui. Elle ne comprend pas, elle reconnaît des motifs statistiques appris. Face à un edge case (météo, objet rare) elle peut mal classer. Uber 2018 : l'IA a hésité + la conductrice était distraite → l'accident vient du système IA + humain." },
          { type: "basic", front: "Qui est responsable en cas d'accident ?", back: "Flou juridique. Niveau ≤2 : conducteur. Niveau 3+ : glisse vers le constructeur. Pas tranché partout — un frein à l'autonome." },
          { type: "basic", front: "Radar, LiDAR, caméra : différence ?", back: "Radar = ondes radio, voit loin, perce la météo, peu précis. LiDAR = laser 3D très précis, cher. Caméra = couleur/texte, sensible à la lumière. On les fusionne.", backImage: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MjAgMzEwIiB3aWR0aD0iNjIwIiBoZWlnaHQ9IjMxMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYyMCIgaGVpZ2h0PSIzMTAiIHJ4PSIyMCIgZmlsbD0iI2Y1ZjhmZCIvPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFoIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI3IiByZWZZPSI0LjUiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMOSw0LjUgTDAsOSB6IiBmaWxsPSIjMDA3MWUzIi8+PC9tYXJrZXI+PC9kZWZzPjx0ZXh0IHg9IjMxMCIgeT0iMzgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RnVzaW9uIGRlIGNhcHRldXJzPC90ZXh0PjxyZWN0IHg9IjYwIiB5PSI3NSIgd2lkdGg9IjE0MCIgaGVpZ2h0PSI4MCIgcng9IjEyIiBmaWxsPSIjZmZmIiBzdHJva2U9IiM1YWM4ZmEiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iMTMwIiB5PSIxMDMiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNyIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzVhYzhmYSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q2Ftw6lyYTwvdGV4dD48dGV4dCB4PSIxMzAiIHk9IjEyMyIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjMWQxZDFmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5jb3VsZXVyLCB0ZXh0ZTwvdGV4dD48dGV4dCB4PSIxMzAiIHk9IjE0MCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5zZW5zaWJsZSDDoCBsYSBsdW1pw6hyZTwvdGV4dD48bGluZSB4MT0iMTMwIiB5MT0iMTU1IiB4Mj0iMzEwIiB5Mj0iMjAwIiBzdHJva2U9IiMwMDcxZTMiIHN0cm9rZS13aWR0aD0iMi41IiBtYXJrZXItZW5kPSJ1cmwoI2FoKSIvPjxyZWN0IHg9IjI1MCIgeT0iNzUiIHdpZHRoPSIxNDAiIGhlaWdodD0iODAiIHJ4PSIxMiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMzRjNzU5IiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjMyMCIgeT0iMTAzIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMzNGM3NTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlJhZGFyPC90ZXh0Pjx0ZXh0IHg9IjMyMCIgeT0iMTIzIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiMxZDFkMWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPm9uZGVzIHJhZGlvPC90ZXh0Pjx0ZXh0IHg9IjMyMCIgeT0iMTQwIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPnZvaXQgbG9pbiwgcGVyY2UgbcOpdMOpbzwvdGV4dD48bGluZSB4MT0iMzIwIiB5MT0iMTU1IiB4Mj0iMzEwIiB5Mj0iMjAwIiBzdHJva2U9IiMwMDcxZTMiIHN0cm9rZS13aWR0aD0iMi41IiBtYXJrZXItZW5kPSJ1cmwoI2FoKSIvPjxyZWN0IHg9IjQ0MCIgeT0iNzUiIHdpZHRoPSIxNDAiIGhlaWdodD0iODAiIHJ4PSIxMiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZmY5NTAwIiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjUxMCIgeT0iMTAzIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiNmZjk1MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkxpREFSPC90ZXh0Pjx0ZXh0IHg9IjUxMCIgeT0iMTIzIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiMxZDFkMWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPmxhc2VyIDNEPC90ZXh0Pjx0ZXh0IHg9IjUxMCIgeT0iMTQwIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPnRyw6hzIHByw6ljaXMsIGNoZXI8L3RleHQ+PGxpbmUgeDE9IjUxMCIgeTE9IjE1NSIgeDI9IjMxMCIgeTI9IjIwMCIgc3Ryb2tlPSIjMDA3MWUzIiBzdHJva2Utd2lkdGg9IjIuNSIgbWFya2VyLWVuZD0idXJsKCNhaCkiLz48cmVjdCB4PSIyMTAiIHk9IjIwNSIgd2lkdGg9IjIwMCIgaGVpZ2h0PSI1MCIgcng9IjEyIiBmaWxsPSIjMDA3MWUzIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iMzEwIiB5PSIyMzYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNyIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2PDqG5lIGNvbXByaXNlPC90ZXh0Pjx0ZXh0IHg9IjMxMCIgeT0iMjg1IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkF1Y3VuIGNhcHRldXIgc2V1bCBuZSBzdWZmaXQg4oaSIG9uIGxlcyBjb21iaW5lLjwvdGV4dD4KPC9zdmc+" },
          { type: "basic", front: "Chiffres clés Q1", back: "AEB ~38–50 % de collisions arrière en moins · niveaux 0 → 5 · Jeep 2015 = 1,4 M de rappels · Uber 2018 = 1er piéton tué par une autonome." },
          { type: "basic", front: "Lien E-Bench → Q1", back: "J'ai testé les capteurs PIR et touché au code qui traite leurs signaux. J'ai vu les limites : faux déclenchements, sensibilité aux conditions. Un capteur ne donne qu'une info binaire ; une voiture doit interpréter une scène entière avec de l'IA → mêmes problèmes de fiabilité, en bien plus grave. C'est tout l'enjeu du mot « réellement »." }
        ]
      },
      {
        id: "base-go-q2", name: "Grand Oral Q2 — Protection des données personnelles", tags: ["Grand Oral","STI2D SIN"],
        cards: [
          { type: "basic", front: "Problématique Q2", back: "Dans quelle mesure les Français protègent-ils RÉELLEMENT leurs données personnelles en ligne ? — tension : le paradoxe de la vie privée." },
          { type: "basic", front: "Thèse assumée (Q2)", back: "« Je défendrai une idée : les Français protègent mal leurs données — mais la faute ne leur revient pas entièrement. » (à annoncer dès l'intro)" },
          { type: "basic", front: "Plan en 3 parties (Q2)", back: "I. Le paradoxe : ils protègent mal · II. Des outils qui protègent · III. L'individu ne suffit pas (État + entreprises)." },
          { type: "basic", front: "Accroche Q2 (par cœur)", back: "En 2024, le piratage de France Travail a exposé les données de plus de 40 millions de Français — presque un citoyen sur deux. Et pourtant, l'un des mots de passe les plus utilisés au monde reste « 123456 »." },
          { type: "basic", front: "Donnée personnelle (déf. CNIL)", back: "Toute information permettant d'identifier une personne, directement ou indirectement (nom, e-mail, IP, IBAN…)." },
          { type: "basic", front: "La CNIL, c'est quoi ?", back: "Commission Nationale de l'Informatique et des Libertés. Autorité française qui applique le RGPD : contrôle, conseille, sanctionne (amendes Google, Amazon)." },
          { type: "basic", front: "Partie I — le paradoxe", back: "Les Français se disent inquiets (sondages CNIL) mais agissent à l'inverse = paradoxe de la vie privée. Mot de passe « 123456 » réutilisé partout. « Tout accepter » cliqué sans lire = dark patterns. → Réponse à « réellement » : non, en pratique peu protégés." },
          { type: "basic", front: "Transition (après partie I)", back: "« Mais ce décalage ne veut pas dire qu'aucune protection n'existe : des outils efficaces sont à leur portée. »" },
          { type: "basic", front: "Partie II — les outils qui protègent", back: "Mots de passe : longs, aléatoires, sans pattern + gestionnaire (Bitwarden). VPN : chiffre le flux sur Wi-Fi public → bloque le Man-in-the-Middle. 2FA : code temporaire (Google Authenticator) → mot de passe volé seul ne suffit pas." },
          { type: "basic", front: "Transition (après partie II)", back: "« Pourtant, même en se protégeant parfaitement, l'individu seul ne peut pas tout : une grande partie échappe à son contrôle. »" },
          { type: "basic", front: "Partie III — l'individu ne suffit pas", back: "On ne peut pas mentir aux impôts, à la banque, à l'employeur : nom, adresse, IBAN obligatoires. Tout repose alors sur la sécurité de l'État et des entreprises. France Travail = 40 M de victimes qui n'avaient rien fait. Cadre : RGPD (2018) + CNIL. Nuance : depuis le RGPD, c'est à l'entreprise de PROUVER qu'elle protège." },
          { type: "basic", front: "Conclusion Q2", back: "Les Français font des efforts, mais s'ils sont seuls et que l'État et les entreprises ne suivent pas, c'est une guerre perdue d'avance. La vraie protection est un effort PARTAGÉ." },
          { type: "basic", front: "Chute Q2 (par cœur)", back: "« Protéger ses données aujourd'hui, c'est comme fermer sa porte à clé… dans un immeuble dont on ne contrôle ni la serrure de l'entrée, ni le gardien. Ma sécurité dépend des autres. »" },
          { type: "basic", front: "Ouverture Q2", back: "Avec l'IA qui progresse, nos défenses suffiront-elles demain ? Une IA a récemment trouvé une faille que des humains avaient manquée pendant des années — elle peut défendre, mais aussi attaquer." },
          { type: "basic", front: "La 2FA / A2F", back: "1er facteur = mot de passe (« ce que je sais ») ; 2e facteur = code temporaire (~30 s, algo TOTP) = « ce que je possède ». Mot de passe volé seul → accès refusé.", backImage: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MjAgMzMwIiB3aWR0aD0iNjIwIiBoZWlnaHQ9IjMzMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYyMCIgaGVpZ2h0PSIzMzAiIHJ4PSIyMCIgZmlsbD0iI2Y1ZjhmZCIvPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFoIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI3IiByZWZZPSI0LjUiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMOSw0LjUgTDAsOSB6IiBmaWxsPSIjMDA3MWUzIi8+PC9tYXJrZXI+PC9kZWZzPjx0ZXh0IHg9IjMxMCIgeT0iMzgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RG91YmxlIGF1dGhlbnRpZmljYXRpb24gKDJGQSk8L3RleHQ+PHJlY3QgeD0iNDAiIHk9IjkwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9Ijk1IiByeD0iMTIiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSIxNDAiIHk9IjEyMCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMDA3MWUzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4xLiBNb3QgZGUgcGFzc2U8L3RleHQ+PHRleHQgeD0iMTQwIiB5PSIxNDUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+wqsgY2UgcXVlIGplIHNhaXMgwrs8L3RleHQ+PHRleHQgeD0iMTQwIiB5PSIxNjgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+4oCi4oCi4oCi4oCi4oCi4oCi4oCi4oCiPC90ZXh0Pjx0ZXh0IHg9IjI1NSIgeT0iMTQzLjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+KzwvdGV4dD48cmVjdCB4PSIyODAiIHk9IjkwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9Ijk1IiByeD0iMTIiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzM0Yzc1OSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSIzODAiIHk9IjEyMCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMzRjNzU5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4yLiBDb2RlIHRlbXBvcmFpcmU8L3RleHQ+PHRleHQgeD0iMzgwIiB5PSIxNDUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+wqsgY2UgcXVlIGplIHBvc3PDqGRlIMK7PC90ZXh0Pjx0ZXh0IHg9IjM4MCIgeT0iMTcwIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMxZDFkMWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuKXtyAzMCBzIMK3IFRPVFA8L3RleHQ+PGxpbmUgeDE9IjM4NSIgeTE9IjE4NSIgeDI9IjM4NSIgeTI9IjIzNSIgc3Ryb2tlPSIjMzRjNzU5IiBzdHJva2Utd2lkdGg9IjIuNSIgbWFya2VyLWVuZD0idXJsKCNhaCkiLz48cmVjdCB4PSIxOTAiIHk9IjI0MCIgd2lkdGg9IjI0MCIgaGVpZ2h0PSI0OCIgcng9IjEyIiBmaWxsPSIjMzRjNzU5IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iMzEwIiB5PSIyNzAiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QWNjw6hzIGF1dG9yaXPDqTwvdGV4dD48dGV4dCB4PSIzMTAiIHk9IjMxMCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEzIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Nb3QgZGUgcGFzc2Ugdm9sw6kgc2V1bCDihpIgYWNjw6hzIHJlZnVzw6kuPC90ZXh0Pgo8L3N2Zz4=" },
          { type: "basic", front: "Une attaque Man-in-the-Middle ?", back: "Un pirate s'intercale entre toi et le site sur un Wi-Fi public et lit le flux. Le VPN chiffre ce flux → il ne voit que de l'illisible.", backImage: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MjAgMzEwIiB3aWR0aD0iNjIwIiBoZWlnaHQ9IjMxMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYyMCIgaGVpZ2h0PSIzMTAiIHJ4PSIyMCIgZmlsbD0iI2Y1ZjhmZCIvPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFoIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI3IiByZWZZPSI0LjUiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMOSw0LjUgTDAsOSB6IiBmaWxsPSIjMDA3MWUzIi8+PC9tYXJrZXI+PC9kZWZzPjx0ZXh0IHg9IjMxMCIgeT0iMzgiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TWFuLWluLXRoZS1NaWRkbGUgJiBWUE48L3RleHQ+PHJlY3QgeD0iMzAiIHk9Ijk1IiB3aWR0aD0iMTMwIiBoZWlnaHQ9IjcwIiByeD0iMTIiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSI5NSIgeT0iMTI1IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMxZDFkMWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlRvaTwvdGV4dD48dGV4dCB4PSI5NSIgeT0iMTQ3IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldpLUZpIHB1YmxpYzwvdGV4dD48cmVjdCB4PSIyNDUiIHk9Ijk1IiB3aWR0aD0iMTMwIiBoZWlnaHQ9IjcwIiByeD0iMTIiIGZpbGw9IiNmZmU4ZTYiIHN0cm9rZT0iI2ZmM2IzMCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSIzMTAiIHk9IjEyNSIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjZmYzYjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QaXJhdGU8L3RleHQ+PHRleHQgeD0iMzEwIiB5PSIxNDciIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+cydpbnRlcmNhbGU8L3RleHQ+PHJlY3QgeD0iNDYwIiB5PSI5NSIgd2lkdGg9IjEzMCIgaGVpZ2h0PSI3MCIgcng9IjEyIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMwMDcxZTMiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iNTI1IiB5PSIxMjUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2l0ZTwvdGV4dD48dGV4dCB4PSI1MjUiIHk9IjE0NyIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5zZXJ2ZXVyPC90ZXh0PjxsaW5lIHgxPSIxNjAiIHkxPSIxMzAiIHgyPSIyNDAiIHkyPSIxMzAiIHN0cm9rZT0iI2ZmM2IzMCIgc3Ryb2tlLXdpZHRoPSIyLjUiIG1hcmtlci1lbmQ9InVybCgjYWgpIi8+PGxpbmUgeDE9IjM4MCIgeTE9IjEzMCIgeDI9IjQ1NSIgeTI9IjEzMCIgc3Ryb2tlPSIjZmYzYjMwIiBzdHJva2Utd2lkdGg9IjIuNSIgbWFya2VyLWVuZD0idXJsKCNhaCkiLz48dGV4dCB4PSIzMTAiIHk9IjIwNSIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEzIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjZmYzYjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TYW5zIFZQTiA6IGxlIHBpcmF0ZSBsaXQgbGUgZmx1eCBlbiBjbGFpci48L3RleHQ+PHJlY3QgeD0iMTEwIiB5PSIyNDAiIHdpZHRoPSI0MDAiIGhlaWdodD0iNTAiIHJ4PSIxMiIgZmlsbD0iI2VhZjNmZSIgc3Ryb2tlPSIjMDA3MWUzIiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjMxMCIgeT0iMjYzIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTUiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMwMDcxZTMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlZQTiA9IHR1bm5lbCBjaGlmZnLDqTwvdGV4dD48dGV4dCB4PSIzMTAiIHk9IjI4MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNTAwIiBmaWxsPSIjNmU2ZTczIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5sZSBwaXJhdGUgbmUgdm9pdCBxdWUgZGUgbCdpbGxpc2libGU8L3RleHQ+Cjwvc3ZnPg==" },
          { type: "basic", front: "HTTPS / TLS", back: "Navigateur + serveur négocient une clé, puis les données circulent chiffrées → interceptées = illisibles." },
          { type: "basic", front: "Le RGPD", back: "Règlement européen de 2018. Encadre collecte et usage des données : consentement, minimisation, droit d'accès et d'effacement. Sanctions jusqu'à 4 % du chiffre d'affaires mondial." },
          { type: "basic", front: "Le VPN protège de quoi, et pas ?", back: "Protège : masque l'IP, chiffre le flux sur Wi-Fi public (anti Man-in-the-Middle). Ne protège pas : données fournies volontairement, cookies, pistage une fois connecté." },
          { type: "basic", front: "Chiffrement vs mot de passe", back: "Mot de passe = contrôle d'accès (qui entre). Chiffrement = rend la donnée illisible sans la clé, même volée. Complémentaires." },
          { type: "basic", front: "Termes à placer (Q2)", back: "CNIL · RGPD · paradoxe de la vie privée · dark patterns · 2FA · Man-in-the-Middle · privacy by design." },
          { type: "basic", front: "Lien E-Bench → Q2", back: "J'ai réalisé le site web, participé au code et aux tests des capteurs. Tout est stocké en local dans une base SQLite, sans cloud : sans le formaliser, on appliquait deux principes du RGPD — la minimisation et le privacy by design. En codant le site (HTTPS sur GitHub Pages) j'ai vu la différence entre une donnée chiffrée et une donnée exposée." }
        ]
      },
      {
        id: "base-go-orient", name: "Grand Oral — Orientation, E-Bench & méthode", tags: ["Grand Oral","STI2D SIN"],
        cards: [
          { type: "basic", front: "Lien sujet → avenir (réponse prête)", back: "À la rentrée j'intègre la Licence Informatique de l'UPJV à Amiens (déjà accepté). Objectif : travailler dans l'intelligence artificielle. Ce sujet m'a poussé à comprendre comment une IA perçoit son environnement et décide. E-Bench m'a initié à la chaîne capteur–traitement ; la licence me fera passer à l'IA elle-même (apprentissage automatique, réseaux de neurones)." },
          { type: "basic", front: "Pourquoi avoir choisi ce sujet ?", back: "Lien direct avec mon avenir : je veux travailler dans l'IA. Comprendre comment une IA perçoit et décide (véhicule) m'a attiré. Réponse honnête et personnelle." },
          { type: "basic", front: "Quel métier / études après le bac ?", back: "J'intègre la Licence Informatique de l'UPJV à Amiens (déjà accepté). Objectif : travailler dans le domaine de l'intelligence artificielle." },
          { type: "basic", front: "Pourquoi l'IA précisément ?", back: "Sur E-Bench j'ai vu la chaîne capteur → traitement. Je veux passer à l'étape supérieure : le système qui apprend et décide. La licence m'ouvre l'apprentissage automatique et les réseaux de neurones." },
          { type: "basic", front: "En quoi STI2D SIN t'a préparé ?", back: "Acquisition et traitement de l'information, programmation, capteurs — ce que j'ai pratiqué sur E-Bench, et la base de l'informatique que je vais étudier." },
          { type: "basic", front: "Ce sujet a-t-il changé ton projet ?", back: "Il l'a confirmé et précisé : il m'a fait mesurer les limites réelles de l'IA (fiabilité, edge cases), un enjeu que je veux comprendre en profondeur dans mes études." },
          { type: "basic", front: "E-Bench, c'est quoi ?", back: "Banc solaire autonome intelligent : Raspberry Pi + capteur PIR + écran tactile + base SQLite locale. 3e aux Olympiades SI 2024-25. Mon rôle : site web, code, tests capteurs." },
          { type: "basic", front: "La chaîne d'information (SIN)", back: "Capteur (PIR détecte une présence) → Traitement (la Raspberry Pi traite l'info) → Action (déclenche). C'est le cœur de la spécialité SIN : acquisition et traitement de l'information.", backImage: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MjAgMzEwIiB3aWR0aD0iNjIwIiBoZWlnaHQ9IjMxMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYyMCIgaGVpZ2h0PSIzMTAiIHJ4PSIyMCIgZmlsbD0iI2Y1ZjhmZCIvPgogIDxkZWZzPjxtYXJrZXIgaWQ9ImFoIiBtYXJrZXJXaWR0aD0iOSIgbWFya2VySGVpZ2h0PSI5IiByZWZYPSI3IiByZWZZPSI0LjUiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTTAsMCBMOSw0LjUgTDAsOSB6IiBmaWxsPSIjMDA3MWUzIi8+PC9tYXJrZXI+PC9kZWZzPjx0ZXh0IHg9IjMxMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q2hhw65uZSBkJ2luZm9ybWF0aW9uIChTSU4pPC90ZXh0PjxyZWN0IHg9IjMwIiB5PSIxMDAiIHdpZHRoPSIxNTAiIGhlaWdodD0iODUiIHJ4PSIxMiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjNWFjOGZhIiBzdHJva2Utd2lkdGg9IjEuNSIvPjx0ZXh0IHg9IjEwNSIgeT0iMTM2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiM1YWM4ZmEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNhcHRldXI8L3RleHQ+PHRleHQgeD0iMTA1IiB5PSIxNjAiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UElSIGTDqXRlY3RlPC90ZXh0PjxsaW5lIHgxPSIxODAiIHkxPSIxNDIuNSIgeDI9IjIzNSIgeTI9IjE0Mi41IiBzdHJva2U9IiMwMDcxZTMiIHN0cm9rZS13aWR0aD0iMi41IiBtYXJrZXItZW5kPSJ1cmwoI2FoKSIvPjxyZWN0IHg9IjIzNSIgeT0iMTAwIiB3aWR0aD0iMTUwIiBoZWlnaHQ9Ijg1IiByeD0iMTIiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwNzFlMyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48dGV4dCB4PSIzMTAiIHk9IjEzNiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sJ1NlZ29lIFVJJyxJbnRlcixBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMDA3MWUzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UcmFpdGVtZW50PC90ZXh0Pjx0ZXh0IHg9IjMxMCIgeT0iMTYwIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlJhc3BiZXJyeSBQaTwvdGV4dD48bGluZSB4MT0iMzg1IiB5MT0iMTQyLjUiIHgyPSI0NDAiIHkyPSIxNDIuNSIgc3Ryb2tlPSIjMDA3MWUzIiBzdHJva2Utd2lkdGg9IjIuNSIgbWFya2VyLWVuZD0idXJsKCNhaCkiLz48cmVjdCB4PSI0NDAiIHk9IjEwMCIgd2lkdGg9IjE1MCIgaGVpZ2h0PSI4NSIgcng9IjEyIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMzNGM3NTkiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHRleHQgeD0iNTE1IiB5PSIxMzYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzM0Yzc1OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QWN0aW9uPC90ZXh0Pjx0ZXh0IHg9IjUxNSIgeT0iMTYwIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwnU2Vnb2UgVUknLEludGVyLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSI1MDAiIGZpbGw9IiM2ZTZlNzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPmTDqWNsZW5jaGU8L3RleHQ+PHRleHQgeD0iMzEwIiB5PSIyNTUiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iIzFkMWQxZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RS1CZW5jaCA6IHN0b2NrYWdlIGxvY2FsIFNRTGl0ZSwgYXVjdW4gY2xvdWQ8L3RleHQ+PHRleHQgeD0iMzEwIiB5PSIyODAiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCdTZWdvZSBVSScsSW50ZXIsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzZlNmU3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+4oaSIG1pbmltaXNhdGlvbiArIHByaXZhY3kgYnkgZGVzaWduIChSR1BEKTwvdGV4dD4KPC9zdmc+" },
          { type: "basic", front: "Les 20 min de préparation", back: "0-2 min : accroche + problématique + annonce de plan. 2-10 min : squelette (titres I/II, 3 sous-points en mots-clés). 10-14 min : exemples + chiffres soulignés (38 %, Jeep 2015, RGPD 2018). 14-17 min : rédiger intro + conclusion en entier. 17-20 min : relire à voix basse, noter 2 transitions, respirer." },
          { type: "basic", front: "Maîtriser l'échange (la clé du 20)", back: "1. Reformule : « Si je comprends, vous me demandez si… ». 2. Réponds en structure : « deux choses : d'abord… ensuite… ». 3. Un exemple concret : E-Bench ou France Travail. 4. Si tu ne sais pas : « Je ne suis pas certain, mais je raisonnerais ainsi… » → honnêteté + raisonnement > bluff." },
          { type: "basic", front: "Les 4 réflexes qui font 17 → 20", back: "Parler sans lire (regards vers les deux examinateurs). Conviction : pause après chaque chiffre (« 40 millions… » puis silence). Tenir 9:30–10:00 pile, fin nette. Posture : debout, droit, mains visibles, une respiration entre chaque partie." }
        ]
      }
    ];
  },

  // ---- Rendu Decks ----

  renderDecks() {
    const decks     = this.filterDecksByTag(StorageManager.getDecks());
    const container = document.getElementById('decks-container');
    if (!container) return;

    if (decks.length === 0) {
      const all = StorageManager.getDecks();
      this._teardownPager(container);
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${Icons.getIcon('books', 64, 'var(--text-secondary)')}</div>
        <div class="empty-state-text">${all.length === 0 ? 'Aucun deck. Créez-en un !' : 'Aucun deck avec ce tag.'}</div>
      </div>`;
      return;
    }

    const now = Date.now();
    const cardsHtml = decks.map(deck => {
      if (!Array.isArray(deck.cards)) deck.cards = [];
      const due   = deck.cards.filter(c => !c.nextReview || c.nextReview <= now).length;
      const total = deck.cards.length;
      const tagsHtml = deck.tags?.length ? `<div class="deck-tags">${deck.tags.map(t => `<span class="deck-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';
      return `<div class="deck-card" data-deck-id="${deck.id}">
        <div class="deck-actions">
          <button class="deck-action-btn" data-deck-id="${deck.id}" data-action="delete" title="Supprimer">${Icons.getIcon('delete', 16)}</button>
          <button class="deck-action-btn" data-deck-id="${deck.id}" data-action="review" title="Réviser">${Icons.getIcon('refresh', 16)}</button>
        </div>
        <h3>${escapeHtml(deck.name)}</h3>
        ${tagsHtml}
        <div class="deck-info">
          <span>${total} carte${total !== 1 ? 's' : ''}</span>
          ${due > 0 ? `<span class="cards-due-badge">${due} à réviser</span>` : ''}
        </div>
      </div>`;
    });

    this._renderDeckGrid(container, cardsHtml, false);
  },

  _attachDeckListeners(container, isBase) {
    // Nettoyer les anciens listeners
    this._cardCleanupFns.forEach(fn => fn());
    this._cardCleanupFns = [];

    container.querySelectorAll('.deck-card').forEach(card => {
      const id = card.dataset.deckId;
      if (!id) return;
      const cleanup = addLongPress(
        card,
        () => this.showDeckActionsModal(id, isBase),
        () => this.openDeck(id, isBase)
      );
      this._cardCleanupFns.push(cleanup);
    });
  },

  // ---- Mise en page « fit-to-viewport » : hauteur de l'écran ----
  _setupViewportSizing() {
    const setH = () => {
      const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
    };
    setH();
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setH);
    window.addEventListener('resize', setH);
    window.addEventListener('orientationchange', () => setTimeout(setH, 250));
  },

  // ---- Grille de decks (scroll vertical simple) ----
  // Démonte les artefacts de l'ancien pager horizontal (observer, dots, listener de scroll).
  _teardownPager(container) {
    if (!container) return;
    container._deckResizeObs?.disconnect?.();
    container._deckResizeObs = null;
    if (container._pagerOnScroll) { container.removeEventListener('scroll', container._pagerOnScroll); container._pagerOnScroll = null; }
    container._deckCardsHtml = null;
    container._deckLayoutSig = null;
    container.parentElement?.querySelector(':scope > .deck-dots')?.remove();
    container.classList.remove('deck-pager');
    container.classList.add('decks-grid');
  },

  _renderDeckGrid(container, cardsHtml, isBase) {
    this._teardownPager(container);
    container.innerHTML = cardsHtml.join('');
    this._attachDeckListeners(container, isBase);
  },

  switchDeckSection(section) {
    if (!section) return;
    document.querySelectorAll('.deck-section-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
    document.querySelectorAll('.decks-section-content').forEach(c => c.classList.remove('active'));
    const addDeckBtn = document.getElementById('add-deck-btn');
    const helpBtn    = document.getElementById('help-btn');
    const tagsFilter = document.getElementById('tags-filter-container');

    if (section === 'my-decks') {
      document.getElementById('my-decks-container')?.classList.add('active');
      this.renderDecks();
      this.renderTagsFilter();
      if (addDeckBtn) addDeckBtn.style.display = 'flex';
      if (helpBtn) helpBtn.style.display = 'flex';
    } else if (section === 'base-decks') {
      document.getElementById('base-decks-container')?.classList.add('active');
      this.renderBaseDecks();
      if (tagsFilter) tagsFilter.style.display = 'none';
      if (addDeckBtn) addDeckBtn.style.display = 'none';
      if (helpBtn) helpBtn.style.display = 'none';
    } else if (section === 'stats-section') {
      document.getElementById('stats-section-container')?.classList.add('active');
      this.renderStatsDashboard();
      if (tagsFilter) tagsFilter.style.display = 'none';
      if (addDeckBtn) addDeckBtn.style.display = 'none';
      if (helpBtn) helpBtn.style.display = 'none';
    }
  },

  renderBaseDecks() {
    const container = document.getElementById('base-decks-grid');
    if (!container) return;
    this.baseDecks = this.getBaseDecksData();
    const now = Date.now();

    if (!this.baseDecks.length) {
      this._teardownPager(container);
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-text">Aucun deck de base disponible.</div>
      </div>`;
      return;
    }

    const cardsHtml = this.baseDecks.map(deck => {
      const total  = deck.cards.length;
      const scores = JSON.parse(localStorage.getItem(`baseDeckScores_${deck.id}`) || '{}');
      const due    = Object.keys(scores).length > 0
        ? Object.values(scores).filter(s => !s.nextReview || s.nextReview <= now).length
        : total;
      return `<div class="deck-card" data-deck-id="${deck.id}" data-is-base="true">
        <div class="deck-actions">
          <button class="deck-action-btn" data-deck-id="${deck.id}" data-action="review" title="Réviser">${Icons.getIcon('refresh', 16)}</button>
        </div>
        <h3>${escapeHtml(deck.name)}</h3>
        <div class="deck-info">
          <span>${total} carte${total !== 1 ? 's' : ''}</span>
          ${due > 0 ? `<span class="cards-due-badge">${due} à réviser</span>` : ''}
        </div>
      </div>`;
    });

    this._renderDeckGrid(container, cardsHtml, true);
  },

  openDeck(deckId, isBase = false) {
    if (!deckId) return;
    this.currentDeckId = deckId;
    this.currentIsBaseDeck = isBase || !!(this.baseDecks?.find(d => d.id === deckId));
    const deck = this.getDeck(deckId, this.currentIsBaseDeck);
    if (!deck) { this.showToast('Deck introuvable.', 'error'); this.showDecksView(); return; }
    const titleEl = document.getElementById('deck-title');
    if (titleEl) titleEl.textContent = deck.name;
    const addCardBtn = document.getElementById('add-card-btn');
    if (addCardBtn) addCardBtn.style.display = this.currentIsBaseDeck ? 'none' : 'flex';
    this.showDeckDetailView(deckId);
  },

  startReview(deckId) {
    deckId = deckId || this.currentDeckId;
    if (!deckId) { this.showToast('Aucun deck sélectionné.', 'error'); return; }
    this.currentDeckId = deckId;
    this.currentIsBaseDeck = !!(this.baseDecks?.find(d => d.id === deckId));
    this.showReviewView();
  },

  // ---- Rendu Cartes ----

  renderCards() {
    if (!this.currentDeckId) return;
    const deck      = this.getCurrentDeck();
    const container = document.getElementById('cards-container');
    if (!deck || !container) return;

    if (deck.cards.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${Icons.getIcon('card', 64, 'var(--text-secondary)')}</div>
        <div class="empty-state-text">Aucune carte dans ce deck.</div>
      </div>`; return;
    }

    const now        = Date.now();
    const savedScores = this.currentIsBaseDeck
      ? JSON.parse(localStorage.getItem(`baseDeckScores_${this.currentDeckId}`) || '{}')
      : null;

    let cards = deck.cards.map((card, index) => {
      if (this.currentIsBaseDeck && savedScores?.[index]) {
        const s = savedScores[index];
        card = { ...card, cardScore: s.cardScore ?? 0, nextReview: s.nextReview ?? null,
          easeFactor: s.easeFactor ?? 2.5, interval: s.interval ?? 0, repetitions: s.repetitions ?? 0, lastReview: s.lastReview ?? null };
      } else {
        card.cardScore  ??= 0; card.nextReview ??= null; card.easeFactor ??= 2.5;
        card.interval   ??= 0; card.repetitions ??= 0; card.lastReview ??= null; card.againCount ??= 0;
      }
      return { card, index };
    });

    const filtered = this.filterAndSortCards(cards.map(c => c.card)).map(c => {
      const orig = deck.cards.findIndex(x => x === c);
      return { card: c, index: orig };
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <div class="empty-state-text">Aucune carte ne correspond à votre recherche.</div>
      </div>`; return;
    }

    container.innerHTML = filtered.map(({ card, index }) => {
      const score    = card.cardScore ?? 0;
      const color    = ColorZones.getCardColor(score);
      const zone     = ColorZones.getZoneName(score);
      const frontImg = (card.frontImage?.trim()) ? `<img src="${escapeHtml(card.frontImage)}" alt="" class="card-grid-img">` : '';
      const backImg  = (card.backImage?.trim())  ? `<img src="${escapeHtml(card.backImage)}"  alt="" class="card-grid-img">` : '';
      const suspended = !!card.suspended;
      const suspendLabel = suspended ? 'Réactiver' : 'Suspendre';
      const suspendIcon  = suspended ? 'play' : 'pause';
      const actions  = this.currentIsBaseDeck ? '' : `
        <button class="card-action-btn-compact" data-card-index="${index}" data-action="suspend" title="${suspendLabel}" aria-label="${suspendLabel}">${Icons.getIcon(suspendIcon, 16)}</button>
        <button class="card-action-btn-compact" data-card-index="${index}" data-action="edit" title="Modifier" aria-label="Modifier">${Icons.getIcon('edit', 16)}</button>
        <button class="card-action-btn-compact card-action-btn-delete" data-card-index="${index}" data-action="delete" title="Supprimer" aria-label="Supprimer">${Icons.getIcon('delete', 16)}</button>`;
      const suspBadge = suspended ? `<span class="card-suspended-badge" title="En suspens">${Icons.getIcon('pause', 11, 'currentColor')}</span>` : '';
      const isCloze   = Cloze.isCloze(card);
      const typeBadge = isCloze ? `<span class="card-type-badge" title="Texte à trous">trous</span>` : '';
      const frontLbl  = isCloze ? 'Texte à trous' : 'Recto';
      const backLbl   = isCloze ? 'Complément' : 'Verso';
      const frontTxt  = isCloze ? (Cloze.back(escapeHtml(card.front || '')) || '<span class="card-grid-empty">-</span>')
                                : (escapeHtml(card.front) || '<span class="card-grid-empty">-</span>');
      const backTxt   = escapeHtml(card.back) || '<span class="card-grid-empty">-</span>';
      return `<div class="card-grid-item${suspended ? ' card-suspended' : ''}" data-score="${score}">
        <span class="card-difficulty-badge" style="background:${color};" title="${zone}"></span>${suspBadge}${typeBadge}
        <div class="card-grid-section"><div class="card-grid-label">${frontLbl}</div>${frontImg}<div class="card-grid-text">${frontTxt}</div></div>
        <div class="card-grid-section"><div class="card-grid-label">${backLbl}</div>${backImg}<div class="card-grid-text">${backTxt}</div></div>
        <div class="card-grid-actions">${actions}</div>
      </div>`;
    }).join('');
    this.renderMath(container);

    if (!this.currentIsBaseDeck) {
      container.querySelectorAll('.card-action-btn-compact').forEach(btn => {
        const idx    = parseInt(btn.dataset.cardIndex);
        const action = btn.dataset.action;
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          if (action === 'edit') this.showEditCardModal(idx);
          else if (action === 'suspend') this.toggleSuspendCard(idx);
          else this.deleteCard(idx);
        });
      });
    }
  },

  // ---- Révision ----

  // Construit la session : cartes dues, plafonnées par type selon les options du deck
  // (nouvelles/session, révisions/session) ou le défaut global `cardsPerSession`.
  _buildReviewSession(deck) {
    const now    = Date.now();
    const opt    = deck.options ?? {};
    const nLimit = Number.isFinite(opt.newPerDay)     ? opt.newPerDay     : this.cardsPerSession;
    const rLimit = Number.isFinite(opt.reviewsPerDay) ? opt.reviewsPerDay : this.cardsPerSession;
    const pool   = Scheduler.getCardsToReview(deck);  // non-suspendues, triées (difficiles d'abord)
    const isNew  = c => (c.state ? c.state === 'new' : ((c.repetitions ?? 0) === 0 && !c.lastReview));
    const isDue  = c => !c.nextReview || c.nextReview <= now;
    const newCards = pool.filter(c => isNew(c)).slice(0, nLimit);
    const revCards = pool.filter(c => !isNew(c) && isDue(c)).slice(0, rLimit);
    return [...revCards, ...newCards];
  },

  showReviewView() {
    if (!this.currentDeckId) return;
    const deck = this.getCurrentDeck();
    if (!deck) return;
    this.reviewCards = this._buildReviewSession(deck);
    if (this.reviewCards.length === 0) {
      const hasSuspended = deck.cards.some(c => c.suspended);
      this.showToast(hasSuspended ? 'Rien à réviser (cartes en suspens exclues).' : 'Aucune carte à réviser pour le moment !', 'info');
      return;
    }
    this.currentReviewIndex = 0;
    this.isRevealed = false;
    this._undoStack = [];
    this._reviewedCount = 0;
    // Icônes des contrôles d'en-tête
    const undoBtn = document.getElementById('review-undo-btn');
    const ttsBtn  = document.getElementById('review-tts-btn');
    if (undoBtn) { undoBtn.innerHTML = Icons.getIcon('undo', 20, 'currentColor'); undoBtn.disabled = true; }
    if (ttsBtn)  ttsBtn.innerHTML = Icons.getIcon('volume', 20, 'currentColor');
    this.showView('review');
    this.showReviewCard();
  },

  showReviewCard() {
    if (this.currentReviewIndex >= this.reviewCards.length) { this.completeReview(); return; }
    const card     = this.reviewCards[this.currentReviewIndex];
    const isCloze  = Cloze.isCloze(card);
    const reversed = this.isReversedMode && !isCloze;  // mode inversé désactivé pour les cloze

    const buildHtml = (text, image, label) => {
      let html = '';
      const hasImg  = image?.trim();
      const hasText = text?.trim();
      if (hasImg)  html += `<div class="review-image-container"><img src="${escapeHtml(image)}" alt="${label}" class="review-image"></div>`;
      if (hasText) html += `<p class="${hasImg ? 'review-text review-text-with-image' : 'review-text'}">${escapeHtml(text)}</p>`;
      if (!hasImg && !hasText) html = `<p class="review-text" style="color:var(--text-secondary);font-style:italic">Aucun contenu</p>`;
      return html;
    };

    let frontHtml, backHtml, frontLabel, backLabel;
    if (isCloze) {
      frontLabel = 'Texte à trous'; backLabel = 'Réponse';
      const esc  = escapeHtml(card.front || '');
      const imgF = card.frontImage?.trim() ? `<div class="review-image-container"><img src="${escapeHtml(card.frontImage)}" alt="" class="review-image"></div>` : '';
      frontHtml  = imgF + `<p class="review-text">${Cloze.front(esc)}</p>`;
      backHtml   = imgF + `<p class="review-text">${Cloze.back(esc)}</p>`;
      if (card.back?.trim()) backHtml += `<p class="review-text cloze-extra">${escapeHtml(card.back)}</p>`;
    } else {
      const dFront      = reversed ? card.back  : card.front;
      const dBack       = reversed ? card.front : card.back;
      const dFrontImage = reversed ? card.backImage  : card.frontImage;
      const dBackImage  = reversed ? card.frontImage : card.backImage;
      frontLabel = reversed ? 'Réponse' : 'Question';
      backLabel  = reversed ? 'Question' : 'Réponse';
      frontHtml  = buildHtml(dFront, dFrontImage, frontLabel);
      backHtml   = buildHtml(dBack,  dBackImage,  backLabel);
    }

    const reviewCard = document.getElementById('review-card');
    const inner      = document.getElementById('flip-card-inner');
    if (!inner && reviewCard) {
      reviewCard.innerHTML = `<div class="flip-card-inner" id="flip-card-inner">
        <div id="card-front" class="card-side card-front"><div class="card-label">${frontLabel}</div><div class="card-content" id="front-content"></div><div class="card-tap-hint">Tapez pour voir la réponse</div></div>
        <div id="card-back"  class="card-side card-back"><div class="card-label">${backLabel}</div><div class="card-content" id="back-content"></div><div class="card-tap-hint">Tapez pour revoir la question</div></div>
      </div>`;
    } else if (inner) {
      const fl = document.querySelector('#card-front .card-label');
      const bl = document.querySelector('#card-back .card-label');
      if (fl) fl.textContent = frontLabel;
      if (bl) bl.textContent = backLabel;
    }

    const fc = document.getElementById('front-content');
    const bc = document.getElementById('back-content');
    const fi = document.getElementById('flip-card-inner');
    if (fc) { fc.innerHTML = frontHtml; this.renderMath(fc); }
    if (bc) { bc.innerHTML = backHtml;  this.renderMath(bc); }
    if (fi) fi.classList.remove('flipped');

    const prog = document.getElementById('review-progress');
    if (prog) prog.textContent = `${this.currentReviewIndex + 1} / ${this.reviewCards.length}`;
    this.isRevealed = false;
    document.getElementById('review-buttons')?.classList.add('hidden');

    if (this.ttsEnabled) this.speakCurrent();
  },

  revealAnswer() { this.toggleCard(); },

  toggleCard() {
    const fi = document.getElementById('flip-card-inner');
    if (!fi) return;
    fi.classList.toggle('flipped');
    this.isRevealed = fi.classList.contains('flipped');
    const btns = document.getElementById('review-buttons');
    if (btns) {
      if (this.isRevealed) setTimeout(() => btns.classList.remove('hidden'), 300);
      else btns.classList.add('hidden');
    }
    if (this.isRevealed && this.ttsEnabled) this.speakCurrent();
  },

  revealCard() {
    const fi = document.getElementById('flip-card-inner');
    if (fi && !fi.classList.contains('flipped')) { fi.classList.add('flipped'); this.isRevealed = true; const btns = document.getElementById('review-buttons'); if (btns) setTimeout(() => btns.classList.remove('hidden'), 300); }
  },

  // Champs de planification persistés par carte.
  _SCHED_FIELDS: ['cardScore', 'nextReview', 'lastReview', 'easeFactor', 'interval', 'repetitions', 'againCount', 'lapses', 'learnStep', 'state', 'suspended', 'isLeech', 'updatedAt'],

  _persistReviewState(card) {
    const deck = this.getCurrentDeck();
    if (!deck) return;
    const idx = card.id
      ? deck.cards.findIndex(c => c.id === card.id)
      : deck.cards.findIndex(c => c.front === card.front && c.back === card.back);
    if (idx >= 0 && deck.cards[idx] !== card) {
      const patch = {};
      this._SCHED_FIELDS.forEach(f => { patch[f] = card[f]; });
      Object.assign(deck.cards[idx], patch);
    }
    if (this.currentIsBaseDeck) {
      const scores = {};
      deck.cards.forEach((c, i) => {
        scores[i] = {};
        this._SCHED_FIELDS.forEach(f => { scores[i][f] = c[f] ?? null; });
      });
      localStorage.setItem(`baseDeckScores_${this.currentDeckId}`, JSON.stringify(scores));
    } else {
      StorageManager.saveDeck(deck);
    }
  },

  rateCard(grade) {
    if (!this.isRevealed) this.revealCard();
    if (this.currentReviewIndex >= this.reviewCards.length) { this.completeReview(); return; }
    const card = this.reviewCards[this.currentReviewIndex];
    if (!card) { this.completeReview(); return; }

    // Snapshot pour annulation (Undo)
    const before = {};
    Scheduler._ensure(card);
    this._SCHED_FIELDS.forEach(f => { before[f] = card[f]; });
    this._undoStack.push({ card, before, index: this.currentReviewIndex, queueLen: this.reviewCards.length });

    this._flashReviewFeedback(grade);
    const { reappear } = Scheduler.answer(card, grade);
    this._logReview(grade);
    this._persistReviewState(card);

    if (card.isLeech && card.suspended) {
      this.showToast('Carte difficile mise en suspens (leech).', 'warning');
      card.isLeech = false; // ne notifier qu'une fois
    }

    // Étapes d'apprentissage : la carte réapparaît plus loin dans la session
    if (reappear) this.reviewCards.push(card);
    else this._reviewedCount = (this._reviewedCount || 0) + 1;

    const undoBtn = document.getElementById('review-undo-btn');
    if (undoBtn) undoBtn.disabled = false;

    this.currentReviewIndex++;
    document.getElementById('review-buttons')?.classList.add('hidden');
    const bc    = document.getElementById('back-content');
    const inner = document.getElementById('flip-card-inner');
    if (bc) bc.style.visibility = 'hidden';
    // Réinitialise le flip instantanément (sans animation) pour éviter d'afficher
    // l'ancienne réponse pendant la rotation de retour, puis charge la carte suivante.
    if (inner) { inner.style.transition = 'none'; inner.classList.remove('flipped'); }
    this.isRevealed = false;
    requestAnimationFrame(() => {
      this.showReviewCard();
      if (bc) bc.style.visibility = '';
      // Restaure la transition de flip pour la prochaine carte
      if (inner) requestAnimationFrame(() => { inner.style.transition = ''; });
    });
  },

  // ---- Annulation (Undo) ----
  undoReview() {
    const snap = this._undoStack.pop();
    if (!snap) { this.showToast('Rien à annuler.', 'info'); return; }
    // Restaure l'état de planification de la carte
    Object.assign(snap.card, snap.before);
    // Retire une éventuelle réapparition ajoutée par cette note
    if (this.reviewCards.length > snap.queueLen) this.reviewCards.length = snap.queueLen;
    else if (this._reviewedCount > 0) this._reviewedCount--;
    this.currentReviewIndex = snap.index;
    this._persistReviewState(snap.card);
    if (this._undoStack.length === 0) { const b = document.getElementById('review-undo-btn'); if (b) b.disabled = true; }
    // Recharge la carte (sans animation de flip)
    const inner = document.getElementById('flip-card-inner');
    if (inner) inner.style.transition = 'none';
    this.isRevealed = false;
    this.showReviewCard();
    if (inner) requestAnimationFrame(() => { inner.style.transition = ''; });
  },

  // ---- Synthèse vocale (TTS) ----
  toggleTts() {
    this.ttsEnabled = !this.ttsEnabled;
    const btn = document.getElementById('review-tts-btn');
    if (btn) btn.classList.toggle('active', this.ttsEnabled);
    if (this.ttsEnabled) this.speakCurrent();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.showToast(this.ttsEnabled ? 'Lecture audio activée' : 'Lecture audio désactivée', 'info');
  },

  speakCurrent() {
    if (!('speechSynthesis' in window)) { this.showToast('Synthèse vocale non disponible.', 'error'); return; }
    const card = this.reviewCards[this.currentReviewIndex];
    if (!card) return;
    const reversed = this.isReversedMode && !Cloze.isCloze(card);
    const front = reversed ? card.back : card.front;
    const back  = reversed ? card.front : card.back;
    let text    = this.isRevealed ? back : front;
    // Cloze : retirer le balisage {{cN::…}} pour la lecture vocale
    text = (text || '').replace(Cloze.RE, (_, content) => content);
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR'; u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  },

  completeReview() {
    // Cartes uniques (la même carte peut réapparaître via les étapes d'apprentissage)
    const unique     = Array.from(new Set(this.reviewCards));
    const total      = unique.length;
    const againCount = unique.filter(c => (c.againCount ?? 0) > 0 || (c.lapses ?? 0) > 0).length;
    const score      = total ? Math.round(((total - Math.min(againCount, total)) / total) * 100) : 0;

    // Log activity
    this._logActivity(total);

    if (score >= 80) this._launchConfetti();

    const reviewCard = document.getElementById('review-card');
    if (reviewCard) {
      reviewCard.innerHTML = `<div class="card-side" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;padding:40px;gap:16px;border-top:4px solid var(--accent)">
        <div>${Icons.getIcon('success', 56, 'var(--success)')}</div>
        <h2 style="font-size:26px;font-weight:800;color:var(--text-primary);text-align:center">Révision terminée !</h2>
        <div style="font-size:48px;font-weight:900;color:var(--accent)">${score}%</div>
        <p style="font-size:15px;color:var(--text-secondary);text-align:center"><strong style="color:var(--text-primary)">${total}</strong> carte${total !== 1 ? 's' : ''} révisée${total !== 1 ? 's' : ''}</p>
        <div style="display:flex;gap:10px;width:100%;max-width:380px;justify-content:center;margin-top:8px">
          <button id="review-complete-back-btn" class="review-btn good" style="flex:1">Retour</button>
          <button id="review-complete-again-btn" class="review-btn easy" style="flex:1">À nouveau</button>
        </div>
      </div>`;
      document.getElementById('review-complete-back-btn')?.addEventListener('click', () => { this.showDeckDetailView(); this.renderCards(); });
      document.getElementById('review-complete-again-btn')?.addEventListener('click', () => { if (this.currentDeckId) this.startReview(this.currentDeckId); else this.showDecksView(); });
    }
    document.getElementById('review-buttons')?.classList.add('hidden');
    const prog = document.getElementById('review-progress');
    if (prog) prog.textContent = 'Terminé';
  },

  // ---- Modales ----

  showModalWithContent(title, content) {
    const overlay = document.getElementById('modal-overlay');
    const modal   = overlay?.querySelector('.modal');
    if (!overlay) return;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = content;
    // 1) On positionne l'état "caché" puis on rend visible (display:flex via .hidden retiré)
    overlay.style.opacity = '0';
    if (modal) { modal.style.opacity = '0'; modal.style.transform = 'translateY(20px) scale(0.97)'; }
    overlay.classList.remove('hidden');
    // 2) reflow pour enregistrer l'état de départ, sinon la transition ne se déclenche pas
    void overlay.offsetWidth;
    // 3) on bascule vers l'état visible → transition CSS fluide, sans flash
    overlay.style.opacity = '1';
    if (modal) { modal.style.opacity = '1'; modal.style.transform = 'translateY(0) scale(1)'; }
    // Sur mobile, faire remonter le champ actif au-dessus du clavier virtuel
    const modalBody = overlay.querySelector('.modal-body');
    if (modalBody) {
      modalBody.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('focus', () => {
          setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        }, { once: false });
      });
    }
  },

  hideModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    const modal = overlay.querySelector('.modal');
    overlay.style.opacity = '0';
    if (modal) { modal.style.opacity = '0'; modal.style.transform = 'translateY(20px) scale(0.97)'; }
    // On masque réellement après la transition pour éviter une disparition brutale
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.style.opacity = '';
      if (modal) { modal.style.transform = ''; modal.style.opacity = ''; }
    }, 250);
  },

  showDeckActionsModal(deckId, isBase = false) {
    const deck = this.getDeck(deckId, isBase);
    if (!deck) return;
    const content = `<div style="text-align:center;padding:10px 0">
      <p style="margin-bottom:20px;font-size:16px">Que faire avec <strong>${escapeHtml(deck.name)}</strong> ?</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <button id="dact-review" class="btn btn-primary btn-with-icon">${Icons.getIcon('refresh', 20, 'white')} <span>Réviser</span></button>
        ${!isBase ? `<button id="dact-delete" class="btn btn-danger btn-with-icon">${Icons.getIcon('delete', 20, 'white')} <span>Supprimer</span></button>` : ''}
      </div>
    </div>`;
    this.showModalWithContent('Actions', content);
    requestAnimationFrame(() => {
      document.getElementById('dact-review')?.addEventListener('click', () => { this.hideModal(); this.startReview(deckId); });
      document.getElementById('dact-delete')?.addEventListener('click', () => { this.hideModal(); this.deleteDeck(deckId); });
    });
  },

  showAddDeckModal() {
    const content = `<form id="add-deck-form">
      <div class="form-group"><label for="new-deck-name">Nom du deck</label><input type="text" id="new-deck-name" required placeholder="Ex: Vocabulaire anglais"></div>
      <div class="form-group"><label for="new-deck-tags">Tags (séparés par des virgules)</label><input type="text" id="new-deck-tags" placeholder="Ex: Math, Physique, Terminale"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="add-deck-cancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer</button>
      </div>
    </form>`;
    this.showModalWithContent('Nouveau deck', content);
    requestAnimationFrame(() => {
      document.getElementById('add-deck-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('add-deck-form')?.addEventListener('submit', e => { e.preventDefault(); this.addDeck(); });
      document.getElementById('new-deck-name')?.focus();
    });
  },

  addDeck() {
    const name = document.getElementById('new-deck-name')?.value.trim();
    if (!name) { this.showToast('Veuillez entrer un nom.', 'error'); return; }
    const tags = document.getElementById('new-deck-tags')?.value.trim().split(',').map(t => t.trim()).filter(Boolean) ?? [];
    const deck = { id: Date.now().toString(), name, tags, cards: [], createdAt: Date.now() };
    StorageManager.saveDeck(deck);
    this.hideModal();
    this.renderDecks(); this.renderTagsFilter();
    this.showToast('Deck créé avec succès', 'success');
  },

  showEditDeckModal() {
    if (!this.currentDeckId || this.currentIsBaseDeck) { this.showToast('Non modifiable.', 'error'); return; }
    const deck = this.getCurrentDeck();
    if (!deck) return;
    const content = `<form id="edit-deck-form">
      <div class="form-group"><label for="edit-deck-name">Nom</label><input type="text" id="edit-deck-name" required value="${escapeHtml(deck.name)}"></div>
      <div class="form-group"><label for="edit-deck-tags">Tags</label><input type="text" id="edit-deck-tags" value="${escapeHtml((deck.tags ?? []).join(', '))}"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="edit-deck-cancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>`;
    this.showModalWithContent('Modifier le deck', content);
    requestAnimationFrame(() => {
      document.getElementById('edit-deck-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('edit-deck-form')?.addEventListener('submit', e => { e.preventDefault(); this.editDeck(); });
    });
  },

  editDeck() {
    const name = document.getElementById('edit-deck-name')?.value.trim();
    if (!name) { this.showToast('Nom requis.', 'error'); return; }
    const tags = document.getElementById('edit-deck-tags')?.value.trim().split(',').map(t => t.trim()).filter(Boolean) ?? [];
    const deck = this.getCurrentDeck();
    if (!deck) return;
    deck.name = name; deck.tags = tags;
    StorageManager.saveDeck(deck);
    document.getElementById('deck-title').textContent = name;
    this.renderDecks(); this.renderTagsFilter(); this.hideModal();
    this.showToast('Deck modifié', 'success');
  },

  deleteDeck(id) {
    id = id || this.currentDeckId;
    if (this.baseDecks?.find(d => d.id === id)) { this.showToast('Les decks de base ne sont pas supprimables.', 'error'); return; }
    const deck = StorageManager.getDeck(id);
    this.showConfirmModal('Supprimer le deck', `Supprimer "${deck?.name ?? id}" ? Irréversible.`, () => {
      StorageManager.deleteDeck(id);
      this.showView('decks'); this.renderDecks(); this.renderTagsFilter();
      this.showToast('Deck supprimé', 'success');
    }, 'danger');
  },

  // ---- Cartes CRUD ----

  showAddCardModal() {
    if (this.currentIsBaseDeck) { this.showToast('Deck en lecture seule.', 'error'); return; }
    const content = `<form id="add-card-form">
      <div class="form-group">
        <label for="new-card-type">Type de carte</label>
        <div class="custom-select-wrapper">
          <select id="new-card-type" class="custom-select">
            <option value="basic">Basique (recto / verso)</option>
            <option value="cloze">Texte à trous (cloze)</option>
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 12px">Maths : écrivez du LaTeX entre <code>$…$</code> (ex : <code>$x^2+1$</code>) ou <code>$$…$$</code> pour une formule centrée.</p>
      <p id="cloze-hint" style="display:none;font-size:12px;color:var(--text-secondary);margin:-4px 0 8px">Sélectionnez un mot puis « Créer un trou », ou tapez <code>{{c1::réponse}}</code> (indice optionnel : <code>{{c1::réponse::indice}}</code>).</p>
      <div class="form-group"><label id="lbl-front">Recto</label><textarea id="new-card-front" placeholder="Question"></textarea></div>
      <button type="button" id="cloze-insert-btn" class="btn btn-secondary" style="display:none;margin:-4px 0 12px">Créer un trou {{c…}}</button>
      <div class="form-group">
        <label>Image recto (optionnel)</label>
        <label for="new-card-front-img" class="btn-import-image" style="cursor:pointer;display:inline-block;color:white">Choisir un fichier</label>
        <input type="file" id="new-card-front-img" accept="image/*" style="display:none">
        <div id="prev-front" class="image-preview" style="display:none"><img id="prev-front-img" class="preview-image" alt=""><button type="button" class="btn-remove-preview" data-side="front">×</button></div>
      </div>
      <div class="form-group"><label id="lbl-back">Verso</label><textarea id="new-card-back" placeholder="Réponse"></textarea></div>
      <div class="form-group" id="grp-back-img">
        <label>Image verso (optionnel)</label>
        <label for="new-card-back-img" class="btn-import-image" style="cursor:pointer;display:inline-block;color:white">Choisir un fichier</label>
        <input type="file" id="new-card-back-img" accept="image/*" style="display:none">
        <div id="prev-back" class="image-preview" style="display:none"><img id="prev-back-img" class="preview-image" alt=""><button type="button" class="btn-remove-preview" data-side="back">×</button></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="add-card-cancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer</button>
      </div>
    </form>`;
    this.showModalWithContent('Nouvelle carte', content);
    setTimeout(() => {
      const form = document.getElementById('add-card-form');
      if (!form) return;
      const typeSel = document.getElementById('new-card-type');
      const applyType = () => {
        const cloze = typeSel.value === 'cloze';
        document.getElementById('cloze-hint').style.display = cloze ? 'block' : 'none';
        document.getElementById('cloze-insert-btn').style.display = cloze ? 'inline-flex' : 'none';
        document.getElementById('lbl-front').textContent = cloze ? 'Texte (avec trous)' : 'Recto';
        document.getElementById('lbl-back').textContent  = cloze ? 'Complément (optionnel)' : 'Verso';
        document.getElementById('new-card-front').placeholder = cloze ? 'Ex : La capitale de la France est {{c1::Paris}}' : 'Question';
      };
      typeSel?.addEventListener('change', applyType); applyType();
      document.getElementById('cloze-insert-btn')?.addEventListener('click', () => this._insertCloze(document.getElementById('new-card-front')));
      document.getElementById('add-card-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('new-card-front-img')?.addEventListener('change', e => this.handleImageUpload(e.target.files[0], 'front', form));
      document.getElementById('new-card-back-img')?.addEventListener('change',  e => this.handleImageUpload(e.target.files[0], 'back',  form));
      form.querySelectorAll('.btn-remove-preview').forEach(btn => btn.addEventListener('click', () => this.removePreview(btn.dataset.side, form)));
      form.addEventListener('submit', e => {
        e.preventDefault();
        const type  = typeSel?.value === 'cloze' ? 'cloze' : 'basic';
        const front = form.querySelector('#new-card-front')?.value.trim() ?? '';
        const back  = form.querySelector('#new-card-back')?.value.trim()  ?? '';
        const fi    = form.dataset.frontImage ?? '';
        const bi    = form.dataset.backImage  ?? '';
        if (type === 'cloze') {
          if (!Cloze.has(front)) { this.showToast('Ajoutez au moins un trou : {{c1::réponse}}.', 'error'); return; }
        } else {
          if (!front && !fi) { this.showToast('Recto requis (texte ou image).', 'error'); return; }
          if (!back  && !bi) { this.showToast('Verso requis (texte ou image).', 'error'); return; }
        }
        this.addCardWithValues(front, back, fi, bi, type);
      });
    }, 50);
  },

  _insertCloze(ta) {
    if (!ta) return;
    const val   = ta.value;
    const start = ta.selectionStart ?? val.length;
    const end   = ta.selectionEnd ?? val.length;
    const sel   = val.slice(start, end) || 'réponse';
    const nums  = [...val.matchAll(/\{\{c(\d+)::/g)].map(m => parseInt(m[1], 10));
    const n     = (nums.length ? Math.max(...nums) : 0) + 1;
    const ins   = `{{c${n}::${sel}}}`;
    ta.value = val.slice(0, start) + ins + val.slice(end);
    ta.focus();
    const pos = start + ins.length;
    ta.setSelectionRange(pos, pos);
  },

  async addCardWithValues(front, back, frontImage, backImage, type = 'basic') {
  if (this.currentIsBaseDeck) return;
  const deck = this.getCurrentDeck();
  if (!deck) return;

  // Génère un ID unique pour la carte (utilisé pour le nom du fichier)
  const cardId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

  // Upload des images si présentes
  let uploadedFrontUrl = frontImage;
  let uploadedBackUrl  = backImage;

  try {
    if (frontImage && frontImage.startsWith('data:image')) {
      uploadedFrontUrl = await SupabaseStorage.uploadImage(frontImage, cardId, 'front');
    }
    if (backImage && backImage.startsWith('data:image')) {
      uploadedBackUrl  = await SupabaseStorage.uploadImage(backImage, cardId, 'back');
    }
  } catch (e) {
    console.error('Upload image error:', e);   // ← ajoute cette ligne
    this.showToast('Erreur upload : ' + (e.message || e), 'error');   // ← et celle-ci
    return;
  }

  const newCard = {
    id: cardId,
    type,
    front,
    back,
    frontImage: uploadedFrontUrl || '',
    backImage:  uploadedBackUrl  || '',
    cardScore: 0,
    againCount: 0,
    nextReview: null,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    updatedAt: Date.now()
  };

  deck.cards.push(newCard);
  StorageManager.saveDeck(deck);
  this.renderCards();
  this.hideModal();
  this.showToast('Carte créée', 'success');
},

  showEditCardModal(cardIndex) {
    if (this.currentIsBaseDeck) return;
    const deck = this.getCurrentDeck();
    if (!deck?.cards[cardIndex]) return;
    const card = deck.cards[cardIndex];
    const isCloze = Cloze.isCloze(card);
    this._editingCardIndex = cardIndex;
    this._editingCardData  = { frontImage: card.frontImage ?? '', backImage: card.backImage ?? '' };
    const content = `<form id="edit-card-form">
      ${isCloze ? `<p style="font-size:12px;color:var(--text-secondary);margin:-4px 0 8px">Texte à trous : <code>{{c1::réponse}}</code> (indice : <code>{{c1::réponse::indice}}</code>).</p>` : ''}
      <div class="form-group"><label>${isCloze ? 'Texte (avec trous)' : 'Recto'}</label><textarea id="edit-card-front">${escapeHtml(card.front)}</textarea></div>
      ${isCloze ? `<button type="button" id="edit-cloze-insert-btn" class="btn btn-secondary" style="margin:-4px 0 12px;display:inline-flex">Créer un trou {{c…}}</button>` : ''}
      <div class="form-group">
        <label>Image recto</label>
        <label for="edit-front-img" class="btn-import-image" style="cursor:pointer;display:inline-block;color:white">Choisir un fichier</label>
        <input type="file" id="edit-front-img" accept="image/*" style="display:none">
        <div id="prev-front" class="image-preview" style="display:${card.frontImage ? 'block' : 'none'}">
          <img id="prev-front-img" class="preview-image" src="${escapeHtml(card.frontImage ?? '')}" alt="">
          <button type="button" class="btn-remove-preview" data-side="front">×</button>
        </div>
      </div>
      <div class="form-group"><label>${isCloze ? 'Complément (optionnel)' : 'Verso'}</label><textarea id="edit-card-back">${escapeHtml(card.back)}</textarea></div>
      <div class="form-group">
        <label>Image verso</label>
        <label for="edit-back-img" class="btn-import-image" style="cursor:pointer;display:inline-block;color:white">Choisir un fichier</label>
        <input type="file" id="edit-back-img" accept="image/*" style="display:none">
        <div id="prev-back" class="image-preview" style="display:${card.backImage ? 'block' : 'none'}">
          <img id="prev-back-img" class="preview-image" src="${escapeHtml(card.backImage ?? '')}" alt="">
          <button type="button" class="btn-remove-preview" data-side="back">×</button>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="edit-card-cancel">Annuler</button>
        <button type="button" class="btn btn-primary" id="edit-card-save">Enregistrer</button>
      </div>
    </form>`;
    this.showModalWithContent('Modifier la carte', content);
    setTimeout(() => {
      document.getElementById('edit-card-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('edit-card-save')?.addEventListener('click', () => this.saveEditCard());
      document.getElementById('edit-cloze-insert-btn')?.addEventListener('click', () => this._insertCloze(document.getElementById('edit-card-front')));
      document.getElementById('edit-front-img')?.addEventListener('change', e => this.handleEditImageUpload(e.target.files[0], 'front'));
      document.getElementById('edit-back-img')?.addEventListener('change',  e => this.handleEditImageUpload(e.target.files[0], 'back'));
      document.querySelectorAll('#edit-card-form .btn-remove-preview').forEach(btn => btn.addEventListener('click', () => this.removeEditPreview(btn.dataset.side)));
    }, 50);
  },

  async saveEditCard() {
  const idx = this._editingCardIndex;
  if (idx === undefined) return;

  const front = document.getElementById('edit-card-front')?.value.trim() ?? '';
  const back  = document.getElementById('edit-card-back')?.value.trim()  ?? '';
  let fi      = this._editingCardData?.frontImage ?? '';
  let bi      = this._editingCardData?.backImage  ?? '';

  const deck = this.getCurrentDeck();
  if (!deck?.cards[idx]) return;
  const card = deck.cards[idx];

  if (Cloze.isCloze(card)) {
    if (!Cloze.has(front)) { this.showToast('Ajoutez au moins un trou : {{c1::réponse}}.', 'error'); return; }
  } else {
    if (!front && !fi) { this.showToast('Recto requis.', 'error'); return; }
    if (!back  && !bi) { this.showToast('Verso requis.', 'error'); return; }
  }

  // Upload des nouvelles images si elles ne sont pas déjà des URLs
  try {
    if (fi && fi.startsWith('data:image')) {
      fi = await SupabaseStorage.uploadImage(fi, card.id, 'front');
    }
    if (bi && bi.startsWith('data:image')) {
      bi = await SupabaseStorage.uploadImage(bi, card.id, 'back');
    }
  } catch (e) {
    this.showToast('Erreur lors de l\'upload de l\'image', 'error');
    return;
  }

  Object.assign(card, { front, back, frontImage: fi, backImage: bi, updatedAt: Date.now() });
  StorageManager.saveDeck(deck);
  this._editingCardIndex = undefined;
  this._editingCardData = null;
  this.renderCards();
  this.hideModal();
  this.showToast('Carte modifiée', 'success');
},

  deleteCard(index) {
    if (this.currentIsBaseDeck) return;
    const deck = this.getCurrentDeck();
    if (!deck) return;
    const preview = deck.cards[index]?.front?.substring(0, 30) ?? 'cette carte';
    this.showConfirmModal('Supprimer la carte', `Supprimer "${preview}" ?`, () => {
      deck.cards.splice(index, 1);
      StorageManager.saveDeck(deck);
      this.renderCards();
      this.showToast('Carte supprimée', 'success');
    }, 'danger');
  },

  toggleSuspendCard(index) {
    if (this.currentIsBaseDeck) return;
    const deck = this.getCurrentDeck();
    const card = deck?.cards[index];
    if (!card) return;
    card.suspended = !card.suspended;
    if (!card.suspended) { card.isLeech = false; card.lapses = 0; } // réactivation : on remet le compteur de rechutes à zéro
    card.updatedAt = Date.now();
    StorageManager.saveDeck(deck);
    this.renderCards();
    this.showToast(card.suspended ? 'Carte mise en suspens' : 'Carte réactivée', 'success');
  },

  // ---- Images ----

  compressImage(file, maxW = 800, maxH = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture impossible'));
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image invalide'));
        img.onload = () => {
          let [w, h] = [img.width, img.height];
          if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w = Math.round(w * r); h = Math.round(h * r); }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  async handleImageUpload(file, side, form) {
    if (!file?.type.startsWith('image/')) { this.showToast('Fichier image invalide.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { this.showToast('Image trop grande (max 10 Mo).', 'error'); return; }
    try {
      const b64 = await this.compressImage(file);
      const previewContainer = document.getElementById(`prev-${side}`);
      const previewImg       = document.getElementById(`prev-${side}-img`);
      if (previewImg) { previewImg.src = b64; }
      if (previewContainer) previewContainer.style.display = 'block';
      if (side === 'front') form.dataset.frontImage = b64;
      else                  form.dataset.backImage  = b64;
    } catch (e) { this.showToast('Erreur traitement image.', 'error'); }
  },

  async handleEditImageUpload(file, side) {
    if (!file?.type.startsWith('image/')) { this.showToast('Fichier image invalide.', 'error'); return; }
    try {
      const b64 = await this.compressImage(file);
      if (side === 'front') this._editingCardData.frontImage = b64;
      else                  this._editingCardData.backImage  = b64;
      const c = document.getElementById(`prev-${side}`);
      const i = document.getElementById(`prev-${side}-img`);
      if (i) i.src = b64;
      if (c) c.style.display = 'block';
    } catch (e) { this.showToast('Erreur traitement image.', 'error'); }
  },

  removePreview(side, form) {
    const c = document.getElementById(`prev-${side}`);
    if (c) c.style.display = 'none';
    if (side === 'front') form.dataset.frontImage = '';
    else                  form.dataset.backImage  = '';
  },

  removeEditPreview(side) {
    if (side === 'front') this._editingCardData.frontImage = '';
    else                  this._editingCardData.backImage  = '';
    const c = document.getElementById(`prev-${side}`);
    if (c) c.style.display = 'none';
  },

  // ---- Import / Export ----

  exportDeck() {
    if (!this.currentDeckId || this.currentIsBaseDeck) { this.showToast('Non exportable.', 'error'); return; }
    const deck = this.getCurrentDeck();
    if (!deck) return;
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importDeck(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.name || !Array.isArray(data.cards)) { this.showToast('Format invalide.', 'error'); return; }
        const deck = {
          id: Date.now().toString(), name: data.name,
          cards: data.cards.map(c => ({ type: c.type === 'cloze' ? 'cloze' : 'basic', front: c.front ?? '', back: c.back ?? '', frontImage: c.frontImage ?? '', backImage: c.backImage ?? '', cardScore: 0, againCount: 0, easeFactor: 2.5, interval: 1, repetitions: 0, nextReview: null, lastReview: null, updatedAt: Date.now() })),
          createdAt: Date.now(), tags: data.tags ?? []
        };
        StorageManager.saveDeck(deck);
        this.renderDecks();
        this.showToast(`Deck "${deck.name}" importé !`, 'success');
      } catch { this.showToast("Erreur d'importation.", 'error'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  // ---- Paramètres révision ----

  showReviewSettingsModal() {
    const deck    = (this.currentDeckId && !this.currentIsBaseDeck) ? this.getCurrentDeck() : null;
    const opt     = deck?.options ?? {};
    const newPD   = opt.newPerDay ?? '';
    const revPD   = opt.reviewsPerDay ?? '';
    const perDeck = deck ? `
      <div class="settings-section-label">Limites du deck « ${escapeHtml(deck.name)} »</div>
      <div class="form-group">
        <label for="opt-new-per-day">Nouvelles cartes par session</label>
        <input type="number" id="opt-new-per-day" min="0" max="999" placeholder="défaut (${this.cardsPerSession})" value="${newPD}">
      </div>
      <div class="form-group">
        <label for="opt-rev-per-day">Révisions par session</label>
        <input type="number" id="opt-rev-per-day" min="0" max="999" placeholder="défaut (${this.cardsPerSession})" value="${revPD}">
      </div>` : '';
    const content = `<form id="review-settings-form">
      <div class="form-group">
        <label for="cards-per-session">Cartes par session (défaut global)</label>
        <input type="number" id="cards-per-session" min="1" max="100" value="${this.cardsPerSession}" required>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="reversed-mode" ${this.isReversedMode ? 'checked' : ''}>
          <span class="checkbox-custom"></span><span>Mode révision inversé</span>
        </label>
      </div>
      ${perDeck}
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="rs-cancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>`;
    this.showModalWithContent('Paramètres de révision', content);
    requestAnimationFrame(() => {
      document.getElementById('rs-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('review-settings-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const n = parseInt(document.getElementById('cards-per-session').value);
        const r = document.getElementById('reversed-mode').checked;
        if (!(n > 0 && n <= 100)) { this.showToast('Valeur entre 1 et 100.', 'error'); return; }
        this.cardsPerSession = n; localStorage.setItem('flashcards_cardsPerSession', n.toString());
        this.isReversedMode = r; localStorage.setItem('flashcards_reversedMode', r.toString());
        // Options par deck (vide = défaut global)
        if (deck) {
          const parseLimit = v => { const x = parseInt(v, 10); return Number.isFinite(x) && x >= 0 ? x : null; };
          const nv = parseLimit(document.getElementById('opt-new-per-day')?.value);
          const rv = parseLimit(document.getElementById('opt-rev-per-day')?.value);
          const options = {};
          if (nv !== null) options.newPerDay = nv;
          if (rv !== null) options.reviewsPerDay = rv;
          const fresh = this.getCurrentDeck();
          if (fresh) {
            if (Object.keys(options).length) fresh.options = options; else delete fresh.options;
            StorageManager.saveDeck(fresh);
          }
        }
        this.hideModal(); this.showToast('Paramètres sauvegardés', 'success');
      });
    });
  },

  // ---- Statistiques ----

  showStatsModal() {
    if (!this.currentDeckId) return;
    const deck = this.getCurrentDeck();
    if (!deck) return;
    const now = Date.now();
    let due = 0, easy = 0, medium = 0, hard = 0, vHard = 0, total = 0, totalScore = 0, todayCount = 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    deck.cards.forEach(c => {
      total++; const s = c.cardScore ?? 0; totalScore += s;
      if (!c.nextReview || c.nextReview <= now) due++;
      if (c.lastReview >= todayStart.getTime()) todayCount++;
      if (s < 10) vHard++; else if (s < 20) hard++; else if (s < 30) medium++; else easy++;
    });
    const mastery   = total ? Math.round(((easy + medium * 0.5) / total) * 100) : 0;
    const avgScore  = total ? Math.round(totalScore / total) : 0;
    const circleColor = mastery >= 80 ? '#4CAF50' : mastery >= 60 ? '#8BC34A' : mastery >= 40 ? '#FFC107' : mastery >= 20 ? '#FF9800' : '#F44336';
    const pct = n => total ? (n / total * 100) : 0;

    // ---- Statistiques détaillées (façon Anki) ----
    const DAY = 86_400_000;
    let nw = 0, learn = 0, young = 0, mature = 0, susp = 0, easeSum = 0, easeN = 0, lapses = 0, leeches = 0, reps = 0;
    const forecast = new Array(14).fill(0);
    deck.cards.forEach(c => {
      reps   += c.repetitions ?? 0;
      lapses += c.lapses ?? 0;
      if (c.isLeech || (c.lapses ?? 0) >= 8) leeches++;
      if ((c.repetitions ?? 0) > 0) { easeSum += c.easeFactor ?? 2.5; easeN++; }
      if (c.suspended) { susp++; return; }
      const st = c.state ?? ((c.repetitions ?? 0) > 0 ? 'review' : 'new');
      if (st === 'new') nw++;
      else if (st === 'learning') learn++;
      else if ((c.interval ?? 0) >= 21) mature++;
      else young++;
      if (c.nextReview && c.nextReview > now) {
        const d = Math.floor((c.nextReview - now) / DAY);
        if (d < 14) forecast[d]++;
      }
    });
    const avgEase  = easeN ? (easeSum / easeN).toFixed(2) : '—';
    const ret      = this._retentionStats(30);
    const fcMax    = Math.max(1, ...forecast);
    const fcTotal  = forecast.reduce((s, v) => s + v, 0);
    const matSegs  = [
      { l: 'Nouvelles',      v: nw,     c: '#3b82f6' },
      { l: 'Apprentissage',  v: learn,  c: '#f59e0b' },
      { l: 'Jeunes (<21 j)', v: young,  c: '#0ea5e9' },
      { l: 'Mûres (≥21 j)',  v: mature, c: '#22c55e' },
      { l: 'En suspens',     v: susp,   c: '#94a3b8' }
    ];
    const matTotal = total || 1;

    const forecastHtml = `<div class="stats-section">
      <h4>Prévision des révisions — 14 jours</h4>
      <div class="forecast-chart">
        ${forecast.map((v, i) => `<div class="forecast-col" title="Dans ${i + 1} j : ${v} carte${v !== 1 ? 's' : ''}"><div class="forecast-bar" style="height:${Math.round(v / fcMax * 100)}%"></div><span class="forecast-x">${i + 1}</span></div>`).join('')}
      </div>
      <div class="forecast-caption">${due} en retard · ${fcTotal} prévue${fcTotal !== 1 ? 's' : ''} sur 14 j</div>
    </div>`;

    const maturityHtml = `<div class="stats-section">
      <h4>Maturité des cartes</h4>
      <div class="distribution-bar">${matSegs.filter(s => s.v > 0).map(s => `<div class="bar-segment" style="width:${s.v / matTotal * 100}%;background:${s.c}" title="${s.l}: ${s.v}"></div>`).join('')}</div>
      <div class="distribution-legend">${matSegs.map(s => `<div class="legend-item"><span class="legend-dot" style="background:${s.c}"></span><span class="legend-label">${s.l}</span><span class="legend-value">${s.v}</span></div>`).join('')}</div>
    </div>`;

    const detailsHtml = `<div class="stats-section">
      <h4>Détails</h4>
      <div class="stats-detail-grid">
        <div class="stats-detail-cell"><span class="sd-val">${ret.retention !== null ? ret.retention + '%' : '—'}</span><span class="sd-lbl">Rétention 30 j</span></div>
        <div class="stats-detail-cell"><span class="sd-val">${avgEase}</span><span class="sd-lbl">Facilité moy.</span></div>
        <div class="stats-detail-cell"><span class="sd-val">${reps}</span><span class="sd-lbl">Révisions</span></div>
        <div class="stats-detail-cell"><span class="sd-val">${lapses}</span><span class="sd-lbl">Rechutes</span></div>
        <div class="stats-detail-cell"><span class="sd-val">${leeches}</span><span class="sd-lbl">Leeches</span></div>
      </div>
      ${ret.reviews === 0 ? `<p class="sd-note">La rétention se calcule au fil de tes révisions.</p>` : ''}
    </div>`;
    const content = `<div class="stats-container">
      <div class="stats-mastery"><div class="mastery-circle-container">
        <svg class="mastery-svg" viewBox="0 0 100 100"><circle class="mastery-bg" cx="50" cy="50" r="45"/><circle class="mastery-progress" cx="50" cy="50" r="45" stroke="${circleColor}" stroke-dasharray="${mastery * 2.83} 283" stroke-dashoffset="0"/></svg>
        <div class="mastery-content"><span class="mastery-value" data-target="${mastery}">0%</span><span class="mastery-label">Maîtrise</span></div>
      </div></div>
      <div class="stats-general">
        <div class="stat-item stat-cards"><div class="stat-icon">${Icons.getIcon('card', 20, 'var(--primary-color)')}</div><span class="stat-value">${total}</span><span class="stat-label">Cartes</span></div>
        <div class="stat-item stat-due"><div class="stat-icon">${Icons.getIcon('clock', 20, 'var(--warning)')}</div><span class="stat-value">${due}</span><span class="stat-label">À réviser</span></div>
        <div class="stat-item stat-today"><div class="stat-icon">${Icons.getIcon('success', 20, 'var(--success)')}</div><span class="stat-value">${todayCount}</span><span class="stat-label">Aujourd'hui</span></div>
      </div>
      <div class="stats-distribution"><h4>Répartition par difficulté</h4>
        <div class="distribution-bar-container"><div class="distribution-bar">
          <div class="bar-segment bar-easy    animate-bar" style="--target-width:${pct(easy)}%"  title="Facile: ${easy}"></div>
          <div class="bar-segment bar-medium  animate-bar" style="--target-width:${pct(medium)}%" title="Moyen: ${medium}"></div>
          <div class="bar-segment bar-hard    animate-bar" style="--target-width:${pct(hard)}%"   title="Difficile: ${hard}"></div>
          <div class="bar-segment bar-very-hard animate-bar" style="--target-width:${pct(vHard)}%" title="Très difficile: ${vHard}"></div>
        </div></div>
        <div class="distribution-legend">
          <div class="legend-item"><span class="legend-dot" style="background:#4CAF50"></span><span class="legend-label">Facile</span><span class="legend-value">${easy}</span></div>
          <div class="legend-item"><span class="legend-dot" style="background:#FFC107"></span><span class="legend-label">Moyen</span><span class="legend-value">${medium}</span></div>
          <div class="legend-item"><span class="legend-dot" style="background:#FF9800"></span><span class="legend-label">Difficile</span><span class="legend-value">${hard}</span></div>
          <div class="legend-item"><span class="legend-dot" style="background:#F44336"></span><span class="legend-label">Très difficile</span><span class="legend-value">${vHard}</span></div>
        </div>
      </div>
      <div class="stats-score-avg"><div class="score-avg-label">Score moyen</div>
        <div class="score-avg-bar"><div class="score-avg-fill animate-bar" style="--target-width:${Math.min(avgScore, 50) * 2}%"></div></div>
        <div class="score-avg-value">${avgScore} pts</div>
      </div>
      ${forecastHtml}
      ${maturityHtml}
      ${detailsHtml}
    </div>`;
    this.showModalWithContent('Statistiques', content);
    setTimeout(() => this.animateStatsModal(mastery), 100);
  },

  animateStatsModal(target) {
    const el = document.querySelector('.mastery-value');
    if (el) {
      let cur = 0; const inc = target / (1000 / 16);
      const anim = () => { cur += inc; if (cur >= target) { el.textContent = target + '%'; } else { el.textContent = Math.round(cur) + '%'; requestAnimationFrame(anim); } };
      requestAnimationFrame(anim);
    }
    document.querySelectorAll('.animate-bar').forEach((bar, i) => {
      setTimeout(() => { bar.style.width = bar.style.getPropertyValue('--target-width'); }, i * 100);
    });
  },

  // ---- Rappels (SW) ----

  async restoreReviewReminders() {
    const reminders = JSON.parse(localStorage.getItem('flashcards_reminders') || '[]');
    const decks     = StorageManager.getDecks();
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      reminders.forEach(r => {
        const d = decks.find(x => x.id === r.deckId);
        if (d && reg.active) reg.active.postMessage({ type: 'ADD_REMINDER', deckId: r.deckId, deckName: d.name, intervalMinutes: r.intervalMinutes });
      });
    } catch {}
  },

  configureReviewReminders() {
    let saved = JSON.parse(localStorage.getItem('flashcards_reminders') || '[]');
    const decks = StorageManager.getDecks();
    const content = `<div style="padding:10px 0">
      <div class="form-group">
        <label>Deck</label>
        <div class="custom-select-wrapper">
          <select id="rem-deck" class="custom-select">
            <option value="">Sélectionner un deck</option>
            ${decks.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>
      <div class="form-group">
        <label>Intervalle</label>
        <div class="custom-select-wrapper">
          <select id="rem-interval" class="custom-select">
            <option value="60">Toutes les heures</option>
            <option value="360">Toutes les 6 heures</option>
            <option value="720">Toutes les 12 heures</option>
            <option value="1440" selected>Tous les jours</option>
            <option value="10080">Toutes les semaines</option>
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>
      <button type="button" id="add-rem-btn" class="btn btn-primary btn-add-reminder"><span>+ Ajouter le rappel</span></button>
      <div class="reminders-section">
        <h3 class="reminders-title">${Icons.getIcon('bell', 20, 'var(--primary-color)')} Rappels actifs</h3>
        <div id="reminders-list">
          ${saved.length === 0 ? '<p style="text-align:center;color:var(--text-secondary);padding:20px">Aucun rappel</p>' : ''}
          ${saved.map((r, i) => {
            const d = decks.find(x => x.id === r.deckId);
            return `<div class="reminder-item">
              <div class="reminder-item-content"><div class="reminder-item-title">${escapeHtml(d?.name ?? 'Deck supprimé')}</div><div class="reminder-item-details">${this.getIntervalText(r.intervalMinutes)}</div></div>
              <button class="btn-remove-reminder" data-index="${i}">Supprimer</button>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
    this.showModalWithContent('Rappels de révision', content);
    requestAnimationFrame(() => {
      document.getElementById('add-rem-btn')?.addEventListener('click', async () => {
        const deckId  = document.getElementById('rem-deck').value;
        const minutes = parseInt(document.getElementById('rem-interval').value);
        if (!deckId) { this.showToast('Sélectionnez un deck.', 'error'); return; }
        if (saved.find(r => r.deckId === deckId && r.intervalMinutes === minutes)) { this.showToast('Ce rappel existe déjà.', 'error'); return; }
        const id = Date.now() + Math.random();
        saved.push({ id, deckId, intervalMinutes: minutes });
        localStorage.setItem('flashcards_reminders', JSON.stringify(saved));
        await this.requestNotificationPermission().catch(() => {});
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const deck = decks.find(d => d.id === deckId);
            reg.active?.postMessage({ type: 'ADD_REMINDER', deckId, deckName: deck?.name ?? 'Deck', intervalMinutes: minutes, reminderId: id });
          } catch {}
        }
        this.configureReviewReminders();
      });
      document.querySelectorAll('.btn-remove-reminder').forEach(btn => {
        btn.addEventListener('click', async () => {
          const i = parseInt(btn.dataset.index);
          const r = saved[i];
          saved.splice(i, 1);
          localStorage.setItem('flashcards_reminders', JSON.stringify(saved));
          if ('serviceWorker' in navigator && r?.id) {
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            reg?.active?.postMessage({ type: 'REMOVE_REMINDER', reminderId: r.id });
          }
          this.configureReviewReminders();
        });
      });
    });
  },

  getIntervalText(m) {
    if (m < 60)    return `Toutes les ${m} minutes`;
    if (m === 60)  return 'Toutes les heures';
    if (m < 1440)  return `Toutes les ${m / 60} heures`;
    if (m === 1440)return 'Tous les jours';
    if (m < 10080) return `Tous les ${m / 1440} jours`;
    return `Toutes les ${m / 10080} semaines`;
  },

  async requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') { this.showToast('Notifications bloquées. Autorisez-les dans les paramètres.', 'error'); throw new Error('denied'); }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('not granted');
  },

  // ---- Tags ----

  getAllTags() {
    const tags = new Set();
    StorageManager.getDecks().forEach(d => d.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  },

  renderTagsFilter() {
    const container = document.getElementById('tags-filter-scroll');
    if (!container) return;
    const tags = this.getAllTags();
    const fc   = document.getElementById('tags-filter-container');
    const hasTags = tags.length > 0;
    if (fc) fc.style.display = hasTags ? 'block' : 'none';
    document.getElementById('my-decks-container')?.classList.toggle('has-tags-filter', hasTags);
    if (!hasTags) { this.currentTagFilter = 'all'; return; }
    // Si le tag sélectionné n'existe plus (deck supprimé/modifié), revenir à "Tous"
    if (this.currentTagFilter !== 'all' && !tags.includes(this.currentTagFilter)) this.currentTagFilter = 'all';
    // Dropdown compact (au lieu d'un bandeau de puces qui déborde quand il y a beaucoup de tags)
    container.innerHTML = `
      <div class="tag-filter-dropdown">
        <span class="tag-filter-icon">${Icons.getIcon('layers', 15, 'currentColor')}</span>
        <div class="custom-select-wrapper">
          <select id="tag-filter-select" class="custom-select" aria-label="Filtrer par tag">
            <option value="all"${this.currentTagFilter === 'all' ? ' selected' : ''}>Tous les tags</option>
            ${tags.map(t => `<option value="${escapeHtml(t)}"${this.currentTagFilter === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>`;
    document.getElementById('tag-filter-select')?.addEventListener('change', e => {
      this.currentTagFilter = e.target.value;
      this.renderDecks();
    });
  },

  filterDecksByTag(decks) {
    if (this.currentTagFilter === 'all') return decks;
    return decks.filter(d => d.tags?.includes(this.currentTagFilter));
  },

  // ---- Recherche & tri ----

  setupCardToolbar() {
    const searchInput = document.getElementById('cards-search');
    const clearBtn    = document.getElementById('clear-search');
    const sortSelect  = document.getElementById('cards-sort');
    const searchIcon  = document.querySelector('.search-icon');

    if (searchIcon) searchIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    const chips = [...document.querySelectorAll('.card-filter-chip')];
    const syncChips = () => {
      const q = (this.currentSearchQuery || '').trim();
      chips.forEach(c => c.classList.toggle('active', (c.dataset.filter || '') === q));
      // Si aucune puce ne correspond et que la requête est vide, activer « Toutes »
      if (!q) chips.find(c => !c.dataset.filter)?.classList.add('active');
    };

    const debouncedSearch = debounce(value => {
      this.currentSearchQuery = value.toLowerCase();
      clearBtn?.classList.toggle('hidden', !this.currentSearchQuery);
      syncChips();
      this.renderCards();
    }, 200);

    searchInput?.addEventListener('input', e => debouncedSearch(e.target.value));
    clearBtn?.addEventListener('click', () => { if (searchInput) { searchInput.value = ''; this.currentSearchQuery = ''; clearBtn.classList.add('hidden'); syncChips(); this.renderCards(); } });

    chips.forEach(chip => chip.addEventListener('click', () => {
      const f = chip.dataset.filter || '';
      this.currentSearchQuery = f;
      if (searchInput) searchInput.value = f;
      clearBtn?.classList.toggle('hidden', !f);
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.renderCards();
    }));

    if (sortSelect) {
      if (this.currentSortOption) sortSelect.value = this.currentSortOption;
      sortSelect.addEventListener('change', e => { this.currentSortOption = e.target.value; localStorage.setItem('flashcards_sortOption', e.target.value); this.renderCards(); });
    }
  },

  // Filtres type Anki : is:due, is:new, is:learning, is:suspended, is:leech, is:cloze
  _cardMatchesFilter(card, filter) {
    const now = Date.now();
    switch (filter) {
      case 'due':       return (!card.suspended) && (!card.nextReview || card.nextReview <= now);
      case 'new':       return card.state ? card.state === 'new' : ((card.repetitions ?? 0) === 0 && !card.lastReview);
      case 'learning':  return card.state === 'learning';
      case 'suspended': return !!card.suspended;
      case 'leech':     return !!card.isLeech || (card.lapses ?? 0) >= 8;
      case 'cloze':     return card.type === 'cloze';
      default:          return true;
    }
  },

  filterAndSortCards(cards) {
    let list = [...cards];
    // La requête peut contenir des jetons `is:xxx` + du texte libre
    const raw     = (this.currentSearchQuery || '').trim();
    const tokens  = raw.split(/\s+/).filter(Boolean);
    const filters = tokens.filter(t => t.startsWith('is:')).map(t => t.slice(3));
    const text    = tokens.filter(t => !t.startsWith('is:')).join(' ').toLowerCase();
    for (const f of filters) list = list.filter(c => this._cardMatchesFilter(c, f));
    if (text) {
      list = list.filter(c => (c.front ?? '').toLowerCase().includes(text) || (c.back ?? '').toLowerCase().includes(text));
    }
    switch (this.currentSortOption) {
      case 'score-asc':   list.sort((a, b) => (a.cardScore ?? 0) - (b.cardScore ?? 0)); break;
      case 'score-desc':  list.sort((a, b) => (b.cardScore ?? 0) - (a.cardScore ?? 0)); break;
      case 'alpha-asc':   list.sort((a, b) => (a.front ?? '').localeCompare(b.front ?? '')); break;
      case 'alpha-desc':  list.sort((a, b) => (b.front ?? '').localeCompare(a.front ?? '')); break;
      case 'review':      list.sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0)); break;
    }
    return list;
  },

  // ---- Toast ----

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    // Dé-duplication : ne pas empiler un toast identique déjà affiché
    if ([...container.querySelectorAll('.toast-message')].some(el => el.textContent === message)) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = { success: Icons.getIcon('success', 18, 'currentColor'), error: Icons.getIcon('close', 18, 'currentColor'), info: Icons.getIcon('help', 18, 'currentColor'), warning: Icons.getIcon('bell', 18, 'currentColor') };
    toast.innerHTML = `<span class="toast-icon">${icon[type] ?? icon.info}</span><span class="toast-message">${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show'); toast.classList.add('toast-hide');
      setTimeout(() => toast.parentNode?.removeChild(toast), 300);
    }, duration);
  },

  // ---- Modal de confirmation ----

  showConfirmModal(title, message, onConfirm, type = 'danger') {
    const modal     = document.getElementById('confirm-modal');
    const titleEl   = document.getElementById('confirm-modal-title');
    const msgEl     = document.getElementById('confirm-modal-message');
    const iconEl    = document.getElementById('confirm-modal-icon');
    const confirmBtn= document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    if (!modal) return;
    titleEl.textContent = title; msgEl.textContent = message;
    const color = type === 'danger' ? 'var(--error)' : 'var(--warning)';
    iconEl.innerHTML = type === 'danger' ? Icons.getIcon('delete', 48, color) : Icons.getIcon('help', 48, color);
    confirmBtn.className = type === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
    modal.classList.remove('hidden');
    const cleanup = () => { confirmBtn.removeEventListener('click', ok); cancelBtn.removeEventListener('click', cancel); modal.removeEventListener('click', outside); };
    const ok      = () => { modal.classList.add('hidden'); cleanup(); onConfirm?.(); };
    const cancel  = () => { modal.classList.add('hidden'); cleanup(); };
    const outside = e => { if (e.target === modal) cancel(); };
    confirmBtn.addEventListener('click', ok); cancelBtn.addEventListener('click', cancel); modal.addEventListener('click', outside);
  },

  // ---- Aide ----

  showHelpModal() {
    const pages = [
      {
        icon: 'zap', tint: 'tint-blue', title: 'Répétition espacée',
        items: [
          { icon: 'card',    t: 'Flashcard',          d: 'Recto = question, verso = réponse.' },
          { icon: 'refresh', t: 'Algorithme adaptatif', d: 'Tu notes chaque carte ; l\'app calcule la date idéale pour la revoir.' },
          { icon: 'target',  t: 'Moins d\'efforts',    d: 'Cartes difficiles plus souvent, faciles plus rarement.' }
        ]
      },
      {
        icon: 'rocket', tint: 'tint-sky', title: 'Démarrer',
        items: [
          { icon: 'plus', t: 'Créer un deck',      d: 'Bouton + en bas à droite.' },
          { icon: 'card', t: 'Ajouter des cartes', d: 'Ouvre un deck puis +. Type basique ou texte à trous.' },
          { icon: 'menu', t: 'Actions rapides',    d: 'Appui long sur un deck : réviser ou supprimer.' }
        ]
      },
      {
        icon: 'refresh', tint: 'tint-green', title: 'Réviser',
        items: [
          { icon: 'layers', t: '4 niveaux',  d: 'Encore · Difficile · Bien · Facile règlent le prochain intervalle.' },
          { icon: 'volume', t: 'Audio & annulation', d: 'Bouton haut-parleur pour la lecture ; touche Z (ou ↩) pour annuler une note.' }
        ],
        extra: `<div class="help-legend">
          <div class="help-legend-row"><span class="color-dot" style="background:#F44336"></span>Très difficile</div>
          <div class="help-legend-row"><span class="color-dot" style="background:#FF9800"></span>Difficile</div>
          <div class="help-legend-row"><span class="color-dot" style="background:#FFC107"></span>Moyen</div>
          <div class="help-legend-row"><span class="color-dot" style="background:#4CAF50"></span>Facile</div>
        </div>`
      },
      {
        icon: 'award', tint: 'tint-blue', title: 'Pour aller plus loin',
        items: [
          { icon: 'zap',      t: 'Formules LaTeX', d: '$…$ en ligne, $$…$$ pour une formule centrée.' },
          { icon: 'cloud',    t: 'Sync cloud',     d: 'Connecte-toi pour retrouver tes decks sur tous tes appareils.' },
          { icon: 'moon',     t: 'Mode sombre',    d: 'Menu → icône lune.' },
          { icon: 'download', t: 'Import / Export', d: 'Sauvegarde et partage tes decks en JSON.' }
        ]
      }
    ];
    const content = `<div class="help-modal-container">
      <div class="help-pages-wrapper">
        ${pages.map((p, i) => `<div class="help-page ${i === 0 ? 'active' : ''}">
          <div class="help-page-head">
            <span class="help-page-icon ${p.tint}">${Icons.getIcon(p.icon, 22)}</span>
            <h3 class="help-page-title">${p.title}</h3>
          </div>
          <div class="help-page-content">
            ${p.items.map(it => `<div class="help-item">
              <span class="help-item-icon">${Icons.getIcon(it.icon, 18, 'currentColor')}</span>
              <div class="help-item-text"><strong>${it.t}</strong><span>${it.d}</span></div>
            </div>`).join('')}
            ${p.extra ?? ''}
          </div>
        </div>`).join('')}
      </div>
      <div class="help-navigation">
        <button class="help-nav-btn" id="help-prev-btn" disabled>${Icons.getIcon('arrowLeft', 20, 'white')}</button>
        <div class="help-dots">${pages.map((_, i) => `<span class="help-dot ${i === 0 ? 'active' : ''}" data-page="${i}"></span>`).join('')}</div>
        <button class="help-nav-btn" id="help-next-btn">${Icons.getIcon('arrowRight', 20, 'white')}</button>
      </div>
    </div>`;
    this.showModalWithContent('Aide', content);
    requestAnimationFrame(() => {
      let cur = 0; const total = pages.length;
      const allPages = document.querySelectorAll('.help-page');
      const dots     = document.querySelectorAll('.help-dot');
      const prev     = document.getElementById('help-prev-btn');
      const next     = document.getElementById('help-next-btn');
      const go = n => {
        allPages[cur].classList.remove('active'); dots[cur].classList.remove('active');
        cur = n; allPages[cur].classList.add('active'); dots[cur].classList.add('active');
        if (prev) prev.disabled = cur === 0;
        if (next) next.disabled = cur === total - 1;
      };
      prev?.addEventListener('click', () => { if (cur > 0) go(cur - 1); });
      next?.addEventListener('click', () => { if (cur < total - 1) go(cur + 1); });
      dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    });
  },

  checkFirstVisit() {
    // Onboarding replaces help modal on first visit
    if (!localStorage.getItem('flashcards_hasVisited')) {
      setTimeout(() => {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.classList.remove('hidden');
      }, 300);
    }
  },

  // ---- Service Worker ----

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');

      // Periodic Sync (Android Chrome)
      if ('periodicSync' in reg) {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => ({ state: 'denied' }));
        if (status.state === 'granted') {
          await reg.periodicSync.register('check-notifications-periodic', { minInterval: 60 * 60 * 1000 }).catch(() => {});
        }
      }

      // Background Sync
      if ('sync' in reg) {
        await reg.sync.register('check-notifications').catch(() => {});
      }

      // Pas de setInterval ici — le SW gère ses propres cycles
    } catch (err) {
      if (window.location.protocol !== 'file:') console.error('SW registration failed:', err);
    }
  },

  setupServiceWorkerMessageListener() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'OPEN_DECK' && event.data.deckId) {
        this.openDeck(event.data.deckId);
      }
    });
  },

  // ---- Utilitaires ----

  addButtonFeedback(btn) {
    if (!btn) return;
    btn.classList.add('clicked');
    setTimeout(() => btn.classList.remove('clicked'), 200);
  },

  isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); },

  // ---- Rendu LaTeX (MathJax) ----
  // Typeset le contenu math d'un élément. No-op si MathJax pas encore chargé.
  renderMath(el) {
    if (!el) return;
    const mj = window.MathJax;
    if (!mj?.typesetPromise) return;
    try { mj.typesetClear?.([el]); } catch { /* ignore */ }
    mj.typesetPromise([el]).catch(() => { /* ignore erreurs de syntaxe LaTeX */ });
  },

  // ============================================================
  // FLASH FEEDBACK (after rating)
  // ============================================================
  _flashReviewFeedback(grade) {
    const cls = grade === 0 ? 'again-flash' : grade === 1 ? 'hard-flash' : grade === 2 ? 'good-flash' : 'easy-flash';
    const el  = document.createElement('div');
    el.className = `review-flash ${cls}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 250);
  },

  // ============================================================
  // CONFETTI (CSS-only particles)
  // ============================================================
  _launchConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    const colors = ['#2563eb','#3b82f6','#60a5fa','#0ea5e9','#38bdf8','#93c5fd'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.cssText = `
        left:${Math.random()*100}%;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        width:${6+Math.random()*8}px;
        height:${6+Math.random()*8}px;
        border-radius:${Math.random()>0.5?'50%':'2px'};
        animation-duration:${2+Math.random()*2}s;
        animation-delay:${Math.random()*0.8}s;
        opacity:${0.6+Math.random()*0.4};
      `;
      container.appendChild(p);
    }
    setTimeout(() => { container.innerHTML = ''; }, 4000);
  },

  // ============================================================
  // ACTIVITY LOG (for streak & heatmap)
  // ============================================================
  // Clé de date unique (jour calendaire UTC) — partagée par le log d'activité,
  // la heatmap et le graphique de progression pour rester cohérents.
  _dateKey(d = new Date()) { return d.toISOString().slice(0, 10); },

  // Retourne les clés des n derniers jours (du plus ancien au plus récent), en UTC.
  _lastNDayKeys(n) {
    const keys = [];
    const cur = new Date();
    cur.setUTCHours(12, 0, 0, 0);                 // midi UTC : évite les décalages de jour
    cur.setUTCDate(cur.getUTCDate() - (n - 1));
    for (let i = 0; i < n; i++) {
      keys.push(this._dateKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  },

  _logActivity(cardsReviewed) {
    const today = this._dateKey();
    const log   = JSON.parse(localStorage.getItem('flashcards_activity_log') || '{}');
    log[today]  = (log[today] || 0) + cardsReviewed;
    localStorage.setItem('flashcards_activity_log', JSON.stringify(log));
    this._updateStreak(today);
  },

  _updateStreak(today) {
    const log    = JSON.parse(localStorage.getItem('flashcards_activity_log') || '{}');
    const dates  = Object.keys(log).sort().reverse();
    let streak   = 0;
    let cursor   = new Date(today);
    for (let i = 0; i < 366; i++) {
      const d = cursor.toISOString().slice(0, 10);
      if (log[d]) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
    localStorage.setItem('flashcards_streak', streak);
    return streak;
  },

  _getStreak() { return parseInt(localStorage.getItem('flashcards_streak') || '0'); },

  // Journal des notes (pour la rétention). Construit avec le temps (pas rétroactif).
  _logReview(grade) {
    const today = this._dateKey();
    const log   = JSON.parse(localStorage.getItem('flashcards_review_log') || '{}');
    const day   = log[today] || { again: 0, hard: 0, good: 0, easy: 0 };
    const key   = ['again', 'hard', 'good', 'easy'][grade] ?? 'good';
    day[key]    = (day[key] || 0) + 1;
    log[today]  = day;
    const keys = Object.keys(log).sort();
    while (keys.length > 120) delete log[keys.shift()];  // garde ~120 jours
    localStorage.setItem('flashcards_review_log', JSON.stringify(log));
  },

  // Rétention = % de révisions réussies (≠ Encore) sur les N derniers jours.
  _retentionStats(days = 30) {
    const log   = JSON.parse(localStorage.getItem('flashcards_review_log') || '{}');
    const since = this._lastNDayKeys(days);
    let again = 0, ok = 0;
    for (const k of since) {
      const d = log[k]; if (!d) continue;
      again += d.again || 0;
      ok    += (d.hard || 0) + (d.good || 0) + (d.easy || 0);
    }
    const tot = again + ok;
    return { reviews: tot, retention: tot ? Math.round((ok / tot) * 100) : null };
  },

  // ============================================================
  // ONBOARDING
  // ============================================================
  setupOnboarding() {
    const overlay    = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    let currentSlide = 0;
    const slides     = overlay.querySelectorAll('.onboarding-slide');
    const dots       = overlay.querySelectorAll('.onboarding-dot');
    const nextBtn    = document.getElementById('onboarding-next-btn');
    const skipBtn    = document.getElementById('onboarding-skip-btn');

    const goTo = n => {
      slides[currentSlide]?.classList.remove('active');
      dots[currentSlide]?.classList.remove('active');
      currentSlide = Math.max(0, Math.min(n, slides.length - 1));
      slides[currentSlide]?.classList.add('active');
      dots[currentSlide]?.classList.add('active');
      if (nextBtn) nextBtn.textContent = currentSlide === slides.length - 1 ? '' : 'Suivant →';
      if (nextBtn) nextBtn.style.display = currentSlide === slides.length - 1 ? 'none' : 'flex';
    };

    const close = () => {
      overlay.classList.add('hidden');
      localStorage.setItem('flashcards_hasVisited', 'true');
    };

    nextBtn?.addEventListener('click', () => goTo(currentSlide + 1));
    skipBtn?.addEventListener('click', close);
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

    document.getElementById('onboarding-explore-btn')?.addEventListener('click', () => {
      close();
      setTimeout(() => this.switchDeckSection('base-decks'), 100);
    });

    document.getElementById('onboarding-create-btn')?.addEventListener('click', () => {
      close();
      setTimeout(() => this.showAddDeckModal(), 200);
    });

    // Swipe support
    let touchStartX = 0;
    overlay.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) { if (dx < 0) goTo(currentSlide + 1); else goTo(currentSlide - 1); }
    });
  },

  // ============================================================
  // STATS DASHBOARD (global)
  // ============================================================
  // ---- Graphiques (SVG natif, responsive, sans dépendance) ----

  // Donut de répartition par niveau de maîtrise
  _buildMasteryDonut(buckets) {
    const segs = [
      { label: 'Facile',        value: buckets.facile,  color: '#4CAF50' },
      { label: 'Moyen',         value: buckets.moyen,   color: '#FFC107' },
      { label: 'Difficile',     value: buckets.dur,     color: '#FF9800' },
      { label: 'Très difficile',value: buckets.tresDur, color: '#F44336' },
    ];
    const total = segs.reduce((s, x) => s + x.value, 0);
    if (total === 0) return `<div class="chart-empty">Aucune carte à analyser.</div>`;

    let cumulative = 0;
    const arcs = segs.filter(s => s.value > 0).map(s => {
      const pct = (s.value / total) * 100;
      const arc = `<circle class="donut-seg" cx="21" cy="21" r="15.915" fill="none"
          stroke="${s.color}" stroke-width="5"
          stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}"
          stroke-dashoffset="${(100 - cumulative + 25).toFixed(2)}"></circle>`;
      cumulative += pct;
      return arc;
    }).join('');

    const masteredPct = Math.round((buckets.facile / total) * 100);
    const legend = segs.map(s => `<div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${s.color}"></span>
        <span class="donut-legend-label">${s.label}</span>
        <span class="donut-legend-val">${s.value}</span>
      </div>`).join('');

    return `<div class="donut-chart-wrap">
      <svg class="donut-chart" viewBox="0 0 42 42" role="img" aria-label="Répartition par maîtrise">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--border-light)" stroke-width="5"></circle>
        ${arcs}
        <text x="21" y="20.5" class="donut-center-num">${masteredPct}%</text>
        <text x="21" y="25.5" class="donut-center-label">maîtrisé</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
  },

  // Courbe de progression : cartes révisées sur les 14 derniers jours
  _buildProgressionChart(actLog) {
    const keys = this._lastNDayKeys(14);
    const data = keys.map(k => actLog[k] || 0);
    const max  = Math.max(1, ...data);
    const W = 300, H = 110, padX = 8, padTop = 10, padBot = 22;
    const innerW = W - padX * 2, innerH = H - padTop - padBot, n = data.length;
    const x = i => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = v => padTop + innerH - (v / max) * innerH;
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const linePath = 'M' + pts.join(' L');
    const baseY = (padTop + innerH).toFixed(1);
    const areaPath = `M${x(0).toFixed(1)},${baseY} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${baseY} Z`;
    const dots = data.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="1.8" class="line-dot"></circle>`).join('');
    const labels = data.map((v, i) => {
      if (i % 3 !== 0 && i !== n - 1) return '';
      return `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="chart-x-label">${keys[i].slice(8, 10)}</text>`;
    }).join('');
    const totalReviewed = data.reduce((s, v) => s + v, 0);

    return `<div class="line-chart-wrap">
      <svg class="line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cartes révisées sur 14 jours">
        <path d="${areaPath}" class="line-area"></path>
        <path d="${linePath}" class="line-stroke"></path>
        ${dots}${labels}
      </svg>
    </div>
    <div class="chart-caption">${totalReviewed} carte${totalReviewed !== 1 ? 's' : ''} révisée${totalReviewed !== 1 ? 's' : ''} sur 14 jours</div>`;
  },

  renderStatsDashboard() {
    const container = document.getElementById('stats-dashboard-content');
    if (!container) return;

    // Important : les statistiques de révision ne portent QUE sur les decks de
    // l'utilisateur. Les decks de base (système) sont exclus de ces calculs.
    const userDecks = StorageManager.getDecks();
    const streak    = this._getStreak();
    const actLog    = JSON.parse(localStorage.getItem('flashcards_activity_log') || '{}');
    const sessions  = JSON.parse(localStorage.getItem('flashcards_sessions') || '[]');
    const now       = Date.now();
    const today     = new Date(); today.setHours(0,0,0,0);

    let totalCards = 0, masteredCards = 0, dueCards = 0, todayCards = 0;
    const buckets = { tresDur: 0, dur: 0, moyen: 0, facile: 0 };
    userDecks.forEach(deck => {
      if (!Array.isArray(deck.cards)) return;
      deck.cards.forEach(c => {
        totalCards++;
        const s = c.cardScore ?? 0;
        if (s >= 30) { masteredCards++; buckets.facile++; }
        else if (s >= 20) buckets.moyen++;
        else if (s >= 10) buckets.dur++;
        else buckets.tresDur++;
        if (!c.nextReview || c.nextReview <= now) dueCards++;
        if (c.lastReview && c.lastReview >= today.getTime()) todayCards++;
      });
    });

    // Heatmap : 12 semaines, alignées au dimanche, incluant la semaine en cours.
    const heatmapCells = [];
    const heatAnchor = new Date();
    heatAnchor.setUTCHours(12, 0, 0, 0);
    heatAnchor.setUTCDate(heatAnchor.getUTCDate() - heatAnchor.getUTCDay()); // dimanche de cette semaine
    heatAnchor.setUTCDate(heatAnchor.getUTCDate() - 7 * 11);                 // 11 semaines avant → 12 au total
    for (let week = 0; week < 12; week++) {
      const weekCells = [];
      for (let day = 0; day < 7; day++) {
        const d = new Date(heatAnchor); d.setUTCDate(d.getUTCDate() + week * 7 + day);
        const key   = this._dateKey(d);
        const count = actLog[key] || 0;
        const level = count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : count < 30 ? 3 : 4;
        weekCells.push(`<div class="heatmap-cell" data-level="${level}" title="${key} : ${count} carte${count !== 1 ? 's' : ''}"></div>`);
      }
      heatmapCells.push(`<div class="heatmap-week">${weekCells.join('')}</div>`);
    }

    // Graphiques
    const progressionChart = this._buildProgressionChart(actLog);
    const masteryDonut      = this._buildMasteryDonut(buckets);

    // Per-deck mastery bars
    const deckBars = userDecks.map(deck => {
      if (!Array.isArray(deck.cards) || deck.cards.length === 0) return '';
      const easy = deck.cards.filter(c => (c.cardScore ?? 0) >= 30).length;
      const pct  = Math.round((easy / deck.cards.length) * 100);
      return `<div class="deck-mastery-bar">
        <div class="deck-mastery-name" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</div>
        <div class="deck-mastery-track"><div class="deck-mastery-fill animate-bar" style="--target-width:${pct}%"></div></div>
        <div class="deck-mastery-pct">${pct}%</div>
      </div>`;
    }).join('');

    // Recent sessions
    const recentSessions = sessions.slice(-5).reverse().map(s => {
      const d = new Date(s.date);
      const label = d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
      return `<div class="session-item">
        <span class="session-deck">${escapeHtml(s.deckName)}</span>
        <span class="session-score">${s.score}%</span>
        <span class="session-date">${label}</span>
      </div>`;
    }).join('');

    container.innerHTML = `
      <!-- Streak -->
      <div class="streak-card">
        <div class="streak-icon">${Icons.getIcon('flame', 30, 'currentColor')}</div>
        <div class="streak-info">
          <div class="streak-number">${streak}</div>
          <div class="streak-label">jour${streak !== 1 ? 's' : ''} consécutif${streak !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <!-- Overview -->
      <div class="stats-overview">
        <div class="stats-overview-card">
          <div class="stats-overview-label">Total cartes</div>
          <div class="stats-overview-value">${totalCards}</div>
        </div>
        <div class="stats-overview-card">
          <div class="stats-overview-label">Maîtrisées</div>
          <div class="stats-overview-value" style="color:var(--success)">${masteredCards}</div>
          <div class="stats-overview-sub">${totalCards ? Math.round(masteredCards/totalCards*100) : 0}%</div>
        </div>
        <div class="stats-overview-card">
          <div class="stats-overview-label">À réviser</div>
          <div class="stats-overview-value" style="color:var(--warning)">${dueCards}</div>
        </div>
        <div class="stats-overview-card">
          <div class="stats-overview-label">Aujourd'hui</div>
          <div class="stats-overview-value" style="color:var(--accent-light)">${todayCards}</div>
        </div>
      </div>

      <!-- Progression -->
      <div class="stats-chart-section">
        <h3>Progression — 14 jours</h3>
        ${progressionChart}
      </div>

      <!-- Répartition par maîtrise -->
      <div class="stats-chart-section">
        <h3>Répartition par maîtrise</h3>
        ${masteryDonut}
      </div>

      <!-- Heatmap -->
      <div class="activity-section">
        <h3>Activité — 12 semaines</h3>
        <div class="heatmap-grid">${heatmapCells.join('')}</div>
      </div>

      ${deckBars ? `
      <!-- Per-deck bars -->
      <div class="stats-decks-section">
        <h3>Maîtrise par deck</h3>
        ${deckBars}
      </div>` : ''}

      ${recentSessions ? `
      <!-- Recent sessions -->
      <div class="recent-sessions">
        <h3>Sessions récentes</h3>
        ${recentSessions}
      </div>` : ''}
    `;

    // Animate bars
    setTimeout(() => {
      container.querySelectorAll('.deck-mastery-fill.animate-bar').forEach(el => {
        el.style.width = el.style.getPropertyValue('--target-width');
      });
    }, 100);
  },

  // ============================================================
  // QUIZ SETUP BACK BTN
  // ============================================================
  setupQuizBackBtn() {
    document.getElementById('quiz-back-btn')?.addEventListener('click', () => {
      this.currentDeckId ? this.showDeckDetailView() : this.showDecksView();
    });
  },

  // ============================================================
  // QUIZ / EXAM MODE
  // ============================================================
  showQuizSetupModal() {
    if (!this.currentDeckId) return;
    const fullDeck = this.getCurrentDeck();
    // Le mode examen (QCM / Vrai-Faux) ne gère que les cartes recto/verso, pas les cloze.
    const quizCards = (fullDeck?.cards ?? []).filter(c => !Cloze.isCloze(c));
    const deck = fullDeck ? { ...fullDeck, cards: quizCards } : null;
    if (!deck || quizCards.length < 4) {
      this.showToast('Il faut au moins 4 cartes recto/verso pour le mode examen.', 'error'); return;
    }
    const content = `<form id="quiz-setup-form">
      <div class="form-group">
        <label for="quiz-count">Nombre de questions</label>
        <div class="custom-select-wrapper">
          <select id="quiz-count" class="custom-select">
            <option value="10">10 questions</option>
            <option value="20">20 questions</option>
            <option value="all">Toutes (${deck.cards.length})</option>
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>
      <div class="form-group">
        <label for="quiz-type">Type de questions</label>
        <div class="custom-select-wrapper">
          <select id="quiz-type" class="custom-select">
            <option value="mcq">QCM (4 choix)</option>
            <option value="truefalse">Vrai / Faux</option>
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>
      <div class="form-group">
        <label for="quiz-timer">Temps par question</label>
        <div class="custom-select-wrapper">
          <select id="quiz-timer" class="custom-select">
            <option value="0">Illimité</option>
            <option value="15">15 secondes</option>
            <option value="30">30 secondes</option>
          </select>
          <div class="custom-select-arrow">${Icons.getIcon('arrowDown', 12)}</div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="quiz-setup-cancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Commencer l'examen</button>
      </div>
    </form>`;
    this.showModalWithContent('Mode Examen', content);
    requestAnimationFrame(() => {
      document.getElementById('quiz-setup-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('quiz-setup-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const countVal = document.getElementById('quiz-count').value;
        const count    = countVal === 'all' ? deck.cards.length : Math.min(parseInt(countVal), deck.cards.length);
        const type     = document.getElementById('quiz-type').value;
        const timer    = parseInt(document.getElementById('quiz-timer').value);
        this.hideModal();
        this.startQuiz({ deck, count, type, timer });
      });
    });
  },

  startQuiz({ deck, count, type, timer }) {
    const shuffled = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, count);
    this.quizState = {
      questions: shuffled,
      type,
      timer,
      currentIndex: 0,
      score: 0,
      wrong: [],
      timerInterval: null
    };
    this.showView('quiz');
    this._renderQuizQuestion();
  },

  _renderQuizQuestion() {
    const { questions, type, timer, currentIndex, score } = this.quizState;
    if (currentIndex >= questions.length) { this._showQuizResults(); return; }

    const q   = questions[currentIndex];
    const pct = Math.round(((currentIndex) / questions.length) * 100);

    document.getElementById('quiz-progress-fill').style.width = pct + '%';
    document.getElementById('quiz-score-chip').textContent = `${score} / ${currentIndex}`;

    // Timer bar
    const timerBar = document.getElementById('quiz-timer-bar');
    if (timerBar) timerBar.style.display = timer > 0 ? 'block' : 'none';

    const content = document.getElementById('quiz-content');
    if (!content) return;

    if (type === 'mcq') {
      // Build distractors from other cards
      const others   = questions.filter((_, i) => i !== currentIndex).sort(() => Math.random() - 0.5);
      const wrong3   = others.slice(0, 3).map(c => c.back);
      const choices  = [...wrong3, q.back].sort(() => Math.random() - 0.5);

      content.innerHTML = `
        <div class="quiz-question-area">
          <div class="quiz-question-number">Question ${currentIndex + 1} / ${questions.length}</div>
          <div class="quiz-question-text">${escapeHtml(q.front)}</div>
        </div>
        <div class="quiz-choices-grid">
          ${choices.map((c, i) => `
            <button class="quiz-choice" data-answer="${escapeHtml(c)}" data-correct="${c === q.back}">
              ${escapeHtml(c)}
            </button>`).join('')}
        </div>`;

      content.querySelectorAll('.quiz-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          const isCorrect = btn.dataset.correct === 'true';
          content.querySelectorAll('.quiz-choice').forEach(b => {
            b.disabled = true;
            if (b.dataset.correct === 'true') b.classList.add('reveal-correct');
          });
          btn.classList.add(isCorrect ? 'selected-correct' : 'selected-wrong');
          if (isCorrect) this.quizState.score++;
          else this.quizState.wrong.push({ q: q.front, a: q.back });
          clearInterval(this.quizState.timerInterval);
          setTimeout(() => { this.quizState.currentIndex++; this._renderQuizQuestion(); }, 1000);
        });
      });
    } else {
      // True / False
      const isTrue = Math.random() > 0.5;
      const displayed = isTrue ? q.back : questions[(currentIndex + 1) % questions.length]?.back ?? q.back;
      const correct   = isTrue;

      content.innerHTML = `
        <div class="quiz-question-area">
          <div class="quiz-question-number">Question ${currentIndex + 1} / ${questions.length}</div>
          <div class="quiz-question-text">${escapeHtml(q.front)}</div>
          <p style="margin-top:16px;font-size:16px;color:var(--text-secondary);font-style:italic">"${escapeHtml(displayed)}"</p>
        </div>
        <div class="quiz-choices-grid" style="grid-template-columns:1fr 1fr">
          <button class="quiz-choice" data-answer="true">${Icons.getIcon('check', 18, 'currentColor')} VRAI</button>
          <button class="quiz-choice" data-answer="false">${Icons.getIcon('close', 18, 'currentColor')} FAUX</button>
        </div>`;

      content.querySelectorAll('.quiz-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen    = btn.dataset.answer === 'true';
          const isCorrect = chosen === correct;
          content.querySelectorAll('.quiz-choice').forEach(b => {
            b.disabled = true;
            if ((b.dataset.answer === 'true') === correct) b.classList.add('reveal-correct');
          });
          btn.classList.add(isCorrect ? 'selected-correct' : 'selected-wrong');
          if (isCorrect) this.quizState.score++;
          else this.quizState.wrong.push({ q: q.front, a: q.back });
          clearInterval(this.quizState.timerInterval);
          setTimeout(() => { this.quizState.currentIndex++; this._renderQuizQuestion(); }, 1000);
        });
      });
    }

    this.renderMath(content);

    // Timer
    if (timer > 0) {
      let remaining = timer;
      const fill = timerBar;
      if (fill) fill.style.transform = 'scaleX(1)';
      clearInterval(this.quizState.timerInterval);
      this.quizState.timerInterval = setInterval(() => {
        remaining--;
        if (fill) fill.style.transform = `scaleX(${remaining / timer})`;
        if (remaining <= 0) {
          clearInterval(this.quizState.timerInterval);
          this.quizState.wrong.push({ q: q.front, a: q.back });
          this.quizState.currentIndex++;
          this._renderQuizQuestion();
        }
      }, 1000);
    }
  },

  _showQuizResults() {
    clearInterval(this.quizState?.timerInterval);
    const { score, questions, wrong } = this.quizState;
    const total = questions.length;
    const pct   = Math.round((score / total) * 100);
    const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';

    // Save session
    const sessions = JSON.parse(localStorage.getItem('flashcards_sessions') || '[]');
    const deck     = this.getCurrentDeck();
    sessions.push({ date: Date.now(), deckName: deck?.name ?? 'Deck', score: pct });
    if (sessions.length > 20) sessions.splice(0, sessions.length - 20);
    localStorage.setItem('flashcards_sessions', JSON.stringify(sessions));

    // Un examen est aussi une révision : on l'enregistre dans le log d'activité
    // (alimente la heatmap "Activité", le streak et le graphique de progression).
    this._logActivity(total);

    if (pct >= 80) this._launchConfetti();

    const wrongHtml = wrong.slice(0, 5).map(w => `
      <div class="quiz-wrong-item">
        <div class="quiz-wrong-q">${escapeHtml(w.q)}</div>
        <div class="quiz-wrong-a">${escapeHtml(w.a)}</div>
      </div>`).join('');

    document.getElementById('quiz-content').innerHTML = `
      <div class="quiz-results">
        <div class="quiz-grade">${grade}</div>
        <div class="quiz-score-display">${score} / ${total} correct${score !== 1 ? 's' : ''}</div>
        <div class="quiz-score-sub">${pct}% de réussite</div>
        ${wrong.length ? `<div class="quiz-wrong-list"><h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">À revoir</h4>${wrongHtml}</div>` : `<p class="quiz-perfect">${Icons.getIcon('award', 20, 'currentColor')} Parfait, sans faute !</p>`}
        <div style="display:flex;gap:10px;width:100%">
          <button class="btn btn-secondary" id="quiz-result-back" style="flex:1">Retour au deck</button>
          ${wrong.length ? `<button class="btn btn-primary" id="quiz-result-retry" style="flex:1">Revoir les erreurs</button>` : ''}
        </div>
      </div>`;

    document.getElementById('quiz-result-back')?.addEventListener('click', () => this.showDeckDetailView());
    document.getElementById('quiz-result-retry')?.addEventListener('click', () => {
      const deck = this.getCurrentDeck();
      if (!deck) return;
      const wrongCards = deck.cards.filter(c => wrong.some(w => w.q === c.front));
      if (wrongCards.length >= 2) {
        this.startQuiz({ deck: { ...deck, cards: wrongCards }, count: wrongCards.length, type: this.quizState.type, timer: this.quizState.timer });
      }
    });
  }
};

// ============================================================
// Démarrage
// ============================================================
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
