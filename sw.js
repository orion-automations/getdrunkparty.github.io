const CACHE_PREFIX = 'gdpw-shell-';
const CACHE_NAME = `${CACHE_PREFIX}1.4.1`;
const SHELL = ['./', './index.html', './manifest.json', './css/styles.css', './css/dashboard-categories.css', './css/dice.css', './css/brand.css', './js/app.js', './js/config.js', './js/utils.js', './js/storage.js', './js/participants.js', './js/decks.js', './js/dice.js', './js/game.js', './js/minigame-results.js', './js/manuals.js', './js/drinks.js', './js/icons.js', './data/initial-cards.js', './data/initial-manuals.js', './data/pdf-catalog.js', './data/additional-challenges.js', './data/catalog-migrations.js', './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/favicon-32.png', './assets/icons/apple-touch-icon.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (await caches.match('./index.html'))));
});
