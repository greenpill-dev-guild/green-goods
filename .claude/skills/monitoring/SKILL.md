---
name: monitoring
user-invocable: false
description: Production monitoring and observability - transaction tracking, service worker health, storage quotas, indexer sync lag, error tracking. Use for production health checks, alerting, and diagnostics.
version: "1.0.0"
status: active
packages: ["indexer", "shared", "client", "admin", "agent"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Monitoring Skill

Production observability guide: tracking transactions, service health, storage quotas, and indexer synchronization.

---

## Activation

When invoked:
- Identify which layer needs monitoring (blockchain, frontend, indexer, agent).
- Use the logger service from `@green-goods/shared` — never `console.log`.
- Check deployment health endpoints before investigating issues.

## Implementation Status

> Sections marked `[IMPLEMENTED]` exist in the codebase. Sections marked `[PATTERN]` document patterns to follow when building new monitoring features.

## Part 1: Monitoring Architecture `[IMPLEMENTED]`

### Observability Stack

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │    │   Indexer    │    │    Agent     │
│  (Vercel)    │    │  (Docker)    │    │  (Service)   │
└──────┬──────┘    └──────┬───────┘    └──────┬───────┘
       │                  │                    │
       ▼                  ▼                    ▼
┌──────────────────────────────────────────────────────┐
│                    Logger Service                     │
│  Structured logs → Error tracking → Metrics           │
└──────────────────────────────────────────────────────┘
```

### Log Levels

```typescript
import { logger } from "@green-goods/shared";

logger.debug("Detailed debugging info", { data });     // Dev only
logger.info("Normal operation", { action, user });      // Business events
logger.warn("Potential issue", { threshold, current }); // Degraded state
logger.error("Operation failed", { error, context });   // Errors
```

## Part 2: Transaction Monitoring `[IMPLEMENTED]`

### Job Queue Health

```typescript
import { jobQueue } from "@green-goods/shared";

// Get queue statistics per user
const stats = await jobQueue.getStats(userAddress);
// → { pending: 3, processing: 1, completed: 45, failed: 2, totalJobs: 51 }

// Alert thresholds
const THRESHOLDS = {
  maxPending: 10,        // Too many queued jobs
  maxFailed: 5,          // Too many failures
  maxProcessingAge: 300, // Job stuck for 5 min (seconds)
};
```

### Failed Transaction Tracking

```typescript
import { useJobQueueEvents } from "@green-goods/shared";

function TransactionMonitor() {
  useJobQueueEvents({
    onJobFailed: (job) => {
      logger.error("Transaction failed", {
        jobId: job.id,
        kind: job.kind,
        attempt: job.attempts,
        error: job.lastError,
        userAddress: job.userAddress,
      });

      // Track failure patterns
      if (job.attempts >= job.maxRetries) {
        logger.error("Job permanently failed after max retries", {
          jobId: job.id,
          totalAttempts: job.attempts,
        });
      }
    },
    onSyncCompleted: () => {
      logger.info("Queue sync completed", {
        timestamp: Date.now(),
      });
    },
  });
}
```

### On-Chain Transaction Verification

```typescript
import { waitForTransactionReceipt } from "@wagmi/core";

async function verifyTransaction(hash: `0x${string}`) {
  try {
    const receipt = await waitForTransactionReceipt(wagmiConfig, {
      hash,
      confirmations: 2,
      timeout: 60_000,
    });

    if (receipt.status === "reverted") {
      logger.error("Transaction reverted on-chain", {
        hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });
    }

    return receipt;
  } catch (error) {
    logger.error("Transaction receipt not found", { hash, error });
    throw error;
  }
}
```

## Part 3: Service Worker Health `[PATTERN]`

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

## Part 4: Storage Quota Monitoring `[PATTERN]`

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

## Part 5: Indexer Sync Monitoring `[PATTERN]`

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

## Part 6: Frontend Diagnostics `[PATTERN]`

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

## Part 7: Health Check Endpoints `[PATTERN]`

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

## Part 8: PostHog Analytics & Error Tracking `[IMPLEMENTED]`

Green Goods uses **PostHog** for product analytics, error tracking, session recording, and feature flags.

### PostHog Setup

```typescript
// packages/shared/src/modules/analytics/posthog.ts
import posthog from "posthog-js";
import { logger } from "@green-goods/shared";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) {
    logger.info("Skipping PostHog init in non-production builds");
    return;
  }
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
  if (!posthogKey) {
    logger.warn("Skipping PostHog init: VITE_POSTHOG_KEY is missing");
    return;
  }

  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,       // PII protection
      maskTextSelector: ".mask", // Mask sensitive elements
    },
  });
}
```

### User Identification

Identify users after authentication (wallet or passkey):

```typescript
import posthog from "posthog-js";

// After successful auth
function identifyUser(address: Address, authMode: "wallet" | "passkey") {
  posthog.identify(address, {
    auth_mode: authMode,
    chain_id: chainId,
  });
}

// On logout — reset to anonymous
function resetUser() {
  posthog.reset();
}
```

### Event Tracking Patterns

Track meaningful business events, not UI clicks:

```typescript
import posthog from "posthog-js";

// Domain events — track these
posthog.capture("work_submitted", {
  garden_address: gardenAddress,
  action_uid: actionUID,
  is_offline: !navigator.onLine,
});

posthog.capture("work_approved", {
  garden_address: gardenAddress,
  work_id: workId,
  approver_role: role,
});

posthog.capture("garden_created", {
  garden_address: gardenAddress,
  operator_count: operators.length,
});

posthog.capture("sync_completed", {
  jobs_synced: count,
  duration_ms: elapsed,
});
```

### Standard Event Names

| Event | Properties | When |
|-------|-----------|------|
| `work_submitted` | `garden_address`, `action_uid`, `is_offline` | Work queued or submitted |
| `work_approved` | `garden_address`, `work_id`, `approver_role` | Operator approves work |
| `garden_created` | `garden_address`, `operator_count` | New garden deployed |
| `garden_joined` | `garden_address`, `role` | User joins a garden |
| `sync_completed` | `jobs_synced`, `duration_ms` | Job queue flush completes |
| `sync_failed` | `job_id`, `error_type`, `attempt` | Job fails after retries |
| `auth_success` | `auth_mode`, `chain_id` | Login succeeds |
| `auth_failed` | `auth_mode`, `error_type` | Login fails |
| `storage_warning` | `percent_used`, `action_taken` | Storage quota threshold hit |
| `offline_detected` | `pending_jobs` | Device goes offline with pending work |

### Error Tracking Integration

Connect the logger service to PostHog for centralized error tracking:

```typescript
import posthog from "posthog-js";
import { logger } from "@green-goods/shared";

// Extend logger to send errors to PostHog
function trackError(error: Error, context: Record<string, unknown> = {}) {
  // Log locally
  logger.error(error.message, { error, ...context });

  // Send to PostHog
  posthog.capture("$exception", {
    $exception_message: error.message,
    $exception_type: error.name,
    $exception_stack_trace_raw: error.stack,
    ...context,
  });
}

// Usage in error handlers
import { createMutationErrorHandler } from "@green-goods/shared";

const handleError = createMutationErrorHandler({
  source: "useSubmitWork",
  toastContext: "work submission",
  trackError: (error, meta) => {
    trackError(error as Error, {
      source: "useSubmitWork",
      ...meta,
    });
  },
});
```

### Contract Error Tracking

Track on-chain failures with rich context:

```typescript
function trackContractError(error: unknown, context: {
  method: string;
  contract: string;
  args?: unknown[];
}) {
  const parsed = parseContractError(error);

  posthog.capture("contract_error", {
    error_name: parsed.name,
    error_message: parsed.message,
    contract: context.contract,
    method: context.method,
    chain_id: chainId,
  });
}
```

### Feature Flags

Use PostHog feature flags for gradual rollouts:

```typescript
import posthog from "posthog-js";

// Check feature flag
if (posthog.isFeatureEnabled("new-work-flow")) {
  // Show new UI
}

// React hook pattern
import { useFeatureFlagEnabled } from "posthog-js/react";

function WorkForm() {
  const showNewFlow = useFeatureFlagEnabled("new-work-flow");

  return showNewFlow ? <NewWorkFlow /> : <LegacyWorkFlow />;
}
```

### Session Recording

Session recordings auto-capture when configured. Control recording for sensitive flows:

```typescript
// Pause recording during sensitive operations
posthog.stopSessionRecording();
// ... handle private key or seed phrase ...
posthog.startSessionRecording();
```

### PostHog + Monitoring Integration

Connect PostHog events with the diagnostic report:

```typescript
async function reportDiagnostics(userAddress: Address) {
  const report = await generateDiagnosticReport(userAddress);

  posthog.capture("diagnostic_report", {
    storage_percent: report.storageQuota.percentUsed,
    pending_jobs: report.queueStats.pending,
    failed_jobs: report.queueStats.failed,
    sw_status: report.swStatus.status,
    is_online: report.isOnline,
    indexer_lag: report.indexerLag,
    app_version: report.version,
  });
}
```

### Environment Configuration

```bash
# .env (root)
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com  # Optional, defaults to US cloud
```

### PostHog Best Practices

#### Development vs Production

```typescript
import posthog from "posthog-js";
import { logger } from "@green-goods/shared";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) {
    logger.info("PostHog disabled outside production");
    return;
  }

  const key = import.meta.env.VITE_POSTHOG_KEY?.trim();
  if (!key) {
    logger.info("PostHog disabled: missing VITE_POSTHOG_KEY");
    return;
  }

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!import.meta.env.PROD) return;
  posthog.capture(event, properties);
}
```

| Practice | Details |
|----------|---------|
| **Identify after auth only** | Never identify anonymous users |
| **Use snake_case events** | Consistent with PostHog conventions |
| **Track outcomes, not clicks** | `work_submitted` not `submit_button_clicked` |
| **Mask PII in recordings** | Use `maskAllInputs` and `.mask` class |
| **Pause for sensitive flows** | Stop recording during key operations |
| **Group by garden** | Use PostHog groups for per-garden analytics |
| **Don't track in dev** | Gate on `import.meta.env.PROD` |

## Anti-Patterns

- **Never use `console.log` in production** — use logger service (Architectural Rule #12)
- **Never poll health endpoints too frequently** — use reasonable intervals (30s+)
- **Never expose internal errors to users** — log details, show friendly messages
- **Never ignore storage quota warnings** — prompt cleanup before data loss
- **Never skip error context in logs** — always include relevant IDs and state

## Quick Reference Checklist

### Setting Up Monitoring for a New Feature

- [ ] Error cases log via `logger.error()` with context
- [ ] Business events log via `logger.info()`
- [ ] Storage-heavy features check quota
- [ ] Transaction features track job queue events
- [ ] Health endpoint accessible for feature's service
- [ ] Degraded state has user-visible indicator

## Related Skills

- `data-layer` — Job queue events and storage patterns
- `web3` — Transaction lifecycle monitoring
- `deployment` — Service health checks post-deploy
- `error-handling-patterns` — Error categorization and tracking
- `debug` — Using monitoring data for root cause analysis
