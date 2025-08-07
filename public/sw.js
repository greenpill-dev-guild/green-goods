const CACHE_NAME = 'green-goods-v1';
const SYNC_TAG = 'offline-sync';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background Sync for offline work submission
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Notify the main app to perform sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        payload: { timestamp: Date.now() }
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Message handler for registering sync
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    // Register for background sync
    self.registration.sync.register(SYNC_TAG).catch((error) => {
      console.error('Failed to register background sync:', error);
    });
  }
});

// Network-first strategy with fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for now
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful, update cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
}); 