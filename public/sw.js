// Kontrol PWA Service Worker
const CACHE_NAME = 'kontrol-pwa-v1.13.174';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install: Pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart caching strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never cache non-GET requests or browser extension requests
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 2. Bypass Service Worker for Vite HMR, websockets, dev tokens, and internal Vite modules
  if (
    req.headers.get('upgrade') === 'websocket' ||
    url.searchParams.has('token') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('@fs') ||
    url.pathname.includes('/node_modules/')
  ) {
    return;
  }

  // 3. Bypass Service Worker for API calls, live data, Supabase, websockets, and uploads
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/uploads') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('openstreetmap') ||
    url.hostname.includes('googleapis') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // 3. Navigation requests (HTML pages): Network First, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // 4. Static assets (JS, CSS, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

