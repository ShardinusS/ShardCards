// notifications.js - Notification/reminder management
// Uses window.AppState for state

const REMINDERS_KEY = 'flashcards_reminders';

export const NotificationManager = {
  async setup() {
    this.loadRemindersFromSW();
  },

  async configureReviewReminders() {
    const store = window.AppState;
    const deck = store.getCurrentDeck();
    if (!deck) { window.UI.showToast('Aucun deck sélectionné.', 'error'); return; }

    let reminders = [];
    try {
      reminders = await this.fetchRemindersFromSW();
    } catch (e) {
      reminders = this.loadLocalReminders();
    }
    const deckReminders = reminders.filter(r => r.deckId === deck.id);

    const content = `
      <form id="reminder-form">
        <div class="form-group">
          <label>Intervalle</label>
          <select id="reminder-interval" class="form-input">
            <option value="60" ${deckReminders[0]?.intervalMinutes === 60 ? 'selected' : ''}>1 heure</option>
            <option value="180" ${deckReminders[0]?.intervalMinutes === 180 ? 'selected' : ''}>3 heures</option>
            <option value="360" ${deckReminders[0]?.intervalMinutes === 360 ? 'selected' : ''}>6 heures</option>
            <option value="720" ${deckReminders[0]?.intervalMinutes === 720 ? 'selected' : ''}>12 heures</option>
            <option value="1440" ${(!deckReminders[0] || deckReminders[0].intervalMinutes === 1440) ? 'selected' : ''}>1 jour</option>
            <option value="2880" ${deckReminders[0]?.intervalMinutes === 2880 ? 'selected' : ''}>2 jours</option>
            <option value="10080" ${deckReminders[0]?.intervalMinutes === 10080 ? 'selected' : ''}>1 semaine</option>
          </select>
        </div>
        ${deckReminders.length > 0 ? `
          <div class="reminders-section">
            <h3 class="reminders-title">Rappels actifs</h3>
            <div id="reminders-list"></div>
          </div>
        ` : ''}
        ${deckReminders.length === 0 ? `
          <button type="button" id="add-rem-btn" class="btn btn-primary btn-add-reminder">
            <span>+ Ajouter le rappel</span>
          </button>
        ` : ''}
      </form>
    `;

    window.UI.showModalWithContent('Rappels de révision', content);

    if (deckReminders.length === 0) {
      document.getElementById('add-rem-btn')?.addEventListener('click', () => {
        const minutes = parseInt(document.getElementById('reminder-interval')?.value || 1440);
        this.addReminder(deck.id, deck.name, minutes);
      });
    } else {
      this.renderRemindersList(deckReminders);
    }
  },

  renderRemindersList(reminders) {
    const container = document.getElementById('reminders-list');
    if (!container) return;

    const store = window.AppState;
    container.innerHTML = reminders.map((r, i) => {
      const d = store.localDecks?.find(d => d.id === r.deckId);
      return `<div class="reminder-item">
        <div class="reminder-item-content">
          <div class="reminder-item-title">${escHtml(d?.name ?? 'Deck supprimé')}</div>
          <div class="reminder-item-details">${this.getIntervalText(r.intervalMinutes)}</div>
        </div>
        <button class="btn-remove-reminder" data-index="${i}" data-id="${escHtml(r.id)}">Supprimer</button>
      </div>`;
    }).join('');

    container.querySelectorAll('.btn-remove-reminder').forEach(btn => {
      btn.addEventListener('click', () => {
        const remId = btn.dataset.id;
        this.removeReminder(remId);
      });
    });
  },

  async addReminder(deckId, deckName, intervalMinutes) {
    const id = crypto.randomUUID();
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type: 'ADD_REMINDER',
        deckId,
        deckName: deckName || 'Deck',
        intervalMinutes,
        reminderId: id
      });
      window.UI.showToast('Rappel ajouté', 'success');
      this.configureReviewReminders();
    } catch (e) {
      window.UI.showToast('Erreur: ' + e.message, 'error');
    }
  },

  async removeReminder(reminderId) {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: 'REMOVE_REMINDER', reminderId });
      window.UI.showToast('Rappel supprimé', 'success');
      this.configureReviewReminders();
    } catch (e) {
      window.UI.showToast('Erreur: ' + e.message, 'error');
    }
  },

  getIntervalText(minutes) {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)} jour${minutes > 1440 ? 's' : ''}`;
  },

  loadLocalReminders() {
    try {
      const raw = localStorage.getItem(REMINDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async fetchRemindersFromSW() {
    try {
      if (!navigator.serviceWorker?.controller) {
        throw new Error('Service Worker not active');
      }
      const reg = await navigator.serviceWorker.ready;
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          resolve(event.data?.reminders ?? []);
        };
        reg.active.postMessage({ type: 'GET_REMINDERS' }, [channel.port2]);
      });
    } catch {
      return this.loadLocalReminders();
    }
  },

  async loadRemindersFromSW() {
    try {
      const swRems = await this.fetchRemindersFromSW();
      if (swRems.length > 0) {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(swRems.map(r => ({
          deckId: r.deckId,
          intervalMinutes: r.intervalMinutes,
          id: r.id
        }))));
      } else {
        localStorage.removeItem(REMINDERS_KEY);
      }
    } catch (e) {
      const raw = localStorage.getItem(REMINDERS_KEY);
      const reminders = raw ? JSON.parse(raw) : [];
      if (!reminders.length) return;
      
      try {
        const reg = await navigator.serviceWorker.ready;
        for (const r of reminders) {
          const d = window.AppState.localDecks?.find(d => d.id === r.deckId);
          reg.active.postMessage({
            type: 'ADD_REMINDER',
            deckId: r.deckId,
            deckName: d?.name ?? 'Deck',
            intervalMinutes: r.intervalMinutes,
            reminderId: r.id
          });
        }
        localStorage.removeItem(REMINDERS_KEY);
      } catch {}
    }
  },

  async syncRemindersWithSW() {
    try {
      const swRems = await this.fetchRemindersFromSW();
      if (swRems?.length) {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(swRems.map(r => ({
          deckId: r.deckId,
          intervalMinutes: r.intervalMinutes,
          id: r.id
        }))));
      } else {
        localStorage.removeItem(REMINDERS_KEY);
      }
    } catch (e) {
      // Silently fail
    }
  }
};

const escHtml = window.Utils?.escapeHtml || ((text) => {
  if (text == null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
});

window.NotificationManager = NotificationManager;