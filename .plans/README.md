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
- `spec.md`: product and technical scope
- `plan.todo.md`: implementation sequencing
- `eval.md`: release gates, QA, and acceptance checks
- `handoffs/`: short lane-to-lane handoff files
- `reports/`: verification outputs, follow-up notes, release summaries
- `artifacts/`: screenshots, logs, scratch outputs that should stay near the plan

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
2. Fill out `brief.md`, `spec.md`, `plan.todo.md`, and `eval.md`
3. Move the hub to `.plans/active/<feature-slug>/` when it is ready for automation
4. Mark unused lanes as `n/a` in `status.json`
5. Let lane automations claim work from `.plans/active/`
6. Archive the hub when QA pass 2 is complete and the work is merged or intentionally paused

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

Older flat files in `.plans/` and `.plans/_backlog/` remain in the repo. Do not create new feature work in the flat layout. When touching legacy work, migrate it into a foldered feature hub first.

Published product and developer specifications under `docs/docs/builders/specs/` remain where they are. They are public docs, not the live automation queue.
