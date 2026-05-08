# Claude Routines (Green Goods)

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's actual config lives on claude.ai/code/routines; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

Guild-level routines (research-synthesis, design-synthesis, routine-issue-cleanup, routine-self-audit, plus the four `guild-*` routines) live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). This directory holds only the green-goods-scoped routines.

## Portfolio (post-2026-05-07 reset)

The portfolio was reset on 2026-05-07 from 7 → 5 active routines + 1 event-driven + 2 on-demand + 2 paused. Goal: reduce noise so the surviving routines can be tuned to consistent quality.

| File | Status | Cadence | Channel | Issue surface |
|---|---|---|---|---|
| `bug-intake.md` | active | M/W/F 04:00 (was daily) | `#product` + Linear | Linear `Green Goods` Customer Need + linked Issue |
| `health-watch.md` | active | Daily M-F 07:30 | `#product` (red only) | GitHub Project #4 |
| `engineering-pulse.md` | active (NEW) | Sun 02:00 weekly | `#engineering` | GitHub Project #4 (rolling drift + ops + anomaly) |
| `growth-pulse.md` | active (NEW) | Mon 09:00 weekly | `#product` + `#funding` cross-post | Linear (anomalies) + `develop` digest PR |
| `pr-review.md` | active | event-driven (PR open) | inline on PR | n/a |
| `plan-executor.md` | on-demand | (no cron) | `#product` on aborts | reads GitHub `plan-task` label |
| `hotfix.md` | on-demand | (no cron) | `#product` on PR open + CI result | reads GitHub Bug Board #18 `Ready` |
| `drift-watch.md` | **paused** | (cron dropped) | (was `#engineering`) | (folded into `engineering-pulse`) |
| `metrics.md` | **paused** | (cron dropped) | (was `#product` + `#funding`) | (split: digest+growth → `growth-pulse`, anomaly → `engineering-pulse`) |

Paused prompts remain in the repo as reference. Their cloud crons have been dropped via `/schedule delete`. Do not re-enable without coordinating with the consolidating routine to avoid duplicate findings.

Guild-level routines (research-synthesis, design-synthesis, routine-issue-cleanup, routine-self-audit, plus the four `guild-*` routines) live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). That portfolio is being reshaped on the same 2026-05-07 reset — see the guild README for status.

> `dream-on` is a **local Claude Code skill** (`/dream-on`), not a cloud routine — invoke it manually from Claude Code when you want overnight exploration. Not scheduled.

See [`workflows.md`](./workflows.md) for human-in-the-loop touchpoints, gating signals, and mermaid diagrams of each pipeline.

See [`product-development-harness.md`](./product-development-harness.md) for the current
Linear/GitHub/Codex/Claude improvement notes, including the recommended Linear migration
order and routine hardening backlog.

## Channel mapping

| Channel | Used by | Why |
|---|---|---|
| `#product` (DISCORD_PRODUCT_CHANNEL_ID) | bug-intake, health-watch (red only), growth-pulse, hotfix (on-demand), plan-executor (on-demand) | user-facing concerns |
| `#engineering` (DISCORD_ENGINEERING_CHANNEL_ID) | engineering-pulse | internal code quality + ops + code-local anomalies |
| `#funding` (DISCORD_FUNDING_CHANNEL_ID) | growth-pulse (cross-post when grant-relevant) | grant relevance only |
| inline on PR | pr-review | review surface |

## Notification policy

Routines @mention Afo only when his action is required:
- `bug-intake` — when unlinked/unreviewed Linear Customer Needs plus linked Issues needing triage exceed 3, or when a Linear setup failure (missing project, missing label, auth error) needs attention
- `health-watch` — on real (🔴) anomalies only
- `engineering-pulse` — when at least one weekly finding is red (indexer red, CI red, anomaly above the user-count threshold)
- `growth-pulse` — when an anomaly is opened in Linear OR a setup failure needs attention
- `hotfix` (on-demand) — on PR open AND on CI green/red
- `plan-executor` (on-demand) — only on aborts/blockers

Weekly heartbeats with no anomalies = no @mention. Discord notifications stay signal-heavy. The 2026-05-07 reset specifically removed daily-cadence noise from `guild-daily-synthesis` (paused), `metrics` (folded), and `drift-watch` (folded) — the surviving weekly post should feel like a useful read, not a noise stream.

The env var `DISCORD_USER_ID_AFO` holds Afo's Discord snowflake ID. Use `<@${DISCORD_USER_ID_AFO}>` syntax in messages.

## Conventions

- All routine PRs target `develop`, except `hotfix` which targets `main`. After a hotfix lands, the hotfix routine opens a follow-up backport PR into `develop`; there is no automatic `main` → `develop` fast-forward workflow.
- All routine branches use `claude/<routine-name>/<topic>`.
- Loop prevention on `pr-review`: filter on `head_branch` starting with `claude/` (NOT on author — routine PRs carry the user's GitHub author per the docs).
- **Sprints field is mandatory** on every issue created on Project #4. Without it, issues are invisible in the user's filtered view of the active iteration.

## Scope discipline (Drive + channel guards)

`bug-intake` is the only active routine that reads Google Drive. It carries an explicit folder allow-list and rejects docs outside it — content keywords alone are too loose. Drive is enrichment, not a substitute when the primary on-chain or Discord source is quiet. `growth-pulse` intentionally does not read Drive (calendar enrichment alone is enough; meeting notes are owned by `guild-weekly-synthesis`). The paused `metrics` routine previously read Drive — that surface is gone post-2026-05-07 and `growth-pulse` did not inherit it.

Every Discord post in a routine is preceded by a `Channel guard` that pins the post target to one env-var-driven channel. If the env var is unset, the routine logs and skips that post — it does not pick an alternate channel. The guild-side routines (in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude)) follow the same discipline; see that README for the dev-guild scope-contract template.

## Required labels

Labels live in two places now: GitHub (still the home for code-local issues, drift snapshots, health, metrics, and dispatch) and Linear (the new home for user-reported bugs, ideas, and operator pain). Ensure both label sets exist before enabling the corresponding routines.

### GitHub labels

**Automation umbrella** — every routine-authored issue/PR carries this:

| Label | Purpose |
|---|---|
| `automated/claude` | Authored by a Claude automation |

**`health-watch` — ops health** (dedupe: one open issue per category):

| Label | Purpose |
|---|---|
| `health:indexer` | Envio indexer is lagging or unreachable |
| `health:ci` | Recent CI failures on main |
| `health:contracts` | On-chain state drift (vaults, yield split, garden activity) |

**`engineering-pulse`** — code-local engineering health (drift + ops + anomaly), one rolling issue per category:

| Label | Purpose |
|---|---|
| `drift-snapshot` | One rolling issue per package, weekly refresh (was `drift-watch`) |
| `metrics:anomaly` | Code-local PostHog/Dune anomaly that doesn't fit the user/strategy lens |
| `area:client` / `area:admin` / `area:shared` / `area:contracts` / `area:indexer` / `area:agent` | Package scope |
| `health:indexer` / `health:contracts` / `health:ci` | Runtime health categories (deduped across routines) |

> User-facing growth/strategy anomalies (funnel breakage, retention cliffs, dormant-garden surges) belong to **Linear**, written by `growth-pulse`. They do not appear here.

**`plan-executor` dispatch (active GitHub path)**:

| Label | Purpose |
|---|---|
| `plan-task` | Applied by the user to dispatch a GitHub issue to plan-executor |
| `agent:assigned:claude` | Plan-executor or hotfix is implementing this — remove to re-dispatch |

> The legacy `polish` + `source:*` GitHub labels used by the previous bug-intake regime are no longer applied by the routine. They remain in the repo for historical records; do not file new GitHub issues with them.

### Linear Issue labels (new — `Green Goods` project)

`bug-intake` writes Customer Needs and linked Issues into the existing `Green Goods` project in Linear. Customer Needs carry source/reporter context in their body and project/customer/Issue links; they do not carry Issue labels or workflow status. Required intake labels are present on the current `Contributors` team; re-check label visibility if the routine moves to dedicated product teams.

| Label | Status | Purpose |
|---|---|---|
| `source:discord` | exists on `Contributors` | Reported via Discord |
| `source:telegram` | already exists | Reported via Telegram bot |
| `source:drive` | exists on `Contributors` | Surfaced from Drive meeting notes |
| `work:customer-need` | already exists | Optional label for triage Issues that group feedback; do not apply to Customer Needs themselves |
| `work:polish` | already exists | Applied to every linked Linear Issue created from a Customer Need |
| `area:client` / `area:admin` / `area:shared` / `area:contracts` / `area:indexer` / `area:agent` | already exists | Affected surface — reuse existing `area:*` set |
| `automation:routine` | already exists | Umbrella for any routine-authored Linear record |
| `automation:claude` | already exists | Human-applied on a `Ready` Linear Issue to release it to a Claude implementer (plan-executor / hotfix Linear path) |
| `automation:codex` | already exists | Human-applied on a `Ready` Linear Issue to release it to a Codex implementer |

## Producer / implementer coordination

User-reported intake lives in **Linear**. Routine-generated audits, drift snapshots, health, and metrics still live in **GitHub Projects**. Implementers (`plan-executor`, `hotfix`) remain GitHub-driven in this pass; their future Linear path is documented but not active yet.

### Linear (primary intake — `Green Goods` project)

| Surface | Purpose | Workflow state | Created by |
|---|---|---|---|
| Customer Need | Every validated user/community signal — bug, idea, operator pain, UX feedback | none — request record linked to project/customer/Issue | bug-intake |
| Linked Issue | The actionable subset of Customer Needs (clear bug or polish task with a known surface) | `Backlog` (exploratory) or `Todo` (well-scoped) | bug-intake |

Linked Issues use the Linear lane structure: `Backlog → Todo → Ready → In Progress → In Review → Done`. The Linear team is `Contributors` (key `CRBT`); future PR bodies that close a Linear Issue use `Closes CRBT-XYZ`.

### GitHub Projects (audits, drift, ops health, plus the legacy bug queue)

| Project | Purpose | Starting column | Used by |
|---|---|---|---|
| **#4 "Green Goods"** | General kanban — drift snapshots, runtime health, code-local anomalies, plan tasks | `Backlog` | health-watch, engineering-pulse |
| **#18 "Bug Board"** | Legacy user-reported bug triage — read-only during the Linear crossover; `hotfix` still drains any `Ready` items here | `To triage` (no new entries from bug-intake) | (none for new entries — `hotfix` reads-only) |

Both share the lane structure `{starting} → Ready → In progress → In review → Done`.

### Lifecycle

1. **Producer creates + attaches**:
   - `bug-intake` creates a Customer Need in the Linear `Green Goods` project and, when actionable, an optional linked Issue in `Backlog`/`Todo`. No GitHub write.
   - `growth-pulse` creates Linear Issues in the `Green Goods` project for user/strategy anomalies (funnel breakage, retention cliffs, dormant-garden surges). Also opens a digest PR to `develop`.
   - `engineering-pulse`, `health-watch` attach GitHub issues to Project #4 in `Backlog` with `Sprints = active iteration`.
2. **Human triages (the only manual step)** —
   - For Linear Customer Needs: review the Customer Need, decide whether the linked Issue is worth doing, and keep the Customer Need as the user-facing context. Future Linear dispatch will use the linked Issue: move it to `Ready` and add `automation:claude` or `automation:codex` when that later pass is enabled.
   - For Project #4 audits: label GitHub issues with `plan-task` to dispatch them to `plan-executor`.
   - Bug Board #18 is dormant for new bugs; only items left in `Ready` from the pre-migration window are still drained by `hotfix`.
3. **Implementer dispatches + implements + opens PR** (both on-demand as of 2026-05-07 — manually triggered, no cron) —
   - `plan-executor`: picks `plan-task`-labeled GitHub issues, bundles, opens PRs against `develop`. Trigger via `/schedule run plan-executor` or the cloud routines surface when labels exist. Linear pickup (`Ready` + `automation:claude`) is a documented follow-up and is not active yet.
   - `hotfix`: picks legacy Bug Board #18 `Ready` items at p2 today; this queue stays mostly empty during the migration. Trigger manually only when a user-reported p2 needs a same-day fix. Linear pickup is a documented follow-up and is not active yet.
   - Both apply `agent:assigned:claude` (GitHub label) and move GitHub Status to `In progress`. GitHub project automation flips to `In review` when the PR opens.
4. **Human reviews the PR** — merge, request changes, or close on GitHub.
5. **Done** — GitHub issue auto-closes on merge via `Closes #N`; the future Linear dispatch pass will handle Linear Issue closure through Linear's GitHub integration. Customer Needs remain the feedback context attached to the Issue/project rather than the workflow-status driver.

### Never auto-dispatched

- p1 from any source — skipped silently by both implementers. Needs human ownership.
- Anything touching critical paths from CLAUDE.md criticality matrix (contracts, providers, job-queue, auth/work/vault/blockchain hooks) — rejected up-front by criticality gates.
- Any issue with an existing linked PR — no dispatch racing.
- Any Linear Customer Need without an actionable linked Issue remains feedback context, not dispatchable work.

### Re-dispatching

- GitHub path: remove `agent:assigned:claude` from the GitHub issue. It becomes eligible on the next run if all other gates still pass.
- Linear path: future dispatch will use linked Issue status and dispatch label; not active in this pass.

### Future comment surfaces (Linear path)

- **Rejection / abort comments** go on the **Linear Issue** (the dispatch surface), symmetric to commenting on a GitHub issue.
- **PR-opened and CI-result status comments** should go on the **linked Customer Need** (the user-facing record). Hotfix CI green/red comments mirror the `<@${DISCORD_USER_ID_AFO}>` mention from `#product`.

## Native Linear ↔ Discord usage (humans)

The team uses Linear's native Discord integration directly for in-the-moment routing — this is independent of `bug-intake`'s scheduled run:

- `/linear issue` in Discord — file a Linear Issue from the message thread; the message URL is preserved on the Linear record so `bug-intake` can detect the duplicate on the next run.
- `/linear search` — find an existing Linear Issue or Customer Need without leaving Discord.
- `/linear wrap` — post a daily summary of your own Linear issue updates.
- Link Discord message threads to Linear records through Linear's Discord link flow or issue UI when a discussion turns actionable.

Limitation to plan around: Linear's native Discord integration does not currently push project-update notifications, so the daily `#product` digest still comes from `bug-intake` (Phase 5). One-time setup happens in the Linear admin UI; the scheduled routine assumes the integration is enabled and dedupes against records the integration has already created.

## Bot API environment

Routines that consume Telegram feedback need:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `bug-intake` (read + respond), `health-watch` (read-only).

## Linear environment

Two routines write to the existing `Green Goods` project in Linear:

- `bug-intake` writes Customer Needs (user feedback) and linked Issues (actionable subset).
- `growth-pulse` writes Issues for user/strategy anomalies (funnel, retention, dormancy).

Both share the same auth surface. The cloud routine env exposes Linear access via whichever of these the harness provides:

| Variable / surface | Description |
|---|---|
| `LINEAR_API_KEY` | Personal API key with read/write access to the `Green Goods` project — fallback when no connector is configured |
| Linear connector | Native Linear connector wired into the cloud routine environment |
| Linear MCP | Linear MCP server exposed to the routine |

Whichever surface is wired up, the routine resolves project/team/label/status IDs by name at the start of every run — IDs are never hardcoded in the prompt. If the lookup fails, the routine surfaces the failure in the daily `#product` summary instead of skipping records silently.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.
