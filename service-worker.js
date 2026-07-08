const CACHE_NAME = 'dks-shell-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/router.js',
  '/js/renderer.js',
  '/js/storage.js',
  '/js/search.js',
  '/js/quiz.js',
  '/js/review.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Serve local JSON and assets from cache-first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return resp;
        }).catch(() => {
          // fallback for navigation
          if (event.request.mode === 'navigate') return caches.match('/index.html');
        });
      })
    );
  } else {
    // network-first for cross-origin
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
