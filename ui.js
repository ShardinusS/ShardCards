// ui.js - UI components (modales, hamburger, toasts, views)
// No external dependencies - uses callbacks for app actions

export const UI = {
  _callbacks: {},

  on(event, callback) {
    if (!this._callbacks[event]) this._callbacks[event] = [];
    this._callbacks[event].push(callback);
  },

  emit(event, data) {
    const cbs = this._callbacks[event] || [];
    cbs.forEach(cb => cb(data));
  },

  isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  },

  toggleDarkMode() {
    const newTheme = this.isDarkMode() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('shardcards_theme', newTheme);
    this.updateThemeIcons();
    return newTheme;
  },

  initDarkMode() {
    const saved = localStorage.getItem('shardcards_theme');
    if (!saved) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', saved);
    }
    this.updateThemeIcons();
  },

  updateThemeIcons() {
    const isDark = this.isDarkMode();
    document.querySelectorAll('[data-icon="moon"], [data-icon="sun"]').forEach(el => {
      el.setAttribute('data-icon', isDark ? 'sun' : 'moon');
    });
  },

  showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const view = document.getElementById(`${viewName}-view`);
    if (view) {
      view.classList.remove('hidden');
      requestAnimationFrame(() => view.classList.add('active'));
    }
    this.emit('viewChange', viewName);
  },

  showDecksView() {
    this.showView('decks');
    this.emit('showDecks');
  },

  showDeckDetailView(deckId = null) {
    if (deckId) this.emit('setCurrentDeck', deckId);
    this.showView('deck-detail');
    this.emit('showDeckDetail');
  },

  showReviewView() {
    this.showView('review');
    this.emit('showReview');
  },

  toggleView() {
    this.emit('toggleView');
  },

  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('active');
    this._trapFocus(modal);
  },

  hideModal() {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      this._releaseFocus(activeModal);
      activeModal.classList.remove('active');
      activeModal.classList.add('hidden');
    }
    document.querySelectorAll('.modal.active').forEach(m => {
      m.classList.remove('active');
      m.classList.add('hidden');
    });
  },

  _trapFocus(modal) {
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modal.querySelectorAll(focusableSelectors);
    this._previousFocus = document.activeElement;
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');

    this._focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    modal.addEventListener('keydown', this._focusTrapHandler);
    firstFocusable?.focus();
  },

  _releaseFocus(modal) {
    if (this._focusTrapHandler) {
      modal?.removeEventListener('keydown', this._focusTrapHandler);
      this._focusTrapHandler = null;
    }
    if (this._previousFocus) {
      this._previousFocus.focus();
      this._previousFocus = null;
    }
    modal?.removeAttribute('aria-modal');
    modal?.removeAttribute('role');
  },

  showModalWithContent(title, content) {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;
    const titleEl = modal.querySelector('.modal-title');
    const bodyEl = modal.querySelector('.modal-body');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    requestAnimationFrame(() => {
      modal.classList.add('active');
      this._trapFocus(modal);
    });
  },

  showConfirmModal(title, message, onConfirm, type = 'danger') {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    const titleEl = modal.querySelector('.confirm-title');
    const msgEl = modal.querySelector('.confirm-message');
    const btn = modal.querySelector('.confirm-btn');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (btn) {
      btn.className = `confirm-btn ${type}`;
      btn.textContent = type === 'danger' ? 'Supprimer' : 'Confirmer';
      btn.onclick = () => { this.hideModal(); onConfirm(); };
    }
    requestAnimationFrame(() => {
      modal.classList.add('active');
      this._trapFocus(modal);
    });
  },

  showHamburgerMenu(viewType) {
    const menu = document.getElementById('hamburger-menu');
    const list = document.getElementById('hamburger-menu-items');
    if (!menu || !list) return;

    document.querySelectorAll('[aria-expanded]').forEach(el => el.setAttribute('aria-expanded', 'false'));
    requestAnimationFrame(() => menu.classList.remove('hidden'));
    document.getElementById('hamburger-menu-btn')?.setAttribute('aria-expanded', 'true');
    document.getElementById('hamburger-menu-btn-detail')?.setAttribute('aria-expanded', 'true');

    const isDark = this.isDarkMode();

    const menus = {
      decks: [
        { icon: 'user', text: 'Connexion / Inscription', action: () => this.emit('showAuth') },
        { icon: isDark ? 'sun' : 'moon', text: isDark ? 'Mode clair' : 'Mode sombre', action: () => this.toggleDarkMode() },
        { icon: 'download', text: 'Importer un deck', action: () => this.emit('importDeck') },
        { icon: 'grid', text: 'Vue grille', action: () => this.toggleView() },
        { icon: 'bell', text: 'Rappels de révision', action: () => this.emit('configureReminders') }
      ],
      'deck-detail': [
        { icon: 'play', text: 'Réviser', action: () => this.emit('startReview') },
        { icon: 'settings', text: 'Paramètres révision', action: () => this.emit('showReviewSettings') },
        { icon: 'chart', text: 'Statistiques', action: () => this.emit('showStats') },
        { icon: isDark ? 'sun' : 'moon', text: isDark ? 'Mode clair' : 'Mode sombre', action: () => this.toggleDarkMode() },
        { icon: 'upload', text: 'Exporter', action: () => this.emit('exportDeck') },
        { icon: 'edit', text: 'Modifier le deck', action: () => this.emit('editDeck') }
      ]
    };

    const items = menus[viewType] || menus.decks;
    list.innerHTML = items.map((item, i) => `
      <div class="hamburger-item" data-action="${i}">
        <span data-icon="${item.icon}"></span>
        <span>${item.text}</span>
      </div>
    `).join('');

    list.querySelectorAll('.hamburger-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.action);
        items[idx]?.action();
      });
    });

    requestAnimationFrame(() => menu.classList.remove('hidden'));
  },

  hideHamburgerMenu() {
    document.getElementById('hamburger-menu')?.classList.add('hidden');
    document.querySelectorAll('[aria-expanded]').forEach(el => el.setAttribute('aria-expanded', 'false'));
  },

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span data-icon="${type === 'success' ? 'check' : type === 'error' ? 'x' : 'info'}"></span>${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  addButtonFeedback(btn) {
    if (!btn) return;
    btn.classList.add('clicked');
    setTimeout(() => btn.classList.remove('clicked'), 200);
  },

  animateStatsModal(target) {
    const progress = target?.querySelector('.stats-progress');
    if (!progress) return;
    const width = Math.min(100, parseFloat(progress.dataset.mastery) || 0);
    progress.style.width = '0%';
    requestAnimationFrame(() => {
      progress.style.transition = 'width 0.8s ease-out';
      progress.style.width = `${width}%`;
    });
  },

  showHelpModal() {
    const content = `
      <div class="help-content">
        <h3>Raccourcis</h3>
        <ul>
          <li><kbd>1</kbd> = Encore</li>
          <li><kbd>2</kbd> = Bien</li>
          <li><kbd>3</kbd> = Facile</li>
          <li><kbd>Espace</kbd> = Retourner la carte</li>
          <li><kbd>Échap</kbd> = Fermer</li>
        </ul>
        <h3>Gestes</h3>
        <ul>
          <li>Glisser à gauche = Encore</li>
          <li>Glisser à droite = Bien</li>
          <li>Glisser en haut = Facile</li>
        </ul>
      </div>
    `;
    this.showModalWithContent('Aide', content);
  }
};

window.UI = UI;