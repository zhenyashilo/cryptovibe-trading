const CACHE_NAME = 'cryptovibe-v5';
const ASSETS = [
  '/', 
  '/index.html', 
  '/bots.html', 
  '/js/db.js', 
  '/js/router.js', 
  '/js/app.js',
  '/js/tokens-registry.js',
  '/js/ston-api.js',
  '/js/notifications.js',
  '/js/alerts-ui.js',
  '/js/ston-page.js',
  '/js/bots-router.js', 
  '/js/bots-app.js', 
  '/site.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names => 
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});

// Periodic sync для проверки алертов (работает когда браузер открыт)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'check-alerts') {
    e.waitUntil(checkAlertsInBackground());
  }
});

async function checkAlertsInBackground() {
  // Отправляем сообщение всем клиентам для проверки
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'CHECK_ALERTS' });
  });
}