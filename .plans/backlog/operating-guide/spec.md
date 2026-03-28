# Plan Hub Operating Guide

This is the day-to-day operating guide for feature work in the Green Goods plan hub.

## What Lives Where

- `.plans/backlog/<feature-slug>/`: approved work that is not ready for automation yet
- `.plans/active/<feature-slug>/`: live work that automations may claim
- `.plans/archive/<feature-slug>/`: shipped, superseded, paused, or reference work
- `.plans/reviews/docs/`: dated docs review outputs
- `.plans/_automation/`: versioned prompt source for Codex and Claude jobs

The schedules themselves live in Codex and Claude, not in git.

## Feature Hub Contract

Every active feature should have:

- `brief.md`: one-page framing
- `spec.md`: requirements and constraints
- `plan.todo.md`: implementation sequencing
- `eval.md`: release gates and QA checks
- `status.json`: machine-readable lane state
- `handoffs/`: lane-to-lane notes

## Start A New Feature

1. Scaffold a hub:

```bash
node scripts/plan-hub.mjs scaffold my-feature --title "My Feature"
```

2. Fill in `brief.md`, `spec.md`, `plan.todo.md`, and `eval.md`
3. Decide which lanes are actually needed
4. Move the feature to active:

```bash
node scripts/plan-hub.mjs move --feature my-feature --to active
```

5. In `status.json`, mark unused lanes as `n/a`
6. Mark the starting lanes ready by setting their lane state explicitly

## Lane Model

Default lane ownership:

| Lane | Owner | Branch Pattern | Role |
|---|---|---|---|
| `ui` | Claude | `claude/ui/<feature-slug>` | UI, copy polish, visuals |
| `state_api` | Codex | `codex/state-api/<feature-slug>` | hooks, stores, query logic, APIs |
| `contracts` | Codex | `codex/contracts/<feature-slug>` | contract changes and tests |
| `qa_pass_1` | Claude | `claude/qa-pass-1/<feature-slug>` | first QA pass |
| `qa_pass_2` | Codex | `codex/qa-pass-2/<feature-slug>` | second QA pass |

`qa_pass_2` is sequential. It only opens after:

- `qa_pass_1` is marked passed in `status.json`
- the trigger branch `claude/qa-pass-1/<feature-slug>` exists

## Cadence

Recommended weekday hourly sequence:

1. Claude UI at `:05`
2. Codex state/API at `:15`
3. Codex contracts at `:25`
4. Claude QA pass 1 at `:35`
5. Codex QA pass 2 at `:45`

This gives parallel implementation lanes and serialized QA.

Recommended weekly docs sequence:

1. Codex docs pass 1 on Wednesday afternoon
2. Claude docs pass 2 after the Codex docs branch and report exist

## How Automations Claim Work

They do not scan Markdown heuristically. They use the helper CLI:

```bash
node scripts/plan-hub.mjs list --agent claude --lane ui --json
node scripts/plan-hub.mjs list --agent codex --lane state_api --json
```

When a lane starts:

```bash
node scripts/plan-hub.mjs set-lane --feature my-feature --lane ui --status in_progress --actor claude --branch claude/ui/my-feature
```

When it finishes:

```bash
node scripts/plan-hub.mjs set-lane --feature my-feature --lane ui --status passed --actor claude
```

## Required Discipline

- `status.json` is the source of truth for explicit state
- branch names are the wake-up signal for downstream work
- every lane writes a short handoff into `handoffs/`
- legacy imported hubs stay blocked until a human classifies their lanes
- do not create new flat files in `.plans/`

## Weekly Cleanup

Once a week:

1. Review active hubs that are still fully blocked
2. Archive anything implemented or superseded
3. Convert placeholder `spec.md` files on active hubs into real requirements
4. Review docs reports under `.plans/reviews/docs/`

## Current Gaps

The migration centralized the plan surface, but many imported legacy hubs still have generated `spec.md` placeholders. Those should be normalized before automations act on them.
