const CACHE_NAME = 'dks-shell-v3';
const PRECACHE = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/router.js',
  'js/renderer.js',
  'js/storage.js',
  'js/search.js',
  'js/quiz.js',
  'js/review.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Network-first: always try to get the latest deployed version first, so
  // a normal reload picks up new pushes immediately. Only fall back to the
  // cache when the network request fails (i.e. actually offline). This
  // trades a bit of pure offline-first purity for not needing a hard
  // refresh after every deploy during active development.
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('index.html');
        })
      )
    );
  } else {
    // network-first for cross-origin
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});