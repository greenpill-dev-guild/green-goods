# Product Development Harness Improvement Notes

Captured: 2026-05-02 PT
Partially superseded: 2026-05-07 routine-portfolio reset

> **Update 2026-05-07.** A routine-portfolio reset on 2026-05-07 superseded several specific decisions in this note. The current portfolio is captured in [`README.md`](./README.md) and the guild [`README.md`](https://github.com/greenpill-dev-guild/.github/blob/main/routines/claude/README.md). High-level changes:
>
> - `metrics` paused — split into `growth-pulse` (Mon weekly, Linear anomalies + `develop` digest PR) and `engineering-pulse` (Sun weekly, GitHub Project #4).
> - `drift-watch` paused — folded into `engineering-pulse`.
> - `bug-intake` cadence reduced from daily M-F to M/W/F.
> - `plan-executor` and `hotfix` moved to on-demand (no cron).
> - Guild routines: `guild-daily-synthesis`, `guild-product-development-synthesis`, `guild-weekly-checkin`, `research-synthesis`, `design-synthesis`, `routine-issue-cleanup` are being paused/folded; replacements are `guild-weekly-synthesis` (Mon), `weekly-insights` (Fri), and an upgraded `routine-self-audit`.
>
> The Linear-migration framing in this note still stands as **direction** (Linear for product/strategy, GitHub for code-local audit). The specific routine names referenced below should be re-read with the consolidations above in mind. Future authors: when this note's body conflicts with the README, the README wins.

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

## Decision: routine-only, intake-first Linear bridge (2026-05-02)

The first migration slice runs with **no new hosted bridge, bot service, webhook worker,
or n8n workflow**. The substrate moves through three coordinated changes only:

- `bug-intake` writes Customer Needs and optional linked Issues into the existing **`Green Goods`
  Linear project** instead of GitHub Bug Board #18. See `bug-intake.md` for the full
  intake contract — Customer Need template, Discord summary template, dedupe and rejection
  rules.
- The team uses **Linear's native Discord integration** (`/linear issue`, `/linear
  search`, `/linear wrap`) for in-the-moment routing and daily personal wrap summaries;
  Discord message threads are linked through Linear's Discord link flow or issue UI.
- The intake-first Customer Need contract preserves all open user signals (bug, idea,
  operator pain, UX feedback). Linear Issues are created only for the actionable subset
  with a clear surface; everything else stays as a Customer Need until human triage decides
  whether to ship it.
- Fireflies/n8n `product-sync` ingestion is retired from this migration path. Product-sync
  synthesis should re-enter through agent/routine-based synthesis, not a Fireflies → n8n →
  GitHub trigger issue workflow.

Implementer migration is intentionally deferred:

- `plan-executor` continues to dispatch off the GitHub `plan-task` label. Its `.md`
  documents the future Linear contract (`Status = Ready` + `automation:claude`) but the
  GitHub path is the only active source of work.
- `hotfix` continues to read GitHub Bug Board #18 `Ready`. That queue stays near-empty
  during the migration because `bug-intake` no longer writes to it; expect mostly-silent
  hotfix runs.

This sequencing matches the principle the May 2 hardening pass applied: migrate the
producer first, prove the contract, then migrate the implementers. It preserves the
working GitHub code-and-PR substrate while the Linear intake path is proven.

### Linear interface contract (intake first)

| Surface | Status today | What's expected |
|---|---|---|
| Project | `Green Goods` already exists | Used as the intake umbrella; do NOT create a new project |
| Issue statuses | `Backlog`, `Todo`, `Ready`, `In Progress`, `In Review`, `Done` already exist | Customer Needs do not use workflow status; linked Issues start at `Backlog` (exploratory) or `Todo` (well-scoped); humans move linked Issues to `Ready` only after dispatch is enabled |
| Labels — `source:discord` | exists on `Contributors` | reuse; re-check visibility if the routine moves to dedicated product teams |
| Labels — `source:drive` | exists on `Contributors` | reuse; re-check visibility if the routine moves to dedicated product teams |
| Labels — `source:telegram` | exists | reuse |
| Labels — `work:customer-need`, `work:polish` | exist | reuse on Issues only; Customer Needs carry request context in their body/links |
| Labels — `area:*` | exist | reuse |
| Labels — `automation:routine` | exists | applied by intake on linked Issues it creates |
| Labels — `automation:claude`, `automation:codex` | exist | human-applied on a `Ready` Linear Issue to release dispatch; intake never applies these |

### Out of scope

- No hosted bridge, n8n workflow, or webhook worker.
- No automatic `automation:claude` / `automation:codex` application — those stay human-gated.
- No reshuffle of `drift-watch`, `health-watch`, `metrics`, or `pr-review` — those continue
  to write GitHub artifacts. Linear is for user-reported intake first; tech-debt and ops
  health migrations come later.

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

| Current GitHub output | Linear destination | Status (2026-05-02) |
|---|---|---|
| `bug-intake` issues on Bug Board #18 | Customer Needs (every signal) and linked Issues (actionable subset) inside the existing `Green Goods` project. Customer Needs carry source/reporter context in the body and project/customer/Issue links; linked Issues carry `source:*`, `work:polish`, `area:*`, and `automation:routine` labels | **active first pass** — see `bug-intake.md` |
| `drift-watch` rolling per-package drift snapshots | Linear Issues under a `Tech Debt` project; use parent/child relationships for snapshot findings and fix tasks | deferred — keep GitHub Project #4 |
| `research-synthesis` `research:insight` issues in `.github` | Linear documents, because insights are knowledge artifacts before they become tasks | deferred |
| `grant-scout` grant-tracker issues in `.github` | Linear projects, one grant per project, with milestones for prospect, draft, submit, and award | deferred |
| `design-synthesis` issues with `automated/claude` | Linear Issues in a `Design` project, with Figma frame attachments | deferred |
| `plan-executor` reads `plan-task` GitHub labels | Future: read Linear Issues with status `Ready` and label `automation:claude` after intake is proven. Customer Need is the user-facing record; the Linear Issue is the dispatch surface | documented in `plan-executor.md`, **not yet active** |
| `hotfix` reads Bug Board #18 `Ready` | Future: read Linear Issues with status `Ready`, label `automation:claude`, label `work:polish`, source `source:discord`/`source:telegram`, priority p2 after plan-executor pickup is proven | documented in `hotfix.md`, **not yet active** |

Migration order:

1. **(active)** `bug-intake` — Customer Needs first, linked Issues for actionable work. Highest
   volume and clearest workflow. Validation: dry-run a Discord report, confirm the duplicate
   detection, confirm the Discord summary links to Linear, confirm the `#product` summary
   surfaces a setup failure when one is injected.
2. **(next)** `plan-executor` Linear pickup. Once `bug-intake` has proven the Linear
   contract for at least two weeks, switch dispatch eligibility to read Linear Issues with
   `Status = Ready` + `automation:claude`. Keep the GitHub `plan-task` path active during
   the crossover window so nothing falls through.
3. **(after plan-executor)** `hotfix` Linear pickup. Same crossover model — wait for the
   Linear path to be stable on `plan-executor` first because hotfix touches `main`
   directly and any contract bug there has a much higher blast radius.
4. **(deferred)** `drift-watch`, `grant-scout`, `design-synthesis`, `research-synthesis` —
   Linear destinations only after the implementer routines have run stably for several
   weeks, because re-routing producers without observed Linear-to-Codex / Linear-to-Claude
   dispatch creates a write-only inventory.

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

## First Implementation Pattern (active 2026-05-02)

`bug-intake` is the first Linear migration slice. The target behavior is documented in
`bug-intake.md`; the summary below tracks the contract this routine commits to so the
self-audit routine has something concrete to verify.

Behavior contract:

1. Read Discord, Telegram, and Drive as before.
2. Deduplicate against existing Customer Needs and Issues in the Linear `Green Goods`
   project before creating new work — match on message URL, error text, surface, and
   reporter+surface within 7 days.
3. Create one Customer Need per genuinely new user/community signal (every validated
   report, including ideas and operator pain). Associate it with the `Green Goods`
   project and customer/garden when known; keep source, reporter, dedupe, evidence, and
   privacy-safe context in the body.
4. Create a linked Linear Issue only when the report is actionable — clear bug or polish
   task with a known surface. Apply `source:*`, `work:polish`, `area:*`, and
   `automation:routine`. Issue status starts at `Backlog` (exploratory) or `Todo`
   (well-scoped).
5. Acknowledge every Discord/Telegram reporter with the Customer Need URL and a ✅
   reaction (Discord) or `/notify` reply (Telegram).
6. Post the daily `#product` summary linking to Linear records, surfacing Customer Needs
   without linked Issues or human follow-up, surfacing linked Issues in `Backlog`/`Todo`,
   and surfacing any Linear setup failure (missing project, missing label, auth error) in
   the same message.
7. Preserve the human gate: humans decide when a Customer Need becomes implementation
   work. This routine never sets `Ready` and never applies `automation:claude` /
   `automation:codex`; those dispatch signals belong to a later implementer migration.

Validation (run before re-enabling the routine in production):

- Dry-run one Discord-sourced report into Linear; confirm the Customer Need appears with
  the right project/customer context and the linked Issue appears with the right labels
  and status.
- Dry-run a duplicate Discord report against an existing Customer Need; confirm a comment
  is added and no new record is created.
- Dry-run a Telegram idea; confirm Customer Need only (no linked Issue).
- Dry-run a Drive grant/strategy note; confirm rejection (no Customer Need, no Issue).
- Confirm the `#product` summary links to Linear, not GitHub.
- Inject a Linear failure (e.g., missing `source:drive` label); confirm the Discord
  summary surfaces the failure and the run does not silently swallow records.
- Confirm `routine-self-audit` can verify the Linear Customer Need / Issue exists for a
  recent run.

## Follow-Up Audit

Schedule or run a two-week follow-up after these changes land:

- Did `grant-scout` post heartbeats?
- Did `research-synthesis` write a Drive memo?
- Did `routine-issue-cleanup` close anything safely?
- Did `health-watch` run after its cron was fixed?
- Did any routine claim success without a visible output artifact?
