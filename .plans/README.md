# Plan Hub

`.plans/` is the canonical workspace for actionable feature ideas, implementation plans, evaluations, and lane handoffs.

## Canonical Layout

```text
.plans/
  ideas/              # rough concepts and one-pagers
  backlog/            # approved but not yet active
  active/             # active feature hubs that automations scan
  ARCHIVE.md          # ledger of closed hubs; git history is the only archive
  _templates/         # scaffold source for new feature hubs
```

No other top-level entries are supported. Architecture belongs in current package
guides or `docs/`; point-in-time audit and cleanup results stay in the session until
accepted into Linear; operational scratch belongs in ignored `tmp/`; release history
belongs in Git tags, releases, and the closed hub's Git history (indexed by `ARCHIVE.md`).

## Feature Hub Contract

Every new feature or polish effort should live in a dedicated folder:

```text
.plans/{stage}/{feature-slug}/
  brief.md
  spec.md
  plan.todo.md
  eval.md
  status.json
  handoffs/
  reports/
  artifacts/
```

Ideas and backlog hubs keep the four canonical documents plus `status.json`.
Lane handoff files are created when the hub moves to `active`; `reports/` and
`artifacts/` are added only when they contain real evidence.

`status.json` is the machine-readable source of truth for explicit lane state. Queue readiness is computed by `node scripts/harness/plan-hub.mjs list` from `status.json` plus any required branch trigger.

Every direct child of `ideas/`, `backlog/`, and `active/` must be a
feature directory with `status.json`. Loose files and invisible status-less
directories fail validation, and any hub left under `.plans/archive/` fails
validation outright — closed hubs live only in Git history. `links.brief`, `links.spec`, `links.plan`, and
`links.eval` are required and must resolve.

The Markdown files are the human-readable context:

- `brief.md`: the idea in one page
- `spec.md`: product and technical scope, research evidence, and human judgment points
- `plan.todo.md`: research/plan gate and implementation sequencing
- `eval.md`: release gates, QA, and acceptance checks
- `handoffs/`: short lane-to-lane handoff files
- `reports/`: verification outputs, follow-up notes, release summaries
- `artifacts/`: screenshots, logs, scratch outputs that should stay near the plan

## Control-Surface Rules

### Repo Truth and Memory

`.plans/` is the durable repo-truth surface for feature state, handoffs, and evaluations.
Tool-local memory stores and local checkpoints can help an agent resume work, but they do not outrank the
active feature hub.

- Treat `.claude/agent-memory/`, `session-state.md`, `tests.json`, and automation memory as
  environment-local unless an explicit freshness, expiry, and ownership policy says otherwise
- Do not promote a repo-level `.claude/agent-memory/` surface into committed truth by default
- When the hub and a local memory artifact disagree, fix the hub or record the blocker in the hub
- Keep decisions, acceptance criteria, evidence, ownership, and unresolved judgment in the hub.
  Do not copy route, export, endpoint, deployment, or workflow inventories from code; cite their
  owning source instead.

### Validation Posture

Use the fastest honest validation loop for the touched surface:

- `node scripts/harness/plan-hub.mjs validate` for hub and lane-state changes
- targeted `bun run test -- <file>` while shaping a bounded code change
- `bun run test` when the changed surface needs a package or repo-level iterative gate
- `bash scripts/quality/check-test-quality.sh` when touching test governance

Coverage is a scheduled or pre-merge floor, not the default inner loop.

## Lane Ownership

The default lane split is:

| Lane | Owner | Purpose |
|---|---|---|
| `ui` | Claude | user interface, copy polish, visuals |
| `state_api` | Codex | state logic, hooks, APIs, data flow |
| `contracts` | Codex | Solidity, deployments-adjacent contract work, tests |
| `qa_pass_1` | Claude | first QA sweep, UX and flow validation |
| `qa_pass_2` | Codex | second QA sweep, regression and implementation validation |

`qa_pass_2` is intentionally sequential. It should only start after Claude marks `qa_pass_1` as passed.

## Work Branch Contract

`status.json` remains the authoritative lane state. Branch names describe concrete work and never identify the owner or lane.

- Leave a lane branch `null` until implementation begins.
- When a branch is needed, use the repository `<type>/<work-description>` contract and validate it with `node scripts/quality/branch-name-policy.mjs <branch>`.
- Downstream readiness follows lane status and dependency state, not branch existence.

Existing version-1 hubs may retain historical branch signals as provenance. They do not authorize creating or reusing those names.

## Where Automations Live

The actual recurring jobs do **not** live in git:

- Codex schedules live in the Codex app automation store
- Claude schedules live in Claude cron / automation config

Versioned automation instructions belong with their durable caller in `.claude/`,
`docs/routines/`, or the planning harness. Feature state and handoffs stay in
`.plans/active/<feature-slug>/`; automation telemetry stays in the scheduler rather
than creating a second plan-history surface.

## Lifecycle

1. Create a new feature hub in `.plans/backlog/<feature-slug>/`
2. Fill out `brief.md`, `spec.md`, `plan.todo.md`, and `eval.md`, including research evidence and human judgment points for non-trivial work
3. Move the hub to `.plans/active/<feature-slug>/` when it is ready for automation
4. Mark unused lanes as `n/a` in `status.json`
5. Let lane automations claim work from `.plans/active/`
6. Close the hub when the work is completed, superseded, closed, cancelled,
   or intentionally paused: `move --to archive` validates the hub and the
   requested `--resolution`, appends one row to `ARCHIVE.md`, and deletes the
   hub directory. Do not label unfinished stale work as completed.

Git history is the only archive. The `ARCHIVE.md` ledger records each closed hub's
slug, title, resolution, closeout reason, and historical path; recover full contents
with `git log --oneline -- <historical path>` and `git checkout <sha>^ -- <historical path>`
against the closeout commit. Dated reports under `reports/` remain byte-for-byte
immutable while a hub is live and may only leave the tree with their whole hub at
closeout. Do not create parallel audit, review, cleanup, ADR, or meeting-note
folders under `.plans/`.

## Backlog Quality Bar

Backlog is for execution candidates, not general storage.

- Keep only work that is realistic for the next execution cycle or two
- Move strategic research that could become work to `.plans/ideas/`; keep durable
  architecture in current package guides or `docs/`
- Keep agent instructions beside their active caller in `.claude/`; close only
  feature implementation records, not generic prompt packs
- Close broad legacy hubs once the remaining work can be expressed as a smaller follow-up hub

Every hub that remains in `.plans/active/` or `.plans/backlog/` must include real `brief.md`, `spec.md`, `plan.todo.md`, and `eval.md` content. Migration placeholder text is not allowed in the live queue.

## CLI

Use the repo helper script for scaffolding, lane discovery, and status transitions:

```bash
node scripts/harness/plan-hub.mjs scaffold my-feature --title "My Feature"
node scripts/harness/plan-hub.mjs move --feature my-feature --to active
node scripts/harness/plan-hub.mjs list --agent claude --lane ui
node scripts/harness/plan-hub.mjs summary --json
node scripts/harness/plan-hub.mjs stale --days 14 --json
node scripts/harness/plan-hub.mjs set-lane --feature my-feature --lane ui --status in_progress --actor claude
node scripts/harness/plan-hub.mjs move --feature my-feature --to archive --resolution completed --reason "Merged and verified."
node scripts/harness/plan-hub.mjs validate
```

## Legacy Compatibility

The foldered feature hub layout is the only supported plan surface. Do not create new flat files in `.plans/`, `.plans/_backlog/`, or `.claude/plans/`. If a legacy plan artifact appears, migrate it into a feature hub immediately.

The one retained published specification, `docs/docs/builders/specs/revenue-explorer.mdx`, remains where it is. It is a public doc, not part of the live automation queue.
