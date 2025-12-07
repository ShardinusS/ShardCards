// Service Worker dédié à Firebase Cloud Messaging
// Ce fichier doit être à la racine (même dossier que index.html)

importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging.js");

// Configuration Firebase
// Project ID: flashcards-app-10e84
const firebaseConfig = {
  apiKey: "AIzaSyASyMmz55F0eZoIRoc0HLTOEXAkcZjhmcQ",
  authDomain: "flashcards-app-10e84.firebaseapp.com",
  projectId: "flashcards-app-10e84",
  storageBucket: "flashcards-app-10e84.firebasestorage.app",
  messagingSenderId: "63932319446",
  appId: "1:63932319446:web:b1d531524b7a90fda8eb77",
  measurementId: "G-N6FD9M0TMW"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Initialiser Firebase Messaging
const messaging = firebase.messaging();

// Gérer les notifications en arrière-plan (quand l'app est fermée)
messaging.onBackgroundMessage((payload) => {
  console.log('Notification FCM reçue en arrière-plan:', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Rappel de révision';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Il est temps de réviser vos flashcards',
    icon: payload.notification?.icon || payload.data?.icon || './icon-1024.png',
    badge: './icon-1024.png',
    tag: payload.data?.tag || `fcm-notification-${Date.now()}`,
    data: {
      url: payload.data?.url || './index.html',
      deckId: payload.data?.deckId || null,
      reminderId: payload.data?.reminderId || null,
      timestamp: Date.now()
    },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };
  
  // Afficher la notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer les clics sur les notifications FCM
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const deckId = event.notification.data?.deckId;
  const url = event.notification.data?.url || './index.html';
  
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
          return clients.openWindow(url);
        }
      })
  );
});
