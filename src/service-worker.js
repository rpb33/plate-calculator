// Build template: Vite supplies a content-derived version and complete app shell.
const BUILD_ID = "__BUILD_ID__";
const FILES = __PRECACHE_FILES__;
const BASE = new URL(self.registration.scope);
const PREFIX = `plate-calculator:${BASE.href}:`;
const CACHE_NAME = `${PREFIX}${BUILD_ID}`;
const INDEX = new URL('index.html', BASE).href;
const PATHS = new Set(FILES.map((file) => new URL(file, BASE).pathname));

self.addEventListener('install', (event) => {
  // A failed download leaves the previous worker active. Do not force an update
  // while someone is using the calculator; the app offers an explicit button.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(
    FILES.map((file) => new Request(new URL(file, BASE), { cache: 'reload' })),
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;

  const isEntry = request.mode === 'navigate'
    && (url.pathname === BASE.pathname || url.pathname === new URL('index.html', BASE).pathname);
  if (!isEntry && !PATHS.has(url.pathname)) return;

  // Serve one consistent build of HTML and assets. New builds are installed as
  // a separate cache, then activated together, including any inventory changes.
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) =>
    (await cache.match(isEntry ? INDEX : request, { ignoreSearch: true })) || fetch(request),
  ));
});
