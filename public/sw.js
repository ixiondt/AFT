/**
 * AFT Planner service worker.
 *
 * Strategy:
 *  - Never cache /api/* (always go to network — auth, mutations, DB reads)
 *  - Static assets under /_next/static and /icon.svg: cache-first
 *  - Pages and other GETs: network-first with offline fallback to the
 *    cached version. The last successful /plan render is the one users
 *    see if they go offline.
 */
const CACHE = "aft-v2";
const SHELL = ["/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg", "/robots.txt"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never intercept the API

  // Static immutable assets: cache-first.
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/icon-maskable.svg" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/robots.txt";

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((fresh) => {
            const clone = fresh.clone();
            if (fresh.ok) caches.open(CACHE).then((c) => c.put(req, clone));
            return fresh;
          }),
      ),
    );
    return;
  }

  // Pages: network-first, fall back to cached version on failure.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || req.destination === "document")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(
        () =>
          caches.match(req).then(
            (cached) =>
              cached ||
              new Response(
                "<!doctype html><meta charset=utf-8><title>Offline</title><style>body{font-family:system-ui;padding:2rem;background:#fdfdfd;color:#222}</style><h1>Offline</h1><p>You're offline and this page hasn't been loaded yet. Open it once while online and it'll be available offline next time.</p>",
                {
                  status: 503,
                  headers: { "content-type": "text/html; charset=utf-8" },
                },
              ),
          ),
      ),
  );
});
