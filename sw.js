/* MBBS Study Hub offline worker. BUILD is stamped when the site is packaged. */
const BUILD = "20261114184103";
const CACHE = "studyhub-" + BUILD;
const CORE = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("studyhub-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const sameVersion = (a, b) => {
  const ea = a.headers.get("etag"), eb = b.headers.get("etag");
  if(ea && eb) return ea === eb;
  const la = a.headers.get("last-modified"), lb = b.headers.get("last-modified");
  if(la && lb) return la === lb;
  return a.headers.get("content-length") === b.headers.get("content-length");
};
async function pageRequest(e){
  const cache = await caches.open(CACHE);
  const cached = await cache.match("./");
  const refresh = fetch("./", {cache: "no-cache"}).then(async res => {
    if(res && res.ok){
      const changed = cached && !sameVersion(cached, res);
      await cache.put("./", res.clone());
      if(changed){ const cs = await self.clients.matchAll(); cs.forEach(c => c.postMessage("hub-updated")); }
    }
    return res;
  }).catch(() => null);
  if(cached){ e.waitUntil(refresh); return cached; }
  const res = await refresh;
  return res || new Response("You are offline and the hub has not been saved on this phone yet. Open it once with data, then it will work offline.", {status: 503, headers: {"content-type": "text/plain"}});
}
self.addEventListener("fetch", e => {
  const req = e.request; if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(req.mode === "navigate" && url.origin === location.origin){ e.respondWith(pageRequest(e)); return; }
  if(url.origin === location.origin){
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(res => { if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; })));
    return;
  }
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.open(CACHE).then(async c => { const h = await c.match(req); const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => h); return h || net; }));
  }
});
