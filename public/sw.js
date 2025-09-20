
// Service Worker semplificato
const CACHE_NAME = 'apnea-app-v1';

self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bypass cache for authentication and API requests
  if (event.request.url.includes('/auth/') || 
      event.request.url.includes('/rest/')) {
    console.log('SW: Bypassing cache for auth/API request');
    return;
  }
  
  // For other requests, try network first
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response before caching
        const responseClone = response.clone();
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});
