const CACHE_PREFIX = "zevyra-";
const CACHE_NAME = `${CACHE_PREFIX}shell-2.3.23`;
const IMAGE_CACHE_NAME = `${CACHE_PREFIX}images-2.3.23`;
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/dashboard-categories.css",
  "./css/dice.css",
  "./css/brand.css",
  "./css/platform.css",
  "./js/app.js",
  "./js/games-catalog.js",
  "./data/midnight-catalog.js",
  "./data/round-events.js",
  "./data/power-catalog.js",
  "./data/chain-challenges.js",
  "./js/multiplayer.js",
  "./js/local-accounts.js",
  "./js/config.js",
  "./js/utils.js",
  "./js/storage.js",
  "./js/participants.js",
  "./js/decks.js",
  "./js/dice.js",
  "./js/game.js",
  "./js/minigame-results.js",
  "./js/manuals.js",
  "./js/drinks.js",
  "./js/icons.js",
  "./data/initial-cards.js",
  "./data/initial-manuals.js",
  "./data/carnival-catalog.js",
  "./data/catalog-migrations.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/favicon-16x16.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon.ico",
  "./assets/icons/favicon-32x32.png",
  "./assets/icons/favicon.svg",
  "./assets/branding/zevyra-mode-dark.png",
  "./assets/branding/zevyra-mode-light.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          SHELL.map((path) =>
            new Request(new URL(path, self.registration.scope), { cache: "reload" }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                ((key.startsWith(`${CACHE_PREFIX}shell-`) ||
                  key.startsWith(`${CACHE_PREFIX}images-`) ||
                  key.startsWith("gdpw-shell-")) &&
                  key !== CACHE_NAME &&
                  key !== IMAGE_CACHE_NAME),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

async function updateCache(request, cacheName) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    /\/api(?:\/|$)/.test(url.pathname) ||
    request.headers.has("range")
  )
    return;

  const isImage = request.destination === "image" || /\/assets\/games\//.test(url.pathname);
  const cacheName = isImage ? IMAGE_CACHE_NAME : CACHE_NAME;
  const refresh = updateCache(request, cacheName);
  event.waitUntil(refresh);
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const fresh = await refresh;
    if (fresh) return fresh;
    if (request.mode === "navigate") {
      return (await caches.open(CACHE_NAME)).match("./index.html") || Response.error();
    }
    return Response.error();
  })());
});
