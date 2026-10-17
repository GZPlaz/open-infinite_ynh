/* OpenInfinite service worker — keeps the app usable offline. Generated at build time. */
const CACHE = 'openinfinite-__VERSION__';
const PRECACHE = __PRECACHE__;
const SCOPE = self.registration.scope;
const SHELL = new URL('./', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE).href));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('openinfinite-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only our own scope; never the YunoHost portal or other apps on the domain.
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE) || url.pathname.startsWith('/yunohost/')) return;

  if (req.mode === 'navigate') {
    // Network first so upgrades show up immediately; cached shell when offline.
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(SHELL, res.clone());
          return res;
        } catch {
          return (await caches.match(SHELL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build assets never change: cache first.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && url.pathname.includes('/assets/')) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })(),
  );
});
