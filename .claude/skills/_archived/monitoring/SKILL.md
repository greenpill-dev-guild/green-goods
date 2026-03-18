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
+--------------+    +--------------+    +--------------+
|   Frontend   |    |   Indexer    |    |    Agent     |
|  (Vercel)    |    |  (Docker)    |    |  (Service)   |
+------+-------+    +------+-------+    +------+-------+
       |                   |                   |
       v                   v                   v
+------------------------------------------------------+
|                    Logger Service                     |
|  Structured logs -> Error tracking -> Metrics         |
+------------------------------------------------------+
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
// -> { pending: 3, processing: 1, completed: 45, failed: 2, totalJobs: 51 }

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

---

## Reference Files

For detailed monitoring guides beyond transaction tracking:

- **[posthog.md](./posthog.md)** -- PostHog setup, user identification, event tracking patterns, standard event names, error tracking integration, contract error tracking, feature flags, session recording, and environment configuration.

- **[health-diagnostics.md](./health-diagnostics.md)** -- Service worker health checks, storage quota monitoring with automated cleanup, indexer sync lag detection, frontend performance diagnostics (Web Vitals), error boundary tracking, health check endpoints, and diagnostic dashboard data.

---

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
