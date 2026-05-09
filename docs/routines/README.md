# Claude Routines (Green Goods)

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's active configuration lives at [claude.ai/code/routines](https://claude.ai/code/routines) under Afo's personal Anthropic Pro account; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

Guild-level routines live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). This directory holds only the green-goods-scoped routines.

## Portfolio

| File | Status | Cadence | Channel | Issue surface |
|---|---|---|---|---|
| `bug-intake.md` | active | M/W/F 04:00 | `#product` | Linear Customer Needs (raw signal); accepted bugs become unprojected Linear Product Issues |
| `health-watch.md` | active | Daily M-F 07:30 | `#product` (red only) | Linear Product Issues for accepted operational health work (unprojected) |
| `growth-pulse.md` | active | Mon 09:00 weekly | `#product` + `#funding` cross-post | Linear Product Issues for accepted anomalies (unprojected) + `develop` digest PR |
| `pr-review.md` | active | event-driven (PR open) | inline on PR | n/a |

That's it — three scheduled cadences plus one event-driven. Anything else previously in this folder (engineering-pulse, plan-executor, hotfix, drift-watch, metrics) has been removed: cut from the portfolio or converted to Claude Code skills (`/plan`, `/debug`).

## Connector matrix

| Routine | MCP connectors | Why each |
|---|---|---|
| `bug-intake` | Google Drive, Linear, PostHog, Vercel | Drive = meeting-note intake · Linear = Customer Need (raw signal) + accepted-bug Issue surface · PostHog = telemetry enrichment for bug correlation · Vercel = deploy correlation (commit + diff that shipped within 48h before each report) |
| `health-watch` | Google Drive, Google Calendar, Linear, PostHog, Vercel | Drive/Calendar = context that adjusts severity · Linear = accepted operational health Issues (unprojected Product) · PostHog = error spike correlation · Vercel = deploy/runtime/web-vitals signal feeding `activity:qa` Issues |
| `growth-pulse` | Google Drive, Google Calendar, Linear, Miro | Drive/Calendar = WoW context · Linear = accepted-anomaly Issue surface (unprojected Product) · Miro = roadmap context. **PostHog access via env vars (no MCP).** Vercel intentionally NOT wired — Vercel Web Analytics overlaps with PostHog, would create dual-source drift. |
| `pr-review` | Vercel | Preview deployment status + Lighthouse delta. Inline review commentary, not a hard invariant. |

Gmail is intentionally NOT wired on any GG routine (personal-inbox pollution risk).

## Channel mapping

| Channel | Used by | Why |
|---|---|---|
| `#product` (DISCORD_PRODUCT_CHANNEL_ID) | bug-intake, health-watch (red only), growth-pulse | user-facing concerns |
| `#funding` (DISCORD_FUNDING_CHANNEL_ID) | growth-pulse cross-post (when grant-relevant) | grant relevance only |
| inline on PR | pr-review | review surface |

`#engineering` is not used by any Green Goods routine. Code-local engineering signals come from the user reading PRs and Linear, not from a routine.

## Notification policy

Routines @mention Afo only when his action is required (via `DISCORD_USER_ID_AFO` env var):

- `bug-intake` — when unlinked/unreviewed Linear Customer Needs plus linked Issues exceed 3, or when a Linear setup failure (missing project, missing label, auth error) needs attention
- `health-watch` — on real (🔴) anomalies only
- `growth-pulse` — when an anomaly is opened in Linear OR a setup failure needs attention

`pr-review` posts inline on the PR; the GitHub mention surface is already explicit and no Discord ping is needed. Healthy weekly heartbeats with zero anomalies = no @mention.

## Conventions

- All routine PRs target `develop`. Hotfix-style flows (same-day p2 fixes to `main`) live in the `/debug` skill, not in this folder.
- All routine branches use `claude/<routine-name>/<topic>`.
- Loop prevention on `pr-review`: filter on `head_branch` starting with `claude/` (NOT on author — routine PRs carry the user's GitHub author per the docs).
- **Linear is the durable backlog.** GitHub is for PRs and code review only — routines never file GitHub Issues, never write to GitHub Projects, and never apply GitHub Project iteration/Sprints fields. The retired GitHub Project #4 / Bug Board flows (and the `Sprints` field they depended on) are out of scope for any active routine.

## Scope discipline

`bug-intake` is the only Green Goods routine that reads Google Drive. It carries an explicit folder allow-list and rejects docs outside it — content keywords alone are too loose. Drive is enrichment, not a substitute when the primary on-chain or Discord source is quiet. `growth-pulse` intentionally does not read Drive (calendar enrichment alone is enough; meeting notes are owned by `guild-weekly-synthesis`).

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

Routines that consume Telegram feedback need:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `bug-intake` (read + respond), `health-watch` (read-only).

## PostHog environment

Green Goods uses three PostHog projects (org-level connector scope, switch-project between them):

| Project | ID | Surfaces | Used by |
|---|---|---|---|
| **App** | `163591` | Client + PWA + editorial website (single ingest target — editorial-to-PWA lineage stays a within-project query) | `growth-pulse` (primary), `bug-intake` (primary), `health-watch` (errors) |
| **Admin** | `262122` | Operator cockpit / admin web app | `growth-pulse` (`actions.template-creation-rate` only), `bug-intake` (admin-route reports) |
| **Agent** | `262124` | Bot/messaging runtime (Telegram + future WhatsApp/SMS) | `bug-intake` (Telegram-source reports) |

The connector key has a project scope set per-project at OAuth time — confirm with `switch-project` + a 1-event test query before assuming a routine can read a given project. A routine that returns zero events on a known-busy project (e.g., App over 30d) should treat the result as a wiring failure (out-of-scope or wrong project ID), not a real anomaly. Cloud routines should set `POSTHOG_PROJECT_ID_APP`, `POSTHOG_PROJECT_ID_ADMIN`, `POSTHOG_PROJECT_ID_AGENT` env vars and reference the right one per query.

## Linear environment

Three routines write to Linear:

- `bug-intake` writes **Customer Needs** (raw signal — every validated user/community report) and creates linked **Issues** only when the report is accepted as committed product work.
- `growth-pulse` writes **Issues** for accepted growth/strategy anomalies (funnel, retention, dormancy) once they cross the anomaly threshold.
- `health-watch` writes **Issues** for accepted operational health work (indexer, CI, Vercel deploy/runtime, contracts) once a 🔴 anomaly is confirmed.

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

Whichever surface is wired up, the routine resolves team/label/status IDs by name at the start of every run — IDs are never hardcoded in the prompt. If the lookup fails, the routine surfaces the failure in the daily `#product` summary instead of skipping records silently.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.
