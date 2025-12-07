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

// ============================================
// DÉTECTION DE PLATEFORME
// ============================================

// Détecter la plateforme pour choisir le meilleur niveau de notification
function detectPlatform() {
  const ua = self.navigator?.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;
  
  return {
    isIOS,
    isAndroid,
    isDesktop,
    // Sur iOS, seul Web Push fonctionne
    requiresWebPush: isIOS,
    // Sur Android, on peut utiliser Scheduling API ou Background Sync
    canUseScheduling: !isIOS && 'scheduledNotifications' in self.registration,
    canUseBackgroundSync: !isIOS && 'sync' in self.registration
  };
}

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
  // Éviter les vérifications simultanées
  if (isCheckingNotifications) {
    return 0;
  }
  
  if (!db) {
    await initDB();
  }
  
  if (!db) {
    console.log('Base de donnees non initialisee');
    return 0;
  }
  
  isCheckingNotifications = true;
  
  // Nettoyer le cache des notifications récentes (plus de 2 minutes)
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > 120000) { // 2 minutes
      recentNotifications.delete(key);
    }
  }
  
  // PRIORITÉ 1: Vérifier d'abord les notifications programmées avec l'API Notification Scheduling
  // Cette API gère automatiquement l'affichage des notifications même quand l'app est fermée
  if ('Notification' in self && 'scheduledNotifications' in self.registration) {
    try {
      const scheduledNotifications = await self.registration.scheduledNotifications.getAll();
      const now = Date.now();
      const dueScheduledNotifications = scheduledNotifications.filter(n => {
        // Vérifier si la notification est due
        if (n.showTrigger && n.showTrigger.timestamp) {
          return n.showTrigger.timestamp <= now;
        }
        return false;
      });
      
      if (dueScheduledNotifications.length > 0) {
        console.log(`${dueScheduledNotifications.length} notification(s) programmée(s) due(s) trouvée(s)`);
        for (const scheduledNotif of dueScheduledNotifications) {
          try {
            // La notification devrait déjà être affichée automatiquement par le navigateur
            // Mais on vérifie quand même et on met à jour IndexedDB pour programmer la suivante
            
            // Extraire le nom du deck du body ou des données
            const deckName = scheduledNotif.data?.deckName || 
                            scheduledNotif.body?.replace('Il est temps de réviser : ', '') || 
                            'Vos flashcards';
            const deckId = scheduledNotif.data?.deckId || null;
            
            // Supprimer la notification programmée (elle a déjà été affichée par le navigateur)
            await self.registration.scheduledNotifications.delete(scheduledNotif.id);
            
            // Mettre à jour la notification dans IndexedDB pour programmer la prochaine
            if (scheduledNotif.data?.reminderId) {
              const transaction = db.transaction(['notifications'], 'readwrite');
              const store = transaction.objectStore('notifications');
              const notification = await new Promise((resolve, reject) => {
                const request = store.get(scheduledNotif.data.reminderId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              
              if (notification) {
                // Programmer la prochaine notification
                await scheduleNextNotification(notification);
              }
            }
          } catch (error) {
            console.error('Erreur lors du traitement de la notification programmée:', error);
          }
        }
      }
    } catch (error) {
      // L'API n'est pas disponible, continuer avec la méthode normale
      console.log('Notification Scheduling API non disponible:', error.message);
    }
  }
  
  // PRIORITÉ 2: Vérifier les notifications dans IndexedDB (méthode de fallback)
  // On utilise Background Sync avec plusieurs enregistrements pour augmenter la fiabilité.
  
  return new Promise((resolve) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('nextNotification');
    // Vérifier les notifications qui sont dues (sans marge pour éviter les doublons)
    const range = IDBKeyRange.upperBound(now);
    
    const request = index.openCursor(range);
    const notificationsToShow = [];
    
    request.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const notification = cursor.value;
        // Vérifier que la notification est vraiment due ET qu'elle n'a pas été affichée récemment
        const notificationKey = `${notification.deckId}_${notification.nextNotification}`;
        const wasShownRecently = recentNotifications.has(notificationKey);
        
        if (notification.nextNotification <= now && !wasShownRecently) {
          notificationsToShow.push(notification);
          // Marquer immédiatement comme affichée pour éviter les doublons
          recentNotifications.set(notificationKey, now);
        }
        cursor.continue();
      } else {
        // Afficher toutes les notifications qui sont dues
        if (notificationsToShow.length > 0) {
          console.log(`${notificationsToShow.length} notification(s) a afficher`);
        for (const notification of notificationsToShow) {
            try {
              // Mettre à jour la notification AVANT de l'afficher pour éviter qu'elle soit trouvée à nouveau
              await scheduleNextNotification(notification);
          await showReviewNotification(notification.deckName || 'Vos flashcards', notification.deckId);
            } catch (error) {
              console.error('Erreur lors de l\'affichage de la notification:', error);
            }
        }
        
        // Reprogrammer le prochain réveil
          scheduleNextWakeUp();
        }
        
        isCheckingNotifications = false;
        resolve(notificationsToShow.length);
      }
    };
    
    request.onerror = (error) => {
      console.error('Erreur lors de la verification des notifications:', error);
      isCheckingNotifications = false;
      resolve(0);
    };
  });
}

// Programmer la prochaine notification avec sélection automatique du niveau
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
  
  // Détecter la plateforme pour choisir le meilleur niveau
  const platform = detectPlatform();
  
  // NIVEAU 1: Notification Scheduling API (priorité absolue si disponible)
  // Fonctionne même application fermée, hors ligne, et ne dépend pas du service worker actif
  if (platform.canUseScheduling && 'scheduledNotifications' in self.registration) {
    try {
      // Récupérer toutes les notifications programmées existantes
      const scheduledNotifications = await self.registration.scheduledNotifications.getAll();
      
      // Supprimer les anciennes notifications programmées pour ce rappel
      for (const scheduledNotif of scheduledNotifications) {
        if (scheduledNotif.data && 
            scheduledNotif.data.deckId === notification.deckId && 
            scheduledNotif.data.reminderId === notification.id) {
          try {
            await self.registration.scheduledNotifications.delete(scheduledNotif.id);
          } catch (e) {
            // Ignorer les erreurs de suppression
          }
        }
      }
      
      // Programmer la nouvelle notification avec un timestamp absolu
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
          timestamp: nextNotification // Utiliser timestamp pour plus de précision
        }
      });
      
      console.log('[NIVEAU 1] Notification programmée avec Notification Scheduling API pour', new Date(nextNotification).toLocaleString());
      
      // Même si on utilise Scheduling API, on enregistre aussi dans IndexedDB pour Web Push
      // Le backend pourra utiliser ces données pour envoyer des push si nécessaire
      await notifyClientForWebPush(notification, nextNotification);
      
      return; // Utiliser cette méthode si disponible
    } catch (error) {
      // L'API n'est pas disponible ou a échoué, continuer avec le niveau suivant
      console.log('[NIVEAU 1] Notification Scheduling API non disponible, passage au niveau suivant:', error.message);
    }
  }
  
  // NIVEAU 2: Background Sync (si pas iOS et Scheduling non disponible)
  if (platform.canUseBackgroundSync && !platform.requiresWebPush) {
    try {
      // Programmer une synchronisation en arrière-plan pour la prochaine notification
      await scheduleBackgroundSyncForNotification(notification);
      console.log('[NIVEAU 2] Notification programmée avec Background Sync pour', new Date(nextNotification).toLocaleString());
      
      // Même si on utilise Background Sync, on enregistre aussi pour Web Push comme backup
      await notifyClientForWebPush(notification, nextNotification);
      
      return;
    } catch (error) {
      console.log('[NIVEAU 2] Background Sync non disponible, passage au niveau 3:', error.message);
    }
  }
  
  // NIVEAU 3: Web Push (obligatoire sur iOS, fallback général)
  // Le backend doit être configuré pour envoyer les notifications
  console.log('[NIVEAU 3] Utilisation de Web Push pour', new Date(nextNotification).toLocaleString());
  await notifyClientForWebPush(notification, nextNotification);
}

// Notifier le client pour qu'il enregistre la notification pour FCM
async function notifyClientForWebPush(notification, nextNotification) {
  // Envoyer un message au client pour qu'il note que cette notification doit être envoyée via FCM
  // Les notifications FCM sont envoyées depuis Firebase Console ou un backend Firebase
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({
        type: 'SCHEDULE_FCM',
        notification: {
          reminderId: notification.id,
          deckId: notification.deckId,
          deckName: notification.deckName,
          nextNotification: nextNotification,
          intervalMinutes: notification.intervalMinutes
        }
      });
    }
    console.log('[NIVEAU 3] Notification programmée pour FCM. Utilisez le token FCM pour envoyer depuis Firebase Console.');
  } catch (error) {
    console.log('Impossible de notifier le client pour FCM:', error);
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
      const { deckId, deckName, intervalMinutes, reminderId } = event.data;
      console.log('Ajout d\'un rappel:', deckName, intervalMinutes, 'minutes');
      const result = await addReminder(deckId, deckName, intervalMinutes, reminderId);
      if (result.isDuplicate) {
        console.log('Rappel deja existant, ignore');
      } else {
        console.log('Rappel ajoute avec succes, ID:', result.id);
      }
      
      // Répondre au client avec l'ID du rappel
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
      // Si reminderId est fourni, supprimer ce rappel spécifique
      // Sinon, supprimer tous les rappels pour ce deck (compatibilité)
      if (reminderId) {
        console.log('Suppression d\'un rappel specifique:', reminderId);
        await removeReminderById(reminderId);
      } else if (deckId) {
        console.log('Suppression de tous les rappels pour le deck:', deckId);
    await removeReminder(deckId);
      }
      console.log('Rappel supprime avec succes');
      // Recalculer le prochain réveil après suppression
      await scheduleNextWakeUp();
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
async function addReminder(deckId, deckName, intervalMinutes, reminderId = null) {
  if (!db) {
    await initDB();
  }
  
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    
    // Vérifier si un rappel existe déjà pour ce deck avec le même intervalle
    const request = index.openCursor(IDBKeyRange.only(deckId));
    let existingReminder = null;
    const allReminders = [];
    
    request.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        allReminders.push(cursor.value);
        // Vérifier si c'est un doublon (même deckId et même intervalMinutes)
        if (cursor.value.intervalMinutes === intervalMinutes) {
          existingReminder = cursor.value;
        }
        cursor.continue();
      } else {
        // Si un rappel existe déjà avec le même intervalle, ne pas créer de doublon
        if (existingReminder) {
          console.log('Rappel deja existant pour ce deck avec cet intervalle, ignore');
          resolve({ id: existingReminder.id, isDuplicate: true });
          return;
        }
        
      const now = Date.now();
      const nextNotification = now + (intervalMinutes * 60 * 1000);
      
        // Construire l'objet notification
      const notification = {
        deckId: deckId,
        deckName: deckName,
        intervalMinutes: intervalMinutes,
        nextNotification: nextNotification,
        lastNotification: null,
          createdAt: now
        };
        
        // Si un reminderId est fourni (depuis localStorage), l'utiliser
        if (reminderId) {
          notification.id = reminderId;
        }
        // Sinon, laisser autoIncrement générer l'ID automatiquement
      
      const putRequest = store.put(notification);
      putRequest.onsuccess = async () => {
          // Récupérer l'ID généré si nécessaire
          const finalId = notification.id || putRequest.result;
          notification.id = finalId; // S'assurer que l'ID est défini
          
          // Programmer la notification immédiatement (utilise Notification Scheduling si disponible)
          await scheduleNextNotification(notification);
          
          // Programmer aussi une synchronisation en arrière-plan comme backup
          await scheduleBackgroundSyncForNotification(notification).catch(() => {
            // Ignorer les erreurs de permission (normal sur desktop)
          });
          
          // Reprogrammer le prochain réveil pour inclure cette nouvelle notification
          await scheduleNextWakeUp();
          resolve({ id: finalId, isDuplicate: false });
      };
      putRequest.onerror = () => reject(putRequest.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Programmer une synchronisation en arrière-plan pour une notification
async function scheduleBackgroundSyncForNotification(notification) {
  if (!('serviceWorker' in self) || !('sync' in self.registration)) {
    return; // Background Sync non disponible
  }
  
  try {
    const delay = notification.nextNotification - Date.now();
    const now = Date.now();
    
    // Créer un tag unique pour cette notification spécifique
    const syncTag = `notification-${notification.deckId}-${notification.nextNotification}`;
    
    // Toujours enregistrer une sync pour cette notification spécifique
    if (delay > 0) {
      await self.registration.sync.register(syncTag).catch(() => {
        // Ignorer si déjà enregistré
      });
    }
    
    // Enregistrer aussi une sync générale pour vérifier périodiquement
    await self.registration.sync.register('check-notifications').catch(() => {
      // Ignorer si déjà enregistré
    });
    
    // Pour les notifications dans les prochaines heures, enregistrer plusieurs syncs
    // pour augmenter les chances qu'elles soient déclenchées
    if (delay > 0 && delay < 6 * 60 * 60 * 1000) { // Dans les 6 prochaines heures
      // Enregistrer une sync supplémentaire 1 minute avant la notification
      const earlySyncTag = `notification-early-${notification.deckId}-${notification.nextNotification}`;
      const earlyDelay = Math.max(0, delay - 60000); // 1 minute avant
      if (earlyDelay > 0) {
        // Note: Background Sync ne permet pas de programmer avec un délai précis,
        // mais on peut enregistrer plusieurs syncs pour augmenter les chances
        await self.registration.sync.register(earlySyncTag).catch(() => {});
      }
    }
  } catch (error) {
    // Ignorer silencieusement les erreurs de permission (normales sur desktop)
    // Background Sync nécessite une interaction utilisateur et n'est pas toujours disponible
    if (error.name !== 'NotAllowedError' && error.name !== 'NotSupportedError') {
      console.error('Erreur lors de la programmation de la sync:', error);
    }
  }
}

// Supprimer un rappel par son ID
async function removeReminderById(reminderId) {
  if (!db) {
    await initDB();
  }
  
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    
    const deleteRequest = store.delete(reminderId);
    deleteRequest.onsuccess = () => {
      // Nettoyer aussi le cache des notifications récentes pour ce rappel
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

// Supprimer tous les rappels d'un deck (pour compatibilité)
async function removeReminder(deckId) {
  if (!db) {
    await initDB();
  }
  
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    const index = store.index('deckId');
    
    // Utiliser un curseur pour supprimer TOUTES les entrées avec ce deckId
    // (au cas où il y en aurait plusieurs par erreur)
    const request = index.openCursor(IDBKeyRange.only(deckId));
    const idsToDelete = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        idsToDelete.push(cursor.value.id);
        cursor.continue();
      } else {
        // Supprimer toutes les entrées trouvées
        if (idsToDelete.length > 0) {
          let deletedCount = 0;
          idsToDelete.forEach(id => {
            const deleteRequest = store.delete(id);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              if (deletedCount === idsToDelete.length) {
                // Nettoyer aussi le cache des notifications récentes pour ce deckId
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
          // Aucune entrée trouvée, mais c'est OK
          console.log(`Aucun rappel trouve pour deckId ${deckId}`);
        resolve();
        }
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
let isCheckingNotifications = false; // Verrouillage pour éviter les vérifications simultanées
const recentNotifications = new Map(); // Cache des notifications récemment affichées

function startPeriodicCheck() {
  // Vérifier toutes les minutes quand le service worker est actif
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Vérifier immédiatement
  checkScheduledNotifications();
  
  // Vérifier périodiquement quand le service worker est actif (toutes les 2 minutes pour éviter le spam)
  checkInterval = setInterval(() => {
    checkScheduledNotifications();
  }, 120000); // Toutes les 2 minutes pour éviter le spam
  
  // Programmer un réveil pour vérifier les notifications même quand l'app est fermée
  scheduleNextWakeUp();
  
  // Enregistrer plusieurs syncs pour augmenter les chances que les notifications soient vérifiées
  if ('sync' in self.registration) {
    // Sync principale pour vérifier les notifications
    self.registration.sync.register('check-notifications').catch(() => {
      // Ignorer si déjà enregistré
    });
    
    // Syncs supplémentaires pour augmenter la fiabilité
    // Le navigateur peut ignorer certaines syncs, donc on en enregistre plusieurs
    self.registration.sync.register('check-notifications-backup-1').catch(() => {});
    self.registration.sync.register('check-notifications-backup-2').catch(() => {});
  }
  
  // Enregistrer Periodic Background Sync si disponible (Android Chrome)
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('check-notifications-periodic', {
      minInterval: 60 * 60 * 1000 // Minimum 1 heure entre les syncs
    }).catch(() => {
      // Ignorer si déjà enregistré ou non disponible
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
            // Programmer une sync pour chaque notification à venir (max 10 pour augmenter la fiabilité)
            const notificationsToSync = upcomingNotifications.slice(0, 10);
            for (const notif of notificationsToSync) {
              const syncDelay = notif.nextNotification - now;
              if (syncDelay > 0 && syncDelay < 24 * 60 * 60 * 1000) {
                // Programmer une sync spécifique pour cette notification
                const syncTag = `notification-${notif.deckId}-${notif.nextNotification}`;
                await self.registration.sync.register(syncTag).catch(() => {
                  // Ignorer si déjà enregistré
                });
                
                // Pour les notifications dans les prochaines heures, enregistrer aussi une sync de backup
                if (syncDelay < 6 * 60 * 60 * 1000) {
                  const backupTag = `notification-backup-${notif.deckId}-${notif.nextNotification}`;
                  await self.registration.sync.register(backupTag).catch(() => {});
                }
              }
            }
            
            // Programmer aussi des syncs générales pour vérifier périodiquement
            await self.registration.sync.register('check-notifications').catch(() => {
              // Ignorer si déjà enregistré
            });
            await self.registration.sync.register('check-notifications-backup-1').catch(() => {});
            await self.registration.sync.register('check-notifications-backup-2').catch(() => {});
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
  // Gérer toutes les syncs liées aux notifications
  if (event.tag === 'check-notifications' || 
      event.tag.startsWith('notification-') || 
      event.tag.startsWith('check-notifications-backup-')) {
    event.waitUntil(
      checkScheduledNotifications().then(() => {
        scheduleNextWakeUp();
        // Reprogrammer les syncs pour continuer à vérifier
        if ('sync' in self.registration) {
          // Reprogrammer la sync principale
          self.registration.sync.register('check-notifications').catch(() => {
            // Ignorer les erreurs si la sync est déjà enregistrée
          });
          
          // Reprogrammer aussi les syncs de backup
          self.registration.sync.register('check-notifications-backup-1').catch(() => {});
          self.registration.sync.register('check-notifications-backup-2').catch(() => {});
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
    // Afficher la notification avec un tag unique pour éviter les doublons
    // Le navigateur dédupliquera automatiquement les notifications avec le même tag
    options.tag = `review-${deckId}-${Date.now()}`;
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

// ============================================
// NIVEAU 3: FIREBASE CLOUD MESSAGING (FCM)
// ============================================
// Note: Les notifications FCM sont gérées par firebase-messaging-sw.js
// Ce service worker (service-worker.js) gère les niveaux 1 et 2
// FCM réveille automatiquement le service worker même si l'app est fermée

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

