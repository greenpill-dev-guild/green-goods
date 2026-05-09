# Claude Routines (Green Goods)

Source-of-truth prompts and configurations for Claude Code routines operating on Green Goods. Each routine's active configuration lives at [claude.ai/code/routines](https://claude.ai/code/routines) under Afo's personal Anthropic Pro account; the files here exist so the setup is rebuildable if routines are lost or the research-preview API surface changes.

Guild-level routines live in [`greenpill-dev-guild/.github/routines/claude/`](https://github.com/greenpill-dev-guild/.github/tree/main/routines/claude). This directory holds only the green-goods-scoped routines.

## Portfolio

| File | Status | Cadence | Channel | Issue surface |
|---|---|---|---|---|
| `bug-intake.md` | active | M/W/F 04:00 | `#product` | Linear `Green Goods` Customer Need + linked Issue |
| `health-watch.md` | active | Daily M-F 07:30 | `#product` (red only) | GitHub Project #4 |
| `growth-pulse.md` | active | Mon 09:00 weekly | `#product` + `#funding` cross-post | Linear (anomalies) + `develop` digest PR |
| `pr-review.md` | active | event-driven (PR open) | inline on PR | n/a |

That's it — three scheduled cadences plus one event-driven. Anything else previously in this folder (engineering-pulse, plan-executor, hotfix, drift-watch, metrics) has been removed: cut from the portfolio or converted to Claude Code skills (`/plan`, `/debug`).

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
- **Sprints field is mandatory** on every issue created on Project #4. Without it, issues are invisible in the user's filtered view of the active iteration.

## Scope discipline

`bug-intake` is the only Green Goods routine that reads Google Drive. It carries an explicit folder allow-list and rejects docs outside it — content keywords alone are too loose. Drive is enrichment, not a substitute when the primary on-chain or Discord source is quiet. `growth-pulse` intentionally does not read Drive (calendar enrichment alone is enough; meeting notes are owned by `guild-weekly-synthesis`).

Every Discord post in a routine is preceded by a `Channel guard` that pins the post target to one env-var-driven channel. If the env var is unset, the routine logs and skips that post — it does not pick an alternate channel.

## Labels in use

### Linear (primary intake — `Green Goods` project)

| Label | Purpose |
|---|---|
| `source:discord` | Reported via Discord |
| `source:telegram` | Reported via Telegram bot |
| `source:drive` | Surfaced from Drive meeting notes |
| `work:customer-need` | Optional label for triage Issues that group feedback |
| `work:polish` | Applied to every linked Linear Issue created from a Customer Need |
| `area:client` / `area:admin` / `area:shared` / `area:contracts` / `area:indexer` / `area:agent` | Affected surface |
| `automation:routine` | Umbrella for any routine-authored Linear record |
| `agent:claude` | Authored by a Claude routine |

### GitHub (Project #4 — health-watch only)

| Label | Purpose |
|---|---|
| `automated/claude` | Authored by a Claude automation |
| `health:indexer` | Envio indexer is lagging or unreachable |
| `health:ci` | Recent CI failures on main |
| `health:contracts` | On-chain state drift (vaults, yield split, garden activity) |

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

Both share the same auth surface. The cloud routine env exposes Linear access via:

| Variable / surface | Description |
|---|---|
| `LINEAR_API_KEY` | Personal API key with read/write access — fallback when no connector is configured |
| Linear connector | Native Linear connector wired into the cloud routine environment |
| Linear MCP | Linear MCP server exposed to the routine |

Whichever surface is wired up, the routine resolves project/team/label/status IDs by name at the start of every run — IDs are never hardcoded in the prompt. If the lookup fails, the routine surfaces the failure in the daily `#product` summary instead of skipping records silently.

## Rebuilding a routine

1. Log in to claude.ai/code/routines.
2. Click **New routine**.
3. Paste the prompt from the relevant `.md` file (everything after the `# Prompt` heading).
4. Configure repos, environment, connectors, and triggers as specified in the file's frontmatter.
5. Save.
