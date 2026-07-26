# Health Checks & Diagnostics

Domain command reference, end-to-end pipeline trace, service worker health, storage quota monitoring, indexer sync lag detection, frontend performance diagnostics, and health check endpoints.

---

## Domain Command Reference

Moved from the debug SKILL.md body — load on demand, not on every activation.

### Offline Sync Issues

- Check `useJobQueue` for stuck jobs
- IndexedDB: Brave DevTools > Application > IndexedDB > `jobQueueDB`
- Service Worker registration: Brave DevTools > Application > Service Workers
- Job queue stats: `jobQueue.getStats(userAddress)` in console
- Event bus monitoring: subscribe to `"job:failed"` events

### Contract Issues

```bash
# Compile and check artifacts
cd packages/contracts && bun build

# Inspect deployment addresses
cat deployments/11155111-latest.json | jq '.gardenToken'

# Verbose test output (traces all calls) through bun wrapper
cd packages/contracts && bun run test -- --match-test "testFailing" -vvvv

# Quick production-readiness gate for contract-touching fixes
bun run verify:contracts:fast

# Decode transaction calldata
cast decode-function "functionName(uint256)" 0xcalldata

# Check on-chain state
cast call <contract> "functionName()" --rpc-url $RPC
```

### Frontend Debugging Tools

| Tool | Purpose | How to Access |
|------|---------|---------------|
| **React DevTools** | Component tree, props, state, re-renders | Browser extension → Components tab |
| **React Profiler** | Render timing, commit frequency | Browser extension → Profiler tab |
| **TanStack Query DevTools** | Query cache, stale state, refetch triggers | Auto-included in dev mode |
| **Redux DevTools** | Zustand store inspection (with `devtools` middleware) | Browser extension |
| **Vite Debug** | Build issues, dependency resolution | `DEBUG=vite:* bun dev` |
| **Network tab** | GraphQL queries, IPFS uploads, RPC calls | Brave DevTools → Network |

### Indexer Debugging

```bash
# View Docker container logs
cd packages/indexer && bun run dev:docker:logs

# Check Hasura GraphQL console (runs on port 8080)
open http://localhost:8080/console

# Test a GraphQL query directly
node -e 'fetch("http://localhost:8080/v1/graphql", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query:"{ Garden { id name } }"})}).then(r=>r.text()).then(console.log)'

# Restart indexer containers
bun run dev:docker:down && bun run dev:docker
```

### Build & Type Debugging

```bash
# TypeScript errors without emitting
cd packages/shared && npx tsc --noEmit

# Check specific package types
cd packages/client && npx tsc --noEmit

# Vite build with verbose output
cd packages/client && DEBUG=vite:* bun build

# Check bundle analysis
cd packages/client && npx vite-bundle-visualizer
```

---

## End-to-End Pipeline Trace

For tracing issues through the full offline → blockchain → indexer pipeline:

### Work Submission Pipeline

```
IndexedDB Draft → Job Queue → IPFS Upload → Contract Call → Indexer Event → GraphQL Cache
```

### Layer 1: Client (IndexedDB → Job Queue)

```bash
# Check IndexedDB for stuck drafts
# Brave DevTools > Application > IndexedDB > green-goods-drafts

# Check job queue state
# Console: jobQueue.getStats(userAddress)

# Monitor job events
# Console: jobQueueEventBus.subscribe("job:*", console.log)
```

| Symptom | Layer | Check |
|---------|-------|-------|
| Draft not saving | IndexedDB | Storage quota: `navigator.storage.estimate()` |
| Job stuck in `pending` | Job Queue | Is the user online? Check `navigator.onLine` |
| Job stuck in `processing` | Job Queue | Check for thrown errors in IPFS/contract call |
| Job `failed` repeatedly | IPFS or Chain | Check `job.error` and `job.retryCount` |

### Layer 2: IPFS Upload

```bash
# Check if media uploaded successfully
# Job payload should contain a CID after upload

# Verify CID is retrievable
node -e 'fetch("https://w3s.link/ipfs/<CID>").then(r => console.log(r.status))'

# Check Storacha service health
# Look for 4xx/5xx in Network tab for storacha requests
```

### Layer 3: Blockchain Transaction

```bash
# Decode the transaction that was sent
cast tx <txHash> --rpc-url $RPC

# Check if transaction reverted and why
cast run <txHash> --rpc-url $RPC

# Verify contract state after tx
cast call <gardenAddress> "getWork(bytes32)" <workUID> --rpc-url $RPC

# Check gas estimation (may fail before tx is sent)
cast estimate <gardenAddress> "submitWork(bytes32,string)" <args> --rpc-url $RPC
```

### Layer 4: Indexer Processing

```bash
# Check if event was emitted
cast receipt <txHash> --rpc-url $RPC | grep -A5 "logs"

# Check indexer lag — compare latest indexed block vs chain head
INDEXED=$(node -e 'fetch("http://localhost:8080/v1/graphql", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query:"{ _metadata { lastProcessedBlock } }"})}).then(r=>r.json()).then(x=>console.log(x.data._metadata.lastProcessedBlock))')
CHAIN_HEAD=$(cast block-number --rpc-url $RPC)
echo "Indexer lag: $((CHAIN_HEAD - INDEXED)) blocks"

# Check if entity exists in indexer
node -e 'fetch("http://localhost:8080/v1/graphql", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query:"{ Work(where: {id: {_eq: \"<workId>\"}}) { id status } }"})}).then(r=>r.text()).then(console.log)'
```

### Layer 5: Frontend Cache

```bash
# Force refetch in TanStack Query DevTools
# Or invalidate programmatically:
# queryClient.invalidateQueries({ queryKey: queryKeys.work.all })

# Check if the query key matches what the indexer returns
# TanStack Query DevTools > Queries tab > check cache content
```

### Cross-Layer Diagnostic Script

```bash
# Full pipeline health check
echo "=== Pipeline Health ==="

# 1. Chain connectivity
echo -n "Chain: "; cast block-number --rpc-url $RPC && echo "OK" || echo "UNREACHABLE"

# 2. Contract deployed
echo -n "Contract: "; cast call $GARDEN_ADDRESS "name()(string)" --rpc-url $RPC && echo "OK" || echo "MISSING"

# 3. Indexer running
echo -n "Indexer: "; node -e 'fetch("http://localhost:8080/healthz").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' && echo "OK" || echo "DOWN"

# 4. Frontend GraphQL reachable
echo -n "GraphQL: "; node -e 'fetch("http://localhost:8080/v1/graphql", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query:"{ __typename }"})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' && echo "OK" || echo "UNREACHABLE"
```

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
