// NeoBranium Service Worker
// Minimal stub — provides fetch fallback but does not cache ad-serving requests.
// AdSense and all third-party ad network requests are always passed through to the network.

const CACHE_NAME = 'neobranium-v1';

// Files to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index_css.css',
  '/online-graduation_16847316.png',
];

// Ad-network hostnames that must NEVER be intercepted by the service worker
const AD_NETWORK_HOSTS = [
  'pagead2.googlesyndication.com',
  'partner.googleadservices.com',
  'tpc.googlesyndication.com',
  'googleads.g.doubleclick.net',
  'adservice.google.com',
  'www.googletagmanager.com',
  'www.googletagservices.com',
  'cm.g.doubleclick.net',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always pass ad-network requests straight to the network — never cache.
  if (AD_NETWORK_HOSTS.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
    return; // let the browser handle it normally
  }

  // For everything else, use a network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

