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

---

## Read-side: PostHog lookup during bug debugging

When you start work on a reported bug, query PostHog for matching telemetry **before** forming a hypothesis. Production replay and error data is the cheapest "did the user actually hit the path I think they did?" check available, and PostHog has it for both client and admin.

### When to query

- A user-reported bug references a specific surface, error message, or behavior.
- A test fails in a way that hints at a real-world flow you cannot easily reproduce locally (auth race, IndexedDB state, transaction nonce).
- An incident is open and you need to size blast radius (how many sessions, how many users, since when).

Skip the lookup for: pure code-quality bugs, lint failures, build errors, anything reproducible by reading source.

### Primary path: Claude Code PostHog connector

The Claude Code PostHog connector is the primary surface. Use it directly — do not stand up a custom PostHog MCP server. Curated questions (mirrored from `docs/routines/bug-intake.md`):

1. Recent JS errors grouped by message and URL (window: 7 days unless older incident).
2. Error detail for a specific hash — top-line message, normalized top stack frame, first/last seen, affected-session count, affected-user count, app surface, replay link.
3. Reporter session lookup — only when the reporter identifier is known and consented.
4. Recurring-pattern probe — distinct-session count for an error hash over 30 days.
5. Free-text fuzzy match against recent error messages and event names from the table above.

Replay URLs, session IDs, distinct IDs, wallet/user identifiers, and reporter identifiers are **private debugging context** — useful to you while triaging, never pasted into a Linear body, GitHub issue, PR description, commit message, Discord summary, or any other shared surface. If you need to share evidence with another agent or a human reviewer, share the **PostHog error hash** and the safe-summary fields (error message, affected-session count, first/last seen, app surface, confidence). Anyone with PostHog access can re-fetch the private fields from the hash.

### Fallback path: `scripts/agents/posthog-query.ts`

When the connector is unavailable (Codex worktree, cron, non-Claude runtime), fall back to the durable script. Root env reads only:

- `POSTHOG_PROJECT_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST`

Subcommands match the curated questions above:

```bash
bun scripts/agents/posthog-query.ts errors --recent 24h --privacy public
bun scripts/agents/posthog-query.ts error-detail <error-hash> --window 7d
bun scripts/agents/posthog-query.ts user-sessions <distinct-id-or-wallet> --window 7d
bun scripts/agents/posthog-query.ts recurring --since 2026-04-01
bun scripts/agents/posthog-query.ts match-bug-report --error-snippet "stack frame text" --user "<distinct-id?>"
```

`--privacy public` suppresses the `private_context` block entirely, leaving only the same allowlist that crosses into Linear bodies. Use it whenever the script's output may flow into a shared surface (a PR description, a `#product` post, a doc).

Do not extend this script to add features that exist in the connector — the connector is the primary surface and the script is fallback-only.

### Privacy hard rule

If a field came from PostHog and it is not in this allowlist, it does not leave private debugging context:

- error message (top line, redacted)
- normalized top stack frame (no query strings, no path params)
- affected-session count
- affected-user count
- first seen / last seen (UTC)
- app surface (`client` / `admin`)
- confidence (`high` / `medium` / `low`)
- recurring-pattern flag + 30-day session count
- PostHog error hash

Everything else — replay URL, session ID, distinct ID, wallet, full stack with paths, IP, UA, geo — stays in private routine/Claude context. Same rule applies whether you used the connector or the fallback script.
