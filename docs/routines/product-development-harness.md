# Product Development Harness Improvement Notes

Captured: 2026-05-02 PT

This note preserves the post-hardening routine insights for evolving the Green Goods and
Greenpill Dev Guild automation system across Linear, GitHub, Codex, and Claude. The
routine state below is operator-reported from the May 2 routine hardening pass; verify
cloud routine schedules and connector settings before changing production routines.

## North Star

Use Linear as the product-management substrate, GitHub as the code and review substrate,
Claude routines as cross-source synthesis and scheduled judgment, and Codex as the
repo-grounded implementation and verification harness.

The harness should make useful work visible where the team already looks, preserve the
human judgment gates, and verify that routine outputs actually appeared instead of only
assuming a run completed.

## Current Routine State

### Guild routines

Guild routine prompts live in
`~/Code/greenpill/.github/routines/claude/`.

| Routine | Cadence | Current state |
|---|---|---|
| `daily-synthesis` | Daily 08:30 PT | Hardened: WEFA reject, per-channel filter, calendar filter |
| `grant-scout` | Wed 19:00 PT | Hardened: mandatory heartbeat, `.github` in sources, MCP clarification |
| `research-synthesis` | Fri 17:00 PT | Hardened: prior-memo recall, sparse mode, Drive memo write |
| `routine-issue-cleanup` | Fri 22:00 PT | Unblocked: previous `BOT_API_TOKEN` misuse fixed |
| `design-synthesis` | Fri 18:00 PT | Uncommitted WIP: channel guards and scope contract; likely needs same MCP/source hardening |
| `product-development-synthesis` | Daily 15:30 PT | Uncommitted WIP; cron shifted to daily without matching `.md` |
| `weekly-checkin` | Mon 14:30 PT | Uncommitted WIP |
| `routine-self-audit` | Sun 23:00 PT | Uncommitted WIP; cadence table does not match cloud reality |

### Green Goods routines

Green Goods routine prompts live in this directory. The table below preserves the
operator-reported status from the hardening pass; treat the cadence values as inputs to
verify against both this repo and the Claude cloud scheduler.

| Routine | Reported cadence/status | Current issue |
|---|---:|---|
| `pr-review` | Event-triggered | Healthy |
| `hotfix` | Weekday 13:30 | Healthy |
| `bug-intake` | Weekday daily | Cloud cron is reportedly weekly Monday only |
| `plan-executor` | Weekday daily | Cloud cron is reportedly weekly Sunday only |
| `drift-watch` | Sun 02:00 | Cloud cron is reportedly Thu 02:00 |
| `metrics` | Weekly Sunday in docs | Cloud cron is reportedly weekday 14:30 |
| `health-watch` | Daily in docs | Cloud cron field is reportedly empty; treat as urgent until verified |

## Linear Migration Strategy

Linear should become the default destination for product work because it is where the
team will look. GitHub issues should remain useful for code-local bugs, PR linkage, and
repository automation, but routine-created product inventory should graduate to Linear.

| Current GitHub output | Linear destination |
|---|---|
| `bug-intake` issues on Bug Board #18 | Linear issues in a `Bugs` project, with `source:discord`, `source:telegram`, and `source:drive` labels plus Cycle assignment |
| `drift-watch` rolling per-package drift snapshots | Linear issues under a `Tech Debt` project; use parent/child relationships for snapshot findings and fix tasks |
| `research-synthesis` `research:insight` issues in `.github` | Linear documents, because insights are knowledge artifacts before they become tasks |
| `grant-scout` grant-tracker issues in `.github` | Linear projects, one grant per project, with milestones for prospect, draft, submit, and award |
| `design-synthesis` issues with `automated/claude` | Linear issues in a `Design` project, with Figma frame attachments |
| `plan-executor` reads `plan-task` GitHub labels | Read Linear issues with status `Ready for Claude` or a dedicated `automated/claude` label |

Recommended migration order:

1. Migrate `bug-intake` end-to-end first. It has the highest volume, the clearest
   workflow, and the easiest validation path.
2. Migrate `drift-watch` next. It is painful to manage as rolling GitHub project-board
   inventory and maps naturally to Linear parent/child issues.
3. Migrate `grant-scout` into Linear projects after the issue pattern is proven.
   It is structurally valuable but less urgent.

## Preventive Hardening

### MCP and source scope

The `BOT_API_TOKEN` failure and the GitHub MCP source-scoping discovery should be applied
preventively across the routines that create GitHub issues or read/write across repos:

- `design-synthesis`
- `bug-intake`
- `drift-watch`
- `metrics`
- `plan-executor`
- `hotfix`

Audit each routine for two things:

1. Its cloud source or repo configuration includes every repository it reads from or
   creates issues against.
2. Its Setup section says GitHub access comes from the GitHub MCP/source configuration,
   not from `BOT_API_TOKEN`.

Prefer factoring this into a shared `SETUP_PRIMER.md` linked from every routine so future
cloud-environment changes update one source of truth instead of several prompts.

### Schedule drift

Resolve doc-vs-cloud cadence drift explicitly:

- If the cloud cadence is intentional, update the `.md` prompt metadata and routine
  tables to match reality.
- If the docs are intentional, push the weekday schedules back to cloud.
- Treat `health-watch`'s empty cloud cron as the urgent fix because it likely means the
  routine is not running.

### Connector coverage

Connectors that can expand the routine harness:

- Linear: PM substrate for bugs, tech debt, design work, grant projects, and Claude-ready
  dispatch.
- Gmail: ingest grant-program officer replies, partner outreach, and conference
  confirmations without requiring manual forwarding into Discord.
- Notion: include any guild knowledge that still lives there.
- Canva: possible weekly design-synthesis publish destination.
- Webflow or WordPress: possible greenpill.network publishing surface if ecosystem
  moments are managed there.

### Telegram source verification

`BOT_API_TOKEN` is the Telegram bot token. `bug-intake` mentions Telegram, but the routine
has been Discord-heavy in practice. Confirm that the Telegram channel or feedback
environment is configured, that pagination works, and that quiet Telegram runs are logged
as source-empty rather than silently successful.

### Cross-routine continuity

Extend the memo pattern that now exists in `research-synthesis`:

- `design-synthesis`: weekly design memo covering themes, open critiques, and prototype
  iterations.
- `grant-scout`: weekly funding pulse covering warm programs, cooling programs, and next
  owner actions.
- `weekly-checkin`: read prior weeks before writing the current guild-health trend frame.

### Self-audit upgrade

`routine-self-audit` should become the verification layer for the whole harness:

- Check whether each routine's claimed output actually appeared, including Linear issue,
  Drive document, GitHub issue, PR, or Discord post.
- Detect MCP scope errors explicitly, especially 401 and source-excluded failures in run
  logs.
- Track conversion from synthesis insight to Linear cycle to shipped work.
- Keep the cadence table synchronized with cloud reality.

## First Implementation Pattern

Use `bug-intake` as the first Linear migration slice.

Target behavior:

1. Read Discord, Telegram, and Drive as it does now.
2. Deduplicate against existing Linear `Bugs` project issues before creating new work.
3. Create one Linear issue per genuinely new user-reported bug.
4. Apply source labels, product area labels, Cycle assignment, and reporter context.
5. Post the daily summary back to `#product`.
6. Preserve the human gate: humans move the Linear issue to `Ready for Claude`, then the
   implementation routine can pick it up.

Validation:

- Dry-run one Discord-sourced report into Linear.
- Confirm duplicate detection catches an existing Linear issue.
- Confirm the `#product` summary links to Linear, not GitHub.
- Confirm the self-audit routine can verify that the Linear issue exists.

## Follow-Up Audit

Schedule or run a two-week follow-up after these changes land:

- Did `grant-scout` post heartbeats?
- Did `research-synthesis` write a Drive memo?
- Did `routine-issue-cleanup` close anything safely?
- Did `health-watch` run after its cron was fixed?
- Did any routine claim success without a visible output artifact?
