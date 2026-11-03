/* Iron Level service worker: the app opens without a network.
   Strategy: answer from the cache at once, refresh the cache from the network in the background, so a new version
   shows up on the next launch. Nothing to bump per release. Only same-origin GET requests are handled.
   Data lives in localStorage and never passes through here. */
const CACHE = "ironlevel-shell-1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "fonts/inter-cyrillic.woff2", "fonts/inter-latin.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("ironlevel-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, {ignoreSearch: req.mode === "navigate"});
    const fresh = fetch(req).then(res => { if (res.ok && res.type === "basic") cache.put(req, res.clone()); return res }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit }
    const res = await fresh;
    if (res) return res;
    if (req.mode === "navigate") { const shell = await cache.match("index.html"); if (shell) return shell }
    return Response.error();
  })());
});
