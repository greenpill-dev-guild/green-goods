# Admin Dashboard Stabilization Evaluation Plan

## Release Gates

1. Plan integrity: the hub is complete, valid, and remains in backlog until a
   maintainer promotes it.
2. Contract preservation: `CanvasLayout`, `/hub`, ADR-019 canonical routes, and
   deployer-only `/actions` remain fixed.
3. Loading correctness: `/` and direct canvas routes share terminal auth/access
   behavior.
4. Storybook reliability: admin workspace stories do not depend on leaked state
   from previous stories.
5. Garden state coherence: role-confirmed eligible gardens remain selectable,
   visible in permission decisions, and usable by detail data.
6. Evidence quality: validation commands, proof limits, and dirty worktree
   caveats are recorded before lanes are marked complete.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Plan hub | `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, and `handoffs/` exist and validate | system | `node scripts/harness/plan-hub.mjs validate` |
| AC-2 | Storybook isolation | Full admin Storybook CI does not depend on prior story order or singleton store state | `state_api` | failing-before/passing-after story proof plus `test:stories:ci` |
| AC-3 | Direct route auth | `/hub/work` and `/` render matching disconnected, embedded-wallet, no-access, indexer-error, and ready states | `ui`, `state_api` | focused admin route/auth tests |
| AC-4 | Eligible garden fallback | A role-confirmed operator garden missing from the base list remains usable in selection, toolbar, and detail data | `state_api` | focused shared tests and admin story/test evidence |
| AC-5 | Actions policy | Operators cannot access `/actions`; deployers can load Actions registry, detail, create, and edit stories | `ui`, `state_api` | route/role tests and Storybook CI story proof |
| AC-6 | Regression review | Admin build, hub tests, Storybook checks, and plan evidence agree | `qa_pass_2` | QA handoff with command output |

## Test Strategy

- Unit:
  - shared admin access-state hook terminal states
  - eligible-garden fallback with stale base-list role recovery
  - Actions controller deployer-only manage policy
- Integration:
  - admin direct route tests for `/hub/work` in disconnected, embedded,
    no-access, indexer-error, and ready states
  - Storybook admin reset harness proof
- Storybook:
  - admin workspace stories with isolated query/store/auth state
  - Actions stories using deployer identity and matching seeds
- Build:
  - admin TypeScript and production build after route or shared hook changes
- TDD proof:
  - RED/GREEN commands and evidence are recorded in lane handoffs and summarized
    in `status.json`.

## Validation Ladder

Audit creation:

- `node scripts/harness/plan-hub.mjs validate`

Later remediation minimum:

- `bun --bun tsc --noEmit -p packages/admin/tsconfig.json`
- `bun run --filter @green-goods/admin test:hub`
- `bun run --filter @green-goods/shared check:stories`
- `bun run --filter @green-goods/shared check:story-quality`
- `bun run --filter @green-goods/shared test:stories:ci`
- `bun run --filter @green-goods/admin build`

Add broader validation only if shared public interfaces or route contracts move.

## QA Sequence

### Claude QA Pass 1

- Review UX consistency of terminal states across `/` and direct canvas routes.
- Confirm Storybook isolation actually resets state rather than relying on story
  order.
- Confirm no legacy route aliases, shell replacements, or admin-local hooks were
  introduced.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists:
  `claude/qa-pass-1/admin-dashboard-stabilization`.
- Re-run targeted validation.
- Confirm `status.json`, lane handoffs, and source diff describe the same
  outcome.

## Archive Criteria

This hub can move to `.plans/archive/` only after:

- all implementation lanes are `passed`, `completed`, `skipped`, or `n/a`;
- direct canvas route terminal states are tested;
- Storybook admin workspace CI is reliable from a clean run;
- eligible-garden fallback consumers are aligned;
- `/actions` route, controller, and stories agree on deployer-only access;
- `status.json` history records the final validation evidence.

## Failure Modes To Watch

- Treating stabilization as a visual redesign.
- Replacing `CanvasLayout` instead of fixing its access-state inputs.
- Making Storybook pass with story-only behavior that hides runtime bugs.
- Using operator seeds for deployer-only Actions stories.
- Treating role-confirmed stubs as fully indexed garden records without any
  stale-base-list signal.
- Claiming success from isolated Storybook stories while full CI still fails.
