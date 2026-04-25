const DEBUG = false;
let checkInterval = null;
const CACHE_NAME = 'flashcards-v5';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './storage-manager.js',
  './supabase-client.js',
  './supabase-umd.js',
  './db.js',
  './manifest.json',
  './store.js',
  './longpress.js',
  './utils.js',
  './icons.js',
  './ui.js',
  './review.js',
  './deck-manager.js',
  './notifications.js',
  './search-sort.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((err) => { if (DEBUG) console.error('Erreur lors du cache:', err); })
    );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))),
      initDB().catch((err) => { if (DEBUG) console.error('Erreur init DB:', err); })
    ])
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => new Response('Resource not available offline', { status: 404 }))
  );
});

// --- Gestion des notifications ---

let db = null;
const recentNotifications = new Map();

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FlashcardsNotifications', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
        store.createIndex('deckId', 'deckId', { unique: false });
        store.createIndex('nextNotification', 'nextNotification', { unique: false });
      }
    };
  });
}

async function checkScheduledNotifications() {
  if (!db) await initDB();
  if (!db) return 0;

  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > 120000) recentNotifications.delete(key);
  }
  

  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('nextNotification');
    const range = IDBKeyRange.upperBound(now);
    const request = index.openCursor(range);
    const notificationsToShow = [];
    
    request.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const notification = cursor.value;
        const notificationKey = `${notification.deckId}_${notification.nextNotification}`;
        const wasShownRecently = recentNotifications.has(notificationKey);
        if (notification.nextNotification <= now && !wasShownRecently) {
          notificationsToShow.push(notification);
          recentNotifications.set(notificationKey, now);
        }
        cursor.continue();
      } else {
        if (notificationsToShow.length > 0) {
          for (const notification of notificationsToShow) {
            try {
              await scheduleNextNotification(notification);
              await showReviewNotification(notification.deckName || 'Vos flashcards', notification.deckId);
            } catch (error) {
              console.error('Erreur affichage notif:', error);
            }
          }
        }
        resolve(notificationsToShow.length);
      }
    };
    
    request.onerror = (error) => {
      console.error('Erreur vérification notifications:', error);
      resolve(0);
    };
  });
}

async function scheduleNextNotification(notification) {
  if (!db) await initDB();
  const now = Date.now();
  const intervalMs = notification.intervalMinutes * 60 * 1000;
  const nextNotification = now + intervalMs;
  
  const transaction = db.transaction(['notifications'], 'readwrite');
  const store = transaction.objectStore('notifications');
  notification.nextNotification = nextNotification;
  notification.lastNotification = now;
  store.put(notification);
  
  await scheduleBackgroundSyncForNotification(notification).catch(() => {});
  await cleanupOldNotifications().catch(() => {});
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function cleanupOldNotifications() {
  if (!db) return;
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('nextNotification');
    const range = IDBKeyRange.upperBound(cutoff);
    let deleted = 0;
    
    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        if (DEBUG && deleted > 0) console.log(`[SW] Nettoyé ${deleted} anciennes notifications`);
        resolve(deleted);
      }
    };
    request.onerror = () => resolve(0);
  });
}

async function scheduleBackgroundSyncForNotification(notification) {
  if (!('sync' in self.registration)) return;
  const delay = notification.nextNotification - Date.now();
  try {
    if (delay > 0) {
      const syncTag = `notification-${notification.deckId}-${notification.nextNotification}`;
      await self.registration.sync.register(syncTag).catch(() => {});
    }
    await self.registration.sync.register('check-notifications').catch(() => {});
  } catch (error) {}
}

self.addEventListener('message', async (event) => {
  if (DEBUG) console.log('Message reçu dans le service worker:', event.data);
  if (!db) await initDB();
  if (!event.data || !event.data.type) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  try {
    if (event.data.type === 'ADD_REMINDER') {
      const { deckId, deckName, intervalMinutes, reminderId } = event.data;
      const result = await addReminder(deckId, deckName, intervalMinutes, reminderId);
      if (event.ports?.[0]) {
        event.ports[0].postMessage({
          success: !result.isDuplicate,
          type: 'REMINDER_ADDED',
          reminderId: result.id,
          isDuplicate: result.isDuplicate
        });
      }
    } else if (event.data.type === 'REMOVE_REMINDER') {
      const { reminderId, deckId } = event.data;
      if (reminderId) await removeReminderById(reminderId);
      else if (deckId) await removeReminder(deckId);
    } else if (event.data.type === 'UPDATE_REMINDERS') {
      const { reminders } = event.data;
      if (reminders && Array.isArray(reminders)) {
        await cancelAllReminders();
        for (const reminder of reminders) {
          await addReminder(reminder.deckId, reminder.deckName || 'Deck', reminder.intervalMinutes);
        }
      }
    } else if (event.data.type === 'GET_ALL_REMINDERS') {
      const reminders = await getAllReminders();
      if (event.ports?.[0]) event.ports[0].postMessage({ reminders });
    } else if (event.data.type === 'CANCEL_ALL_REMINDERS') {
      await cancelAllReminders();
    }
  } catch (error) {
    console.error('Erreur message:', error);
    if (event.ports?.[0]) event.ports[0].postMessage({ success: false, error: error.message });
  }
});

async function addReminder(deckId, deckName, intervalMinutes, reminderId = null) {
  if (!db) await initDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    const request = index.openCursor(IDBKeyRange.only(deckId));
    let existingReminder = null;
    
    request.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.intervalMinutes === intervalMinutes) {
          existingReminder = cursor.value;
        }
        cursor.continue();
      } else {
        if (existingReminder) {
          resolve({ id: existingReminder.id, isDuplicate: true });
          return;
        }
        const now = Date.now();
        const notification = {
          deckId, deckName, intervalMinutes,
          nextNotification: now + intervalMinutes * 60 * 1000,
          lastNotification: null,
          createdAt: now
        };
        if (reminderId) notification.id = reminderId;
        const putRequest = store.put(notification);
        putRequest.onsuccess = async () => {
          notification.id = notification.id || putRequest.result;
          await scheduleNextNotification(notification);
          // scheduleNextWakeUp removed (not implemented, not needed for basic notifications)
          resolve({ id: notification.id, isDuplicate: false });
        };
        putRequest.onerror = () => reject(putRequest.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function removeReminderById(reminderId) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const deleteRequest = store.delete(reminderId);
    deleteRequest.onsuccess = () => {
      for (const [key] of recentNotifications.entries()) {
        if (key.includes(`_${reminderId}_`) || key.endsWith(`_${reminderId}`)) recentNotifications.delete(key);
      }
      resolve();
    };
    deleteRequest.onerror = () => reject(deleteRequest.error);
  });
}

async function removeReminder(deckId) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    const request = index.openCursor(IDBKeyRange.only(deckId));
    const idsToDelete = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) { idsToDelete.push(cursor.value.id); cursor.continue(); }
      else {
        if (idsToDelete.length === 0) { resolve(); return; }
        let deleted = 0;
        idsToDelete.forEach(id => {
          const delReq = store.delete(id);
          delReq.onsuccess = () => {
            deleted++;
            if (deleted === idsToDelete.length) resolve();
          };
        });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllReminders() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function cancelAllReminders() {
  if (!db) await initDB();
  const transaction = db.transaction(['notifications'], 'readwrite');
  transaction.objectStore('notifications').clear();
}

function startPeriodicCheck() {
  if (checkInterval) clearInterval(checkInterval);
  checkScheduledNotifications();
  checkInterval = setInterval(checkScheduledNotifications, 120000);
  if ('sync' in self.registration) {
    self.registration.sync.register('check-notifications').catch(() => {});
  }
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('check-notifications-periodic', { minInterval: 60 * 60 * 1000 }).catch(() => {});
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications' || event.tag.startsWith('notification-')) {
    event.waitUntil(checkScheduledNotifications());
  }
});

if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications-periodic') {
      event.waitUntil(checkScheduledNotifications());
    }
  });
}

async function showReviewNotification(deckName = 'Vos flashcards', deckId = null) {
  if (!self.registration || !self.registration.showNotification) return;
  const title = 'Rappel de révision';
  const options = {
    body: `Il est temps de réviser : ${deckName}`,
    tag: `review-reminder-${deckId || 'default'}`,
    requireInteraction: false,
    silent: false,
    data: { url: './index.html', deckId, timestamp: Date.now() },
    icon: './icon-1024.png',
    badge: './icon-1024.png',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Plus tard' }
    ]
  };
  try { await self.registration.showNotification(title, options); } catch (e) { console.error('Erreur notification:', e); }
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'Rappel de révision',
    body: 'Il est temps de réviser vos flashcards !',
    icon: './icon-1024.png',
    badge: './icon-1024.png',
    tag: 'review-reminder',
    data: { url: './index.html' }
  };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { data.body = event.data.text() || data.body; }
  }
  // Use stable tag: if deckId exists, include it; otherwise generic tag
  const tag = data.deckId ? `review-reminder-${data.deckId}` : 'review-reminder';
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: tag,
    data: data.data || { url: './' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Plus tard' }
    ]
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deckId = event.notification.data?.deckId;
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          if (deckId) client.postMessage({ type: 'OPEN_DECK', deckId });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      clientList.forEach(client => {
        client.postMessage({
          type: 'PUSH_SUBSCRIPTION_CHANGED',
          oldSubscription: event.oldSubscription,
          newSubscription: event.newSubscription
        });
      });
    })
  );
});

if (typeof indexedDB !== 'undefined') {
  initDB().then(() => {
    startPeriodicCheck();
    checkScheduledNotifications();
    cleanupOldNotifications().catch(() => {});
  }).catch((err) => { if (DEBUG) console.error('Erreur init DB:', err); });
}
