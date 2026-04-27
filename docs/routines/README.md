# Claude Routines (Green Goods)

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's actual config lives on claude.ai/code/routines; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

Guild-level routines (research-synthesis, design-synthesis, routine-issue-cleanup, routine-self-audit, plus the four `guild-*` routines) live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). This directory holds only the green-goods-scoped routines.

## Files (7 routines)

- `pr-review.md` — GitHub-triggered inline PR review (event)
- `bug-intake.md` — Daily 04:00 weekday: harvests user-reported bugs from Discord/Telegram/Drive → Bug Board #18 → @mentions Afo on triage queue
- `plan-executor.md` — Daily 06:30 weekday: picks up issues labeled `plan-task` → bundled PRs to `develop`
- `health-watch.md` — Daily 07:30 weekday: indexer + 8-lane CI + contracts health → board #4 issues, auto-closes on recovery
- `hotfix.md` — Twice weekday (10:00 + 16:00 PT): user-reported p2 in Bug Board `Ready` → solo PR to `main` → @mentions on PR open + CI green
- `drift-watch.md` — Weekly Sunday 02:00: code drift vs CLAUDE.md/AGENTS.md invariants, retired workflow guardrails, and package boundaries → one rolling issue per package
- `metrics.md` — Weekly Sunday 22:00: Dune + PostHog + indexer → digest PR + anomaly issues, primary post #product, grant cross-post #funding

> `dream-on` is a **local Claude Code skill** (`/dream-on`), not a cloud routine — invoke it manually from Claude Code when you want overnight exploration. Not scheduled.

See [`workflows.md`](./workflows.md) for human-in-the-loop touchpoints, gating signals, and mermaid diagrams of each pipeline.

## Channel mapping

| Channel | Used by | Why |
|---|---|---|
| `#product` (DISCORD_PRODUCT_CHANNEL_ID) | bug-intake, hotfix, plan-executor, health-watch, metrics (primary) | user-facing concerns |
| `#engineering` (DISCORD_ENGINEERING_CHANNEL_ID) | drift-watch | internal code quality |
| `#funding` (DISCORD_FUNDING_CHANNEL_ID) | metrics (cross-post for grant context) | grant relevance only |
| inline on PR | pr-review | review surface |

## Notification policy

Routines @mention Afo only when his action is required:
- `bug-intake` — when triage queue > 3
- `hotfix` — on PR open AND on CI green/red
- `plan-executor` — only on aborts/blockers
- `health-watch` — on real (🔴) anomalies only
- `metrics` — on metric anomalies
- `drift-watch` — only when total findings escalated this week

Daily/weekly heartbeats with no anomalies = no @mention. Discord notifications stay signal-heavy.

The env var `DISCORD_USER_ID_AFO` holds Afo's Discord snowflake ID. Use `<@${DISCORD_USER_ID_AFO}>` syntax in messages.

## Conventions

- All routine PRs target `develop`, except `hotfix` which targets `main`. After a hotfix lands, the hotfix routine opens a follow-up backport PR into `develop`; there is no automatic `main` → `develop` fast-forward workflow.
- All routine branches use `claude/<routine-name>/<topic>`.
- Loop prevention on `pr-review`: filter on `head_branch` starting with `claude/` (NOT on author — routine PRs carry the user's GitHub author per the docs).
- **Sprints field is mandatory** on every issue created on Project #4. Without it, issues are invisible in the user's filtered view of the active iteration.

## Scope discipline (Drive + channel guards)

Routines that read Google Drive (`bug-intake`, `metrics`) carry an explicit folder allow-list and reject docs outside it — content keywords alone are too loose. Drive is enrichment, not a substitute when the primary on-chain or Discord source is quiet.

Every Discord post in a routine is preceded by a `Channel guard` that pins the post target to one env-var-driven channel. If the env var is unset, the routine logs and skips that post — it does not pick an alternate channel. The guild-side routines (in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude)) follow the same discipline; see that README for the dev-guild scope-contract template.

## Required labels

Ensure these GitHub labels exist before enabling the corresponding routines.

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

**`metrics`**:

| Label | Purpose |
|---|---|
| `metrics:anomaly` | Metric anomaly in Dune or PostHog |

**`bug-intake`** (umbrella + source + package + automation):

| Label | Purpose |
|---|---|
| `polish` | Umbrella applied to every bug-intake output |
| `source:discord` | Reported via Discord |
| `source:telegram` | Reported via Telegram bot |
| `source:drive` | Surfaced from Drive meeting notes |
| `client` | Client PWA — `packages/client/` |
| `admin` | Admin dashboard — `packages/admin/` |

**`drift-watch`** (per-package rolling snapshot):

| Label | Purpose |
|---|---|
| `drift-snapshot` | One rolling issue per package, weekly refresh |
| `client` / `admin` / `shared` / `contracts` / `indexer` | Package scope |

**`plan-executor` dispatch**:

| Label | Purpose |
|---|---|
| `plan-task` | Applied by the user to dispatch an issue to plan-executor |
| `agent:assigned:claude` | Plan-executor or hotfix is implementing this — remove to re-dispatch |

## Project board coordination

`bug-intake` (producer) and `hotfix`/`plan-executor` (implementers) coordinate through two GitHub Projects under `greenpill-dev-guild`:

| Project | Purpose | Starting column | Used by |
|---|---|---|---|
| **#4 "Green Goods"** | General kanban — drift snapshots, health, metrics, plan tasks | `Backlog` | health-watch, drift-watch, metrics |
| **#18 "Bug Board"** | User-reported bug triage | `To triage` | bug-intake |

Both share the lane structure `{starting} → Ready → In progress → In review → Done`.

### Lifecycle

1. **Producer creates + attaches** — bug-intake creates an issue, applies labels, attaches it to Bug Board #18 in `To triage`. Drift-watch + health-watch + metrics attach to Project #4 in `Backlog` with `Sprints = active iteration`.
2. **Human triages (the only manual step)** —
   - For Bug Board #18: drag urgent items to `Ready` so hotfix picks them up
   - For Project #4 audits: label issues with `plan-task` to dispatch them to plan-executor
3. **Implementer dispatches + implements + opens PR**:
   - `plan-executor` (06:30 weekday): picks `plan-task`-labeled issues, bundles, opens PRs against `develop`
   - `hotfix` (every 4h): picks Bug Board `Ready` items at p2, solo PRs against `main`
   - Both apply `agent:assigned:claude` and move Status to `In progress`. GitHub project automation flips to `In review` when the PR opens.
4. **Human reviews the PR** — merge, request changes, or close.
5. **Done** — issue auto-closes on merge via `Closes #N` in the PR body; board moves to `Done`.

### Never auto-dispatched

- p1 from any source — skipped silently by both implementers. Needs human ownership.
- Anything touching critical paths from CLAUDE.md criticality matrix (contracts, providers, job-queue, auth/work/vault/blockchain hooks) — rejected up-front by criticality gates.
- Any issue with an existing linked PR — no dispatch racing.

### Re-dispatching

To force `plan-executor` to retry an issue it already handled (bundle aborted, PR closed without merge), remove the `agent:assigned:claude` label manually. The issue becomes eligible again on the next run if all other gates still pass.

## Bot API environment

Routines that consume Telegram feedback need:

| Variable | Description |
|---|---|
| `BOT_API_URL` | Public URL of the Green Goods agent (e.g., `https://agent.greengoods.app`) |
| `BOT_API_TOKEN` | Bearer token for authenticating API requests to the agent |

Used by: `bug-intake` (read + respond), `health-watch` (read-only).

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.
