# Claude Routines (Green Goods)

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's active configuration lives at [claude.ai/code/routines](https://claude.ai/code/routines) under Afo's personal Anthropic Pro account; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

Guild-level routines live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). This directory holds only the green-goods-scoped routines. Every posting routine follows the guild **house style v2** (one message per post, lede first, one-line all-clear on quiet runs) defined in [`routines/claude/README.md`](https://github.com/greenpill-dev-guild/.github/blob/main/routines/claude/README.md#house-style-v2-applies-to-every-posting-routine).

## Portfolio

| File | Status | Cadence | Channel | Issue surface |
|---|---|---|---|---|
| `bug-intake.md` | active | M/W/F 04:00 | `#bug-report` (in-thread ack + ✅ on the reporter's message) + `#product` (one digest when something was captured; quiet run = one line) | Linear Customer Needs (raw signal); accepted bugs become unprojected Linear Product Issues |
| `health-watch.md` | active | Mon/Wed/Fri 14:30 UTC (= 07:30 PT; reduced from daily 2026-07-18) | `#engineering` (all-green = one line; per-check breakdown only on non-green or state change; @mention red only) | Linear Product Issues for accepted operational health work (unprojected) |
| `growth-pulse.md` | active | Mon 09:00 weekly | `#growth` + `#funding` cross-post | Linear Product Issues for accepted anomalies (unprojected) + weekly digest as a Linear initiative status update (Sustainability & Monetization) |
| `qa-triage-pulse.md` | active | Wed 21:00 UTC = 13:00 PST / 14:00 PDT (3h after the 10am PST Build Sync start) | `#product` (item-led summary when items exist; no-sync day = one line; @mention when there's something to triage) | Linear Customer Needs only (pre-staged, label `source:qa-triage-pulse` + `qa-sync:<date>`) from Build Sync notes **plus the biweekly Engineering Sync notes** (2026-07-18 extension; off-weeks skip silently); `/qa-triage` promotes them to Issues + QA-sheet rows interactively. Routine id: `trig_01GSagDiEV9Y8QTBzKeZsPSw` |
| `release-prep.md` | active (2026-07-18) | Weekdays 16:00 UTC, **self-gating**: full brief posts 3 days before the Linear release project's target date (or on target-moved / Monday cadence-slip / any manual run); other runs exit quietly. Routine id: `trig_01FA23vPDQ1aYaBbZwdJ8gb1` | `#engineering` (readiness brief; @mention on decision-needed risk) | none — read + draft only; no Linear/GitHub writes |
| `pr-review.md` | active | event-driven (PR opened / ready_for_review) | **Linear comment** on the issue(s) referenced in the PR body (OAuth connector, no stored tokens — steward decision 2026-07-18); PRs with **no Linear reference** get one `#engineering` flag line | one idempotent review comment per referenced Linear issue; never writes GitHub |
| `qa-call-report.md` | active | **on-demand** — manual run right after a team QA call (no cron) | `#product` (one summary linking the report; failures loud) | One `QA session YYYY-MM-DD` parent Issue (the session report) + slice sub-issues via `parentId` — `Todo` + derived priority when backed by a QA-app verdict, `Backlog` for notes-only items. Interactive sibling: `/qa-triage --call`. |
| `research-synthesis.md` | active (v4, 2026-09-02; trigger `trig_01Wkc4tG6XTgRkw7R23Kc57a` in the `guild-routines` environment, retiring the guild-level v3 trigger `trig_01AVZbVmfUjHcVLbKzsurhyb`; Google Drive and Linear are attached, the model still needs setting to `claude-fable-5` in the UI, and the v3 trigger still needs disabling there, see the spec's § Migration) | Sat 00:00 UTC (= Fri 17:00 PT) | `#research` (one agenda-ordered digest; quiet week = one line; @mention only inside 🔴 Needs you) | Reads [`research-agenda.md`](research-agenda.md) as the compass, then Linear anchors, `#research`, Gemini call notes, and `.plans/` hubs onto its seven tracks. Writes ≤1 Linear project/initiative status update per **moved** track (health carried forward, never set), ≤3 comments, ≤1 Research issue (Triage) for an agenda-named gap, and a Drive memo with agenda-drift proposals |

That's it — six scheduled cadences, one event-driven, and one on-demand, all cloud routines hosted at [claude.ai/code/routines](https://claude.ai/code/routines). Anything else previously in this folder (engineering-pulse, plan-executor, hotfix, drift-watch, metrics) has been removed: cut from the portfolio or converted to Claude Code skills (`/plan`, `/debug`).

## Connector Matrix

| Routine | Connectors | Why each |
|---|---|---|
| `bug-intake` | Google Drive, Linear, PostHog, Vercel; Sentry-ready when connector/API access exists | Drive = meeting-note intake · Linear = Customer Need (raw signal) + accepted-bug Issue surface · PostHog = telemetry/product-impact enrichment · Sentry = stack/release/root-cause enrichment · Vercel = deploy correlation (commit + diff that shipped within 48h before each report) |
| `health-watch` | Google Calendar, Linear, PostHog, Vercel; Sentry-ready when connector/API access exists | Calendar = context that adjusts severity · Linear = accepted operational health Issues (unprojected Product) · PostHog = client-side `$exception` spike detection + error correlation · Sentry = release regression and agent/API crash context · Vercel = deploy/runtime/web-vitals signal feeding `activity:qa` Issues. Also probes the agent's unauthenticated `/health` via `BOT_API_URL` (env var, not a connector). |
| `growth-pulse` | Google Calendar, Linear, PostHog | Calendar = WoW context · Linear = accepted-anomaly Issue surface (unprojected Product) · PostHog = product/growth metrics via curated questions. Drive and Miro are intentionally not wired here; Vercel is also intentionally not wired because Vercel Web Analytics overlaps with PostHog and would create dual-source drift. |
| `qa-triage-pulse` | Google Drive, Linear, PostHog, Vercel | Drive = the Wed Build Sync's Gemini notes · Linear = Customer Need pre-stage surface (raw signal, unprojected) · PostHog = per-surface telemetry cross-reference · Vercel = deploy correlation gated on PostHog-matched items only (anchored to `first_seen`, skipped for items without telemetry signal). |
| `release-prep` | GitHub (read-only), Linear (read-only) | GitHub = open PRs + commit range (`main..develop`) + existing releases/tags · Linear = the active release project's targetDate drives the self-gating window (brief posts at target − 3 days). No Drive/PostHog — a pure readiness draft; reads the release runbook live from the checkout. |
| `pr-review` | Vercel, Linear (OAuth, the posting surface), Sentry | Vercel = preview deployment status + Lighthouse delta (commentary, not an invariant) · Linear = where the review posts (one idempotent comment per issue referenced in the PR body; no stored GitHub token by steward decision) · Sentry = open-issue context on touched surfaces. |
| `qa-call-report` | Google Drive, Linear, PostHog, Vercel; Sentry-ready when connector/API access exists | Drive = the call's Gemini notes · Linear = the session report + slice sub-issues · PostHog = **session-window** enrichment (the testers' own product sessions during the call: per-slice exception matches + `[derived:telemetry]` misses nobody recorded) · Vercel = build under test (the deploys live during the window — the Blob store has no build SHA) · Sentry = stack/release context for window errors, skipped silently when absent. App verdicts stay the ground truth; enrichment is context and never blocks the record. Also needs `BLOB_READ_WRITE_TOKEN` (env var, not a connector) so `bun run qa:pull` can read the QA app's private shards, and a **`develop` checkout** — the qa scripts are not on `main`. |
| `research-synthesis` | Google Drive, Linear; green-goods checkout (read-only) | Drive = Gemini call notes from the last 7 days (agenda-keyword passages only; WEFA docs rejected; personal one-to-ones and coffee meets rejected unless a research watch keyword appears in their summary or next steps, and then cited past the memo by meeting kind and date, never by title) + memo continuity + linked docs · Linear = the agenda tracks' anchor projects, issues, and documents, the Research cycle, and the gated write surfaces (status updates, comments, ≤1 issue) · the checkout = `docs/routines/research-agenda.md` (the compass) and the `.plans/` hubs each track names. No PostHog, Vercel, or Calendar; product metrics come from growth-pulse's status update, never re-queried. Discord `#research` is read and posted over REST with the shared bot token. |

Gmail is intentionally NOT wired on any GG routine (personal-inbox pollution risk).

## Channel mapping

| Channel | Used by | Why |
|---|---|---|
| `#bug-report` (DISCORD_BUGS_CHANNEL_ID) | bug-intake (Phase 1 ingest source + in-thread acks on reporters' messages) | dedicated bug-report feed |
| `#product` (DISCORD_PRODUCT_CHANNEL_ID) | bug-intake (digest, quiet run = one line), qa-triage-pulse (Wed pre-stage summary, no-sync = one line) | user-facing concerns + ideas |
| `#growth` (DISCORD_GROWTH_CHANNEL_ID) | growth-pulse (weekly digest highlights) | growth / funnel / retention / action-template pulse |
| `#engineering` (DISCORD_ENGINEERING_CHANNEL_ID) | health-watch (one-line green; breakdown on change; @mention red only) | operational health status — engineering-focused (indexer / Vercel / contracts / agent uptime / client errors) |
| `#funding` (DISCORD_FUNDING_CHANNEL_ID) | growth-pulse cross-post (when grant-relevant) | grant relevance only |
| `#research` (DISCORD_RESEARCH_CHANNEL_ID) | research-synthesis (Sat digest; input channel for research shares) | researcher-facing state of the seven agenda tracks: what moved, what is blocked and on whom, connections, verified new input |
| Linear comment (referenced issue) | pr-review | review surface — one idempotent comment per issue the PR body references; `#engineering` gets a one-line flag when a PR references no Linear issue |

`#engineering` is health-watch's home channel (operational health status — indexer / Vercel / contracts / agent uptime / client errors). Other code-local engineering signals still come from the user reading PRs and Linear, not from a routine.

## Notification policy

Routines @mention Afo only when his action is required (via `DISCORD_USER_ID_AFO` env var):

- `bug-intake` — when its own bug-intake-sourced Issues awaiting triage (raw-signal tracking + accepted bugs) exceed 3, or when any run failure needs attention (missing Linear project/label, Linear auth error, Telegram intake auth failure, PostHog unreachable, privacy-grep hit, or a failed in-thread acknowledgement)
- `health-watch` — on real (🔴) anomalies only
- `growth-pulse` — when an anomaly is opened in Linear OR a setup failure needs attention
- `qa-triage-pulse` — when ≥1 Customer Need was pre-staged from **either** source it reads (the Wednesday Build Sync, or the biweekly Engineering Sync on on-weeks; signal that `/qa-triage` is ready to run) OR a Linear/Drive setup failure needs attention. A run with nothing to pre-stage and nothing failing posts one line without a mention.
- `qa-call-report` — when ≥1 slice was filed (the fix work is ready to pull) OR any failure needs attention (missing Blob token, wrong checkout branch, Linear write rejected, privacy-grep hit). Every run posts its summary — the run is manual, so the post is the receipt.
- `research-synthesis` — only inside a 🔴 Needs you block, when a decision or an external contact on an agenda track is his to make (a panel decision owed, a provider or partner to contact). Movement alone never mentions.

`pr-review` posts its review to Linear (the referenced issue), never to GitHub — in-PR commentary is CodeRabbit's and Codex's lane; its only Discord output is the `#engineering` missing-issue flag line. Healthy weekly heartbeats with zero anomalies = no @mention.

## Conventions

- All routine PRs target `develop`. Hotfix-style flows (same-day p2 fixes to `main`) live in the `/debug` skill, not in this folder.
- Current routines do not create branches or PRs. Any future branch-producing routine must use the repository `<type>/<work-description>` policy rather than encode the routine or model identity.
- `pr-review` retains its `claude/*` head filter only as compatibility for legacy in-flight branches; it is not a valid naming convention for new work.
- **Linear is the durable backlog.** GitHub is for PRs and code review only — routines never file GitHub Issues, never write to GitHub Projects, and never apply GitHub Project iteration/Sprints fields. The retired GitHub Project #4 / Bug Board flows (and the `Sprints` field they depended on) are out of scope for any active routine.
- **Model tier:** every GG routine runs `claude-opus-5`, except `research-synthesis`, which runs `claude-fable-5` for the same reason the guild tiering gives its v3 predecessor (cross-track connection-finding and source verification are genuine-ambiguity work at a weekly cadence) (the rest moved off `claude-opus-4-8[1m]` on 2026-07-26; same token price, better instruction-following and bug-finding). Each spec names its model in frontmatter, and that frontmatter is documentation of the live trigger, not a control surface: changing it does not change the running model, so re-emit the trigger and edit the spec in the same change. The guild-level tiering rationale, including the routines on `claude-fable-5`, lives in [`greenpill-dev-guild/.github` → `routines/claude/README.md`](https://github.com/greenpill-dev-guild/.github/blob/main/routines/claude/README.md).

## Scope discipline

Three GG routines read Google Drive: `bug-intake` (meeting-note enrichment across all team docs, with a folder allow-list and content-rejection list), `qa-triage-pulse` (single-purpose — only the Wednesday Build Sync's Gemini notes, narrower title-pattern match), and `research-synthesis` (every Gemini call-note doc from the last 7 days, but only the summary, next steps, and transcript passages near a research-agenda keyword; WEFA, personal, and out-of-scope docs are rejected, and nothing from a transcript is ever quoted into Discord or Linear). `growth-pulse` intentionally does not read Drive (calendar enrichment alone is enough; broader meeting notes are owned by `guild-weekly-synthesis`).

Every Discord post in a routine is preceded by a `Channel guard` that pins the post target to one env-var-driven channel. If the env var is unset, the routine logs and skips that post — it does not pick an alternate channel.

## Labels in use

All routine writes use the canonical Linear label scheme. Old vocabularies (`area:*`, `work:*`, `migration:*`, `automation:*`, `health:*`, `grant:*`, `source:linear`) are retired — do not reintroduce them.

### Canonical Linear labels

| Label family | Values used by GG routines | Purpose |
|---|---|---|
| `protocol:*` | `protocol:green-goods` | Protocol/product — every routine record carries this. (Cookie Jar work routes here too — Cookie Jar is a completed Linear project and not a separate protocol.) |
| `package:*` | `package:client`, `package:admin`, `package:shared`, `package:contracts`, `package:indexer`, `package:agent`, `package:docs` | Affected code surface, keyed to the repo (replaces old `area:*`). Orthogonal to `protocol:*` (the product) — one package can serve several products. Apply only to code-touching work; omit if the surface is unknown or the issue isn't code (research / funding / ops). |
| `activity:*` | Routines apply: `activity:qa` (bug fixes, anomaly review, operational health validation), `activity:maintenance` (polish/cleanup that isn't a user-visible defect). The full Linear taxonomy also includes `activity:research`, `activity:architecture`, `activity:build`, `activity:design` — those are human-applied and not used by GG routines. |
| `source:*` | `source:discord`, `source:telegram`, `source:drive` | Provenance of the originating signal (Customer Needs always carry this; Issues carry it when the originating provenance still matters). |
| `ai:*` | `ai:routine` (default) · `ai:codex` (Codex-ready Issues) | Single-value-per-Issue provenance/routing. Default `ai:routine`; swap to `ai:codex` when an accepted Issue clears the Codex-ready bar (see § Codex hand-off). Provenance only, not human priority. |

**Writing these through the API:** `group:child` is display shorthand, not accepted input. `save_issue` resolves labels by **bare child name or ID**, so pass `["green-goods", "qa", "routine"]`, not `["protocol:green-goods", "activity:qa", "ai:routine"]`. One unresolvable entry rejects the whole array and the routine files nothing, so a stale label name is a silent no-write rather than a partial write. The `ai:*` group was written `agent:*` in docs before 2026-07-27; `agent` exists only as `package:agent`, which is unrelated.

The dispatch labels `automation:claude` / `automation:codex` (legacy GitHub-era handoff flags) and the `work:polish` / `work:customer-need` / `area:*` / `health:*` / `grant:*` labels are not used. GitHub Project #4 and its `automated/claude` + `health:*` label set are retired entirely; no active routine writes to a GitHub Issue surface.

## Codex hand-off (label + delegate)

Routines that create accepted Issues can route them to Codex in two tiers. The `ai:*` label is **single-value**, so `ai:codex` *replaces* `ai:routine` — never both.

- **Tier 1 — label `ai:codex` (the queue).** When an accepted Issue clears the **Codex-ready bar** — *clear behavior + named surface + suggestable fix + a validation command (explicit, or inferable from the repo)* — set `ai:codex` (instead of `ai:routine`) and `Todo`. It now appears in the Codex queue (`label:ai:codex` + `Todo` + undelegated) for a human to delegate.
- **Tier 2 — also delegate to Codex (auto-build).** When the Issue *also* clears the **autonomous-confident bar** — *a concrete suggested fix + a bounded, non-`critical` surface + mechanical scope + a validation command* — also set the Linear **delegate** to the Codex agent so it builds autonomously, with the human left as assignee/reviewer.
- **Otherwise** (Codex-ready but not confident, or not Codex-ready) → keep `ai:routine`, undelegated; a human triages/delegates. A vague Issue never clears the bar, so it never auto-reaches Codex — the bar *is* the gate.

**Always human-gated, never auto-delegated** regardless of bar: `package:contracts` and shared auth / session / permit / policy and job-queue / work providers (the repo's `critical` set).

## Bot API environment

Routines that consume Telegram captures need the agent API surface only:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `bug-intake` (read + claim + status updates via `/api/messages?inferred_type=bug|idea` — needs `BOT_API_TOKEN`; no Telegram-side ack; Telegram captures surface as item lines in bug-intake's `#product` digest). `health-watch` uses **only** the unauthenticated `/health` + `/ready` endpoints for an uptime probe — no token, never `/api/*`.

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
emits maps whenever `GG_ENABLE_SOURCEMAPS=true` (the upload lane sets it) or the Sentry
upload path is active. `GG_ENABLE_SOURCEMAPS` is an upload-lane flag, not a durable Vercel
project variable — the app build only strips public `.map` files when it is unset, so setting
it on a Vercel project would publish browser source maps. Keep client Sentry integration
variables only where Sentry upload or log-drain integration is intentionally enabled, and do
not keep orphaned source-map flags on admin.

Active routines are Sentry-ready, not Sentry-dependent: when a Sentry connector/API surface is available, include Sentry safe-summary evidence beside PostHog evidence. When it is unavailable, continue without it. Do not add Sentry MCP entries or routine API-key fallbacks unless the user explicitly asks.

## Linear environment

The workspace has five teams as of 2026-07-14 (Product `PRD`, Research `RESR`, Community `COM`, Growth `GROW`, Marketing `MAR`; charters in [`greenpill-dev-guild/.github` → `docs/teams/`](https://github.com/greenpill-dev-guild/.github/tree/main/docs/teams)). **Green Goods routines write only to the Product team** — the funding pipeline lives on Growth (guild grant-scout's turf), marketing briefs on Marketing, cohort work on Community. The one exception is `research-synthesis`: it is the research surface, so it comments on Research-team issues, posts project and initiative status updates, and may file at most one Research issue per run (see its row below).

These routines write to Linear:

- `bug-intake` writes **Customer Needs** (raw signal — every validated user/community report) and creates linked **Issues** only when the report is accepted as committed product work.
- `growth-pulse` writes **Issues** for accepted growth/strategy anomalies (funnel, retention, dormancy) once they cross the anomaly threshold.
- `health-watch` writes **Issues** for accepted operational health work (indexer, Vercel deploy/runtime, contracts) once a 🔴 anomaly is confirmed.
- `qa-triage-pulse` writes **Customer Needs only** (pre-stage from Wednesday Build Sync notes, label `source:qa-triage-pulse` + `qa-sync:<YYYY-MM-DD>`). Never creates Issues. The interactive `/qa-triage` skill promotes them to Issues with human judgment in the loop.
- `qa-call-report` writes the QA-session record directly: one `QA session YYYY-MM-DD` parent **Issue** plus slice sub-issues — `Todo` with derived priority when a QA-app verdict backs the slice, `Backlog` otherwise. It is the one routine allowed to create `Todo` work, because the verdicts it transcribes were recorded by humans on the call; notes-only reconstructions keep the pre-stage posture. No Customer Needs, no Sheet writes.
- `research-synthesis` writes **status updates** on each agenda track's named surface (a project or initiative status update, only for a track that moved that week, with the previous `health` carried forward and never set by the routine), up to three **comments** on anchor issues, and at most one Research **Issue** in `Triage` when no open Research issue covers an agenda track's open question. It never changes state, priority, labels, assignees, dates, or health, and never edits the agenda file.

### Project routing

- **Customer Needs** are unprojected raw signal — they carry `source:*` for provenance and live on the Product team without a project.
- **Issues** are unprojected by default on the Product team. Graduate an Issue into a bounded active project only when one already exists for the work; the retired staging/completed projects (`Green Goods`, `Coop`, `Network Website`, `Cookie Jar`, `Story Board`) are not roadmap destinations — never route new Issues into them.
- Green Goods `.plans/` remains the per-feature execution truth for agent implementation work; Linear is the upstream Issue surface, `.plans/` is the implementation plan.

### Auth

All routines reach Linear through the **native Linear OAuth connector wired into the cloud routine environment — no `LINEAR_API_KEY` is stored** (standing guild rule as of 2026-07-04; the connector can lapse between runs and is re-authorized by a human, never replaced with a key). If the connector is unauthenticated or unreachable, the routine **fails closed**: it surfaces the failure in its Discord summary and skips Linear writes — it never scans or writes blind.

The routine resolves team/label/status IDs by name at the start of every run — IDs are never hardcoded in the prompt. If the lookup fails, the routine surfaces the failure in its daily Discord summary instead of skipping records silently.

### Output style (all posting routines)

Green Goods routine posts follow the guild house style: bold headers with blank lines between blocks, lead with what needs a human (🔴 first), a thing appears only if it moved or needs attention (never a "quiet" bullet or empty section), metrics folded into the line they describe, one message per channel per run. Get short by cutting content rather than compressing prose: drop anything that would not change what a reader does next, then write what remains in complete sentences (no padding, no fragment-and-arrow shorthand). Cadences in the portfolio table are UTC (the qa-triage-pulse row's "Wed 21:00 UTC" annotation style is the convention).

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, triggers, **and the model** as specified in the file's frontmatter. A rebuilt routine left on the platform default silently runs the wrong tier.
5. Save.
