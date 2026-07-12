const CACHE = 'goalrpg-shell-v14';
const SHELL = ['./', './index.html', './styles.css?v=14', './app.js?v=14', './manifest.webmanifest?v=14', './icons/goalrpg.png', './icons/avatar-level-01.png', './icons/avatar-level-02.png', './icons/avatar-level-03.png', './icons/avatar-level-04.png', './icons/avatar-level-05.png', './icons/avatar-level-06.png', './icons/avatar-level-07.png', './icons/avatar-level-08.png', './icons/avatar-level-09.png', './icons/avatar-level-10.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('./index.html'))));
});
