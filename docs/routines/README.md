# Claude Routines (Green Goods)

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's active configuration lives at [claude.ai/code/routines](https://claude.ai/code/routines) under Afo's personal Anthropic Pro account; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

Guild-level routines live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). This directory holds only the green-goods-scoped routines.

## Portfolio

| File | Status | Cadence | Channel | Issue surface |
|---|---|---|---|---|
| `bug-intake.md` | active | M/W/F 04:00 | `#bug-report` (per-capture acks for bug-source) + `#product` (idea-source acks + daily summary) | Linear Customer Needs (raw signal); accepted bugs become unprojected Linear Product Issues |
| `health-watch.md` | active | Daily M-F 07:30 | `#engineering` (red only) | Linear Product Issues for accepted operational health work (unprojected) |
| `growth-pulse.md` | active | Mon 09:00 weekly | `#growth` + `#funding` cross-post | Linear Product Issues for accepted anomalies (unprojected) + weekly digest as a Linear initiative status update (Sustainability & Monetization) |
| `qa-triage-pulse.md` | active | Wed 21:00 UTC = 13:00 PST / 14:00 PDT (3h after the 10am PST Build Sync start) | `#product` (Discord summary, @mention when there's something to triage) | Linear Customer Needs only (pre-staged, label `source:qa-triage-pulse` + `qa-sync:<date>`); `/qa-triage` promotes them to Issues + QA-sheet rows interactively. Routine id: `trig_01GSagDiEV9Y8QTBzKeZsPSw` |
| `pr-review.md` | active | event-driven (PR open) | inline on PR | n/a |

That's it — four scheduled cadences plus one event-driven, all cloud routines hosted at [claude.ai/code/routines](https://claude.ai/code/routines). Anything else previously in this folder (engineering-pulse, plan-executor, hotfix, drift-watch, metrics) has been removed: cut from the portfolio or converted to Claude Code skills (`/plan`, `/debug`).

## Connector Matrix

| Routine | Connectors | Why each |
|---|---|---|
| `bug-intake` | Google Drive, Linear, PostHog, Vercel; Sentry-ready when connector/API access exists | Drive = meeting-note intake · Linear = Customer Need (raw signal) + accepted-bug Issue surface · PostHog = telemetry/product-impact enrichment · Sentry = stack/release/root-cause enrichment · Vercel = deploy correlation (commit + diff that shipped within 48h before each report) |
| `health-watch` | Google Calendar, Linear, PostHog, Vercel; Sentry-ready when connector/API access exists | Calendar = context that adjusts severity · Linear = accepted operational health Issues (unprojected Product) · PostHog = client-side `$exception` spike detection + error correlation · Sentry = release regression and agent/API crash context · Vercel = deploy/runtime/web-vitals signal feeding `activity:qa` Issues. Also probes the agent's unauthenticated `/health` via `BOT_API_URL` (env var, not a connector). |
| `growth-pulse` | Google Calendar, Linear, PostHog | Calendar = WoW context · Linear = accepted-anomaly Issue surface (unprojected Product) · PostHog = product/growth metrics via curated questions. Drive and Miro are intentionally not wired here; Vercel is also intentionally not wired because Vercel Web Analytics overlaps with PostHog and would create dual-source drift. |
| `qa-triage-pulse` | Google Drive, Linear, PostHog, Vercel | Drive = the Wed Build Sync's Gemini notes · Linear = Customer Need pre-stage surface (raw signal, unprojected) · PostHog = per-surface telemetry cross-reference · Vercel = deploy correlation gated on PostHog-matched items only (anchored to `first_seen`, skipped for items without telemetry signal). |
| `pr-review` | Vercel | Preview deployment status + Lighthouse delta. Inline review commentary, not a hard invariant. |

Gmail is intentionally NOT wired on any GG routine (personal-inbox pollution risk).

## Channel mapping

| Channel | Used by | Why |
|---|---|---|
| `#bug-report` (DISCORD_BUGS_CHANNEL_ID) | bug-intake (Phase 1 ingest source + per-capture acks for bug-source records) | dedicated bug-report feed; reporter ack surface for Telegram bug-topic captures |
| `#product` (DISCORD_PRODUCT_CHANNEL_ID) | bug-intake (idea-source per-capture acks + daily summary), qa-triage-pulse (Wed pre-stage summary) | user-facing concerns + ideas |
| `#growth` (DISCORD_GROWTH_CHANNEL_ID) | growth-pulse (weekly digest highlights) | growth / funnel / retention / action-template pulse |
| `#engineering` (DISCORD_ENGINEERING_CHANNEL_ID) | health-watch (red only) | operational health status — engineering-focused (indexer / Vercel / contracts / agent uptime / client errors) |
| `#funding` (DISCORD_FUNDING_CHANNEL_ID) | growth-pulse cross-post (when grant-relevant) | grant relevance only |
| inline on PR | pr-review | review surface |

`#engineering` is health-watch's home channel (operational health status — indexer / Vercel / contracts / agent uptime / client errors). Other code-local engineering signals still come from the user reading PRs and Linear, not from a routine.

## Notification policy

Routines @mention Afo only when his action is required (via `DISCORD_USER_ID_AFO` env var):

- `bug-intake` — when its own bug-intake-sourced Issues awaiting triage (raw-signal tracking + accepted bugs) exceed 3, or when a setup failure (missing Linear project/label, Linear auth error, or a Telegram intake auth failure) needs attention
- `health-watch` — on real (🔴) anomalies only
- `growth-pulse` — when an anomaly is opened in Linear OR a setup failure needs attention
- `qa-triage-pulse` — when ≥1 Customer Need was pre-staged from the Wednesday Build Sync (signal that `/qa-triage` is ready to run) OR a Linear/Drive setup failure needs attention. Silent on quiet weeks.

`pr-review` posts inline on the PR; the GitHub mention surface is already explicit and no Discord ping is needed. Healthy weekly heartbeats with zero anomalies = no @mention.

## Conventions

- All routine PRs target `develop`. Hotfix-style flows (same-day p2 fixes to `main`) live in the `/debug` skill, not in this folder.
- All routine branches use `claude/<routine-name>/<topic>`.
- Loop prevention on `pr-review`: filter on `head_branch` starting with `claude/` (NOT on author — routine PRs carry the user's GitHub author per the docs).
- **Linear is the durable backlog.** GitHub is for PRs and code review only — routines never file GitHub Issues, never write to GitHub Projects, and never apply GitHub Project iteration/Sprints fields. The retired GitHub Project #4 / Bug Board flows (and the `Sprints` field they depended on) are out of scope for any active routine.

## Scope discipline

Two GG routines read Google Drive: `bug-intake` (meeting-note enrichment across all team docs, with a folder allow-list and content-rejection list) and `qa-triage-pulse` (single-purpose — only the Wednesday Build Sync's Gemini notes, narrower title-pattern match). `growth-pulse` intentionally does not read Drive (calendar enrichment alone is enough; broader meeting notes are owned by `guild-weekly-synthesis`).

Every Discord post in a routine is preceded by a `Channel guard` that pins the post target to one env-var-driven channel. If the env var is unset, the routine logs and skips that post — it does not pick an alternate channel.

## Labels in use

All routine writes use the canonical Linear label scheme. Old vocabularies (`area:*`, `work:*`, `migration:*`, `automation:*`, `health:*`, `grant:*`, `source:linear`) are retired — do not reintroduce them.

### Canonical Linear labels

| Label family | Values used by GG routines | Purpose |
|---|---|---|
| `protocol:*` | `protocol:green-goods` | Protocol/product — every routine record carries this. (Cookie Jar work routes here too — Cookie Jar is a completed Linear project and not a separate protocol.) |
| `package:*` | `package:client`, `package:admin`, `package:shared`, `package:contracts`, `package:indexer`, `package:agent`, `package:docs` | Affected code surface (replaces old `area:*`). Use the inferred package only when the surface is known; omit if unclear. |
| `activity:*` | Routines apply: `activity:qa` (bug fixes, anomaly review, operational health validation), `activity:maintenance` (polish/cleanup that isn't a user-visible defect). The full Linear taxonomy also includes `activity:research`, `activity:architecture`, `activity:build`, `activity:design` — those are human-applied and not used by GG routines. |
| `task:*` | Routines apply when clear: `task:evidence`, `task:funding-pathway`, `task:access-participation`, `task:reputation-identity`, `task:data-input`, `task:local-onboarding`, `task:evaluator-review`. Omit if the work doesn't clearly map to one of these task pathways. |
| `source:*` | `source:discord`, `source:telegram`, `source:drive` | Provenance of the originating signal (Customer Needs always carry this; Issues carry it when the originating provenance still matters). |
| `agent:*` | `agent:routine` (always) | Routine-authored provenance. Optionally pair with `agent:claude` to identify the agent that ran the routine when that distinction matters. Provenance only, not human priority. |

The dispatch labels `automation:claude` / `automation:codex` (legacy GitHub-era handoff flags) and the `work:polish` / `work:customer-need` / `area:*` / `health:*` / `grant:*` labels are not used. GitHub Project #4 and its `automated/claude` + `health:*` label set are retired entirely; no active routine writes to a GitHub Issue surface.

## Bot API environment

Routines that consume Telegram captures need the agent API surface only:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `bug-intake` (read + claim + status updates via `/api/messages?inferred_type=bug|idea` — needs `BOT_API_TOKEN`; no Telegram-side ack, reporters get acknowledged via the per-capture Discord post in `#bug-report` or `#product`). `health-watch` uses **only** the unauthenticated `/health` + `/ready` endpoints for an uptime probe — no token, never `/api/*`.

Capture scope is **agent-side only** (two Fly.io secrets — one per topic type):

```
TELEGRAM_BUGS_TOPIC=<chat_id>_<thread_id>      # e.g. -1002847752257_311
TELEGRAM_IDEAS_TOPIC=<chat_id>_<thread_id>     # e.g. -1002847752257_312
```

The routine never sees these — it queries `/api/messages?inferred_type=bug|idea` and the agent's mapping (env-var name → `inferredType`) decides which threads contribute. Adding a new topic type later is a one-line code change in the agent's `CAPTURE_TYPE_ENV_VARS` map plus a new Fly secret; nothing changes on the routine side.

## PostHog environment

Green Goods uses three PostHog projects (org-level connector scope, switch-project between them):

| Project | ID | Surfaces | Used by |
|---|---|---|---|
| **App** | `163591` | Client + PWA + editorial website (single ingest target — editorial-to-PWA lineage stays a within-project query) | `growth-pulse` (primary), `bug-intake` (primary), `qa-triage-pulse` (PWA/website-surface items), `health-watch` (errors) |
| **Admin** | `262122` | Operator cockpit / admin web app | `growth-pulse` (`actions.template-creation-rate` only), `bug-intake` (admin-route reports), `qa-triage-pulse` (admin-surface items) |
| **Agent** | `262124` | Bot/messaging runtime (Telegram + future WhatsApp/SMS) | `bug-intake` (Telegram-source reports) |

The PostHog connector is the primary access path. The connector key has a project scope set per-project at OAuth time — confirm with `switch-project` + a 1-event test query before assuming a routine can read a given project. A routine that returns zero events on a known-busy project (e.g., App over 30d) should treat the result as a wiring failure (out-of-scope or wrong project ID), not a real anomaly.

Cloud routines set the project ID env vars below and reference the right one per query:

| Variable | Value | Used for |
|---|---|---|
| `POSTHOG_PROJECT_ID_APP` | `163591` | App/client/PWA/editorial queries |
| `POSTHOG_PROJECT_ID_ADMIN` | `262122` | Admin cockpit queries |
| `POSTHOG_PROJECT_ID_AGENT` | `262124` | Agent/bot-channel queries |

Do not add `POSTHOG_PROJECT_API_KEY`, single-project `POSTHOG_PROJECT_ID`, or `POSTHOG_HOST` to the active Claude routine env unless you are deliberately enabling the local fallback script. Those variables belong to `scripts/agents/posthog-query.ts` for non-Claude/Codex/local fallback reads; connector-backed routines should only need the connector plus the three project IDs above.

## Sentry environment

Sentry complements PostHog; it does not replace it. PostHog remains the product/session/replay impact surface. Sentry is for stack traces, release regression, suspect commits, and server-side agent/API crashes. The browser apps initialize Sentry from public DSNs, while the agent uses a server-only DSN.

| Variable | Value / purpose |
|---|---|
| `SENTRY_ORG` | Sentry org slug, default `greenpill` |
| `SENTRY_CLIENT_PROJECT` | `green-goods-client` |
| `SENTRY_ADMIN_PROJECT` | `green-goods-admin` |
| `SENTRY_AGENT_PROJECT` | `green-goods-agent` |
| `SENTRY_PROJECT` | Supported Sentry/Vercel integration project slug fallback; app-specific project vars win |
| `VITE_SENTRY_CLIENT_DSN` | Preferred public browser DSN for the client/PWA |
| `VITE_SENTRY_ADMIN_DSN` | Preferred public browser DSN for admin |
| `VITE_SENTRY_DSN` | Supported generic Vite/browser DSN fallback |
| `NEXT_PUBLIC_SENTRY_DSN` / `PUBLIC_SENTRY_DSN` | Supported compatibility aliases for Sentry/Vercel or framework-shaped public DSNs |
| `SENTRY_CLIENT_DSN` | Supported Vercel/Sentry integration fallback for the client/PWA |
| `SENTRY_ADMIN_DSN` | Supported Vercel/Sentry integration fallback for admin |
| `SENTRY_DSN` | Supported Vercel project-scoped fallback for client/admin builds and agent runtime fallback |
| `SENTRY_AGENT_DSN` | Preferred server-only agent/API DSN |
| `SENTRY_AUTH_TOKEN` | Build-time Sentry source-map upload token; required only for the current Sentry upload path and never exposed to browser runtime |

Browser builds never expose `SENTRY_AUTH_TOKEN`. The client and admin Vite configs read
generic Sentry integration DSNs only at build time and inject them into the existing
`VITE_SENTRY_*` runtime keys. The Vercel/Sentry integration's generic `SENTRY_DSN`
is accepted by each package-specific Vite config only as a last-resort fallback, and only
when `VERCEL_PROJECT_ID` matches that app's known Green Goods project — so a linked Vercel
project picks up its DSN without duplicate `VITE_` variables, while a repo-root `SENTRY_DSN`
cannot cross-wire the two browser apps.

Frontend source-map ownership is split today: PostHog source-map uploads run from GitHub
Actions with `POSTHOG_CLI_TOKEN` plus the app-specific PostHog environment ID, while Vite
currently emits maps only when `SENTRY_AUTH_TOKEN` is present. `GG_ENABLE_SOURCEMAPS` is an
upload-lane flag, not a durable Vercel project variable. Keep client Sentry integration
variables only where Sentry upload or log-drain integration is intentionally enabled, and do
not keep orphaned source-map flags on admin.

Active routines are Sentry-ready, not Sentry-dependent: when a Sentry connector/API surface is available, include Sentry safe-summary evidence beside PostHog evidence. When it is unavailable, continue without it. Do not add Sentry MCP entries or routine API-key fallbacks unless the user explicitly asks.

## Linear environment

Three routines write to Linear:

- `bug-intake` writes **Customer Needs** (raw signal — every validated user/community report) and creates linked **Issues** only when the report is accepted as committed product work.
- `growth-pulse` writes **Issues** for accepted growth/strategy anomalies (funnel, retention, dormancy) once they cross the anomaly threshold.
- `health-watch` writes **Issues** for accepted operational health work (indexer, Vercel deploy/runtime, contracts) once a 🔴 anomaly is confirmed.
- `qa-triage-pulse` writes **Customer Needs only** (pre-stage from Wednesday Build Sync notes, label `source:qa-triage-pulse` + `qa-sync:<YYYY-MM-DD>`). Never creates Issues. The interactive `/qa-triage` skill promotes them to Issues with human judgment in the loop.

### Project routing

- **Customer Needs** are unprojected raw signal — they carry `source:*` for provenance and live on the Product team without a project.
- **Issues** are unprojected by default on the Product team. Graduate an Issue into a bounded active project only when one already exists for the work; the retired staging/completed projects (`Green Goods`, `Coop`, `Network Website`, `Cookie Jar`, `Story Board`) are not roadmap destinations — never route new Issues into them.
- Green Goods `.plans/` remains the per-feature execution truth for agent implementation work; Linear is the upstream Issue surface, `.plans/` is the implementation plan.

### Auth

All three routines share the same auth surface. The cloud routine env exposes Linear access via:

| Variable / surface | Description |
|---|---|
| `LINEAR_API_KEY` | Personal API key with read/write access — fallback when no connector is configured |
| Linear connector | Native Linear connector wired into the cloud routine environment |
| Linear MCP | Linear MCP server exposed to the routine |

Whichever surface is wired up, the routine resolves team/label/status IDs by name at the start of every run — IDs are never hardcoded in the prompt. If the lookup fails, the routine surfaces the failure in its daily Discord summary instead of skipping records silently.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.
