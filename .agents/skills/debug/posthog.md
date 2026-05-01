# PostHog Analytics & Error Tracking

> Sub-file of the [debug skill](./SKILL.md).

---

## Integration Points

### Core Module

**`packages/shared/src/modules/app/posthog.ts`** — centralized wrapper with throttling, offline support, and error handling.

Exports:
- `track(event, properties)` — track custom events with automatic enrichment
- `identify(distinctId)` — identify user by wallet/smart account address
- `identifyWithProperties(distinctId, properties)` — identify + set person properties
- `reset()` — clear identity on logout
- `getDistinctId()` — get current distinct ID
- `trackOfflineEvent(event, properties)` — track offline-specific events
- `trackSyncPerformance(operation, startTime, success, details)` — track sync performance
- `trackAppLifecycle(event)` — track app start/resume/background

### Analytics Hooks

**`packages/shared/src/hooks/analytics/useAnalyticsIdentity.ts`**
- Syncs user identity with PostHog on auth state changes
- Options: `app: "client" | "admin"`, `isPwa?: boolean`, `locale?: string`
- Auto-identifies on login, resets on logout

**`packages/shared/src/hooks/analytics/usePageView.ts`**
- Tracks SPA pageviews on route changes
- Options: `app: "client" | "admin"`, `trackInitial?: boolean`, `excludePaths?: string[]`

### Provider Setup

**`packages/shared/src/providers/App.tsx`** wraps the app with `PostHogProvider` from `posthog-js/react` when `apiKey` is provided. Registers global properties with exponential backoff retry.

### App Entry Points

- **Client** (`packages/client/src/main.tsx`): passes `VITE_POSTHOG_KEY`
- **Admin** (`packages/admin/src/main.tsx`): passes `VITE_POSTHOG_ADMIN_KEY`
- Both `Root.tsx` files call `useAnalyticsIdentity()` and `usePageView()`

## Event Tracking Patterns

Track meaningful business events, not UI clicks:

```typescript
import { track } from "@green-goods/shared";

track("work_submitted", { garden_address: gardenAddress, action_uid: actionUID, is_offline: !navigator.onLine });
track("sync_completed", { jobs_synced: count, duration_ms: elapsed });
```

### Standard Event Names

| Event | Properties | When |
|-------|-----------|------|
| `work_submitted` | `garden_address`, `action_uid`, `is_offline` | Work queued or submitted |
| `work_approved` | `garden_address`, `work_id`, `approver_role` | Operator approves work |
| `garden_created` | `garden_address`, `operator_count` | New garden deployed |
| `sync_completed` | `jobs_synced`, `duration_ms` | Job queue flush completes |
| `sync_failed` | `job_id`, `error_type`, `attempt` | Job fails after retries |
| `auth_login_success` | `auth_mode`, `chain_id` | Login succeeds |
| `auth_logout` | | Logout |
| `page_view` | `path`, `app`, `is_initial` | Route change |

## Environment Variables

| Variable | Used By |
|----------|---------|
| `VITE_POSTHOG_KEY` | Client |
| `VITE_POSTHOG_ADMIN_KEY` | Admin |
| `VITE_POSTHOG_HOST` | Both (defaults to US cloud) |
| `VITE_POSTHOG_DEBUG` | Both (enables debug logging) |

## Best Practices

| Practice | Details |
|----------|---------|
| **Identify after auth only** | Never identify anonymous users |
| **Use snake_case events** | Consistent with PostHog conventions |
| **Track outcomes, not clicks** | `work_submitted` not `submit_button_clicked` |
| **Don't track in dev** | Module gates on production environment |
| **Use the shared module** | Never import `posthog-js` directly — use `track()` from shared |
