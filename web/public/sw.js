// Service worker: keeps a copy of the app on the phone so it opens without internet.
// The list of app files and the version below are filled in automatically after each build
// (scripts/sw-shell.mjs), so every new version replaces the old saved copy.
const CACHE = 'dayline-next-__BUILD__';
const SHELL = ['./', /*SHELL*/];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('dayline-next-') && k !== CACHE).map(k => caches.delete(k))))
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
