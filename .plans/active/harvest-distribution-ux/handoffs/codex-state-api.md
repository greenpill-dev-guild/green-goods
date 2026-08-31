# Harvest Distribution Completion - State/API Handoff

## Lane

- Owner: Codex
- Branch: existing `polish/harvest-funds` branch; no branch mutation performed
- Status: implementation prepared; clean-SHA receipt pending

## Scope

- Added fresh yield-status reads, destination precedence, effective-threshold derivation, and explicit loading/error/waiting/ready states.
- Added the harvest-then-refetch-then-split mutation workflow, Safe stop conditions, partial-success retry, exact `YieldSplit` parsing, finance invalidation, and privacy-safe telemetry.
- Preserved separate deployed `harvest()` and permissionless `splitYield()` behavior.

## TDD Proof

- RED: `bun run --cwd packages/shared test src/__tests__/hooks/yield/useYieldStatus.test.tsx src/__tests__/hooks/yield/useHarvestDistribution.test.tsx` -> initially, two suites could not resolve the intentionally absent hooks; a supplemental edge RED later proved a standalone split failure incorrectly resolved as confirmed-harvest partial success.
- GREEN: same command -> 2 files and 15 tests passed.
- Proof limit: the implementation is uncommitted, so this is working-tree proof rather than a clean-SHA validation receipt.

## Validation

- Focused tests, the full shared test suite, shared source/test typechecks, root lint, source-structure, vocabulary, ontology, and Plan Hub validation ran successfully against the working tree.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): focused command above; `bun run --cwd packages/shared test`; shared source/test typechecks; root lint and structural guards
- Result: working-tree checks successful; terminal receipt intentionally withheld until a committed clean SHA exists
- Validated paths: shared yield hooks, ABI, query invalidation, analytics, exports, and focused tests
- Worktree identity command and result: pending because the implementation is intentionally uncommitted
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- A clean committed SHA is required before this lane can claim completed or merge-ready.
