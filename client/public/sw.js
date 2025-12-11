/* eslint-env serviceworker */
// Importar Firebase Cloud Messaging (compat para Service Workers)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase (inyectada desde main.jsx)
let firebaseConfig = null;
let messaging = null;

// Escuchar mensajes con la configuración de Firebase
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
    console.log('[SW] Firebase inicializado con configuración desde entorno');
    
    // Manejar notificaciones en segundo plano
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Mensaje FCM recibido en segundo plano:', payload);
      
      const notificationTitle = payload.notification?.title || 'Nueva notificación';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: payload.data
      };

      if (payload.notification?.image) {
        notificationOptions.image = payload.notification.image;
      }

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// PWA Cache
const CACHE_NAME = 'abarrotes-v1';
const STATIC_CACHE = 'abarrotes-static-v1';
const DYNAMIC_CACHE = 'abarrotes-dynamic-v1';

// Recursos estáticos para cachear durante la instalación
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Instalación del service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación del service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estrategia de cache: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  // Ignora solicitudes que no sean GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignora solicitudes a extensiones de Chrome
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clónala y guárdala en cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intenta servir desde cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay cache y la solicitud es de navegación, devuelve index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});


