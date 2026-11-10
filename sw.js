/* Офлайн-режим: сначала сеть, при отсутствии — кэш. Обновления подтягиваются сразу. */
const CACHE = 'oil-management-2.8.0';
const FILES = ['./', 'index.html', 'css/style.css?v=2.8.0', 'js/data.js?v=2.8.0', 'js/engine.js?v=2.8.0', 'js/charts.js?v=2.8.0', 'js/sound.js?v=2.8.0', 'js/app.js?v=2.8.0',
  'manifest.webmanifest', 'assets/logo.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
