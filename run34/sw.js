// Offline-Cache (stale-while-revalidate). VERSION erhöhen, um Updates zu erzwingen.
const VERSION = 'br-v77';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/assets.js', 'js/audio.js', 'js/character.js', 'js/config.js', 'js/fx.js', 'js/scenes.js', 'js/world.js', 'js/motifs.js', 'js/biomes.js', 'js/levels.js', 'js/songs.js', 'js/emoji.js', 'js/story.js', 'js/intro.js', 'js/roadtrip.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'assets/bundle.enc',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
