const CACHE_PREFIX = "zevyra-shell-";
const CACHE_NAME = `${CACHE_PREFIX}2.3.18`;
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
  "./js/supabase.js",
  "./js/multiplayer.js",
  "./js/multiplayer-auth.js",
  "./js/multiplayer-rooms.js",
  "./js/multiplayer-sync.js",
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
  "./data/pdf-catalog.js",
  "./data/additional-challenges.js",
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
  "./assets/brand/zevyra-emblem.png",
  "./assets/branding/logo-dark.png",
  "./assets/branding/logo-light.png",
  "./assets/games/carnival-of-chaos.png",
  "./assets/games/yo-nunca-nunca.png",
  "./assets/games/weekend-hearts.png",
  "./assets/games/quien-es-mas-probable.png",
  "./assets/games/el-impostor.png",
  "./assets/icons/apple-touch-icon.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
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
            .filter((key) => (key.startsWith(CACHE_PREFIX) || key.startsWith("gdpw-shell-")) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (await caches.match("./index.html")),
      ),
  );
});
