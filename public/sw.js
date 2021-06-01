const CACHE_NAME = 'offline';

self.addEventListener('install', function(event) {
    console.log('[ServiceWorker] Install');
    
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
    })());
    
    self.skipWaiting();
  });

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil((async () => {
      // Enable navigation preload if it's supported.
      // See https://developers.google.com/web/updates/2017/02/navigation-preload
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }
    })());
  
    // Tell the active service worker to take control of the page immediately.
    self.clients.claim();
  });

self.addEventListener('fetch', function(event) {
    // console.log('[Service Worker] Fetch', event.request.url);
    if (event.request.mode === 'navigate') {
      event.respondWith((async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }
  
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log('[Service Worker] Fetch failed.', error);
        }
      })());
    }
  });