// db.js - Lightweight IndexedDB layer with localStorage migration
const DB_NAME = 'ShardCardsDB';
const DB_VERSION = 2;
let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('decks')) {
        db.createObjectStore('decks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

async function migrateFromLocalStorage() {
  if (localStorage.getItem('shardcards_idb_migrated')) return;

  const db = await openDB();

  try {
    const rawDecks = localStorage.getItem('flashcards_decks');
    if (rawDecks) {
      const decks = JSON.parse(rawDecks);
      if (Array.isArray(decks) && decks.length > 0) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('decks', 'readwrite');
          decks.forEach((d) => tx.objectStore('decks').put({ ...d, updatedAt: d.updatedAt ?? d.createdAt ?? Date.now() }));
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        localStorage.removeItem('flashcards_decks');
      }
    }

    const rawQueue = localStorage.getItem('flashcards_sync_queue');
    if (rawQueue) {
      const queue = JSON.parse(rawQueue);
      if (Array.isArray(queue) && queue.length > 0) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('syncQueue', 'readwrite');
          queue.forEach((q) => tx.objectStore('syncQueue').add(q));
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        localStorage.removeItem('flashcards_sync_queue');
      }
    }

    localStorage.removeItem('flashcards_reminders');
    localStorage.setItem('shardcards_idb_migrated', '1');
    console.log('[DB] Migration from localStorage completed');
  } catch (e) {
    console.warn('[DB] Migration failed:', e);
  }
}

export const DB = {
  async init() {
    await openDB();
    await migrateFromLocalStorage();
  },

  async getDecks() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('decks', 'readonly').objectStore('decks').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async saveDeck(deck) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite');
      tx.objectStore('decks').put({ ...deck, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteDeck(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite');
      tx.objectStore('decks').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getDeck(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('decks', 'readonly').objectStore('decks').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getSyncQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('syncQueue', 'readonly').objectStore('syncQueue').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async enqueueSync(operation, payload) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').add({ operation, payload, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearSyncQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getDueNotifications() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const req = db.transaction('notifications', 'readonly').objectStore('notifications').getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const due = all.filter(n => n.nextNotification && n.nextNotification <= now);
        resolve(due);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getAllNotifications() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('notifications', 'readonly').objectStore('notifications').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async updateNotification(notification) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notifications', 'readwrite');
      tx.objectStore('notifications').put(notification);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteNotification(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notifications', 'readwrite');
      tx.objectStore('notifications').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveNotification(notification) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notifications', 'readwrite');
      tx.objectStore('notifications').put(notification);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};