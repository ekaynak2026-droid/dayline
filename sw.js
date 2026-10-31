// Service worker: keeps a copy of the app on the phone so it opens without internet.
// The list of app files and the version below are filled in automatically after each build
// (scripts/sw-shell.mjs), so every new version replaces the old saved copy.
const CACHE = 'dayline-next-mvwug46n';
const SHELL = ['./', '_next/static/chunks/0cz1d0mv5g_q7.js', '_next/static/chunks/0umf92h1sb77c.js', '_next/static/chunks/26aagj8_7_ee_.js', '_next/static/chunks/2wygtw8ak_ih9.js', '_next/static/chunks/3cfn99dbrcvvp.js', '_next/static/chunks/3s1wd7kkqc1rf.css', '_next/static/chunks/3wbm-994r45kr.js', '_next/static/chunks/turbopack-0eowb_3f-uy_3.js', '_next/static/media/favicon.117ezoe8m31dk.ico', '_next/static/tFnmw2vn0MGDcz-9OOmKb/_buildManifest.js', '_next/static/tFnmw2vn0MGDcz-9OOmKb/_clientMiddlewareManifest.js', '_next/static/tFnmw2vn0MGDcz-9OOmKb/_ssgManifest.js', 'favicon.ico', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon.svg', 'index.html', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Old saved copies (including the original app's) are removed when a new version takes over,
// and so is the AI model an earlier version could download (it is no longer part of Dayline).
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.startsWith('dayline-') && k !== CACHE) || k === 'transformers-cache').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App files: use the network when online (so updates arrive), fall back to the saved copy offline.
// Fonts and the sync library: use the saved copy first (they never change).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com' || (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./'))));
});

// Tapping a reminder opens (or brings forward) the app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./#tasks');
  }));
});
