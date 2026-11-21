const APP_CACHE = 'kiralyte-app-v1';
const API_CACHE = 'kiralyte-api-v1';

const PRECACHE_ROUTES = [
  '/',
  '/login',
  '/dashboard',
  '/pos',
  '/products',
  '/categories',
  '/inventory',
  '/sales',
  '/purchases',
  '/suppliers',
  '/customers',
  '/reports',
  '/notifications',
  '/settings',
  '/crm',
  '/kiralyte-icon.png',
  '/kiralyte-logo.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE_ROUTES.map((url) =>
          cache.add(url).catch(() => {
            // Ignore individual route precache failures
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1. API GET requests: Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/logout') return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: 'Offline and no cached data available' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 2. Static assets: Cache-first with network fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(APP_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // 3. Page navigations & RSC requests: Network-first with cache fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const fallback = await caches.match('/dashboard');
          if (fallback) return fallback;
        }
        return new Response('Offline', { status: 503 });
      })
  );
});
