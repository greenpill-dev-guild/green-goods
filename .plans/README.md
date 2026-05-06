# Plan Hub

`.plans/` is the canonical workspace for feature ideas, implementation plans, evaluations, lane handoffs, and automation prompts.

## Canonical Layout

```text
.plans/
  ideas/              # rough concepts and one-pagers
  backlog/            # approved but not yet active
  active/             # active feature hubs that automations scan
  archive/            # shipped, superseded, or paused work
  audits/             # point-in-time audits (existing convention)
  reviews/            # recurring review outputs (docs, QA sweeps, report-only checks)
  _templates/         # scaffold source for new feature hubs
  _automation/        # automation prompt files and scheduling guidance
```

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

`status.json` is the machine-readable source of truth for explicit lane state. Queue readiness is computed by `node scripts/plan-hub.mjs list` from `status.json` plus any required branch trigger.

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

`.plans/` is the durable repo-truth surface for feature state, handoffs, evaluations, and automation context.
Tool-local memory stores and local checkpoints can help an agent resume work, but they do not outrank the
active feature hub.

- Treat `.claude/agent-memory/`, `session-state.md`, `tests.json`, and automation memory as
  environment-local unless an explicit freshness, expiry, and ownership policy says otherwise
- Do not promote a repo-level `.claude/agent-memory/` surface into committed truth by default
- When the hub and a local memory artifact disagree, fix the hub or record the blocker in the hub

### Validation Posture

Use the fastest honest validation loop for the touched surface:

- `node scripts/plan-hub.mjs validate` for hub and lane-state changes
- targeted `bun run test -- <file>` while shaping a bounded code change
- `bun run test` when the changed surface needs a package or repo-level iterative gate
- `bash scripts/check-test-quality.sh` when touching test governance

Coverage is a scheduled or pre-merge floor, not the default inner loop.

## Lane Ownership

The default lane split is:

| Lane | Owner | Branch Pattern | Purpose |
|---|---|---|---|
| `ui` | Claude | `claude/ui/<feature-slug>` | user interface, copy polish, visuals |
| `state_api` | Codex | `codex/state-api/<feature-slug>` | state logic, hooks, APIs, data flow |
| `contracts` | Codex | `codex/contracts/<feature-slug>` | Solidity, deployments-adjacent contract work, tests |
| `qa_pass_1` | Claude | `claude/qa-pass-1/<feature-slug>` | first QA sweep, UX and flow validation |
| `qa_pass_2` | Codex | `codex/qa-pass-2/<feature-slug>` | second QA sweep, regression and implementation validation |

`qa_pass_2` is intentionally sequential. It should only start after Claude marks `qa_pass_1` as passed and the trigger branch exists.

## Branch Signal Contract

Branch names are a wake-up signal for the next automation. `status.json` remains the authoritative state.

- Claude QA finishes on `claude/qa-pass-1/<feature-slug>`
- Codex QA polls for that branch name and also verifies that `status.json` shows `qa_pass_1.status = "passed"`

Use both checks together. Branch existence alone is not enough, especially in cloud sandboxes where remote refs may lag.

## Where Automations Live

The actual recurring jobs do **not** live in git:

- Codex schedules live in the Codex app automation store
- Claude schedules live in Claude cron / automation config

This repo stores the **versioned prompt source-of-truth** and workflow contract:

- prompt files in `.plans/_automation/`
- plan and handoff state in `.plans/active/<feature-slug>/`
- recurring review outputs in `.plans/reviews/`

That split keeps scheduling platform-specific while keeping instructions, branches, and artifacts reviewable in the repo.

## Lifecycle

1. Create a new feature hub in `.plans/backlog/<feature-slug>/`
2. Fill out `brief.md`, `spec.md`, `plan.todo.md`, and `eval.md`, including research evidence and human judgment points for non-trivial work
3. Move the hub to `.plans/active/<feature-slug>/` when it is ready for automation
4. Mark unused lanes as `n/a` in `status.json`
5. Let lane automations claim work from `.plans/active/`
6. Archive the hub when QA pass 2 is complete and the work is merged or intentionally paused

## Backlog Quality Bar

Backlog is for execution candidates, not general storage.

- Keep only work that is realistic for the next execution cycle or two
- Move strategic research to `.plans/ideas/` or `.plans/adr/`
- Move prompt packs, team prompts, and implementation wrappers to `.plans/_automation/` or `.plans/archive/`
- Archive broad legacy hubs once the remaining work can be expressed as a smaller follow-up hub

Every hub that remains in `.plans/active/` or `.plans/backlog/` must include real `brief.md`, `spec.md`, `plan.todo.md`, and `eval.md` content. Migration placeholder text is not allowed in the live queue.

## CLI

Use the repo helper script for scaffolding, lane discovery, and status transitions:

```bash
node scripts/plan-hub.mjs scaffold my-feature --title "My Feature"
node scripts/plan-hub.mjs move --feature my-feature --to active
node scripts/plan-hub.mjs list --agent claude --lane ui
node scripts/plan-hub.mjs set-lane --feature my-feature --lane ui --status in_progress --actor claude
node scripts/plan-hub.mjs validate
```

## Legacy Compatibility

The foldered feature hub layout is the only supported plan surface. Do not create new flat files in `.plans/`, `.plans/_backlog/`, or `.claude/plans/`. If a legacy plan artifact appears, migrate it into a feature hub immediately.

Published product and developer specifications under `docs/docs/builders/specs/` remain where they are. They are public docs, not the live automation queue.
