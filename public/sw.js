/* RuangKerja: cache only generic, identity-independent offline assets. */
const CACHE_PREFIX = 'ruangkerja-static-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = new Set([
  OFFLINE_URL,
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
]);

const isProtectedEndpoint = (pathname) =>
  pathname === '/api' ||
  pathname.startsWith('/api/') ||
  pathname === '/auth' ||
  pathname.startsWith('/auth/') ||
  pathname === '/signin-with-chatgpt' ||
  pathname === '/signout-with-chatgpt' ||
  pathname === '/callback' ||
  pathname.startsWith('/callback/');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of STATIC_ASSETS) {
      const response = await fetch(new Request(path, {
        cache: 'reload',
        credentials: 'same-origin',
        redirect: 'error',
      }));
      if (!response.ok || response.redirected || new URL(response.url).pathname !== path) {
        throw new Error('Offline asset was not served directly.');
      }
      const contentType = response.headers.get('content-type') || '';
      if (path === OFFLINE_URL) {
        if (!contentType.includes('text/html') || !(await response.clone().text()).includes('data-ruangkerja-offline="v1"')) {
          throw new Error('Offline page must be the generic RuangKerja fallback.');
        }
      } else if (!contentType.startsWith('image/')) {
        throw new Error('Only local image assets may be cached.');
      }
      await cache.put(path, response);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No API, auth, external request or write is intercepted or queued.
  if (request.method !== 'GET' || url.origin !== self.location.origin || isProtectedEndpoint(url.pathname)) return;

  if (request.mode === 'navigate') {
    // Always contact the server. Never retain a page that can depend on identity.
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })).catch(async () => {
      const fallback = await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME });
      return fallback || new Response(
        '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RuangKerja offline</title><h1>Koneksi terputus</h1><p>Hubungkan perangkat ke internet untuk melanjutkan.</p><a href="/">Coba lagi</a></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
      );
    }));
    return;
  }

  // The allowlist has no forms, personal data, auth responses or app HTML.
  if (STATIC_ASSETS.has(url.pathname) && !url.search) {
    event.respondWith(caches.match(url.pathname, { cacheName: CACHE_NAME })
      .then((cached) => cached || fetch(request)));
  }
});
