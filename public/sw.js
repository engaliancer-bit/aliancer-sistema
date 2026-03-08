const CACHE_NAME = 'aliancer-v7-optimized';
const OFFLINE_URL = '/';

// CRITICAL: Do NOT cache manifest.json or index.html
const STATIC_ASSETS = [
  '/aliancer_logo_6cm-01-01.jpg',
  '/produtos.jpg',
  '/relatorios.jpg',
  '/financeiro.png',
  '/fluxo_de_caixa.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );

      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (error) {}
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );

      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.navigate(client.url);
      });
    })()
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always fetch manifest.json and index.html from network (no cache)
  if (url.pathname === '/manifest.json' || url.pathname === '/index.html' || url.pathname === '/') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  } else {
    event.respondWith(
      (async () => {
        if (url.pathname.includes('/assets/') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css')) {
          try {
            const networkResponse = await fetch(event.request);
            return networkResponse;
          } catch (error) {}
        }

        const cache = await caches.open(CACHE_NAME);

        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);

          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
          }

          return networkResponse;
        } catch (error) {
          if (event.request.destination === 'image') {
            return cache.match('/aliancer_logo_6cm-01-01.jpg');
          }
        }
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
