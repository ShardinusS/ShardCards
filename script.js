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
      layers:    `<svg ${s}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
    };
    return icons[name] ?? '';
  }
};

// ============================================================
// ALGORITHME SM-2
// ============================================================
const SM2 = {
  calculateNextReview(card, quality) {
    const now = Date.now();
    card.easeFactor  ??= 2.5; card.interval ??= 1;
    card.repetitions ??= 0;   card.againCount ??= 0; card.cardScore ??= 0;
    if (quality === 0) {
      card.againCount++; card.cardScore = Math.max(0, card.cardScore - 10);
      card.interval = 1; card.repetitions = 0;
    } else {
      card.cardScore  += quality === 1 ? 5 : 20;
      card.easeFactor  = Math.max(1.3, card.easeFactor + (quality === 1 ? -0.15 : 0.15));
      card.repetitions++;
      if      (card.repetitions === 1) card.interval = 1;
      else if (card.repetitions === 2) card.interval = 6;
      else    card.interval = Math.round(card.interval * card.easeFactor);
    }
    card.nextReview = now + card.interval * 86_400_000;
    card.lastReview = now;
    return card;
  },
  getCardsToReview(deck, limit = null) {
    const now = Date.now();
    const scored = deck.cards.map(card => {
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

  // ---- Init ----
  async init() {
    this.cardsPerSession = parseInt(localStorage.getItem('flashcards_cardsPerSession') || '10') || 10;
    this.isReversedMode  = localStorage.getItem('flashcards_reversedMode') === 'true';
    const savedSort      = localStorage.getItem('flashcards_sortOption');
    if (savedSort) this.currentSortOption = savedSort;
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
    document.getElementById('again-btn')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (this.isRevealed) { this.addButtonFeedback(e.currentTarget); this.rateCard(0); } });
    document.getElementById('good-btn')?.addEventListener('click',  e => { e.preventDefault(); e.stopPropagation(); if (this.isRevealed) { this.addButtonFeedback(e.currentTarget); this.rateCard(1); } });
    document.getElementById('easy-btn')?.addEventListener('click',  e => { e.preventDefault(); e.stopPropagation(); if (this.isRevealed) { this.addButtonFeedback(e.currentTarget); this.rateCard(2); } });

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
      current.style.display = 'none';
    }
    // On laisse l'animation CSS `.view.active { animation: viewEnter }` gérer la transition.
    // (Les anciens styles inline opacity/transform entraient en conflit avec ce keyframe → flicker.)
    next.style.display = 'flex';
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
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">${Icons.getIcon('books', 64, 'var(--text-secondary)')}</div>
        <div class="empty-state-text">${all.length === 0 ? 'Aucun deck. Créez-en un !' : 'Aucun deck avec ce tag.'}</div>
      </div>`;
      return;
    }

    const now = Date.now();
    container.innerHTML = decks.map(deck => {
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
    }).join('');

    this._attachDeckListeners(container, false);
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

    container.innerHTML = this.baseDecks.map(deck => {
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
    }).join('');

    this._attachDeckListeners(container, true);
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
      const actions  = this.currentIsBaseDeck ? '' : `
        <button class="card-action-btn-compact" data-card-index="${index}" data-action="edit">${Icons.getIcon('edit', 14)} Modifier</button>
        <button class="card-action-btn-compact card-action-btn-delete" data-card-index="${index}" data-action="delete">${Icons.getIcon('delete', 14)} Supprimer</button>`;
      return `<div class="card-grid-item" data-score="${score}">
        <span class="card-difficulty-badge" style="background:${color};" title="${zone}"></span>
        <div class="card-grid-section"><div class="card-grid-label">Recto</div>${frontImg}<div class="card-grid-text">${escapeHtml(card.front) || '<span class="card-grid-empty">-</span>'}</div></div>
        <div class="card-grid-section"><div class="card-grid-label">Verso</div>${backImg}<div class="card-grid-text">${escapeHtml(card.back) || '<span class="card-grid-empty">-</span>'}</div></div>
        <div class="card-grid-actions">${actions}</div>
      </div>`;
    }).join('');

    if (!this.currentIsBaseDeck) {
      container.querySelectorAll('.card-action-btn-compact').forEach(btn => {
        const idx    = parseInt(btn.dataset.cardIndex);
        const action = btn.dataset.action;
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          if (action === 'edit') this.showEditCardModal(idx);
          else this.deleteCard(idx);
        });
      });
    }
  },

  // ---- Révision ----

  showReviewView() {
    if (!this.currentDeckId) return;
    const deck = this.getCurrentDeck();
    if (!deck) return;
    this.reviewCards = SM2.getCardsToReview(deck, this.cardsPerSession);
    if (this.reviewCards.length === 0) { this.showToast('Aucune carte à réviser pour le moment !', 'info'); return; }
    this.currentReviewIndex = 0;
    this.isRevealed = false;
    this.showView('review');
    this.showReviewCard();
  },

  showReviewCard() {
    if (this.currentReviewIndex >= this.reviewCards.length) { this.completeReview(); return; }
    const card     = this.reviewCards[this.currentReviewIndex];
    const reversed = this.isReversedMode;
    const dFront      = reversed ? card.back  : card.front;
    const dBack       = reversed ? card.front : card.back;
    const dFrontImage = reversed ? card.backImage  : card.frontImage;
    const dBackImage  = reversed ? card.frontImage : card.backImage;
    const frontLabel  = reversed ? 'Réponse' : 'Question';
    const backLabel   = reversed ? 'Question' : 'Réponse';

    const buildHtml = (text, image, label) => {
      let html = '';
      const hasImg  = image?.trim();
      const hasText = text?.trim();
      if (hasImg)  html += `<div class="review-image-container"><img src="${escapeHtml(image)}" alt="${label}" class="review-image"></div>`;
      if (hasText) html += `<p class="${hasImg ? 'review-text review-text-with-image' : 'review-text'}">${escapeHtml(text)}</p>`;
      if (!hasImg && !hasText) html = `<p class="review-text" style="color:var(--text-secondary);font-style:italic">Aucun contenu</p>`;
      return html;
    };

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
    if (fc) fc.innerHTML = buildHtml(dFront, dFrontImage, frontLabel);
    if (bc) bc.innerHTML = buildHtml(dBack,  dBackImage,  backLabel);
    if (fi) fi.classList.remove('flipped');

    const prog = document.getElementById('review-progress');
    if (prog) prog.textContent = `${this.currentReviewIndex + 1} / ${this.reviewCards.length}`;
    this.isRevealed = false;
    document.getElementById('review-buttons')?.classList.add('hidden');
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
  },

  revealCard() {
    const fi = document.getElementById('flip-card-inner');
    if (fi && !fi.classList.contains('flipped')) { fi.classList.add('flipped'); this.isRevealed = true; const btns = document.getElementById('review-buttons'); if (btns) setTimeout(() => btns.classList.remove('hidden'), 300); }
  },

  rateCard(quality) {
    if (!this.isRevealed) this.revealCard();
    if (this.currentReviewIndex >= this.reviewCards.length) { this.completeReview(); return; }
    const card = this.reviewCards[this.currentReviewIndex];
    if (!card) { this.completeReview(); return; }

    this._flashReviewFeedback(quality);
    SM2.calculateNextReview(card, quality);
    const deck = this.getCurrentDeck();
    if (deck) {
      const idx = deck.cards.findIndex(c => c.front === card.front && c.back === card.back);
      if (idx >= 0) {
        const dc = deck.cards[idx];
        Object.assign(dc, { cardScore: card.cardScore, nextReview: card.nextReview, lastReview: card.lastReview, easeFactor: card.easeFactor, interval: card.interval, repetitions: card.repetitions, againCount: card.againCount });
      }
      if (this.currentIsBaseDeck) {
        const key = `baseDeckScores_${this.currentDeckId}`;
        const scores = {};
        deck.cards.forEach((c, i) => { scores[i] = { cardScore: c.cardScore ?? 0, nextReview: c.nextReview ?? null, easeFactor: c.easeFactor ?? 2.5, interval: c.interval ?? 0, repetitions: c.repetitions ?? 0, lastReview: c.lastReview ?? null, againCount: c.againCount ?? 0 }; });
        localStorage.setItem(key, JSON.stringify(scores));
      } else {
        StorageManager.saveDeck(deck);
      }
    }

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

  completeReview() {
    const total      = this.reviewCards.length;
    const againCount = this.reviewCards.filter(c => (c.cardScore ?? 0) === 0 || c.againCount > 0).length;
    const score      = Math.round(((total - Math.min(againCount, total)) / total) * 100);

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
      <div class="form-group"><label>Recto</label><textarea id="new-card-front" placeholder="Question"></textarea></div>
      <div class="form-group">
        <label>Image recto (optionnel)</label>
        <label for="new-card-front-img" class="btn-import-image" style="cursor:pointer;display:inline-block;color:white">Choisir un fichier</label>
        <input type="file" id="new-card-front-img" accept="image/*" style="display:none">
        <div id="prev-front" class="image-preview" style="display:none"><img id="prev-front-img" class="preview-image" alt=""><button type="button" class="btn-remove-preview" data-side="front">×</button></div>
      </div>
      <div class="form-group"><label>Verso</label><textarea id="new-card-back" placeholder="Réponse"></textarea></div>
      <div class="form-group">
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
      document.getElementById('add-card-cancel')?.addEventListener('click', () => this.hideModal());
      document.getElementById('new-card-front-img')?.addEventListener('change', e => this.handleImageUpload(e.target.files[0], 'front', form));
      document.getElementById('new-card-back-img')?.addEventListener('change',  e => this.handleImageUpload(e.target.files[0], 'back',  form));
      form.querySelectorAll('.btn-remove-preview').forEach(btn => btn.addEventListener('click', () => this.removePreview(btn.dataset.side, form)));
      form.addEventListener('submit', e => {
        e.preventDefault();
        const front = form.querySelector('#new-card-front')?.value.trim() ?? '';
        const back  = form.querySelector('#new-card-back')?.value.trim()  ?? '';
        const fi    = form.dataset.frontImage ?? '';
        const bi    = form.dataset.backImage  ?? '';
        if (!front && !fi) { this.showToast('Recto requis (texte ou image).', 'error'); return; }
        if (!back  && !bi) { this.showToast('Verso requis (texte ou image).', 'error'); return; }
        this.addCardWithValues(front, back, fi, bi);
      });
    }, 50);
  },

  async addCardWithValues(front, back, frontImage, backImage) {
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
    front,
    back,
    frontImage: uploadedFrontUrl || '',
    backImage:  uploadedBackUrl  || '',
    cardScore: 0,
    againCount: 0,
    nextReview: null,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0
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
    this._editingCardIndex = cardIndex;
    this._editingCardData  = { frontImage: card.frontImage ?? '', backImage: card.backImage ?? '' };
    const content = `<form id="edit-card-form">
      <div class="form-group"><label>Recto</label><textarea id="edit-card-front">${escapeHtml(card.front)}</textarea></div>
      <div class="form-group">
        <label>Image recto</label>
        <label for="edit-front-img" class="btn-import-image" style="cursor:pointer;display:inline-block;color:white">Choisir un fichier</label>
        <input type="file" id="edit-front-img" accept="image/*" style="display:none">
        <div id="prev-front" class="image-preview" style="display:${card.frontImage ? 'block' : 'none'}">
          <img id="prev-front-img" class="preview-image" src="${escapeHtml(card.frontImage ?? '')}" alt="">
          <button type="button" class="btn-remove-preview" data-side="front">×</button>
        </div>
      </div>
      <div class="form-group"><label>Verso</label><textarea id="edit-card-back">${escapeHtml(card.back)}</textarea></div>
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

  if (!front && !fi) { this.showToast('Recto requis.', 'error'); return; }
  if (!back  && !bi) { this.showToast('Verso requis.', 'error'); return; }

  const deck = this.getCurrentDeck();
  if (!deck?.cards[idx]) return;
  const card = deck.cards[idx];

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

  Object.assign(card, { front, back, frontImage: fi, backImage: bi });
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
          cards: data.cards.map(c => ({ front: c.front ?? '', back: c.back ?? '', frontImage: c.frontImage ?? '', backImage: c.backImage ?? '', cardScore: 0, againCount: 0, easeFactor: 2.5, interval: 1, repetitions: 0, nextReview: null, lastReview: null })),
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
    const content = `<form id="review-settings-form">
      <div class="form-group">
        <label for="cards-per-session">Cartes par session</label>
        <input type="number" id="cards-per-session" min="1" max="100" value="${this.cardsPerSession}" required>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="reversed-mode" ${this.isReversedMode ? 'checked' : ''}>
          <span class="checkbox-custom"></span><span>Mode révision inversé</span>
        </label>
      </div>
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
        if (n > 0 && n <= 100) {
          this.cardsPerSession = n; localStorage.setItem('flashcards_cardsPerSession', n.toString());
          this.isReversedMode = r; localStorage.setItem('flashcards_reversedMode', r.toString());
          this.hideModal(); this.showToast('Paramètres sauvegardés', 'success');
        } else { this.showToast('Valeur entre 1 et 100.', 'error'); }
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
    // Réserve l'espace sous la barre de tags (fixed) pour ne pas chevaucher la grille
    document.getElementById('my-decks-container')?.classList.toggle('has-tags-filter', hasTags);
    if (!hasTags) return;
    container.innerHTML = `
      <button class="tag-filter-btn ${this.currentTagFilter === 'all' ? 'active' : ''}" data-tag="all">Tous</button>
      ${tags.map(t => `<button class="tag-filter-btn ${this.currentTagFilter === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}`;
    container.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTagFilter = btn.dataset.tag;
        container.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); this.renderDecks();
      });
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

    const debouncedSearch = debounce(value => {
      this.currentSearchQuery = value.toLowerCase();
      clearBtn?.classList.toggle('hidden', !this.currentSearchQuery);
      this.renderCards();
    }, 200);

    searchInput?.addEventListener('input', e => debouncedSearch(e.target.value));
    clearBtn?.addEventListener('click', () => { if (searchInput) { searchInput.value = ''; this.currentSearchQuery = ''; clearBtn.classList.add('hidden'); this.renderCards(); } });

    if (sortSelect) {
      if (this.currentSortOption) sortSelect.value = this.currentSortOption;
      sortSelect.addEventListener('change', e => { this.currentSortOption = e.target.value; localStorage.setItem('flashcards_sortOption', e.target.value); this.renderCards(); });
    }
  },

  filterAndSortCards(cards) {
    let list = [...cards];
    if (this.currentSearchQuery) {
      list = list.filter(c => (c.front ?? '').toLowerCase().includes(this.currentSearchQuery) || (c.back ?? '').toLowerCase().includes(this.currentSearchQuery));
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
      { title: "Qu'est-ce qu'une flashcard ?",
        content: `<p><strong>ShardCards</strong> utilise la <strong>répétition espacée</strong> (algorithme SM-2) pour mémoriser efficacement.</p><p style="margin-top:10px"><strong>Flashcard :</strong> carte avec recto (question) et verso (réponse).</p><p style="margin-top:10px">Les cartes difficiles reviennent plus souvent, les faciles moins souvent. Résultat : mémorisation optimale en moins de temps.</p>` },
      { title: 'Démarrer avec ShardCards',
        content: `<p><strong>Créer un deck :</strong> bouton <strong>+</strong> en bas à droite.</p><p style="margin-top:10px"><strong>Ajouter des cartes :</strong> ouvrez un deck, puis cliquez sur <strong>+</strong>.</p><p style="margin-top:10px"><strong>Actions rapides :</strong> appui long sur un deck pour réviser ou supprimer.</p>` },
      { title: 'Réviser',
        content: `<p><strong>Lancer une révision :</strong> appui long → Réviser, ou menu hamburger.</p><p style="margin-top:10px"><strong>Couleurs de difficulté :</strong></p><ul style="margin-top:8px;padding-left:20px;font-size:14px"><li><span style="color:#F44336">● Rouge</span> — Très difficile</li><li><span style="color:#FF9800">● Orange</span> — Difficile</li><li><span style="color:#FFC107">● Jaune</span> — Moyen</li><li><span style="color:#4CAF50">● Vert</span> — Facile</li></ul>` },
      { title: 'Fonctionnalités avancées',
        content: `<p><strong>Synchronisation cloud :</strong> connectez-vous (menu hamburger) pour sauvegarder vos decks en ligne et les retrouver sur tous vos appareils.</p><p style="margin-top:10px"><strong>Mode sombre :</strong> menu hamburger → icône lune.</p><p style="margin-top:10px"><strong>Import/Export JSON :</strong> partagez vos decks ou faites des sauvegardes.</p>` }
    ];
    const content = `<div class="help-modal-container">
      <div class="help-pages-wrapper">
        ${pages.map((p, i) => `<div class="help-page ${i === 0 ? 'active' : ''}">
          <h3 class="help-page-title">${Icons.getIcon('help', 24, 'var(--primary-color)')} ${p.title}</h3>
          <div class="help-page-content">${p.content}</div>
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

  // ============================================================
  // FLASH FEEDBACK (after rating)
  // ============================================================
  _flashReviewFeedback(quality) {
    const cls = quality === 0 ? 'again-flash' : quality === 1 ? 'good-flash' : 'easy-flash';
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
    const deck = this.getCurrentDeck();
    if (!deck || deck.cards.length < 4) {
      this.showToast('Il faut au moins 4 cartes pour le mode examen.', 'error'); return;
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
