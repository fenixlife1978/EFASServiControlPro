// Actualizamos el nombre del caché a la nueva marca [cite: 2026-02-11]
const CACHE_NAME = 'efas-servicontrolpro-cache-v1';

// Rutas actualizadas para EFAS ServiControlPro [cite: 2026-02-13]
const urlsToCache = [
  '/',
  '/login',
  '/dashboard/admin/classrooms', // Nueva ruta de aulas
  '/dashboard/admin/seguridad',  // Nueva ruta de seguridad corregida
  '/manifest.json',
  '/logo-efas-192.png',          // Icono con fondo original 192x192
  '/logo-efas-512.png',          // Icono con fondo original 512x512
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Borramos cachés antiguos de EduGuard o versiones previas
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch mejorada (Stale-while-revalidate)
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Solo cacheamos respuestas válidas y de nuestro dominio
          if (networkResponse.ok && event.request.method === 'GET') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
        return response || fetchPromise;
      });
    })
  );
});

// Mantenemos tu lógica de notificaciones Push [cite: 2026-01-23]
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Notificación', body: 'Nuevo evento en EFAS' };
  const options = {
    body: data.body,
    icon: '/logo-efas-192.png', // Usamos el nuevo logo en la notificación
    badge: '/favicon.ico'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
