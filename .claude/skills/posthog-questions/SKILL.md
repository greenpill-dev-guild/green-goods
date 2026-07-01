---
name: posthog-questions
user-invocable: false
description: Canonical curated-question library for PostHog reads across Green Goods routines and skills. Two lenses (product/quality, growth/BD), one privacy boundary, one shared answer per question. Routines reference questions by name; the connector or fallback script resolves them.
version: "1.2.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-07-01"
last_verified: "2026-07-01"
---

# PostHog Curated Questions

Single source of truth for every PostHog read a routine or interactive skill should need. Routines reference questions **by name** (`errors.recent`, `funnel.onboarding`, etc.) — never paste raw HogQL into a routine prompt. When a question's underlying query needs to evolve, edit it here once and every consumer picks up the change.

## When to use this skill

- Authoring or editing a routine that needs PostHog data — pick a named question instead of writing HogQL.
- Authoring or editing a skill that pulls PostHog evidence (e.g. `/debug`) — reference the same library so privacy boundaries match.
- Reviewing a routine for compliance — every PostHog call should resolve to a name in this file. Raw HogQL outside this file is a `routine-self-audit` violation.
- Designing a new metric — propose a new question entry here first, then wire routines.

## Activation

Use this skill whenever a Green Goods routine, skill, or agent prompt needs PostHog evidence. Treat this file as the registry of allowed question names, privacy modes, output fields, and current invocation paths.

Default flow:

1. Pick the existing named question that answers the need.
2. Use the concrete invocation path documented below.
3. Keep public/shared outputs limited to fields marked public in the question schema.
4. Add a new question here before wiring a new PostHog read elsewhere.

## Question index

All 17 questions at a glance. Names are the stable identifiers consumers reference; each links to its full entry (HogQL, bind variables, output schema, consumers) below. ⚠️ = private-only default, 🚫 = blocked (do not run).

| Question | Lens | Privacy default | Answers |
|---|---|---|---|
| [`errors.recent`](#errorsrecent) | product-quality | public-safe (aggregates) | Recent JS exceptions grouped by message + URL with affected-session counts |
| [`errors.detail`](#errorsdetail) | product-quality | ⚠️ private-only | Full detail for one error hash incl. top stack frame + replay links |
| [`errors.recurring`](#errorsrecurring) | product-quality | public-safe | Distinct-session count per error hash over 30 days (bug-intake roll-up input) |
| [`errors.match-bug-report`](#errorsmatch-bug-report) | product-quality | ⚠️ private-only | Fuzzy match between a verbatim bug-report quote and recent errors/events |
| [`replay.user-sessions`](#replayuser-sessions) | product-quality | ⚠️ private-only | Recent sessions for a known reporter with replay links |
| [`release.error-rate-delta`](#releaseerror-rate-delta) | product-quality | public-safe | Error rate per 1k events, 24h before vs after a deploy |
| [`release.sync-success-rate-delta`](#releasesync-success-rate-delta) | product-quality | public-safe | Offline-job success rate before vs after a deploy |
| [`quality.top-failures`](#qualitytop-failures) | product-quality | public-safe | Top 10 errors ranked by affected-user count |
| [`funnel.onboarding`](#funnelonboarding) | growth-bd | public-safe | Passkey register → garden join → first work submission funnel |
| [`funnel.work-repeat`](#funnelwork-repeat) | growth-bd | public-safe | % of first-time submitters who submit a second work within 7 days |
| [`retention.curve`](#retentioncurve) | growth-bd | public-safe | D1/D7/D30 retention by weekly cohort |
| [`gardens.engagement-summary`](#gardensengagement-summary) | growth-bd | public-safe | Per-garden 7-day active members + work submitted |
| [`gardens.dormant`](#gardensdormant) | growth-bd | public-safe | Gardens with zero work in the last 7/14/30 days |
| [`gardens.operator-activity`](#gardensoperator-activity) | growth-bd | public counts / ⚠️ private operator identity | Work approvals per operator per week, as anonymous aggregates |
| [`actions.template-creation-rate`](#actionstemplate-creation-rate) | growth-bd | 🚫 blocked | Action-template creation rate (required event never fires — do not run) |
| [`failures.conversion-kill`](#failuresconversion-kill) | growth-bd | public-safe | Per-step failure rate for `*_failed` vs `*_success` event pairs |
| [`web.acquisition-summary`](#webacquisition-summary) | growth-bd | public-safe | Sessions by source/UTM medium for grant/BD reporting |

## Architecture (Option C, locked)

Each question has:

- **Name** — `lens.subject` identifier consumers reference (e.g. `funnel.onboarding`).
- **Lens** — `product-quality` (private-default) or `growth-bd` (public-safe-default).
- **Default privacy** — what crosses into a shared surface (Linear body, Discord summary, PR body, public doc) by default.
- **HogQL** — the canonical query string. Used directly by `scripts/agents/posthog-query.ts` and as the source of truth when promoting to a PostHog Saved Insight.
- **Saved-Insight ID** — populated when a human has created a tunable Insight in the PostHog UI for this question. When present, the connector path prefers the Insight; the script path still uses HogQL.
- **Output schema** — exact field names + which fields are public-safe vs private-only.
- **Required emit-side events** — the events the question depends on. If any are absent in production, the question is `blocked` and consumers must skip it gracefully.
- **Used by** — list of routines/skills that reference this question. Updated as new consumers wire in.

> **Promotion rule**: every question starts as HogQL-only. Promote to a Saved Insight only when a human actually wants to tune the underlying query in the PostHog UI. Don't pre-create Insights nobody is going to maintain.

## Calling pattern (for routines and skills)

**Today (2026-05-09): there is no `posthog.run_question(name, vars)` RPC and no `script ask <name>` subcommand yet.** Both are aspirational targets a follow-up plan will build. Until they exist, this is the concrete invocation a routine actually writes:

- **Claude routines and interactive Claude Code work**: use the PostHog connector as the primary path. Switch to the right project (`POSTHOG_PROJECT_ID_APP`, `POSTHOG_PROJECT_ID_ADMIN`, or `POSTHOG_PROJECT_ID_AGENT`) and run the HogQL block from this file verbatim through connector `query-run`. The routine prompt should reference the question by name in its `## PostHog usage` section and point to this file as the source of the HogQL.
  ```
  Run question `funnel.onboarding` (window 30d) via the PostHog connector's
  query-run, using the HogQL block defined under that name in
  .claude/skills/posthog-questions/SKILL.md. Privacy mode: public.
  ```
- **Local/Codex/non-Claude fallback only**: product/quality questions that match a script command (`errors.recent` → `errors`, `errors.detail` → `error-detail`, `errors.recurring` → `recurring`, `errors.match-bug-report` → `match-bug-report`, `replay.user-sessions` → `user-sessions`) may use `scripts/agents/posthog-query.ts` when the connector is unavailable and the local environment explicitly provides `POSTHOG_PROJECT_API_KEY`, single-project `POSTHOG_PROJECT_ID`, and `POSTHOG_HOST`.
  ```bash
  bun scripts/agents/posthog-query.ts errors --recent 24h --privacy public
  bun scripts/agents/posthog-query.ts error-detail <error-hash> --window 7d
  ```

**Aspirational target (build in a follow-up plan):**

```
posthog.run_question("funnel.onboarding", { window: "30d" })
```

The eventual connector wrapper resolves the name against this file: if a Saved-Insight ID is present, it fetches that; otherwise it runs the HogQL string with the named bind variables. The script gains an `ask <name>` mode that reads the same library. Privacy stays the same: pass `privacy: "public"` to suppress private fields up-front rather than redacting after the fact.

Until that wrapper exists, the connector invocation above is what a Claude routine should actually contain. Reviewing a routine: any HogQL block must match a HogQL block in this file verbatim, or it's a `routine-self-audit` violation.

## Privacy boundary

> ⚠️ **Hard boundary — non-negotiable.** Applies to every question below and every consumer (routine, skill, agent), on every shared surface (Linear body, Discord, PR, doc). A question's `public-safe` default never overrides this table. When unsure, treat a field as private.

The same boundary the bug-intake routine uses, applied to every consumer. Never violate this even when a question's default privacy is `public-safe`.

| Field class | Allowed in shared surface (Linear body, Discord, PR, doc) | Private-only |
|---|---|---|
| Aggregate counts (sessions, users, events, conversions, %) | ✅ | |
| Aggregate timestamps (first/last seen, cohort week) | ✅ | |
| Error message (top line, redacted) | ✅ | |
| Normalized top stack frame (no query strings, no path params) | ✅ | |
| App surface (`client` / `admin`) | ✅ | |
| PostHog error hash | ✅ | |
| Garden address / name (when the surface is a per-garden routine that already discloses it) | ✅ | |
| Replay URL | | ✅ |
| Session ID | | ✅ |
| Distinct ID | | ✅ |
| Wallet / smart-account address | | ✅ |
| User name / email / handle | | ✅ |
| Reporter identifier (Discord username, Telegram handle) | | ✅ |
| Full stack frames with paths/query strings | | ✅ |
| IP, UA, geo | | ✅ |
| Any field not explicitly above | | ✅ (default to private when unsure) |

If a question's output would name a single user (one row per `distinct_id`), it is private-only by definition. Aggregations over ≥ 5 users are public-safe.

---

## Product/quality lens

Private-default. The eight bug-intake / debug / release-health questions.

### `errors.recent`

- **Lens**: product-quality
- **Default privacy**: public-safe (aggregate counts only)
- **What it answers**: recent JS exceptions grouped by message + URL with affected-session counts.
- **HogQL**:
  ```sql
  SELECT
    cityHash64(toString(properties.$exception_message), toString(properties.$current_url)) AS error_hash,
    properties.$exception_type AS exception_type,
    properties.$exception_message AS message,
    properties.$current_url AS current_url,
    count(DISTINCT $session_id) AS affected_sessions,
    count(DISTINCT distinct_id) AS affected_users,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen
  FROM events
  WHERE event = '$exception' AND timestamp > now() - interval {window:String}
  GROUP BY error_hash, exception_type, message, current_url
  ORDER BY affected_sessions DESC
  LIMIT 50
  ```
- **Bind variables**: `{ window: "24h" | "7d" | "30d" }` (default `24h`)
- **Output schema**:
  - `error_hash`, `exception_type`, `message`, `current_url` — public
  - `affected_sessions`, `affected_users` — public
  - `first_seen`, `last_seen` — public
- **Required emit-side events**: `$exception` (PostHog auto-captures via `posthog.captureException`)
- **Used by**: `bug-intake` (Phase 1 enrichment), `/debug`

### `errors.detail`

- **Lens**: product-quality
- **Default privacy**: private-only (returns replay URLs and per-session rows)
- **What it answers**: full detail for one error hash including a sample of the top stack frame plus per-session replay links.
- **HogQL**:
  ```sql
  WITH matches AS (
    SELECT *
    FROM events
    WHERE event = '$exception'
      AND timestamp > now() - interval {window:String}
      AND cityHash64(toString(properties.$exception_message), toString(properties.$current_url)) = {error_hash:UInt64}
  )
  SELECT
    properties.$exception_type AS exception_type,
    properties.$exception_message AS message,
    properties.$current_url AS current_url,
    count(DISTINCT $session_id) AS affected_sessions,
    count(DISTINCT distinct_id) AS affected_users,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen,
    any(properties.$exception_stack_trace_raw) AS sample_stack,
    arrayDistinct(groupArray(($session_id, distinct_id))) AS sessions
  FROM matches
  GROUP BY exception_type, message, current_url
  ```
- **Bind variables**: `{ window: "7d", error_hash: 12345 }`
- **Output schema**:
  - `exception_type`, `message`, `current_url`, `affected_sessions`, `affected_users`, `first_seen`, `last_seen` — public
  - `sample_stack` (top frame only, normalized) — public
  - `sessions[].session_id`, `sessions[].distinct_id`, `sessions[].replay_url` — private
- **Required emit-side events**: `$exception`, `$session_id` autoassigned
- **Used by**: `bug-intake` (Phase 1 enrichment), `/debug`

### `errors.recurring`

- **Lens**: product-quality
- **Default privacy**: public-safe
- **What it answers**: distinct-session count per error hash over a 30-day window — the input to bug-intake's recurring-pattern roll-up (≥50 sessions threshold).
- **HogQL**:
  ```sql
  SELECT
    cityHash64(toString(properties.$exception_message), toString(properties.$current_url)) AS error_hash,
    properties.$exception_message AS message,
    count(DISTINCT $session_id) AS sessions_30d,
    count(DISTINCT distinct_id) AS users_30d,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen
  FROM events
  WHERE event = '$exception' AND timestamp > toDateTime({since:String})
  GROUP BY error_hash, message
  HAVING sessions_30d >= {threshold:UInt32}
  ORDER BY sessions_30d DESC
  ```
- **Bind variables**: `{ since: "2026-04-07", threshold: 50 }`
- **Output schema**: all fields public.
- **Required emit-side events**: `$exception`
- **Used by**: `bug-intake` (Phase 4 recurring-pattern roll-up)

### `errors.match-bug-report`

- **Lens**: product-quality
- **Default privacy**: private-only (matches may include single-user evidence)
- **What it answers**: free-text fuzzy match between a verbatim bug-report quote and recent error messages or event names.
- **HogQL**:
  ```sql
  SELECT
    cityHash64(toString(properties.$exception_message), toString(properties.$current_url)) AS error_hash,
    properties.$exception_message AS message,
    properties.$current_url AS current_url,
    count(DISTINCT $session_id) AS affected_sessions,
    max(timestamp) AS last_seen,
    positionUTF8(lower(properties.$exception_message), lower({snippet:String})) AS confidence_signal
  FROM events
  WHERE event = '$exception'
    AND timestamp > now() - interval 14 day
    AND positionUTF8(lower(properties.$exception_message), lower({snippet:String})) > 0
  GROUP BY error_hash, message, current_url
  ORDER BY affected_sessions DESC
  LIMIT 20
  ```
- **Bind variables**: `{ snippet: "stack frame text" }`
- **Output schema**:
  - `error_hash`, `message`, `current_url`, `affected_sessions`, `last_seen`, `confidence_signal` — public
- **Required emit-side events**: `$exception`
- **Used by**: `bug-intake` (Drive Phase 3 fuzzy match), `/debug`

### `replay.user-sessions`

- **Lens**: product-quality
- **Default privacy**: private-only (every field re-identifies a user)
- **What it answers**: recent sessions for a known reporter (distinct ID or wallet) with replay links.
- **HogQL**:
  ```sql
  SELECT
    $session_id AS session_id,
    distinct_id,
    min(timestamp) AS session_start,
    max(timestamp) AS session_end,
    countIf(event = '$exception') AS errors_observed,
    concat('{posthog_host}/replay/', toString($session_id)) AS replay_url
  FROM events
  WHERE timestamp > now() - interval {window:String}
    AND (distinct_id = {user:String} OR properties.wallet_address = {user:String})
  GROUP BY session_id, distinct_id
  ORDER BY session_start DESC
  LIMIT 25
  ```
- **Bind variables**: `{ window: "7d", user: "<distinct-id-or-wallet>" }`
- **Output schema**: every field private. Never copy any of these into a shared surface.
- **Required emit-side events**: any tracked event with `distinct_id`. `wallet_address` person property is set on identify.
- **Used by**: `bug-intake` (Phase 1/2 reporter lookup, when consented), `/debug`

### `release.error-rate-delta`

- **Lens**: product-quality
- **Default privacy**: public-safe
- **What it answers**: error rate per 1k events for a 24h window before vs after a given deploy timestamp.
- **HogQL**:
  ```sql
  WITH
    {deploy_at:String} AS deploy_at,
    toDateTime(deploy_at) - interval 24 hour AS before_start,
    toDateTime(deploy_at) AS deploy_dt,
    toDateTime(deploy_at) + interval 24 hour AS after_end
  SELECT
    sumIf(1, event = '$exception' AND timestamp >= before_start AND timestamp < deploy_dt) AS errors_before,
    sumIf(1, timestamp >= before_start AND timestamp < deploy_dt) AS events_before,
    sumIf(1, event = '$exception' AND timestamp >= deploy_dt AND timestamp < after_end) AS errors_after,
    sumIf(1, timestamp >= deploy_dt AND timestamp < after_end) AS events_after,
    if(events_before > 0, errors_before * 1000.0 / events_before, 0) AS rate_per_1k_before,
    if(events_after > 0, errors_after * 1000.0 / events_after, 0) AS rate_per_1k_after,
    rate_per_1k_after - rate_per_1k_before AS delta_per_1k
  FROM events
  WHERE timestamp >= before_start AND timestamp < after_end
  ```
- **Bind variables**: `{ deploy_at: "2026-05-07T12:00:00Z" }`
- **Output schema**: every field public.
- **Required emit-side events**: `$exception` plus any tracked event for the volume denominator.
- **Used by**: deferred to follow-up `release-health` plan; documented here so the question is ready when needed.

### `release.sync-success-rate-delta`

- **Lens**: product-quality
- **Default privacy**: public-safe
- **What it answers**: offline-job success rate before vs after a deploy. Companion to `release.error-rate-delta` for the offline-first pipeline.
- **HogQL**:
  ```sql
  WITH
    {deploy_at:String} AS deploy_at,
    toDateTime(deploy_at) - interval 24 hour AS before_start,
    toDateTime(deploy_at) AS deploy_dt,
    toDateTime(deploy_at) + interval 24 hour AS after_end
  SELECT
    countIf(event = 'offline_job_processed' AND timestamp >= before_start AND timestamp < deploy_dt) AS processed_before,
    countIf(event IN ('offline_job_failed','offline_job_permanently_failed') AND timestamp >= before_start AND timestamp < deploy_dt) AS failed_before,
    countIf(event = 'offline_job_processed' AND timestamp >= deploy_dt AND timestamp < after_end) AS processed_after,
    countIf(event IN ('offline_job_failed','offline_job_permanently_failed') AND timestamp >= deploy_dt AND timestamp < after_end) AS failed_after,
    if(processed_before + failed_before > 0, processed_before * 100.0 / (processed_before + failed_before), 0) AS success_pct_before,
    if(processed_after + failed_after > 0, processed_after * 100.0 / (processed_after + failed_after), 0) AS success_pct_after,
    success_pct_after - success_pct_before AS delta_pct
  FROM events
  WHERE timestamp >= before_start AND timestamp < after_end
  ```
- **Bind variables**: `{ deploy_at: "2026-05-07T12:00:00Z" }`
- **Output schema**: every field public.
- **Required emit-side events**: `offline_job_processed`, `offline_job_failed`, `offline_job_permanently_failed` (all present today, `packages/shared/src/modules/job-queue/job-analytics.ts`).
- **Used by**: deferred to follow-up `release-health` plan.

### `quality.top-failures`

- **Lens**: product-quality
- **Default privacy**: public-safe
- **What it answers**: the top 10 errors in a window, ranked by affected-user count rather than session count (better signal for prioritization).
- **HogQL**:
  ```sql
  SELECT
    cityHash64(toString(properties.$exception_message), toString(properties.$current_url)) AS error_hash,
    properties.$exception_type AS exception_type,
    properties.$exception_message AS message,
    properties.$current_url AS current_url,
    count(DISTINCT distinct_id) AS affected_users,
    count(DISTINCT $session_id) AS affected_sessions,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen
  FROM events
  WHERE event = '$exception' AND timestamp > now() - interval {window:String}
  GROUP BY error_hash, exception_type, message, current_url
  ORDER BY affected_users DESC
  LIMIT 10
  ```
- **Bind variables**: `{ window: "7d" }`
- **Output schema**: every field public.
- **Required emit-side events**: `$exception`
- **Used by**: deferred (`health-watch` or a future release-health digest).

---

## Growth/BD lens

Public-safe-default. Aggregates only — never names a single user.

### `funnel.onboarding`

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: passkey register → garden join → first work submission funnel over a window.
- **Identity stitching note**: PostHog assigns an anonymous UUID `distinct_id` on first page-load and switches it to the wallet/passkey-credential `distinct_id` after `posthog.identify()` in the auth flow. **Joins must be by `person_id`** (which stitches anonymous + identified IDs at the person level), not raw `distinct_id` — joining by `distinct_id` produces 0% conversion across the auth boundary even when conversions are happening. Verified empirically 2026-05-09 against the App project (163591): 7 person registers + 6 person joins in 30d, 0 overlap when joined by `distinct_id`; correct number when joined by `person_id`.
- **HogQL**:
  ```sql
  WITH
    register_users AS (
      SELECT person_id, min(timestamp) AS register_at
      FROM events
      WHERE event = 'auth_passkey_register_success'
        AND timestamp > now() - interval {window:String}
      GROUP BY person_id
    ),
    join_users AS (
      SELECT r.person_id, min(e.timestamp) AS join_at
      FROM register_users r
      JOIN events e ON e.person_id = r.person_id
      WHERE e.event IN ('garden_join_success', 'garden_auto_join_success')
        AND e.timestamp >= r.register_at
      GROUP BY r.person_id
    ),
    first_work AS (
      SELECT j.person_id, min(e.timestamp) AS first_work_at
      FROM join_users j
      JOIN events e ON e.person_id = j.person_id
      WHERE e.event = 'work_submission_success'
        AND e.timestamp >= j.join_at
      GROUP BY j.person_id
    )
  SELECT
    (SELECT count() FROM register_users) AS registered,
    (SELECT count() FROM join_users) AS joined_garden,
    (SELECT count() FROM first_work) AS submitted_first_work,
    if((SELECT count() FROM register_users) > 0, (SELECT count() FROM join_users) * 100.0 / (SELECT count() FROM register_users), 0) AS register_to_join_pct,
    if((SELECT count() FROM join_users) > 0, (SELECT count() FROM first_work) * 100.0 / (SELECT count() FROM join_users), 0) AS join_to_first_work_pct
  ```
- **Bind variables**: `{ window: "30d" }`
- **Output schema**: every field public.
- **Required emit-side events**: `auth_passkey_register_success`, `garden_join_success`, `garden_auto_join_success`, `work_submission_success` (all present today, `packages/shared/src/modules/app/analytics-events.ts`).
- **Cohort caveat**: this funnel only tracks the new-user cohort within `{window}`. Returning users (registered before the window) who join gardens during the window are intentionally excluded — that's a different question. If `registered > 0` but `register_to_join_pct == 0`, verify by comparing to the raw `garden_join_success` count over the same window: a non-zero raw count with a zero funnel percentage usually means joiners are returning users from outside the window, not a product breakage.
- **Used by**: `growth-pulse` (App project, id 163591).

### `funnel.work-repeat`

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: of users whose first work submission was in the past 30 days, what percentage submitted a second work within 7 days?
- **Identity stitching note**: same as `funnel.onboarding` — joins are by `person_id` so anonymous→identified transitions don't break the cohort.
- **HogQL**:
  ```sql
  WITH first_subs AS (
    SELECT person_id, min(timestamp) AS first_at
    FROM events
    WHERE event = 'work_submission_success'
      AND timestamp > now() - interval 60 day
    GROUP BY person_id
    HAVING first_at > now() - interval 30 day
  ),
  repeat_subs AS (
    SELECT f.person_id
    FROM first_subs f
    JOIN events e ON e.person_id = f.person_id
    WHERE e.event = 'work_submission_success'
      AND e.timestamp > f.first_at
      AND e.timestamp <= f.first_at + interval 7 day
    GROUP BY f.person_id
  )
  SELECT
    (SELECT count() FROM first_subs) AS first_time_users,
    (SELECT count() FROM repeat_subs) AS repeat_within_7d,
    if((SELECT count() FROM first_subs) > 0, (SELECT count() FROM repeat_subs) * 100.0 / (SELECT count() FROM first_subs), 0) AS repeat_pct
  ```
- **Bind variables**: none (window is fixed at 30d / 7d to keep the metric stable across runs).
- **Output schema**: every field public.
- **Required emit-side events**: `work_submission_success`.
- **Used by**: `growth-pulse` (App project, id 163591).

### `retention.curve`

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: D1 / D7 / D30 retention by weekly cohort — what percentage of users from cohort week W returned in the N-day window after their first session?
- **HogQL**:
  ```sql
  WITH first_seen AS (
    SELECT distinct_id, min(toDate(timestamp)) AS first_day
    FROM events
    WHERE timestamp > now() - interval 60 day
    GROUP BY distinct_id
  ),
  cohorts AS (
    SELECT
      toMonday(first_day) AS cohort_week,
      distinct_id,
      first_day
    FROM first_seen
  )
  SELECT
    c.cohort_week,
    count(DISTINCT c.distinct_id) AS cohort_size,
    countDistinctIf(c.distinct_id, e_d1.distinct_id != '') AS returned_d1,
    countDistinctIf(c.distinct_id, e_d7.distinct_id != '') AS returned_d7,
    countDistinctIf(c.distinct_id, e_d30.distinct_id != '') AS returned_d30
  FROM cohorts c
  LEFT JOIN events e_d1 ON e_d1.distinct_id = c.distinct_id
    AND toDate(e_d1.timestamp) > c.first_day AND toDate(e_d1.timestamp) <= c.first_day + 1
  LEFT JOIN events e_d7 ON e_d7.distinct_id = c.distinct_id
    AND toDate(e_d7.timestamp) > c.first_day AND toDate(e_d7.timestamp) <= c.first_day + 7
  LEFT JOIN events e_d30 ON e_d30.distinct_id = c.distinct_id
    AND toDate(e_d30.timestamp) > c.first_day AND toDate(e_d30.timestamp) <= c.first_day + 30
  GROUP BY c.cohort_week
  ORDER BY c.cohort_week DESC
  LIMIT 8
  ```
- **Bind variables**: none.
- **Output schema**: every field public. (HogQL above is a sketch — promote to Saved Insight when tuning is needed; PostHog has a native retention insight that may be cleaner.)
- **Required emit-side events**: any tracked event with `distinct_id`.
- **Used by**: deferred (follow-up routines / dashboards).

### `gardens.engagement-summary`

- **Lens**: growth-bd
- **Default privacy**: public-safe (per-garden numbers; garden addresses are already public on-chain)
- **What it answers**: per-garden 7-day active members + 7-day work submitted.
- **HogQL**:
  ```sql
  SELECT
    properties.garden_address AS garden_address,
    properties.garden_name AS garden_name,
    count(DISTINCT distinct_id) AS active_members_7d,
    countIf(event = 'work_submission_success') AS work_submitted_7d,
    countIf(event = 'work_approval_success') AS work_approved_7d
  FROM events
  WHERE timestamp > now() - interval 7 day
    AND properties.garden_address IS NOT NULL
    AND event IN ('work_submission_success', 'work_approval_success', 'garden_join_success', 'garden_auto_join_success')
  GROUP BY garden_address, garden_name
  ORDER BY work_submitted_7d DESC
  ```
- **Bind variables**: none.
- **Output schema**:
  - `garden_address`, `garden_name`, `active_members_7d`, `work_submitted_7d`, `work_approved_7d` — public
- **Required emit-side events**: `work_submission_success`, `work_approval_success`, `garden_join_success`, `garden_auto_join_success` (all present; all carry `garden_address`).
- **Used by**: `growth-pulse` (App project, id 163591).

### `gardens.dormant`

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: gardens with zero work submitted in the last 7 / 14 / 30 days. Drives the `#498` dormancy signal and Season-One health awareness.
- **HogQL**:
  ```sql
  WITH known_gardens AS (
    SELECT DISTINCT properties.garden_address AS garden_address, properties.garden_name AS garden_name
    FROM events
    WHERE event = 'admin_garden_create_success' OR event IN ('garden_join_success', 'garden_auto_join_success')
  ),
  recent_work AS (
    SELECT
      properties.garden_address AS garden_address,
      max(timestamp) AS last_work_at
    FROM events
    WHERE event = 'work_submission_success'
    GROUP BY garden_address
  )
  SELECT
    g.garden_address,
    g.garden_name,
    coalesce(toString(rw.last_work_at), 'never') AS last_work_at,
    if(rw.last_work_at IS NULL OR rw.last_work_at < now() - interval 30 day, '30d+',
       if(rw.last_work_at < now() - interval 14 day, '14d+',
          if(rw.last_work_at < now() - interval 7 day, '7d+', 'active'))) AS dormancy_band
  FROM known_gardens g
  LEFT JOIN recent_work rw ON rw.garden_address = g.garden_address
  WHERE dormancy_band != 'active'
  ORDER BY dormancy_band DESC, last_work_at ASC
  ```
- **Bind variables**: none.
- **Output schema**: all public.
- **Required emit-side events**: `admin_garden_create_success`, `garden_join_success`, `garden_auto_join_success`, `work_submission_success`.
- **Used by**: `growth-pulse` (App project, id 163591).

### `gardens.operator-activity`

- **Lens**: growth-bd
- **Default privacy**: public-safe (counts), private-only (operator wallet/address)
- **What it answers**: work approvals per operator per week, surfaced as `gardens × operator-count × approvals` aggregates without naming the operator.
- **HogQL**:
  ```sql
  SELECT
    properties.garden_address AS garden_address,
    count(DISTINCT distinct_id) AS active_operators_7d,
    countIf(event = 'work_approval_success') AS approvals_7d,
    countIf(event = 'work_rejection_success') AS rejections_7d
  FROM events
  WHERE timestamp > now() - interval 7 day
    AND event IN ('work_approval_success', 'work_rejection_success')
  GROUP BY garden_address
  ORDER BY approvals_7d DESC
  ```
- **Bind variables**: none.
- **Output schema**: all public. (Per-operator detail must be queried with `replay.user-sessions` and stays private.)
- **Required emit-side events**: `work_approval_success`, `work_rejection_success`.
- **Used by**: `growth-pulse` (App project, id 163591).

### `actions.template-creation-rate`

> 🚫 **BLOCKED (2026-05-24)** — do not consume. Its required event `admin_action_create_success` is defined at `packages/shared/src/modules/app/analytics-events.ts:111` but has **no tracker factory and no call site** (the entire `admin_action_*` constant family is orphaned), so it has never fired and the HogQL returns zero forever. Consumers (e.g. `growth-pulse`) must **not** run this question or fire an "action template stall" threshold from it. Unblock by either wiring `trackAdminActionCreateSuccess` (a `createTracker` factory) + calling it in `packages/admin/src/views/Actions/CreateAction.tsx`, **or** repointing the signal at the Envio indexer `Action` entity (`createdAt`), the on-chain source of truth. `growth-pulse` uses the indexer substitute as of 2026-W21.

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: action-template creation rate over time — the signal behind `#473` (zero new action templates in 23 days).
- **HogQL**:
  ```sql
  SELECT
    toMonday(toDate(timestamp)) AS week,
    count() AS templates_created
  FROM events
  WHERE event = 'admin_action_create_success'
    AND timestamp > now() - interval 12 week
  GROUP BY week
  ORDER BY week DESC
  ```
- **Bind variables**: none.
- **Output schema**: all public.
- **Required emit-side events**: `admin_action_create_success`.
- **Used by**: `growth-pulse` (Admin project, id 262122).

### `failures.conversion-kill`

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: per-step failure rate for the conversion-killing events (`*_failed` paired with `*_success`). Surfaces product breakages that vanish from a success-only funnel. Empirically (2026-05-09, App project) the strongest growth signal in the dataset: `garden_join` ~75% failure rate, `work_submission` ~70%, `work_approval` 100% (zero successes), `auth_passkey_register` ~27%.
- **HogQL**:
  ```sql
  SELECT
    multiIf(
      event LIKE 'garden_join_%', 'garden_join',
      event LIKE 'work_submission_%', 'work_submission',
      event LIKE 'work_approval_%', 'work_approval',
      event LIKE 'auth_passkey_register_%', 'auth_passkey_register',
      NULL
    ) AS step,
    countIf(event LIKE '%_success') AS success_count,
    countIf(event LIKE '%_failed') AS failed_count,
    countIf(event LIKE '%_success' OR event LIKE '%_failed') AS total_attempts,
    if(
      countIf(event LIKE '%_success' OR event LIKE '%_failed') > 0,
      countIf(event LIKE '%_failed') * 100.0 / countIf(event LIKE '%_success' OR event LIKE '%_failed'),
      0
    ) AS failure_pct
  FROM events
  WHERE timestamp > now() - interval {window:String}
    AND event IN (
      'garden_join_success', 'garden_join_failed',
      'work_submission_success', 'work_submission_failed',
      'work_approval_success', 'work_approval_failed',
      'auth_passkey_register_success', 'auth_passkey_register_failed'
    )
  GROUP BY step
  HAVING step IS NOT NULL
  ORDER BY failure_pct DESC
  ```
- **Bind variables**: `{ window: "7d" }` (default; `30d` for monthly digest, `1d` for hot triage).
- **Output schema**: every field public.
- **Required emit-side events**: the four `*_started/_success/_failed` event triplets above (all present in `packages/shared/src/modules/app/analytics-events.ts`). Note that `work_approval_success` may live primarily on the Admin project (262122) — when this question runs against the App project, `work_approval` will report 100% failure even when admin successes exist. Run the query separately against project 262122 for the admin-side success counts and merge in the routine.
- **Anomaly thresholds (consumer)**: failure rate > 50% AND absolute failed count ≥ 5 over the window → file a Linear anomaly Issue. 100% failure with absolute count ≥ 5 → P2/urgent. The thresholds catch real product breakage rather than tiny-N noise.
- **Used by**: `growth-pulse` (anomaly detection, replaces sole reliance on `funnel.onboarding`).

### `web.acquisition-summary`

- **Lens**: growth-bd
- **Default privacy**: public-safe
- **What it answers**: sessions by source/UTM medium in the last window — for grant impact narratives and BD reporting.
- **HogQL**:
  ```sql
  SELECT
    coalesce(properties.utm_source, properties.$initial_referrer_host, 'direct') AS source,
    coalesce(properties.utm_medium, '') AS medium,
    count(DISTINCT $session_id) AS sessions,
    count(DISTINCT distinct_id) AS users
  FROM events
  WHERE event = '$pageview'
    AND timestamp > now() - interval {window:String}
  GROUP BY source, medium
  ORDER BY sessions DESC
  LIMIT 25
  ```
- **Bind variables**: `{ window: "30d" }`
- **Output schema**: all public.
- **Required emit-side events**: `$pageview` (PostHog auto-captures).
- **Used by**: deferred (`guild-grant-scout` follow-up).

---

## Blocked / pending emit-side coverage

The following questions would expand coverage but require events that don't exist yet. Listed here so a future emit-side plan can pick them up:

- `funnel.invite-acceptance` — needs `garden_invite_sent` and `garden_invite_accepted`. The current `garden_join_success` and `garden_auto_join_success` events fire after the invite link is followed, but the invite-creation step itself isn't tracked. Add via `createTracker<T>` in `packages/shared/src/modules/app/analytics-events.ts` if invitation conversion becomes a key metric.
- `funnel.first-work-from-invite` — depends on the same invitation events plus a stable `first_work` derivation. The derivation is computable from `work_submission_success` (`min(timestamp) per distinct_id`), so no new event is strictly required, but a `first_work_submitted` event would let cohort joins be cheaper.

Do not write a question for these until the underlying events ship. **Consuming** (running the HogQL of) a `blocked` question from a routine is a `routine-self-audit` violation; **documenting** a question's blocked/deprecated status in routine prose (as `growth-pulse` now does for `actions.template-creation-rate`) is expected and not a violation.

**Blocked in place (written, but the required event never fires):**

- `actions.template-creation-rate` — depends on `admin_action_create_success`, which is defined but unwired (no tracker, no call site; the whole `admin_action_*` family is orphaned constants). Marked 🚫 BLOCKED in its entry above (2026-05-24). Wire the event (`trackAdminActionCreateSuccess` + a call in `CreateAction.tsx`) or repoint the question at the indexer `Action` entity before any consumer uses it again.

## Routine integration checklist

A routine wiring this library should:

1. List the question names it consumes in a `## PostHog usage` section near the top of its prompt.
2. State each connector call with the named question, project env var, bind variables, and privacy mode, e.g. `funnel.onboarding` on `POSTHOG_PROJECT_ID_APP` with `{ window: "30d" }`, privacy `public`.
3. Map output fields to the routine's Discord post / Linear body / Drive doc, **only** using fields marked public in the question's output schema (or pass `privacy: "public"` to the call).
4. State a fail-soft behavior: if the question returns an error or no data, log it in the routine's failure block and continue rather than aborting the run.
5. Never inline raw HogQL; never invent a question name not in this file. Both are `routine-self-audit` violations once Phase 3 lands.

## Anti-Patterns

- Inlining raw HogQL in routine prompts when a named question already exists.
- Adding a routine-specific PostHog query outside this file instead of promoting it to a named question first.
- Sharing replay URLs, session IDs, distinct IDs, wallet addresses, reporter identifiers, or full stack/query-string details in public surfaces.
- Treating aspirational `posthog.run_question(...)` examples as callable runtime until the wrapper actually exists.
- Marking a question public-safe when it returns one row per user or any single-user evidence.

## Related Skills

- `debug` uses product-quality questions for bug investigation and reporter/session lookup.
- `ops` owns routine setup, cloud-run configuration, and validation of automation wiring.
- `plan` owns follow-up implementation planning when a new question needs emit-side events or a wrapper script.

## Versioning

Bump the file's `version:` in front matter when:

- Adding or removing a question (consumers may break).
- Changing a question's HogQL in a way that alters the output schema (consumers must re-validate).
- Changing the privacy boundary (consumers must re-audit their public surfaces).

Pure HogQL refactors that preserve the output schema do not need a bump but should record a one-line note in the routine self-audit log.
