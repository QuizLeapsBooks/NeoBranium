// sw.js
const CACHE_NAME = 'neobranium-cache-v1';
const urlsToCache = [
  '/index.html', // Apne pages ke URLs daal
  '/htmls/notes.html',
  '/htmls/spotlight.html',
  '/htmls/dashboard.html',
  '/htmls/contactus.html',
  '/htmls/feedback.html',
  '/htmls/chat/chat_app.html',
  '/htmls/bot/bot.html',
  '/htmls/profile.html',
  '/htmls/setting.html',
 
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching pages...');
        return cache.addAll(urlsToCache);
      })
  );
});


self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; 
        }
        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            let responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        );
      })
  );
});