# Service Worker & Connectivity

Service worker lifecycle, cache strategies, background sync, and cross-module event communication for the Green Goods PWA.

---

## Service Worker Lifecycle

### Registration

```typescript
import { ServiceWorkerManager } from "@green-goods/shared";

const swManager = new ServiceWorkerManager();
await swManager.register();  // Registers /sw.js
```

### Cache Strategies

Green Goods uses different strategies per resource type:

| Resource | Strategy | Why |
|----------|----------|-----|
| App shell (HTML) | Network-first, cache fallback | Always serve latest, work offline |
| Static assets (`/assets/*`) | Cache-first (immutable) | Hashed filenames, never changes |
| API calls (GraphQL) | Network-only + cache fallback | Fresh data preferred, stale OK offline |
| Images (IPFS) | Cache-first | Content-addressed, never changes |
| Service worker (`/sw.js`) | Network-only | Must always check for updates |

```typescript
// In service-worker.ts
const CACHE_NAME = "green-goods-v1";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Static assets — cache-first (immutable hashed filenames)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // API/GraphQL — network-first with cache fallback
  if (url.pathname.startsWith("/v1/graphql")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell — network-first
  event.respondWith(networkFirst(event.request));
});
```

### Background Sync

When the device comes back online, the service worker triggers a sync:

```typescript
// Request background sync manually
swManager.requestBackgroundSync();

// In service worker: handle sync events
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "job-queue-flush") {
    event.waitUntil(flushPendingJobs());
  }
});
```

### Controller Change Handling

```typescript
// Handle service worker updates (new version available)
// Uses { once: true } to prevent listener leaks (Architectural Rule #2)
navigator.serviceWorker.addEventListener(
  "controllerchange",
  () => window.location.reload(),
  { once: true }
);
```

### SW Update Flow ("New Version Available")

```typescript
import { useServiceWorkerUpdate } from "@green-goods/shared";

function UpdatePrompt() {
  const { hasUpdate, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();

  if (!hasUpdate) return null;

  return (
    <div role="alert" className="fixed bottom-4 right-4 p-4 bg-card rounded-lg shadow-lg">
      <p>A new version is available</p>
      <div className="flex gap-2 mt-2">
        <button onClick={applyUpdate}>Update now</button>
        <button onClick={dismissUpdate} variant="ghost">Later</button>
      </div>
    </div>
  );
}
```

### Vercel Cache Headers

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/assets/:path*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

---

## Connectivity & Event Bus

### Connectivity Detection

```typescript
import { useOffline } from "@green-goods/shared";

function OfflineBanner() {
  const { isOnline } = useOffline();

  if (!isOnline) {
    return (
      <div role="status" className="bg-warning text-warning-foreground p-2 text-center">
        You're offline. Changes will sync when you reconnect.
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div role="status" className="bg-success text-success-foreground p-2 text-center">
        Back online! Syncing changes...
      </div>
    );
  }

  return null;
}
```

### Cross-Module Communication

```typescript
import { jobQueueEventBus } from "@green-goods/shared";

type QueueEvent =
  | "job:added"
  | "job:processing"
  | "job:completed"
  | "job:failed"
  | "queue:sync-completed"
  | "background:sync-requested";

// Subscribe in React
import { useJobQueueEvents } from "@green-goods/shared";

function SyncIndicator() {
  useJobQueueEvents({
    onSyncCompleted: () => toast.success("All work synced!"),
    onJobFailed: (job) => toast.error(`Failed to sync: ${job.id}`),
  });
}
```
