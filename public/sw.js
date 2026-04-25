// Service Worker con caching limitato agli asset statici
// Incrementa la versione per forzare l'aggiornamento dei client quando si deploya
const CACHE_NAME = 'apnea-app-v5-20260425';

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
          // Cancella TUTTE le cache vecchie
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
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET può essere gestito dal SW
  if (req.method !== 'GET') return;

  // Non intercettare navigazioni/HTML: lascia passare al network (sempre latest)
  if (req.mode === 'navigate' || req.destination === 'document') return;

  // Non intercettare API e autenticazione
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/auth/') || url.pathname.includes('/rest/')) return;

  // Non intercettare richieste cross-origin (es. https://api.weapnea.com)
  if (url.origin !== self.location.origin) return;

  // NON cachare script JS: sempre network-first senza fallback in cache
  // così i nuovi bundle vengono sempre scaricati
  if (req.destination === 'script') return;

  // Caching solo per immagini e font (cambiano raramente)
  const cacheableDest = ['image', 'font'];
  if (!cacheableDest.includes(req.destination)) return;

  // Network-first per asset; in fallback usa cache
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});
