# Production Monitoring

> Sub-file of the [debug skill](./SKILL.md). Covers transaction monitoring, job queue health, and on-chain verification.

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

## Quick Reference Checklist

### Setting Up Monitoring for a New Feature

- [ ] Error cases log via `logger.error()` with context
- [ ] Business events log via `logger.info()`
- [ ] Storage-heavy features check quota
- [ ] Transaction features track job queue events
- [ ] Health endpoint accessible for feature's service
- [ ] Degraded state has user-visible indicator

## Anti-Patterns

- **Never use `console.log` in production** -- use logger service (Architectural Rule #12)
- **Never poll health endpoints too frequently** -- use reasonable intervals (30s+)
- **Never expose internal errors to users** -- log details, show friendly messages
- **Never ignore storage quota warnings** -- prompt cleanup before data loss
- **Never skip error context in logs** -- always include relevant IDs and state
