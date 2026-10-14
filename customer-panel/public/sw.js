/**
 * Experto Visuals Store - Production Progressive Web App Service Worker
 * Version: 1.0.0
 */

const CACHE_NAME = 'experto-store-pwa-v2';

// Core App Shell resources to pre-cache on install (Offline fallback & static assets, excluding dynamic root page)
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/placeholder-product.svg',
  '/favicon.ico',
];

// URLs that must NEVER be intercepted or cached by the Service Worker
const BYPASS_PATTERNS = [
  '/socket.io',
  '/api/stripe',
  '/api/orders/checkout',
  '/api/auth',
  '/api/rider',
  '/api/admin',
  '/api/orders/my-orders',
  '/api/orders/my-refund-requests',
  'api.stripe.com',
  'checkout.stripe.com',
  'js.stripe.com',
  'maps.googleapis.com',
  'maps.gstatic.com',
];

/**
 * 1. Install Event: Pre-cache App Shell & Offline fallback
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching app shell assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        // Force immediate activation of updated service worker
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[Service Worker] Pre-cache error:', err);
      })
  );
});

/**
 * 2. Activate Event: Clean up legacy caches & take control
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting outdated cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

/**
 * Helper: Determine whether a request should bypass the Service Worker entirely
 */
function shouldBypass(url, request) {
  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') return true;

  // Bypass local development server completely for Next.js internals, chunks, and page navigations
  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';

  if (isLocalhost) {
    if (url.pathname.startsWith('/_next/') || request.mode === 'navigate') {
      return true;
    }
  }

  // Bypass HMR, Webpack hot updates, and Turbopack internals
  if (
    url.pathname.includes('/_next/webpack-hmr') ||
    url.pathname.includes('turbopack') ||
    url.searchParams.has('turbopack')
  ) {
    return true;
  }

  const urlString = url.href.toLowerCase();

  for (const pattern of BYPASS_PATTERNS) {
    if (urlString.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Bypass WebSockets / Socket.IO
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return true;

  return false;
}

/**
 * 3. Fetch Event: Multi-tier caching strategy
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Bypass non-GET, Stripe, Socket.IO, development chunks, and private auth APIs
  if (shouldBypass(url, request)) {
    return;
  }

  // Strategy A: HTML Page Navigation Requests -> Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Clone and cache successful page response
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Try matching cached page first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache and device is offline, return pre-cached /offline fallback page
          const offlineFallback = await caches.match('/offline');
          return offlineFallback || Response.error();
        })
    );
    return;
  }

  // Strategy B: Public Static Assets (Icons, images, web fonts) -> Cache-First
  const isStaticAsset =
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Strategy C: Safe Public GET APIs (/api/products*, /api/delivery-zones*) -> Network-First with Cache Fallback
  const isPublicCatalogAPI =
    url.pathname.startsWith('/api/products') ||
    url.pathname.startsWith('/api/delivery-zones');

  if (isPublicCatalogAPI) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return Response.error();
        })
    );
    return;
  }

  // Default: Normal Network Fetch
  event.respondWith(fetch(request));
});

/**
 * 4. Message Event: Handle manual updates (SKIP_WAITING)
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * 5. Push Notification Foundation (Compatible with future web push)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Experto Store Notification';
    const options = {
      body: payload.body || payload.message || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.url || '/',
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn('[Service Worker] Push notification parse error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
