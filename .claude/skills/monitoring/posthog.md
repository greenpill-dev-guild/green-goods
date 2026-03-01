# PostHog Analytics & Error Tracking

Green Goods uses **PostHog** for product analytics, error tracking, session recording, and feature flags.

---

## PostHog Setup

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

## User Identification

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

## Event Tracking Patterns

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

## Standard Event Names

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

## Error Tracking Integration

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

## Contract Error Tracking

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

## Feature Flags

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

## Session Recording

Session recordings auto-capture when configured. Control recording for sensitive flows:

```typescript
// Pause recording during sensitive operations
posthog.stopSessionRecording();
// ... handle private key or seed phrase ...
posthog.startSessionRecording();
```

## PostHog + Monitoring Integration

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

## Environment Configuration

```bash
# .env (root)
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com  # Optional, defaults to US cloud
```

## Best Practices

### Development vs Production

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
