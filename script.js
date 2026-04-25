// ============================================================
  // script.js — ShardCards (Refactorisé avec modules)
  // ============================================================

  // Import store first to set up window.AppState before other modules
  import { store } from './store.js';
  window.AppState = store;
  window.App = store;

  // Import longpress
  import { addLongPress, addSwipeGesture } from './longpress.js';
  window.addLongPress = addLongPress;
  window.addSwipeGesture = addSwipeGesture;

  // Import utils
  import * as Utils from './utils.js';
  window.Utils = Utils;

  // Import icons
  import { Icons } from './icons.js';
  window.Icons = Icons;

  // Inject icons into DOM with safety for DOM readiness
  const renderIcons = () => {
    if (!window.Icons || typeof window.Icons.getIcon !== 'function') return;
    document.querySelectorAll('.icon-svg').forEach(el => {
      if (el.innerHTML.trim()) return;
      const cls = Array.from(el.classList).find(c => c.startsWith('icon-') && c !== 'icon-svg');
      if (!cls) return;
      const name = cls.substring(5);
      el.innerHTML = window.Icons.getIcon(name, 24, 'currentColor');
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderIcons);
  } else {
    renderIcons();
  }

  // Now import other modules (they can safely use window.AppState)
  import { UI } from './ui.js';
  import { ReviewSession, SM2, ColorZones } from './review.js';
  import { DeckManager } from './deck-manager.js';
  import { NotificationManager } from './notifications.js';
  import { SearchSort } from './search-sort.js';
  import { StorageManager } from './storage-manager.js';
  import { AuthService, SupabaseStorage } from './supabase-client.js';

// ============================================================
// BASE DECKS DATA
// ============================================================
function getBaseDecksData() {
  return [
    { id: 'base-programming', name: 'Programmation', tags: ['dev'], cards: [
      { id: 'p1', front: "fonction pure", back: "Same input → same output, no side effects" },
      { id: 'p2', front: "closure", back: "Function that captures its lexical environment" },
      { id: 'p3', front: "this", back: "Reference to current execution context" },
      { id: 'p4', front: "Promise", back: "Represents eventual completion of async operation" },
      { id: 'p5', front: "API", back: "Application Programming Interface" },
      { id: 'p6', front: "CRUD", back: "Create, Read, Update, Delete" },
      { id: 'p7', front: "REST", back: "Representational State Transfer" },
      { id: 'p8', front: "JWT", back: "JSON Web Token" },
      { id: 'p9', front: "async/await", back: "Syntax for Promises" },
      { id: 'p10', front: "let vs const", back: "const is immutable reference" },
      { id: 'p11', front: "for...of", back: "Iterates over values" },
      { id: 'p12', front: "Array.map", back: "Transforms each element" },
      { id: 'p13', front: "Array.filter", back: "Keeps matching elements" },
      { id: 'p14', front: "Array.reduce", back: "Accumulates to single value" },
      { id: 'p15', front: "module", back: "export/import between files" },
      { id: 'p16', front: "Service Worker", back: "Background script for offline" },
      { id: 'p17', front: "PWA", back: "Progressive Web App" },
      { id: 'p18', front: "localStorage", back: "String-only, sync storage" },
      { id: 'p19', front: "IndexedDB", back: "Async client-side DB" },
      { id: 'p20', front: "npm", back: "Node Package Manager" },
    ]},
    { id: 'base-security', name: 'Sécurité', tags: ['dev', 'sec'], cards: [
      { id: 's1', front: "XSS", back: "Inject malicious scripts" },
      { id: 's2', front: "CSRF", back: "Forged requests from other sites" },
      { id: 's3', front: "SQL injection", back: "Malicious SQL commands" },
      { id: 's4', front: "TLS", back: "Transport Layer Security" },
      { id: 's5', front: "HTTPS", back: "HTTP over TLS" },
      { id: 's6', front: "JWT", back: "JSON Web Token" },
      { id: 's7', front: "OAuth", back: "Authorization framework" },
      { id: 's8', front: "MFA", back: "Multi-Factor Authentication" },
      { id: 's9', front: "CORS", back: "Cross-Origin Resource Sharing" },
      { id: 's10', front: "CSP", back: "Content-Security-Policy" },
    ]},
    { id: 'base-linux', name: 'Linux', tags: ['sys'], cards: [
      { id: 'l1', front: "ls", back: "List directory contents" },
      { id: 'l2', front: "cd", back: "Change directory" },
      { id: 'l3', front: "cp", back: "Copy files" },
      { id: 'l4', front: "mv", back: "Move/rename files" },
      { id: 'l5', front: "rm", back: "Remove files" },
      { id: 'l6', front: "chmod", back: "Change permissions" },
      { id: 'l7', front: "grep", back: "Pattern search" },
      { id: 'l8', front: "find", back: "File search" },
      { id: 'l9', front: "ps", back: "Process list" },
      { id: 'l10', front: "ssh", back: "Secure shell" },
    ]}
  ];
}

// ============================================================
  // APP INITIALIZATION
  // ============================================================
  function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action === 'review') {
      setTimeout(() => {
        if (AppState.currentDeckId) {
          window.ReviewSession?.start?.(AppState.currentDeckId, AppState.cardsPerSession);
        } else {
          UI.showToast('Sélectionnez un deck d\'abord', 'info');
        }
      }, 500);
    } else if (action === 'new-deck') {
      setTimeout(() => showAddDeckModal(), 500);
    }

    if (action) {
      history.replaceState({}, '', window.location.pathname);
    }
  }

  async function initApp() {
    // Handle manifest shortcuts
    handleURLParams();

    // Initialize store
    store.cardsPerSession = parseInt(localStorage.getItem('flashcards_cardsPerSession') || '10');
    store.isGridView = true;

    // Restore last opened deck from localStorage
    const lastDeckId = localStorage.getItem('shardcards_lastDeck');
    if (lastDeckId) {
      store.currentDeckId = lastDeckId;
    }

    // Init UI dark mode
    UI.initDarkMode();

    // Init Storage
    await StorageManager.init();

    // Init Auth
    await AuthService.init();
    AuthService.onChange((event, user) => {
      if (event === 'SIGNED_IN' && user) {
        UI.showToast('Connecté', 'success');
      } else if (event === 'SIGNED_OUT') {
        UI.showToast('Déconnecté', 'info');
      }
    });

  // Setup UI event handlers (deferred to avoid circular deps)
  setupUIHandlers();

  // Setup keyboard shortcuts
  ReviewSession.setupShortcuts();

  // Initialize base decks data
  AppState.setBaseDecksData(getBaseDecksData());

  // Setup Service Worker update notification
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            UI.showToast('Nouvelle version disponible - Rechargement...', 'info');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => window.location.reload(), 2000);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  // Load decks
  await DeckManager.renderDecks();
  SearchSort.init();
  SearchSort.renderTagsFilter();
  SearchSort.setupCardSearchSort();

  // Check first visit
  if (!localStorage.getItem('shardcards_visited')) {
    localStorage.setItem('shardcards_visited', '1');
    setTimeout(() => UI.showHelpModal(), 1000);
  }

  // Initial view
  showDecksView();
}

function setupUIHandlers() {
  // Navigation buttons
  document.getElementById('back-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    showDecksView();
  });

  document.getElementById('review-back-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (AppState.currentDeckId) showDeckDetailView();
    else showDecksView();
  });

  // Hamburger menu
  document.getElementById('hamburger-menu-btn')?.addEventListener('click', () => UI.showHamburgerMenu('decks'));
  document.getElementById('hamburger-menu-btn-detail')?.addEventListener('click', () => UI.showHamburgerMenu('deck-detail'));
  document.getElementById('hamburger-close-btn')?.addEventListener('click', () => UI.hideHamburgerMenu());
  document.getElementById('hamburger-menu')?.addEventListener('click', (e) => {
    if (e.target.id === 'hamburger-menu' || e.target.classList.contains('hamburger-menu-overlay')) {
      UI.hideHamburgerMenu();
    }
  });

  // Review buttons
  document.getElementById('again-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (AppState.isRevealed) {
      UI.addButtonFeedback(e.currentTarget);
      ReviewSession.rateCard(0);
    }
  });

  document.getElementById('good-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (AppState.isRevealed) {
      UI.addButtonFeedback(e.currentTarget);
      ReviewSession.rateCard(1);
    }
  });

  document.getElementById('easy-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (AppState.isRevealed) {
      UI.addButtonFeedback(e.currentTarget);
      ReviewSession.rateCard(2);
    }
  });

  // Deck section switching
  document.querySelectorAll('.deck-section-btn').forEach(btn => {
    btn.addEventListener('click', () => switchDeckSection(btn.dataset.section));
  });

  // Import file input
  document.getElementById('import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) DeckManager.importDeck(file);
  });

  // Add deck button
  document.getElementById('add-deck-btn')?.addEventListener('click', () => showAddDeckModal());

  // Add card button
  document.getElementById('add-card-btn')?.addEventListener('click', () => showAddCardModal());

  // ===== UI Event Callbacks =====
  UI.on('showDecks', () => {
    AppState.currentDeckId = null;
    localStorage.removeItem('shardcards_lastDeck');
    AppState.currentIsBaseDeck = false;
    DeckManager.renderDecks();
  });

  UI.on('showDeckDetail', () => {
    DeckManager.renderCards();
  });

  UI.on('showReview', () => {
    ReviewSession.showCard();
  });

  UI.on('toggleView', () => {
    AppState.isGridView = !AppState.isGridView;
    const container = document.getElementById('decks-container');
    if (container) container.classList.toggle('list-view', !AppState.isGridView);
    UI.hideHamburgerMenu();
  });

  UI.on('showAuth', () => showAuthModal());
  UI.on('importDeck', () => document.getElementById('import-file-input')?.click());
  UI.on('configureReminders', () => NotificationManager.configureReviewReminders());
  UI.on('showReviewSettings', () => showReviewSettingsModal());
  UI.on('showStats', () => showStatsModal());

  UI.on('startReview', () => {
    if (AppState.currentDeckId) ReviewSession.start(AppState.currentDeckId, AppState.cardsPerSession);
  });

  UI.on('exportDeck', () => DeckManager.exportDeck());
  UI.on('editDeck', () => showEditDeckModal());

  UI.on('setCurrentDeck', (deckId) => {
    AppState.currentDeckId = deckId;
    if (deckId) {
      localStorage.setItem('shardcards_lastDeck', deckId);
    }
  });

  // Service worker messages
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'OPEN_DECK') {
      DeckManager.openDeck(event.data.deckId);
    }
  });
}

// ============================================================
// VIEW FUNCTIONS
// ============================================================
function showDecksView() {
  UI.showView('decks');
  AppState.currentDeckId = null;
  AppState.currentIsBaseDeck = false;
  localStorage.removeItem('shardcards_lastDeck');
  DeckManager.renderDecks();
}

function showDeckDetailView(deckId = null) {
  if (deckId) {
    AppState.currentDeckId = deckId;
    localStorage.setItem('shardcards_lastDeck', deckId);
  }
  if (!AppState.currentDeckId) { showDecksView(); return; }

  UI.showView('deck-detail');
  DeckManager.renderCards();

  const addCardBtn = document.getElementById('add-card-btn');
  if (addCardBtn) addCardBtn.style.display = AppState.currentIsBaseDeck ? 'none' : 'flex';
}

function showReviewView() {
  if (AppState.reviewCards?.length === 0) {
    UI.showToast('Aucune carte à réviser pour le moment !', 'info');
    return;
  }
  UI.showView('review');
  ReviewSession.showCard();
}

function switchDeckSection(section) {
  if (!section) return;
  document.querySelectorAll('.deck-section-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
  document.querySelectorAll('.decks-section-content').forEach(c => c.classList.remove('active'));

  const addDeckBtn = document.getElementById('add-deck-btn');
  if (section === 'my-decks') {
    document.getElementById('my-decks-container')?.classList.add('active');
    DeckManager.renderDecks();
    if (addDeckBtn) addDeckBtn.style.display = 'flex';
  } else if (section === 'base-decks') {
    document.getElementById('base-decks-container')?.classList.add('active');
    DeckManager.renderBaseDecks();
    if (addDeckBtn) addDeckBtn.style.display = 'none';
  } else if (section === 'cards') {
    document.getElementById('cards-section-content')?.classList.add('active');
    DeckManager.renderCards();
  }
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================
function showAuthModal() {
  const content = `
    <div class="auth-form">
      <p class="auth-subtitle">Créez un compte pour synchroniser vos decks sur tous vos appareils.</p>
      <input type="email" id="auth-email" class="form-input" placeholder="Email" required>
      <input type="password" id="auth-password" class="form-input" placeholder="Mot de passe" required>
      <button class="btn primary" id="auth-signup-btn">S'inscrire</button>
      <button class="btn secondary" id="auth-login-btn">Se connecter</button>
      <button class="btn text" id="auth-forgot-btn">Mot de passe oublié ?</button>
    </div>
  `;
  UI.showModalWithContent('Connexion / Inscription', content);
  attachAuthListeners();
}

function attachAuthListeners() {
  const email = document.getElementById('auth-email');
  const password = document.getElementById('auth-password');

  document.getElementById('auth-signup-btn')?.addEventListener('click', async () => {
    try {
      UI.showToast('Synchronisation en cours…', 'info');
      await AuthService.signUp(email.value, password.value);
      UI.hideModal();
      UI.showToast('Synchronisation terminée', 'success');
    } catch (e) { UI.showToast('Erreur: ' + (e.message || e), 'error'); }
  });

  document.getElementById('auth-login-btn')?.addEventListener('click', async () => {
    try {
      UI.showToast('Synchronisation en cours…', 'info');
      await AuthService.signIn(email.value, password.value);
      UI.hideModal();
      UI.showToast('Synchronisation terminée', 'success');
    } catch (e) { UI.showToast('Erreur: ' + (e.message || e), 'error'); }
  });

  document.getElementById('auth-forgot-btn')?.addEventListener('click', async () => {
    try { await AuthService.resetPassword(email.value); UI.hideModal(); UI.showToast('Email de réinitialisation envoyé', 'success'); }
    catch (e) { UI.showToast('Erreur: ' + (e.message || e), 'error'); }
  });
}

function showAddDeckModal() {
  const content = `
    <form id="add-deck-form">
      <input type="text" id="deck-name" class="form-input" placeholder="Nom du deck" maxlength="100" required>
      <input type="text" id="deck-tags" class="form-input" placeholder="Tags (séparés par des virgules)">
      <button type="submit" class="btn primary">Créer</button>
    </form>
  `;
  UI.showModalWithContent('Nouveau deck', content);
  document.getElementById('add-deck-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addDeck();
  });
}

async function addDeck() {
  const name = document.getElementById('deck-name')?.value?.trim();
  const tagsInput = document.getElementById('deck-tags')?.value || '';
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  await DeckManager.addDeck(name, tags);
  UI.hideModal();
}

function showEditDeckModal() {
  const deck = AppState.getCurrentDeck();
  if (!deck || AppState.currentIsBaseDeck) { UI.showToast('Non modifiable.', 'error'); return; }

  const content = `
    <form id="edit-deck-form">
      <input type="text" id="deck-name" class="form-input" value="${escapeHtml(deck.name)}" maxlength="100" required>
      <input type="text" id="deck-tags" class="form-input" value="${escapeHtml(deck.tags?.join(', '))}" placeholder="Tags (séparés par des virgules)">
      <button type="submit" class="btn primary">Enregistrer</button>
    </form>
  `;
  UI.showModalWithContent('Modifier le deck', content);
  document.getElementById('edit-deck-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    updateDeck();
  });
}

async function updateDeck() {
  const name = document.getElementById('deck-name')?.value?.trim();
  const tagsInput = document.getElementById('deck-tags')?.value || '';
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  await DeckManager.updateDeck(AppState.currentDeckId, name, tags);
  UI.hideModal();
}

function showDeckActionsModal(deckId, isBase = false) {
  AppState.currentDeckId = deckId;
  AppState.currentIsBaseDeck = isBase;
  const deck = AppState.getDeck(deckId, isBase);

  const content = `
    <div class="deck-actions-list">
      <button class="action-btn" data-action="review">
        <span data-icon="refresh"></span> Réviser
      </button>
      ${!isBase ? `
        <button class="action-btn" data-action="export">
          <span data-icon="upload"></span> Exporter
        </button>
        <button class="action-btn" data-action="edit">
          <span data-icon="edit"></span> Modifier
        </button>
        <button class="action-btn danger" id="dact-delete" data-action="delete">
          <span data-icon="delete"></span> Supprimer
        </button>
      ` : ''}
    </div>
  `;
  UI.showModalWithContent(escapeHtml(deck?.name || 'Deck'), content);

  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      UI.hideModal();
      if (action === 'review') ReviewSession.start(deckId, AppState.cardsPerSession);
      else if (action === 'export') DeckManager.exportDeck();
      else if (action === 'edit') showEditDeckModal();
      else if (action === 'delete') deleteDeck(deckId);
    });
  });
}

async function deleteDeck(id) {
  if (AppState.baseDecks?.find(d => d.id === id)) {
    UI.showToast('Les decks de base ne sont pas supprimables.', 'error');
    return;
  }
  await DeckManager.deleteDeck(id);
}

function showAddCardModal() {
  if (AppState.currentIsBaseDeck) { UI.showToast('Deck en lecture seule.', 'error'); return; }

  const content = `
    <form id="add-card-form" class="card-form">
      <div class="form-side">
        <label>Recto</label>
        <textarea id="front-text" class="form-input" placeholder="Texte (optionnel)"></textarea>
        <div class="image-upload">
          <input type="file" id="front-image" accept="image/*" class="file-input">
          <div class="image-preview" id="front-preview"></div>
          <button type="button" class="btn secondary btn-remove" id="front-remove">Supprimer</button>
        </div>
      </div>
      <div class="form-side">
        <label>Verso</label>
        <textarea id="back-text" class="form-input" placeholder="Texte (optionnel)"></textarea>
        <div class="image-upload">
          <input type="file" id="back-image" accept="image/*" class="file-input">
          <div class="image-preview" id="back-preview"></div>
          <button type="button" class="btn secondary btn-remove" id="back-remove">Supprimer</button>
        </div>
      </div>
      <button type="submit" class="btn primary">Ajouter</button>
    </form>
  `;
  UI.showModalWithContent('Nouvelle carte', content);
  setTimeout(() => attachCardFormListeners('add'), 0);
}

function showEditCardModal(cardId, sortIndex) {
  const deck = AppState.getCurrentDeck();
  if (!deck) return;
  if (AppState.currentIsBaseDeck) { UI.showToast('Deck en lecture seule.', 'error'); return; }

  const card = deck.cards.find(c => c.id === cardId);
  if (!card) return;

  const content = `
    <form id="edit-card-form" class="card-form">
      <div class="form-side">
        <label>Recto</label>
        <textarea id="front-text" class="form-input">${escapeHtml(card.front)}</textarea>
        <div class="image-upload">
          <input type="file" id="front-image" accept="image/*" class="file-input">
          <div class="image-preview" id="front-preview">${card.frontImage ? `<img src="${safeImageUrl(card.frontImage)}" alt="Recto">` : ''}</div>
          <button type="button" class="btn secondary btn-remove" id="front-remove">Supprimer</button>
        </div>
      </div>
      <div class="form-side">
        <label>Verso</label>
        <textarea id="back-text" class="form-input">${escapeHtml(card.back)}</textarea>
        <div class="image-upload">
          <input type="file" id="back-image" accept="image/*" class="file-input">
          <div class="image-preview" id="back-preview">${card.backImage ? `<img src="${safeImageUrl(card.backImage)}" alt="Verso">` : ''}</div>
          <button type="button" class="btn secondary btn-remove" id="back-remove">Supprimer</button>
        </div>
      </div>
      <button type="submit" class="btn primary">Enregistrer</button>
    </form>
  `;
  UI.showModalWithContent('Modifier la carte', content);

  setTimeout(() => {
    AppState._editingCardId = cardId;
    AppState._editingCardIndex = sortIndex;
    attachCardFormListeners('edit');
  }, 0);
}

function attachCardFormListeners(mode) {
  const frontFile = document.getElementById('front-image');
  const backFile = document.getElementById('back-image');
  const frontRemove = document.getElementById('front-remove');
  const backRemove = document.getElementById('back-remove');

  frontFile?.addEventListener('change', (e) => handleImageUpload(e, 'front', mode));
  backFile?.addEventListener('change', (e) => handleImageUpload(e, 'back', mode));
  frontRemove?.addEventListener('click', () => removePreview('front', mode));
  backRemove?.addEventListener('click', () => removePreview('back', mode));

  const form = document.getElementById(`${mode}-card-form`);
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (mode === 'add') addCard();
    else updateCard();
  });
}

async function handleImageUpload(event, side, mode) {
  const file = event.target.files?.[0];
  if (!file?.type.startsWith('image/')) { UI.showToast('Fichier image invalide.', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { UI.showToast('Image trop grande (max 10 Mo).', 'error'); return; }

  try {
    const b64 = await compressImage(file);
    if (!b64) { UI.showToast('Image trop lourde', 'error'); return; }

    const preview = document.getElementById(`${side}-preview`);
    if (preview) preview.innerHTML = `<img src="${b64}" alt="Preview">`;
  } catch (e) { UI.showToast('Erreur traitement image.', 'error'); }
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = (h / w) * maxDim; w = maxDim; }
      else if (h > maxDim) { w = (w / h) * maxDim; h = maxDim; }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const isPng = file.type === 'image/png';
      let mimeType = 'image/jpeg';

      if (isPng) {
        mimeType = 'image/png';
        resolve(canvas.toDataURL(mimeType, 1));
      } else if (canvas.toDataURL('image/webp', 0.8).length < canvas.toDataURL('image/jpeg', 0.7).length) {
        mimeType = 'image/webp';
        resolve(canvas.toDataURL(mimeType, 0.8));
      } else {
        resolve(canvas.toDataURL(mimeType, 0.7));
      }
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

function removePreview(side, mode) {
  const fileInput = document.getElementById(`${side}-image`);
  const preview = document.getElementById(`${side}-preview`);
  if (fileInput) fileInput.value = '';
  if (preview) preview.innerHTML = '';
}

async function addCard() {
  const front = document.getElementById('front-text')?.value || '';
  const back = document.getElementById('back-text')?.value || '';
  const frontPreview = document.getElementById('front-preview')?.querySelector('img');
  const backPreview = document.getElementById('back-preview')?.querySelector('img');
  const fi = frontPreview?.src;
  const bi = backPreview?.src;

  await DeckManager.addCard(front, back, fi, bi);
  UI.hideModal();
}

async function updateCard() {
  const front = document.getElementById('front-text')?.value || '';
  const back = document.getElementById('back-text')?.value || '';
  const frontPreview = document.getElementById('front-preview')?.querySelector('img');
  const backPreview = document.getElementById('back-preview')?.querySelector('img');
  const fi = frontPreview?.src;
  const bi = backPreview?.src;

  await DeckManager.updateCard(AppState._editingCardId, front, back, fi, bi);
  UI.hideModal();
}

function showReviewSettingsModal() {
  const content = `
    <form id="review-settings-form">
      <div class="form-group">
        <label>Cartes par session</label>
        <input type="number" id="cards-per-session" class="form-input" value="${AppState.cardsPerSession}" min="1" max="100">
      </div>
      <button type="submit" class="btn primary">Enregistrer</button>
    </form>
  `;
  UI.showModalWithContent('Paramètres de révision', content);
  document.getElementById('review-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseInt(document.getElementById('cards-per-session')?.value);
    if (val >= 1 && val <= 100) {
      AppState.cardsPerSession = val;
      localStorage.setItem('flashcards_cardsPerSession', val);
      UI.hideModal();
      UI.showToast('Paramètres sauvegardés', 'success');
    } else {
      UI.showToast('Valeur entre 1 et 100.', 'error');
    }
  });
}

function showStatsModal() {
  const deck = AppState.getCurrentDeck();
  if (!deck) return;

  const now = Date.now();
  const total = deck.cards?.length || 0;
  const due = deck.cards?.filter(c => !c.nextReview || c.nextReview <= now).length || 0;
  const learned = deck.cards?.filter(c => (c.cardScore ?? 0) >= 30).length || 0;
  const mastery = total > 0 ? Math.round((learned / total) * 100) : 0;

  const content = `
    <div class="stats-content">
      <div class="stats-detail">
        <div><span>${total}</span><label>cartes</label></div>
        <div><span>${due}</span><label>à réviser</label></div>
        <div><span>${learned}</span><label>maîtrisées</label></div>
      </div>
      <div class="stats-mastery">
        <label>Maîtrise globale</label>
        <div class="stats-progress-bar">
          <div class="stats-progress" data-mastery="${mastery}" style="width:0%"></div>
        </div>
        <span>${mastery}%</span>
      </div>
    </div>
  `;
  UI.showModalWithContent('Statistiques', content);
  setTimeout(() => UI.animateStatsModal(document.querySelector('.stats-content')), 100);
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeImageUrl(url) {
  if (typeof url !== 'string') return '';
  const t = url.trim();
  if (t.startsWith('data:image/')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return '';
}

// ============================================================
  // STARTUP
  // ============================================================
  document.addEventListener('DOMContentLoaded', initApp);

  // Expose additional App functions to window for event handlers from other modules
  window.App = window.App || {};
  window.App.showDeckActionsModal = showDeckActionsModal;
  window.App.showEditCardModal = showEditCardModal;
  window.App.showToast = (msg, type) => UI.showToast(msg, type);
  window.App.renderCards = () => DeckManager.renderCards();
