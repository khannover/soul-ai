/**
 * Soul-AI — Service Worker
 * Network-first for app shell; cache-first for static assets.
 */

const APP_VERSION = '2.5.0';
const CACHE_NAME = `soul-ai-${APP_VERSION}`;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './tailwind.css',
  './core.mjs',
  './i18n.mjs',
  './tts.mjs',
  './storage.mjs',
  './app.js',
  './assets/fonts/share-tech-mono.ttf',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

const NETWORK_FIRST = new Set([
  '/',
  '/index.html',
  '/app.js',
  '/core.mjs',
  '/i18n.mjs',
  '/tts.mjs',
  '/storage.mjs',
  '/style.css',
  '/tailwind.css',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('SW precache partial failure:', err);
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    url.origin !== location.origin ||
    url.pathname.startsWith('/chat') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  const path = url.pathname.replace(/\/$/, '') || '/';
  const networkFirst = NETWORK_FIRST.has(path) || path.endsWith('/index.html');

  if (networkFirst) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  event.respondWith(cacheFirstStrategy(event.request));
});

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}