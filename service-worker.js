const SW_VERSION = 'v3'; // súbelo cada vez que cambies cosas importantes
const CACHE_NAME = `fresamelon-${SW_VERSION}`;
 
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/icons/icon-192.png',
        // añade lo que necesites
      ]);
    })
  );
  self.skipWaiting(); // para que este SW se active lo antes posible
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});
