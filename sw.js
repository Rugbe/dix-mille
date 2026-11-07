// Offline support for the 10 000 app.
// Online: the page is loaded fresh from the server, so updates show up right away.
// Offline (or very slow network): the copy saved on the phone is used.
// Nothing to change here when you update the app.
const CACHE = 'dixmille';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png', './favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  const isPage = req.mode === 'navigate' || (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));
  e.respondWith(isPage ? networkFirst(req) : cacheFirst(req, sameOrigin));
});

async function networkFirst(req){
  const cache = await caches.open(CACHE);
  const fresh = fetch(req, {cache:'no-cache'}).then(res => {
    if (res && res.ok){ cache.put(req, res.clone()); cache.put('./index.html', res.clone()); }
    return res;
  }).catch(() => null);
  const timeout = new Promise(r => setTimeout(() => r(null), 4000));
  const res = await Promise.race([fresh, timeout]);
  if (res && res.ok) return res;
  return (await cache.match(req, {ignoreSearch:true})) || (await cache.match('./index.html')) || (await fresh) || new Response('Offline', {status:503});
}
async function cacheFirst(req, sameOrigin){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, {ignoreSearch:true});
  const fresh = fetch(req, sameOrigin ? {cache:'no-cache'} : undefined).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await fresh) || new Response('', {status:504});
}
