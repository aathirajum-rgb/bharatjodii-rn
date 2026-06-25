const CACHE_NAME = 'jodii-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/pwa.html',
  '/manifest.json',
  '/css/bootstrap.min.css',
  '/css/swiper-bundle.min.css',
  '/css/jodii-styles.css',
  '/js/landing-page.js',
  '/assets/images/jodii-logo.svg',
  '/assets/images/google-play.svg',
  '/assets/images/arrow-animation.gif'
];

/**
 * Install Event - Cache all core assets
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching all assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
});

/**
 * Fetch Event - Network First / Cache Fallback (for API calls) or Cache First (for static assets)
 */
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // If we have a cached version, return it (Cache First)
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache new static files dynamically
            if (event.request.url.includes('/assets/')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for HTML
            if (event.request.mode === 'navigate') {
              return caches.match('/pwa.html');
            }
          });
      })
  );
});
