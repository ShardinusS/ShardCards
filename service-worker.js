// Service Worker pour cache offline et notifications
const CACHE_NAME = 'flashcards-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
  // Les icônes sont optionnelles - ne pas les mettre en cache si elles n'existent pas
  // './icon-192.png',
  // './icon-512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
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
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET et les requêtes vers d'autres origines
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  
  // Pour les routes SPA (navigation), toujours retourner index.html
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      caches.match(new Request('./index.html'))
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(new Request('./index.html'))
            .then((response) => {
              // Vérifier que la réponse est valide
              if (!response || response.status !== 200) {
                throw new Error('Invalid response');
              }
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(new Request('./index.html'), responseToCache);
              });
              return response;
            })
            .catch(() => {
              // Fallback si même index.html n'est pas disponible
              return new Response('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title></head><body><h1>Application hors ligne</h1></body></html>', {
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
          // Vérifier si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Cloner la réponse pour le cache
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          
          return response;
        });
      })
      .catch(() => {
        // En cas d'erreur, retourner index.html pour les navigations
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // Pour les autres ressources, retourner une réponse vide
        return new Response('Resource not available offline', {
          status: 404,
          statusText: 'Not Found'
        });
      })
  );
});

// ============================================
// GESTION DES NOTIFICATIONS PUSH
// ============================================

// Base de données IndexedDB pour stocker les notifications
let db = null;

// Initialiser IndexedDB
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

// Vérifier et afficher les notifications programmées
async function checkScheduledNotifications() {
  if (!db) {
    await initDB();
  }
  
  if (!db) {
    console.log('Base de donnees non initialisee');
    return 0;
  }
  
  return new Promise((resolve) => {
    const now = Date.now();
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('nextNotification');
    // Vérifier les notifications qui sont dues (avec une marge de 5 minutes pour éviter les problèmes de timing)
    const range = IDBKeyRange.upperBound(now + (5 * 60 * 1000));
    
    const request = index.openCursor(range);
    const notificationsToShow = [];
    
    request.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const notification = cursor.value;
        // Vérifier que la notification est vraiment due
        if (notification.nextNotification <= now) {
          notificationsToShow.push(notification);
          console.log('Notification due trouvee:', notification.deckName, new Date(notification.nextNotification).toLocaleString());
        }
        cursor.continue();
      } else {
        // Afficher toutes les notifications qui sont dues
        if (notificationsToShow.length > 0) {
          console.log(`${notificationsToShow.length} notification(s) a afficher`);
          for (const notification of notificationsToShow) {
            try {
              await showReviewNotification(notification.deckName || 'Vos flashcards', notification.deckId);
              await scheduleNextNotification(notification);
            } catch (error) {
              console.error('Erreur lors de l\'affichage de la notification:', error);
            }
          }
          
          // Reprogrammer le prochain réveil
          scheduleNextWakeUp();
        }
        
        resolve(notificationsToShow.length);
      }
    };
    
    request.onerror = (error) => {
      console.error('Erreur lors de la verification des notifications:', error);
      resolve(0);
    };
  });
}

// Programmer la prochaine notification
async function scheduleNextNotification(notification) {
  if (!db) {
    await initDB();
  }
  
  const now = Date.now();
  const intervalMs = notification.intervalMinutes * 60 * 1000;
  const nextNotification = now + intervalMs;
  
  const transaction = db.transaction(['notifications'], 'readwrite');
  const store = transaction.objectStore('notifications');
  
  notification.nextNotification = nextNotification;
  notification.lastNotification = now;
  
  store.put(notification);
  
  // Programmer une synchronisation en arrière-plan pour la prochaine notification
  await scheduleBackgroundSyncForNotification(notification);
  
  // Programmer aussi une vérification locale (pour quand le service worker est actif)
  const delay = nextNotification - now;
  if (delay > 0 && delay < 2147483647) { // Max pour setTimeout
    setTimeout(() => {
      checkScheduledNotifications();
    }, delay);
  }
}

// Écouter les messages du client
self.addEventListener('message', async (event) => {
  console.log('Message recu dans le service worker:', event.data);
  
  if (!db) {
    await initDB();
  }
  
  if (!event.data || !event.data.type) {
    console.warn('Message sans type recu');
    return;
  }
  
  try {
    if (event.data.type === 'ADD_REMINDER') {
      const { deckId, deckName, intervalMinutes } = event.data;
      console.log('Ajout d\'un rappel:', deckName, intervalMinutes, 'minutes');
      await addReminder(deckId, deckName, intervalMinutes);
      console.log('Rappel ajoute avec succes');
      
      // Répondre au client
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, type: 'REMINDER_ADDED' });
      }
    } else if (event.data.type === 'REMOVE_REMINDER') {
      const { deckId } = event.data;
      console.log('Suppression d\'un rappel:', deckId);
      await removeReminder(deckId);
      console.log('Rappel supprime avec succes');
    } else if (event.data.type === 'UPDATE_REMINDERS') {
      // Synchroniser tous les rappels (pour compatibilité)
      const { reminders } = event.data;
      console.log('Mise a jour de tous les rappels:', reminders?.length || 0);
      if (reminders && Array.isArray(reminders)) {
        // Supprimer tous les rappels existants
        await cancelAllReminders();
        // Ajouter les nouveaux rappels
        for (const reminder of reminders) {
          await addReminder(reminder.deckId, reminder.deckName || 'Deck', reminder.intervalMinutes);
        }
        console.log('Tous les rappels mis a jour');
      }
    } else if (event.data.type === 'GET_ALL_REMINDERS') {
      const reminders = await getAllReminders();
      console.log('Recuperation de tous les rappels:', reminders.length);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ reminders });
      } else {
        // Fallback si MessageChannel n'est pas utilisé
        event.source.postMessage({ type: 'ALL_REMINDERS', reminders }, event.origin);
      }
    } else if (event.data.type === 'CANCEL_ALL_REMINDERS') {
      console.log('Annulation de tous les rappels');
      await cancelAllReminders();
      console.log('Tous les rappels annules');
    }
  } catch (error) {
    console.error('Erreur lors du traitement du message:', error);
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: false, error: error.message });
    }
  }
});

// Ajouter un rappel
async function addReminder(deckId, deckName, intervalMinutes) {
  if (!db) {
    await initDB();
  }
  
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    
    // Vérifier si un rappel existe déjà pour ce deck
    const existingRequest = index.get(deckId);
    existingRequest.onsuccess = async () => {
      const existing = existingRequest.result;
      const now = Date.now();
      const nextNotification = now + (intervalMinutes * 60 * 1000);
      
      // Construire l'objet notification
      const notification = {
        deckId: deckId,
        deckName: deckName,
        intervalMinutes: intervalMinutes,
        nextNotification: nextNotification,
        lastNotification: null,
        createdAt: existing ? existing.createdAt : now
      };
      
      // Si un rappel existe déjà, inclure son ID pour la mise à jour
      if (existing && existing.id) {
        notification.id = existing.id;
      }
      // Sinon, laisser autoIncrement générer l'ID automatiquement
      
      const putRequest = store.put(notification);
      putRequest.onsuccess = async () => {
        // Programmer une synchronisation en arrière-plan pour cette notification
        await scheduleBackgroundSyncForNotification(notification);
        // Reprogrammer le prochain réveil pour inclure cette nouvelle notification
        await scheduleNextWakeUp();
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    };
    existingRequest.onerror = () => reject(existingRequest.error);
  });
}

// Programmer une synchronisation en arrière-plan pour une notification
async function scheduleBackgroundSyncForNotification(notification) {
  if (!('serviceWorker' in self) || !('sync' in self.registration)) {
    return; // Background Sync non disponible
  }
  
  try {
    const delay = notification.nextNotification - Date.now();
    
    // Si la notification est dans moins de 5 minutes, programmer immédiatement
    if (delay > 0 && delay < 5 * 60 * 1000) {
      await self.registration.sync.register(`notification-${notification.deckId}-${Date.now()}`);
    } else if (delay > 0) {
      // Pour les notifications futures, programmer une sync périodique
      // Le système vérifiera périodiquement les notifications
      await self.registration.sync.register('check-notifications');
    }
  } catch (error) {
    console.log('Erreur lors de la programmation de la sync:', error);
  }
}

// Supprimer un rappel
async function removeReminder(deckId) {
  if (!db) {
    await initDB();
  }
  
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    
    const request = index.get(deckId);
    request.onsuccess = () => {
      if (request.result) {
        const deleteRequest = store.delete(request.result.id);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Obtenir tous les rappels
async function getAllReminders() {
  if (!db) {
    await initDB();
  }
  
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

// Annuler tous les rappels
async function cancelAllReminders() {
  if (!db) {
    await initDB();
  }
  
  const transaction = db.transaction(['notifications'], 'readwrite');
  const store = transaction.objectStore('notifications');
  store.clear();
}

// Vérifier périodiquement les notifications
let checkInterval = null;
let wakeUpTimeout = null;

function startPeriodicCheck() {
  // Vérifier toutes les minutes quand le service worker est actif
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Vérifier immédiatement
  checkScheduledNotifications();
  
  // Vérifier périodiquement quand le service worker est actif (toutes les minutes pour être plus réactif)
  checkInterval = setInterval(() => {
    checkScheduledNotifications();
  }, 60000); // Toutes les minutes pour être plus réactif
  
  // Programmer un réveil pour vérifier les notifications même quand l'app est fermée
  scheduleNextWakeUp();
  
  // Enregistrer une sync périodique pour s'assurer que les notifications sont vérifiées
  if ('sync' in self.registration) {
    self.registration.sync.register('check-notifications').catch(() => {
      // Ignorer si déjà enregistré
    });
  }
  
  console.log('Verification periodique des notifications demarree');
}

// Programmer le prochain réveil pour vérifier les notifications
async function scheduleNextWakeUp() {
  if (!db) {
    await initDB();
  }
  
  if (!db) return;
  
  // Annuler le timeout précédent
  if (wakeUpTimeout) {
    clearTimeout(wakeUpTimeout);
    wakeUpTimeout = null;
  }
  
  // Récupérer toutes les notifications programmées
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const index = store.index('nextNotification');
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const notifications = request.result || [];
      
      if (notifications.length === 0) {
        resolve();
        return;
      }
      
      // Trouver la prochaine notification à afficher
      const now = Date.now();
      const upcomingNotifications = notifications
        .filter(n => n.nextNotification && n.nextNotification > now)
        .sort((a, b) => a.nextNotification - b.nextNotification);
      
      if (upcomingNotifications.length > 0) {
        const nextNotification = upcomingNotifications[0];
        const delay = nextNotification.nextNotification - now;
        
        // Programmer une synchronisation en arrière-plan pour la prochaine notification
        if ('sync' in self.registration) {
          try {
            // Programmer une sync pour chaque notification à venir (max 5 pour éviter la surcharge)
            const notificationsToSync = upcomingNotifications.slice(0, 5);
            for (const notif of notificationsToSync) {
              const syncDelay = notif.nextNotification - now;
              if (syncDelay > 0 && syncDelay < 24 * 60 * 60 * 1000) {
                // Programmer une sync spécifique pour cette notification
                const syncTag = `notification-${notif.deckId}-${notif.nextNotification}`;
                await self.registration.sync.register(syncTag).catch(() => {
                  // Ignorer si déjà enregistré
                });
              }
            }
            
            // Programmer aussi une sync générale pour vérifier périodiquement
            await self.registration.sync.register('check-notifications').catch(() => {
              // Ignorer si déjà enregistré
            });
          } catch (error) {
            console.log('Erreur lors de la programmation de la sync:', error);
          }
        }
        
        // Programmer aussi un réveil local (pour quand le service worker est actif)
        const maxDelay = 24 * 60 * 60 * 1000; // 24 heures
        const actualDelay = Math.min(delay, maxDelay);
        
        if (actualDelay > 0 && actualDelay < 2147483647) {
          wakeUpTimeout = setTimeout(() => {
            checkScheduledNotifications().then(() => {
              // Programmer le prochain réveil
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

// Vérifier au démarrage et à chaque activation
self.addEventListener('activate', async (event) => {
  event.waitUntil(
    initDB().then(() => {
      startPeriodicCheck();
      // Vérifier immédiatement les notifications dues
      checkScheduledNotifications();
    })
  );
});

// Écouter l'événement de réveil du service worker (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications' || event.tag.startsWith('notification-')) {
    event.waitUntil(
      checkScheduledNotifications().then(() => {
        scheduleNextWakeUp();
        // Reprogrammer la prochaine sync
        if ('sync' in self.registration) {
          self.registration.sync.register('check-notifications').catch(() => {
            // Ignorer les erreurs si la sync est déjà enregistrée
          });
        }
      })
    );
  }
});

// Écouter l'événement Periodic Background Sync (Android Chrome)
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

// Initialiser la base de données et démarrer la vérification au chargement du service worker
if (typeof indexedDB !== 'undefined') {
  initDB().then(() => {
    startPeriodicCheck();
    // Vérifier immédiatement les notifications dues
    checkScheduledNotifications();
  }).catch(err => {
    console.log('Erreur init DB au chargement:', err);
  });
}

// Détecter si on est sur Windows
function isWindows() {
  // Dans un service worker, on ne peut pas accéder à navigator.platform directement
  // On va utiliser les clients pour détecter
  return clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clientList => {
      if (clientList.length > 0) {
        // On peut envoyer un message pour demander, mais pour simplifier,
        // on va toujours essayer d'envoyer un message au client d'abord
        return false; // On va toujours essayer le bandeau d'abord
      }
      return false;
    })
    .catch(() => false);
}

// Afficher une notification de rappel (notifications push pour mobile et desktop)
async function showReviewNotification(deckName = 'Vos flashcards', deckId = null) {
  // Vérifier que le service worker peut afficher des notifications
  if (!self.registration || !self.registration.showNotification) {
    console.error('Service worker ne peut pas afficher de notifications');
    return;
  }
  
  const title = 'Rappel de révision';
  
  // Options de base pour toutes les plateformes (mobile et desktop)
  const options = {
    body: `Il est temps de réviser : ${deckName}`,
    tag: `review-reminder-${deckId || 'default'}-${Date.now()}`, // Tag unique pour éviter les conflits
    requireInteraction: false,
    silent: false,
    data: {
      url: './index.html',
      deckId: deckId,
      timestamp: Date.now()
    }
  };
  
  // Ajouter l'icône si disponible
  try {
    options.icon = './icon-1024.png';
    options.badge = './icon-1024.png';
  } catch (e) {
    // Ignorer si l'icône n'est pas disponible
  }
  
  // Vibrations pour mobile (ignoré sur desktop, mais toujours ajouté)
  // Le navigateur ignorera automatiquement si non supporté
  options.vibrate = [200, 100, 200];
  
  // Actions pour les notifications (supportées sur desktop et mobile)
  try {
    options.actions = [
      {
        action: 'open',
        title: 'Ouvrir'
      },
      {
        action: 'dismiss',
        title: 'Plus tard'
      }
    ];
  } catch (e) {
    // Ignorer si les actions ne sont pas supportées
  }
  
  try {
    // Afficher la notification
    await self.registration.showNotification(title, options);
    console.log('Notification push affichee:', deckName, 'a', new Date().toLocaleTimeString());
  } catch (error) {
    console.error('Erreur lors de l\'affichage de la notification:', error);
    console.error('Détails de l\'erreur:', error.message, error.stack);
    
    // Essayer avec des options minimales en cas d'erreur
    try {
      const minimalOptions = {
        body: options.body,
        tag: options.tag,
        data: options.data
      };
      
      // Ajouter l'icône si possible
      if (options.icon) {
        minimalOptions.icon = options.icon;
      }
      
      await self.registration.showNotification(title, minimalOptions);
      console.log('Notification affichee avec options minimales');
    } catch (fallbackError) {
      console.error('Erreur critique lors de l\'affichage de la notification:', fallbackError);
      console.error('Détails de l\'erreur fallback:', fallbackError.message, fallbackError.stack);
    }
  }
}

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const deckId = event.notification.data?.deckId;
  
  if (event.action === 'open' || !event.action) {
    // Ouvrir l'application
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Si une fenêtre est déjà ouverte, la mettre au premier plan
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes(self.registration.scope) && 'focus' in client) {
              // Envoyer un message pour ouvrir le deck si nécessaire
              if (deckId) {
                client.postMessage({
                  type: 'OPEN_DECK',
                  deckId: deckId
                });
              }
              return client.focus();
            }
          }
          // Sinon, ouvrir une nouvelle fenêtre
          if (clients.openWindow) {
            return clients.openWindow('./index.html');
          }
        })
    );
  }
});

