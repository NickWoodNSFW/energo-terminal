const CACHE = "et-v45";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./fonts/onest-400-cyrillic-ext.woff2",
  "./fonts/onest-400-cyrillic.woff2",
  "./fonts/onest-400-latin-ext.woff2",
  "./fonts/onest-400-latin.woff2",
  "./fonts/onest-600-cyrillic-ext.woff2",
  "./fonts/onest-600-cyrillic.woff2",
  "./fonts/onest-600-latin-ext.woff2",
  "./fonts/onest-600-latin.woff2",
  "./fonts/playfair-700-cyrillic.woff2",
  "./fonts/playfair-700-latin-ext.woff2",
  "./fonts/playfair-700-latin.woff2",
  "./fonts/playfair-900-cyrillic.woff2",
  "./fonts/playfair-900-latin-ext.woff2",
  "./fonts/playfair-900-latin.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) =>
        fetch(u, { cache: "reload" }).then((r) => c.put(u, r)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req).then((hit) => hit || caches.match("./index.html")).then((r) => r || new Response("Нет сети, а оболочка не сохранена", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      }))
    )
  );
});
