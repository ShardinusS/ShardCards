const CACHE_NAME = 'flashcards-v3';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((err) => console.log('Erreur lors du cache:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      initDB().then(() => startPeriodicCheck()).catch(err => console.log('Erreur init DB:', err))
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
      caches.match(new Request('./index.html'))
        .then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(new Request('./index.html'))
            .then((response) => {
              if (!response || response.status !== 200) throw new Error('Invalid response');
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(new Request('./index.html'), responseToCache));
              return response;
            })
            .catch(() => new Response(`<h1 style="text-align:center;">Application hors ligne</h1>`, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }));
        })
    );
    return;
  }
  
  // Stale-while-revalidate pour script.js et style.css : servir le cache
  // immédiatement et refetcher en arrière-plan pour la prochaine visite.
  const isAppAsset = url.pathname.endsWith('/script.js') || url.pathname.endsWith('/style.css');
  if (isAppAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);
        return cached ?? fetchPromise;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) return response;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return response;
        });
      })
      .catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Resource not available offline', { status: 404, statusText: 'Not Found' });
      })
  );
});

// --- Gestion des notifications ---

let db = null;
let checkInterval = null;
let wakeUpTimeout = null;
let isCheckingNotifications = false;
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
  if (isCheckingNotifications) return 0;
  if (!db) await initDB();
  if (!db) return 0;
  
  isCheckingNotifications = true;
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > 120000) recentNotifications.delete(key);
  }
  
  if ('Notification' in self && 'scheduledNotifications' in self.registration) {
    try {
      const scheduledNotifications = await self.registration.scheduledNotifications.getAll();
      const dueScheduledNotifications = scheduledNotifications.filter(n => n.showTrigger?.timestamp <= now);
      if (dueScheduledNotifications.length > 0) {
        for (const scheduledNotif of dueScheduledNotifications) {
          try {
            const deckId = scheduledNotif.data?.deckId || null;
            await self.registration.scheduledNotifications.delete(scheduledNotif.id);
            if (scheduledNotif.data?.reminderId && db) {
              const transaction = db.transaction(['notifications'], 'readwrite');
              const store = transaction.objectStore('notifications');
              const notification = await new Promise((resolve, reject) => {
                const req = store.get(scheduledNotif.data.reminderId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              });
              if (notification) {
                // Marquer comme récente AVANT scheduleNext pour éviter le double-affichage
                // par le chemin IndexedDB qui s'exécute juste après.
                const dedupeKey = `${notification.deckId}_${notification.nextNotification}`;
                recentNotifications.set(dedupeKey, now);
                await scheduleNextNotification(notification);
              }
            }
          } catch (error) {
            console.error('Erreur traitement notif programmée:', error);
          }
        }
      }
    } catch (error) {
      console.log('Scheduling API non disponible:', error.message);
    }
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
          scheduleNextWakeUp();
        }
        isCheckingNotifications = false;
        resolve(notificationsToShow.length);
      }
    };
    
    request.onerror = (error) => {
      console.error('Erreur vérification notifications:', error);
      isCheckingNotifications = false;
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
  
  if ('scheduledNotifications' in self.registration) {
    try {
      const scheduledNotifications = await self.registration.scheduledNotifications.getAll();
      for (const sn of scheduledNotifications) {
        if (sn.data?.deckId === notification.deckId && sn.data?.reminderId === notification.id) {
          await self.registration.scheduledNotifications.delete(sn.id);
        }
      }
      await self.registration.scheduledNotifications.schedule({
        title: 'Rappel de révision',
        body: `Il est temps de réviser : ${notification.deckName || 'Vos flashcards'}`,
        icon: './icon-1024.png',
        badge: './icon-1024.png',
        tag: `review-reminder-${notification.deckId}-${notification.id}`,
        data: {
          url: './index.html',
          deckId: notification.deckId,
          reminderId: notification.id,
          deckName: notification.deckName,
          timestamp: nextNotification
        },
        showTrigger: { timestamp: nextNotification }
      });
      return;
    } catch (error) {
      console.log('Scheduling API échouée, utilisation Background Sync');
    }
  }
  await scheduleBackgroundSyncForNotification(notification).catch(() => {});
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
  console.log('Message reçu dans le service worker:', event.data);
  if (!db) await initDB();
  if (!event.data || !event.data.type) return;
  
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
      await scheduleNextWakeUp();
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
          await scheduleNextWakeUp();
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
  scheduleNextWakeUp();
  if ('sync' in self.registration) {
    self.registration.sync.register('check-notifications').catch(() => {});
  }
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('check-notifications-periodic', { minInterval: 60 * 60 * 1000 }).catch(() => {});
  }
}

async function scheduleNextWakeUp() {
  if (!db) await initDB();
  if (!db) return;
  if (wakeUpTimeout) clearTimeout(wakeUpTimeout);
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();
    request.onsuccess = async () => {
      const notifications = request.result || [];
      if (notifications.length === 0) { resolve(); return; }
      const now = Date.now();
      const upcoming = notifications.filter(n => n.nextNotification > now).sort((a,b) => a.nextNotification - b.nextNotification);
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const delay = Math.min(next.nextNotification - now, 24 * 60 * 60 * 1000);
        if (delay > 0 && delay < 2147483647) {
          wakeUpTimeout = setTimeout(() => {
            checkScheduledNotifications().then(() => scheduleNextWakeUp());
          }, delay);
        }
      }
      resolve();
    };
    request.onerror = () => resolve();
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications' || event.tag.startsWith('notification-') || event.tag.startsWith('check-notifications-backup-')) {
    event.waitUntil(checkScheduledNotifications().then(() => {
      scheduleNextWakeUp();
      if ('sync' in self.registration) {
        self.registration.sync.register('check-notifications').catch(() => {});
      }
    }));
  }
});

if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications-periodic') {
      event.waitUntil(checkScheduledNotifications().then(() => scheduleNextWakeUp()));
    }
  });
}

async function showReviewNotification(deckName = 'Vos flashcards', deckId = null) {
  if (!self.registration || !self.registration.showNotification) return;
  const title = 'Rappel de révision';
  const options = {
    body: `Il est temps de réviser : ${deckName}`,
    tag: `review-reminder-${deckId || 'default'}-${Date.now()}`,
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
    data: { url: './' }
  };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { data.body = event.data.text() || data.body; }
  }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || `push-${Date.now()}`,
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
  initDB().then(() => { startPeriodicCheck(); checkScheduledNotifications(); }).catch(err => console.log('Erreur init DB:', err));
}