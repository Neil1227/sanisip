// ══════════════════════════════════════
//  SaniSip — sw.js  (Service Worker)
// ══════════════════════════════════════

const CACHE_NAME = 'sanisip-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './sanisip.css',
  './sanisip.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

// Firebase domain — always fetch fresh (network-first)
const FIREBASE_DOMAIN = 'firebasedatabase.app';

// ── Install: cache all static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route strategy ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Firebase → Network-first (live sensor data, never serve stale)
  if (url.hostname.includes(FIREBASE_DOMAIN)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. Google Fonts → Cache-first (rarely changes)
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. Everything else (HTML, CSS, JS, icons) → Cache-first
  event.respondWith(cacheFirst(request));
});

// ── Strategy: Cache-first ──
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Cache a clone for future use
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Nothing in cache and network failed — return offline fallback if available
    return caches.match('./index.html');
  }
}

// ── Strategy: Network-first ──
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Network failed — try cache as last resort
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'offline' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}
