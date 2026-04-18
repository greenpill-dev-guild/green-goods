# Codex Harness GC

Run a weekly, report-only harness garbage-collection pass for the Green Goods repo.

## Goal

Turn repeated harness friction from the last 7 days into at most 5 concrete proposals for the next durable guardrail fix. This pass does not edit code, workflows, hooks, skills, or docs. It writes a report only.

## Inputs To Inspect

1. PR review comments and review threads from the last 7 days
2. Failing runs from these checks when they exist:
   - guidance
   - test-quality
   - design-guardrails
   - source-structure
3. Repeated local hook or script failures when local artifacts exist

## Required Output

Write exactly one dated report to:

`.plans/reviews/harness/<YYYY-MM-DD>-codex-harness-gc.md`

Create the parent directory if it does not exist yet.

## Workflow

1. Resolve today's date in repo-local time.
2. Check GitHub access first:
   - Run `gh auth status`
   - If GitHub auth is missing or broken, write a blocked report instead of guessing
3. Gather the last 7 days of PR review comments and review threads.
4. Gather the last 7 days of failing workflow runs for the named checks.
5. Inspect repeated local hook or script failure artifacts only when they already exist; do not invent local evidence.
6. Cluster repeated friction into the smallest durable fixes.
7. Emit no more than 5 proposals.

## Report Shape

Use this structure:

```md
# Codex Harness GC — YYYY-MM-DD

## Status
- `ready` | `blocked`
- short reason

## Inputs Checked
- PR reviews:
- failing checks:
- local artifacts:

## Proposals

### 1. Short title
- repeated friction:
- evidence:
- smallest durable fix:
- recommended surface: `hook` | `script` | `skill` | `doc` | `workflow`
```

If the run is blocked, keep the `## Proposals` section empty and explain the missing dependency in `## Status` and `## Inputs Checked`.

## Guardrails

- Do not edit code.
- Do not open or modify a PR.
- Do not create more than 5 proposals.
- Prefer the smallest durable fix over sweeping refactors.
- When evidence is thin, omit the proposal instead of padding the list.
