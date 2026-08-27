# Harvest Distribution Completion - UI Handoff

## Lane

- Owner: Claude
- Branch: existing `polish/harvest-funds` branch; no branch mutation performed
- Status: implementation prepared; clean-SHA receipt pending

## Scope

- `PositionCard` now presents one state-aware operator workflow with destination-aware confirmation, Safe submission, below-threshold waiting, partial-success retry, and exact confirmed allocation states.
- Emergency pause remains visually and behaviorally separate from the financial action.
- English, Spanish, and Portuguese catalogs and Storybook state harnesses were updated.

## TDD Proof

- RED: `bun run --cwd packages/admin test src/__tests__/components/PositionCard.test.tsx` -> 23 tests failed against the old standalone harvest implementation.
- GREEN: same command -> 1 file and 25 tests passed.
- Proof limit: the implementation is uncommitted, so this is working-tree proof rather than a clean-SHA validation receipt.

## Validation

- Focused and full admin tests, admin test typecheck, admin production build, vocabulary and Storybook quality checks succeeded.
- Authenticated Brave visually verified the static confirmed and partial-success stories. The live authenticated route remains blocked by the managed environment's inability to create the local HTTPS certificate; HTTP loses the authenticated origin.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): focused command above; full admin tests; admin test typecheck; admin build; Storybook build and quality checks
- Result: working-tree checks successful; terminal receipt intentionally withheld until a committed clean SHA exists
- Validated paths: `PositionCard`, its tests and stories, and all three locale catalogs
- Worktree identity command and result: pending because the implementation is intentionally uncommitted
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Complete authenticated real-route keyboard and narrow-viewport QA once local HTTPS can reuse the authenticated Brave origin.
