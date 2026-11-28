/* DIBS Photo Mode: offline cache. Registered only when the page is served over http or https.
   Pages are fetched from the network first and the cache is the offline fallback. Bump CACHE whenever the FILES list changes. */
var CACHE = 'dibs-photo-mode-v11';
var FILES = [
  './',
  'index.html',
  'movie.html',
  'manifest.webmanifest',
  'css/photo.css',
  'css/movie.css',
  'js/assets.js',
  'js/store.js',
  'js/extras.js',
  'js/craft.js',
  'js/puppets.js',
  'js/sets.js',
  'js/dof.js',
  'js/controls.js',
  'js/stickers.js',
  'js/app.js',
  'js/edit.js',
  'js/ui.js',
  'js/movie-showcase.js',
  'js/movie.js',
  'js/movie-actions.js',
  'js/movie-ui.js',
  'js/movie-templates.js',
  'js/movie-quick.js',
  'js/movie-edit.js',
  'vendor/three.min.js',
  '../fonts/lexend-latin-400-normal.woff2',
  '../fonts/lexend-latin-700-normal.woff2',
  '../fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  '../fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  '../img/icons/icon-192.png',
  '../img/icons/icon-512.png',
  '../img/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('dibs-photo-mode-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // network first, so a new version shows on the next load; the saved copy is used when offline
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});
