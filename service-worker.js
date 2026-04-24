// Service Worker pour cache offline et notifications push
const CACHE_NAME = 'flashcards-v3';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json' // Correction: espace supprimé
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache); // Correction: 'cac he' -> 'cache'
      })
      .catch((err) => {
        console.log('Erreur lors du cache:', err);
      })
  );
  self.skipWaiting();
});

// Activation du Service Worker 
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
      initDB().then(() => {
        startPeriodicCheck();
      }).catch(err => {
        console.log('Erreur init DB:', err);
       })
    ])
  );
  return self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url); // Correction: 'UR L' -> 'URL'
  
  // Ignorer les requêtes non-GET et les requêtes vers d'autres origines
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  } 
  
  // Pour les routes SPA (navigation), toujours retourner index.html
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      caches.match(new Request('./index.html'))
        .then((cachedResponse) => {
          if (cachedResponse) { // Correction: 'c achedResponse' -> 'cachedResponse'
            return cachedResponse;
          }
          return fetch(new Request('./index.html'))
            .then((response) => {
              // Vérifier que la réponse est valide
              if (!response || response.status !== 200) {
                throw new Error('Invalid response');
              }
              const responseToCache = response.clone(); // Correction: 'responseToC ache' -> 'responseToCache'
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(new Request('./index.html'), responseToCache);
              });
               return response;
            })
            .catch(() => {
              // Fallback si même index.html n'est pas disponible
              return new Response(`<h1 style="text-align:center;">Application hors ligne</h1>`, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            });
        })
    );
    return;
  }
  
  // Pour les autres ressources (JS, CSS, images, etc.)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Retourner la réponse du cache si disponible
        if (response) {
          return response;
        }
        
        // Sinon, faire une requête réseau
        return fetch(request).then((response) => {
          //  Vérifier si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Cloner la réponse pour le cache
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request,  responseToCache);
          });
          
          return response;
        });
      })
      .catch(() => {
        // En cas d'erreur, retourner index.html pour les navigation s
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // Pour les autres ressources, retourner une réponse vide
        return new Response('Resource not available offline', { // Correction: 'retu rn' -> 'return'
          status: 404,
          statusText: 'Not Found'
        });
      })
  );
});

// ======================================
// GESTION DES NOTIFICATIONS PUSH
// ======================================

let db = null;

// Initialiser IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FlashcardsNotifications', 1);
    
    request.onerror = () => reject(request.error); // Correction: 'rejec t' -> 'reject'
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
        store.createIndex('deckId', 'deckId', { unique: false }); // Correction: 'st ore' -> 'store'
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
    if (now - timestamp > 120000 ) { 
      recentNotifications.delete(key);
    }
  }
  
  // PRIORITÉ 1: Notification Scheduling API
  if ('Notification' in self && 'scheduledNotifications' in self.registration) {
    try {
      const scheduledNotifications = await self.registration.scheduledNotifications.getAll();
      const dueScheduledNotifications = scheduledNotifications.filter(n => {
        if (n.showTrigger && n.showTrigger.timestamp) {
          return n.showTrigger.timestamp <= now; // Correction opérateur cassé
        }
        return false;
      });

      if (dueScheduledNotifications.length > 0) {
        console.log(`${dueScheduledNotifications.length} notification(s) programmée(s) due(s) trouvée(s)`);
        for (const scheduledNotif of dueScheduledNotifications) {
           try {
            const deckName = scheduledNotif.data?.deckName || 
                             scheduledNotif.body?.replace('Il est temps de réviser : ', '') || 
                            'Vos flashcards';
            const deckId = scheduledNotif.data?.deckId | null;
            
            // Supprimer la notification programmée affichée
            await self.registration.scheduledNotifications.delete(scheduledNotif.id);
            
            if (scheduledNotif.data?.reminderId) {
               const transaction = db.transaction(['notifications'], 'readwrite');
              const store = transaction.objectStore('notifications');
              const notification = await new Promise((resolve, reject) => {
                const request = store.get(scheduledNotif.data.reminderId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              
              if (notification) {
                await scheduleNextNotification(notification);
              }
            }
          } catch (error) {
            console.error('Erreur traitement notif programmée:', error);
          }
        }
      }
    } catch (error) {
      console.log('Notification Scheduling API non disponible ou erreur:', error.message);
    }
  }
  
  // PRIORITÉ 2: IndexedDB fallback
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
          console.log(`${notificationsToShow.length} notification(s) à afficher`);
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
  
  if ('Notification' in self && 'showNotification' in self.registration) {
    if ('scheduledNotifications' in self.registration) {
      try {
        const scheduledNotifications = await self.registration.scheduledNotifications.getAll();
        for (const scheduledNotif of scheduledNotifications) {
          if (scheduledNotif.data && 
              scheduledNotif.data.deckId === notification.deckId && 
              scheduledNotif.data.reminderId === notification.id) {
            try {
              await self.registration.scheduledNotifications.delete(scheduledNotif.id);
             } catch (e) {}
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
          showTrigger: {
            timestamp: nextNotification
          }
        });
         
        console.log('Notification programmée avec API Scheduling');
        return;
      } catch (error) {
        console.log('API Scheduling échouée, utilisation de Background Sync');
      }
    }
  }
  
  await scheduleBackgroundSyncForNotification(notification).catch(() => {});
}

self.addEventListener('message', async (event) => {
  console.log('Message recu dans le service worker:', event.data);
  
  if (!db) await initDB();
  
  if (!event.data || !event.data.type) return;
  
  try {
    if (event.data.type === 'ADD_REMINDER') {
      const { deckId, deckName, intervalMinutes, reminderId } = event.data;
      const result = await addReminder(deckId, deckName, intervalMinutes, reminderId);
      if (result.isDuplicate) {
        console.log('Rappel deja existant, ignore');
      } else {
        console.log('Rappel ajoute avec succes, ID:', result.id);
      }
       
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          success: !result.isDuplicate, 
          type: 'REMINDER_ADDED',
          reminderId: result.id,
          isDuplicate: result.isDuplicate
        });
      }
    } else if (event.data.type === 'REMOVE_REMINDER') {
      const { reminderId, deckId } = event.data;
      if (reminderId) {
        await removeReminderById(reminderId);
      } else if (deckId) {
        await removeReminder(deckId);
      }
      await scheduleNextWakeUp();
    } else if (event.data.type === 'UPDATE_REMINDERS') {
      const { reminders } = event.data;
      if (reminders && Array.isArray(reminders)) {
        await cancelAllReminders();
        for (const reminder of reminders) {
          await addReminder(reminder.deckId, reminder.deckName || 'Deck', reminder.intervalMinutes);
        }
        console.log('Tous les rappels mis a jour');
      }
    } else if (event.data.type === 'GET_ALL_REMINDERS') {
      const reminders = await getAllReminders();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ reminders });
      }
    } else if (event.data.type === 'CANCEL_ALL_REMINDERS') {
      await cancelAllReminders();
    }
  } catch (error) {
    console.error('Erreur message:', error);
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: false, error: error.message });
    }
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
          console.log('Rappel deja existant pour ce deck avec cet intervalle, ignore');
          resolve({ id: existingReminder.id, isDuplicate: true });
          return;
        }
        
        const now = Date.now();
        const nextNotification = now + (intervalMinutes * 60 * 1000);
        
        const notification = {
          deckId: deckId,
          deckName: deckName,
          intervalMinutes: intervalMinutes,
          nextNotification: nextNotification,
          lastNotification: null,
          createdAt: now
        };
        
        if (reminderId) notification.id = reminderId;
      
        const putRequest = store.put(notification);
        putRequest.onsuccess = async () => {
           const finalId = notification.id || putRequest.result;
          notification.id = finalId;
          
          await scheduleNextNotification(notification);
          await scheduleBackgroundSyncForNotification(notification).catch(() => {});
          await scheduleNextWakeUp();
          resolve({ id: finalId, isDuplicate: false });
      };
      putRequest.onerror = () => reject(putRequest.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function scheduleBackgroundSyncForNotification(notification) {
  if (!('serviceWorker' in self) || !('sync' in self.registration)) return;
  
  try {
    const delay = notification.nextNotification - Date.now();
    const syncTag = `notification-${notification.deckId}-${notification.nextNotification}`;
    
    if (delay > 0) {
      await self.registration.sync.register(syncTag).catch(() => {});
    }
    
    await self.registration.sync.register('check-notifications').catch(() => {});
    
    if (delay > 0 && delay < 6 * 60 * 60 * 1000) {
      const earlySyncTag = `notification-early-${notification.deckId}-${notification.nextNotification}`;
      const earlyDelay = Math.max(0, delay - 60000);
      if (earlyDelay > 0) {
        await self.registration.sync.register(earlySyncTag).catch(() => {});
      }
    }
  } catch (error) {
    if (error.name !== 'NotAllowedError' && error.name !== 'NotSupportedError') {
      console.error('Erreur programmation sync:', error);
    }
  }
}

async function removeReminderById(reminderId) {
  if (!db) await initDB();
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const deleteRequest = store.delete(reminderId);
    deleteRequest.onsuccess = () => {
      for (const [key] of recentNotifications.entries()) {
        if (key.includes(`_${reminderId}_`) || key.endsWith(`_${reminderId}`)) {
          recentNotifications.delete(key);
        }
      }
      console.log(`Rappel supprime: ID ${reminderId}`);
      resolve();
    };
     deleteRequest.onerror = () => reject(deleteRequest.error);
  });
}

async function removeReminder(deckId) {
  if (!db) await initDB();
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    
    const request = index.openCursor(IDBKeyRange.only(deckId));
    const idsToDelete = [];
    
    request.onsuccess = (event) => { 
      const cursor = event.target.result;
      if (cursor) {
        idsToDelete.push(cursor.value.id);
        cursor.continue();
      } else {
        if (idsToDelete.length > 0) {
          let deletedCount = 0;
          idsToDelete.forEach(id => {
            const deleteRequest = store.delete(id);
             deleteRequest.onsuccess = () => {
              deletedCount++;
              if (deletedCount === idsToDelete.length) {
                for (const [key] of recentNotifications.entries()) {
                  if (key.startsWith(`${deckId}_`)) {
                    recentNotifications.delete(key);
                  }
                }
                console.log(`Rappel supprime: ${idsToDelete.length} entree(s) pour deckId ${deckId}`);
                 resolve();
              }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        } else {
          console.log(`Aucun rappel trouve pour deckId ${deckId}`);
          resolve();
        }
      }
    };
    
    request.onerror = () => reject(reques t.error);
  });
}

async function getAllReminders() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result || []);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function cancelAllReminders() {
  if (!db) await initDB();
  
  const transaction = db.transaction(['notifications'], 'readwrite');
  const store = transaction.objectStore('notifications');
  store.clear();
}

let checkInterval = null;
let wakeUpTimeout = null;
let isCheckingNotifications = false;
const recentNotifications = new Map();

function startPeriodicCheck() {
  if (checkInterval) clearInterval(checkInterval);
  
  checkScheduledNotifications();
  
  checkInterval = setInterval(() => {
    checkScheduledNotifications();
  }, 120000);
  
  scheduleNextWakeUp();
  
  if ('sync' in self.registration) {
    self.registration.sync.register('check-notifications').catch(() => {});
    self.registration.sync.register('check-notifications-backup-1').catch(() => {});
    self.registration.sync.register('check-notifications-backup-2').catch(() => {});
  }
  
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('check-notifications-periodic', {
      minInterval: 60 * 60 * 1000
    }).catch(() => {});
  }
}

async function scheduleNextWakeUp() {
  if (!db) await initDB();
  if (!db) return;
  
  if (wakeUpTimeout) {
    clearTimeout(wakeUpTimeout);
    wakeUpTimeout = null;
  }
  
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const notifications = request.result || [];
      
      if (notifications.length === 0) { resolve(); return; }
      
      const now = Date.now();
      const upcomingNotifications = notifications
        .filter(n => n.nextNotification && n.nextNotification > now)
        .sort((a, b) => a.nextNotification - b.nextNotification);
      
      if (upcomingNotifications.length > 0) {
        const nextNotification = upcomingNotifications[0];
        const delay = nextNotification.nextNotification - now;
        
        if ('sync' in self.registration) {
          try {
            const notificationsToSync = upcomingNotifications.slice(0, 10);
            for (const notif of notificationsToSync) {
              const syncDelay = notif.nextNotification - now;
              if (syncDelay > 0 && syncDelay < 24 * 60 * 60 * 1000) {
                const syncTag = `notification-${notif.deckId}-${notif.nextNotification}`;
                await self.registration.sync.register(syncTag).catch(() => {});
                
                if (syncDelay < 6 * 60 * 60 * 1000) {
                  const backupTag = `notification-backup-${notif.deckId}-${notif.nextNotification}`;
                  await self.registration.sync.register(backupTag).catch(() => {});
                }
              }
            }
            
            await self.registration.sync.register('check-notifications').catch(() => {});
            await self.registration.sync.register('check-notifications-backup-1').catch(() => {});
            await self.registration.sync.register('check-notifications-backup-2').catch(() => {});
          } catch (error) {
            console.log('Erreur programmation sync:', error);
          }
        }
        
        const maxDelay = 24 * 60 * 60 * 1000;
        const actualDelay = Math.min(delay, maxDelay);
        
        if (actualDelay > 0 && actualDelay < 2147483647) {
          wakeUpTimeout = setTimeout(() => {
            checkScheduledNotifications().then(() => {
              scheduleNextWakeUp();
            });
          }, actualDelay);
        }
      }
      
      resolve();
    };
    
    request.onerror = () => resolve();
  });
}

self.addEventListener('activate', async (event) => {
  event.waitUntil(
    initDB().then(() => {
      startPeriodicCheck();
      checkScheduledNotifications();
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications' || 
      event.tag.startsWith('notification-') || 
      event.tag.startsWith('check-notifications-backup-')) {
    event.waitUntil(
      checkScheduledNotifications().then(() => {
        scheduleNextWakeUp();
        if ('sync' in self.registration) {
          self.registration.sync.register('check-notifications').catch(() => {});
          self.registration.sync.register('check-notifications-backup-1').catch(() => {});
          self.registration.sync.register('check-notifications-backup-2').catch(() => {});
        }
      })
    );
  }
});

if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications-periodic') {
      event.waitUntil(
        checkScheduledNotifications().then(() => {
          scheduleNextWakeUp();
        })
      );
    }
  });
}

async function showReviewNotification(deckName = 'Vos flashcards', deckId = null) {
  if (!self.registration || !self.registration.showNotification) {
    console.error('Service worker ne peut pas afficher de notifications');
    return;
  }
  
  const title = 'Rappel de révision';
  
  const options = {
    body: `Il est temps de réviser : ${deckName}`,
    tag: `review-reminder-${deckId || 'default'}-${Date.now()}`,
    requireInteraction: false,
    silent: false,
    data: {
      url: './index.html',
      deckId: deckId,
      timestamp: Date.now()
    }
  };
   
  try {
    options.icon = './icon-1024.png';
    options.badge = './icon-1024.png';
  } catch (e) {}
  
  options.vibrate = [200, 100, 200];
  
  try {
    options.actions = [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Plus tard' }
    ];
  } catch (e) {}
  
  try {
    options.tag = `review-${deckId}-${Date.now()}`;
    await self.registration.showNotification(title, options);
  } catch (error) {
    console.error('Erreur notification:', error);
  }
}

self.addEventListener('push', (event) => {
  console.log('Push notification reçue:', event);
  
  let data = {
    title: 'Rappel de révision',
    body: 'Il est temps de réviser vos flashcards !',
    icon: './icon-1024.png',
    badge: './icon-1024.png',
    tag: 'review-reminder',
    data: { url: './' }
  };
  
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || './icon-1024.png',
    badge: data.badge || './icon-1024.png',
    tag: data.tag || `push-${Date.now()}`,
    data: data.data || { url: './' },
    vibrate: data.vibrate || [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Plus tard' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const deckId = notificationData.deckId;
  const targetUrl = notificationData.url || './index.html';
  
  if (event.action === 'dismiss') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            if (deckId) {
              client.postMessage({
                type: 'OPEN_DECK',
                deckId: deckId
              });
            }
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
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
  }).catch(err => {
    console.log('Erreur init DB au chargement:', err);
  });
}