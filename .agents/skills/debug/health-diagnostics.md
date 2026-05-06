# Health Checks & Diagnostics

Service worker health, storage quota monitoring, indexer sync lag detection, frontend performance diagnostics, and health check endpoints.

---

## Service Worker Health `[PATTERN]`

### Registration Status

```typescript
async function checkServiceWorkerHealth() {
  if (!("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    return { status: "unregistered" };
  }

  return {
    status: "active",
    scope: registration.scope,
    updateFound: !!registration.waiting,
    active: !!registration.active,
    installing: !!registration.installing,
  };
}
```

### Cache Storage Metrics

```typescript
async function getCacheMetrics() {
  if (!("caches" in window)) return null;

  const cacheNames = await caches.keys();
  const metrics = [];

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    metrics.push({
      name,
      entryCount: keys.length,
    });
  }

  return metrics;
}
```

---

## Storage Quota Monitoring `[PATTERN]`

### IndexedDB Usage

```typescript
import { getStorageQuota } from "@green-goods/shared";

async function monitorStorage() {
  const quota = await getStorageQuota();

  logger.info("Storage status", {
    used: `${quota.used}MB`,
    total: `${quota.quota}MB`,
    percent: `${quota.percentUsed}%`,
  });

  if (quota.isCritical) {
    // > 90% — user must take action
    logger.warn("Storage critically low", {
      percentUsed: quota.percentUsed,
      action: "Prompt user to sync or clear old data",
    });
  } else if (quota.isLow) {
    // > 75% — show indicator
    logger.warn("Storage getting low", {
      percentUsed: quota.percentUsed,
    });
  }

  return quota;
}
```

### Automated Cleanup

```typescript
import { mediaResourceManager } from "@green-goods/shared/modules";

async function cleanupOldData(userAddress: Address) {
  const stats = await jobQueue.getStats(userAddress);

  // Clean completed jobs older than 30 days
  if (stats.completed > 100) {
    await jobQueue.cleanCompleted(userAddress, {
      olderThan: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    logger.info("Cleaned old completed jobs", { userAddress });
  }

  // Shared job-queue media lifecycle helper
  mediaResourceManager.cleanupAll();
}
```

---

## Indexer Sync Monitoring `[PATTERN]`

### Sync Lag Detection

```typescript
// Query the indexer for its latest processed block
async function checkIndexerLag() {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ _metadata { lastProcessedBlock lastProcessedTimestamp } }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const metadata = payload?.data?._metadata;
    if (!metadata) {
      throw new Error("GraphQL response missing _metadata");
    }

    const indexerBlock = Number(metadata.lastProcessedBlock ?? 0);
    const lastTimestamp = metadata.lastProcessedTimestamp ?? null;

    // Compare with chain head
    const chainBlock = await getBlockNumber(wagmiConfig);
    const lag = chainBlock - BigInt(indexerBlock);

    if (lag > 100n) {
      logger.warn("Indexer significantly behind chain head", {
        indexerBlock,
        chainBlock: chainBlock.toString(),
        lag: lag.toString(),
      });
    }

    return {
      indexerBlock,
      chainBlock: Number(chainBlock),
      lag: Number(lag),
      lastTimestamp,
    };
  } catch (error) {
    logger.error("Failed to check indexer lag", {
      endpoint: GRAPHQL_ENDPOINT,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      indexerBlock: null,
      chainBlock: null,
      lag: null,
      lastTimestamp: null,
    };
  }
}
```

### Indexer Health Check (Docker Compose)

```bash
# Check indexer is responding
node -e 'fetch("http://localhost:8080/healthz").then(r=>console.log(r.status))'

# Query GraphQL playground
node -e 'fetch("http://localhost:8080/v1/graphql", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query:"{ _metadata { lastProcessedBlock } }"})}).then(r=>r.text()).then(console.log)'

# Check Docker container status
docker compose -f docker-compose.indexer.yaml ps
docker compose -f docker-compose.indexer.yaml logs --tail 50
```

---

## Frontend Diagnostics `[PATTERN]`

### Performance Metrics

```typescript
import { logger } from "@green-goods/shared";

// Collect Web Vitals
declare global {
  interface Window {
    __webVitalsObserverInstalled?: boolean;
  }
}

function collectWebVitals() {
  if (typeof window === "undefined") return;
  if (typeof PerformanceObserver === "undefined") {
    logger.info("Web Vitals unavailable: PerformanceObserver is not supported");
    return;
  }
  if (window.__webVitalsObserverInstalled) return;
  window.__webVitalsObserverInstalled = true;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      logger.info("Web Vital", {
        name: entry.name,
        value: entry.startTime,
        type: entry.entryType,
      });
    }
  });

  observer.observe({ type: "largest-contentful-paint", buffered: true });
  observer.observe({ type: "first-input", buffered: true });
  observer.observe({ type: "layout-shift", buffered: true });
}
```

### Error Boundary Tracking

```typescript
import { logger } from "@green-goods/shared";

class MonitoredErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("React error boundary caught error", {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }
}
```

---

## Health Check Endpoints `[PATTERN]`

### Service Health Matrix

| Service | Endpoint | Expected |
|---------|----------|----------|
| Client (Vercel) | `https://app.greengoods.app` | 200 |
| Admin (Vercel) | `https://admin.greengoods.app` | 200 |
| Indexer GraphQL | `http://indexer:8080/healthz` | 200 |
| Agent Bot | `https://agent.greengoods.app/health` | 200 |
| Agent Ready | `https://agent.greengoods.app/ready` | 200 |

### Diagnostic Dashboard Data

```typescript
interface DiagnosticReport {
  // Storage
  storageQuota: StorageQuota;
  // Job queue
  queueStats: QueueStats;
  // Service worker
  swStatus: ServiceWorkerStatus;
  // Network
  isOnline: boolean;
  // Indexer
  indexerLag: number;
  // App version
  version: string;
  buildTime: string;
}

async function generateDiagnosticReport(userAddress: Address): Promise<DiagnosticReport> {
  const [storageQuota, queueStats, swStatus, indexerLag] = await Promise.all([
    getStorageQuota(),
    jobQueue.getStats(userAddress),
    checkServiceWorkerHealth(),
    checkIndexerLag(),
  ]);

  return {
    storageQuota,
    queueStats,
    swStatus,
    isOnline: navigator.onLine,
    indexerLag: indexerLag.lag,
    version: __APP_VERSION__,
    buildTime: __BUILD_TIME__,
  };
}
```
