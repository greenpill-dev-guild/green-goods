# PostHog Analytics, Sentry, and Error Tracking

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

### Sentry Companion Sink

**`packages/shared/src/modules/app/sentry.ts`** registers Sentry for client/admin through the `@green-goods/shared/sentry` subpath. It is deliberately not exported from the main shared barrel so the Node agent does not load React/browser Sentry.

**`packages/shared/src/modules/app/error-categories.ts`** remains the browser error funnel. It still sends `error_tracked` to PostHog and now also calls registered external reporters for categorized errors and React boundary crashes. Native `window.onerror` and `unhandledrejection` stay with Sentry's global handlers to avoid duplicate capture.

**`packages/agent/src/services/sentry.ts`** initializes `@sentry/bun` with `sendDefaultPii: false`, safe tags, sanitized context, and flush-on-shutdown. Agent capture points are startup/runtime failures, Hono `onError`, and `handleMessage` failures.

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
| `VITE_SENTRY_CLIENT_DSN` | Client Sentry project |
| `VITE_SENTRY_ADMIN_DSN` | Admin Sentry project |
| `SENTRY_AGENT_DSN` | Agent/API Sentry project |
| `SENTRY_AUTH_TOKEN` | Build-time sourcemap upload only |

## Best Practices

| Practice | Details |
|----------|---------|
| **Identify after auth only** | Never identify anonymous users |
| **Use snake_case events** | Consistent with PostHog conventions |
| **Track outcomes, not clicks** | `work_submitted` not `submit_button_clicked` |
| **Don't track in dev** | Module gates on production environment |
| **Use the shared module** | Never import `posthog-js` directly — use `track()` from shared |
| **Use Sentry for root cause** | Stack, release, suspect commit, and server crash context belong in Sentry |
| **Use PostHog for impact** | Session count, replay, funnels, and user journey context belong in PostHog |

---

## Read-side: PostHog lookup during bug debugging

> **Question library**: the canonical curated-question library lives at `.claude/skills/posthog-questions/SKILL.md` (mirrored at `.agents/skills/posthog-questions/SKILL.md`). It covers both the product/quality lens used here and the growth/BD lens used by `growth-pulse`. Reference questions by name (`errors.recent`, `errors.detail`, `errors.recurring`, `errors.match-bug-report`, `replay.user-sessions`) — never inline raw HogQL.

When you start work on a reported bug, reproduce or probe the failing boundary first, then use PostHog and Sentry for evidence. PostHog answers "how many users/sessions and what path?" Sentry answers "which stack, release, and suspected code path?"

### When to query

- A user-reported bug references a specific surface, error message, or behavior.
- A test fails in a way that hints at a real-world flow you cannot easily reproduce locally (auth race, IndexedDB state, transaction nonce).
- An incident is open and you need to size blast radius (how many sessions, how many users, since when).

Skip the lookup for: pure code-quality bugs, lint failures, build errors, anything reproducible by reading source.

### Primary path: Claude Code PostHog connector + optional Sentry

The Claude Code PostHog connector is the primary surface. Use it directly — do not stand up a custom PostHog MCP server. Curated questions (mirrored from `docs/routines/bug-intake.md`):

1. Recent JS errors grouped by message and URL (window: 7 days unless older incident).
2. Error detail for a specific hash — top-line message, normalized top stack frame, first/last seen, affected-session count, affected-user count, app surface, replay link.
3. Reporter session lookup — only when the reporter identifier is known and consented.
4. Recurring-pattern probe — distinct-session count for an error hash over 30 days.
5. Free-text fuzzy match against recent error messages and event names from the table above.

When Sentry connector/API access exists, pair the PostHog result with Sentry issue lookup against the matching project:

- `green-goods-client` for browser/PWA/editorial issues
- `green-goods-admin` for admin cockpit issues
- `green-goods-agent` for bot/API issues

Allowed shared Sentry evidence: issue ID/shortlink, title/top-line message, normalized top in-app frame, release/environment, first/last seen, event count, affected-user count, and suspect commit SHA. Private Sentry context stays private: event IDs, trace IDs, request headers, breadcrumbs, local variables, replay/session URLs, raw tags, full stacks, IP/geo, emails, wallets, and user identifiers.

Replay URLs, session IDs, distinct IDs, wallet/user identifiers, and reporter identifiers are **private debugging context** — useful to you while triaging, never pasted into a Linear body, Customer Need, PR description, commit message, Discord summary, or any other shared surface. If you need to share evidence with another agent or a human reviewer, share the **PostHog error hash** and the safe-summary fields (error message, affected-session count, first/last seen, app surface, confidence). Anyone with PostHog access can re-fetch the private fields from the hash.

### Signal and Linear routing

- Raw user or telemetry signal goes to Linear Customer Needs using the Customer Signal Handoff
  structure. Keep it as signal unless a steward accepts the work.
- Accepted fixes, QA follow-ups, maintenance work, or product investigations go to Linear Issues
  using the Accepted Product Work structure. Team: Product.
- Accepted research questions, evidence gathering, or recommendations go to Linear Issues using
  the Accepted Research Task structure. Team: Research.
- `.plans` remains the Green Goods execution truth. If a debug handoff or investigation is
  mirrored from `.plans`, include the `.plans` link and label the Linear issue `source:plans`.
- Attach to an active bounded project only when the scope clearly matches. Do not route new work
  into completed/staging umbrella projects such as `Green Goods`, `Coop`, `Network Website`, or
  `Cookie Jar`; otherwise leave the issue unprojected.
- Use only these label namespaces: `protocol:*`, `package:*`, `activity:*`, `task:*`,
  `funding:*`, `source:*`, `agent:*`.
- Replay URLs, session IDs, emails, wallet addresses, distinct IDs, reporter identifiers, and
  private source links stay out of public Linear issue bodies and Customer Need summaries.

### Fallback path: `scripts/agents/posthog-query.ts`

When the connector is unavailable in a local/Codex/non-Claude runtime, fall back to the durable script only if the environment explicitly provides the API-key vars below. Active Claude routines should prefer the connector plus `POSTHOG_PROJECT_ID_APP`, `POSTHOG_PROJECT_ID_ADMIN`, and `POSTHOG_PROJECT_ID_AGENT`.

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

Do not add Sentry MCP or API-key fallback wiring during debugging unless Afo explicitly asks. The codebase is Sentry-ready; connector availability is an environment concern.

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
