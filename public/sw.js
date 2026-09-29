/* Epoch offline cache. Network first — you always get the latest when online — and the last
   good copy when the venue's signal drops, so the wallet and its QR pass still open. */
const CACHE = "epoch-v1";
const SHELL = ["/epoch", "/epoch/wallet", "/epoch/booths", "/icons/epoch-192.png", "/epoch-coin.svg"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // never touch Supabase/GitHub calls
  const cacheable = url.pathname.startsWith("/epoch") || url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/stickers") || url.pathname.startsWith("/icons");
  if (!cacheable) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("/epoch/wallet")))
  );
});
