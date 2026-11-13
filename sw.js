// Offline support + fast updates.
// - The page itself (index.html): try the network first (max 1.5s), so new versions
//   show up on the very next open; fall back to the saved copy when offline.
// - Everything else: serve the saved copy instantly and refresh it in the background.
const CACHE = 'ditl-v9';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png', './apple.png'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's own HTTP cache so we never store an old copy.
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(ASSETS.map(u => fetch(new Request(u, { cache: 'reload' }))
      .then(r => r.ok ? c.put(u, r) : null).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) cache.put('./index.html', res.clone());
        return res;
      });
      const timeout = new Promise(r => setTimeout(r, 1500));
      try {
        const res = await Promise.race([net, timeout]);
        if (res) return res;
      } catch {}
      return (await cache.match('./index.html')) || net;
    })());
    return;
  }

  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
