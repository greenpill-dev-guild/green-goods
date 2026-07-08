# Yield Split UI - Codex QA Pass 2 Handoff

**Lane**: `qa_pass_2`
**Owner**: Codex
**Branch signal**: `codex/qa-pass-2/yield-split-ui`
**Status**: blocked until `qa_pass_1` passes.

## Scope

Run the final evidence pass after Claude QA. Close plan truth only when implementation lanes have recorded proof and the Linear mirror is synced or explicitly documented as pending.

## Checks

- Re-run targeted shared/admin/client/contract validation from the lane handoffs.
- Confirm no lingering hardcoded split config remains in live admin/client surfaces.
- Confirm preset helpers preserve Protocol Treasury bps and sum to `10000`.
- Confirm `setGardenTreasury` hardening proof is recorded in the contracts lane.
- Confirm `node scripts/harness/plan-hub.mjs linear-sync --feature yield-split-ui --json` stays parent-only while the hub is in backlog.
- Confirm Linear PRD-351 is synced when Linear tools are available; child lane issues should only be created or revived after the hub becomes active.

## Validation

```bash
bun run --cwd packages/contracts test:match test/unit/YieldSplitter.t.sol
bun run --cwd packages/shared test src/__tests__/hooks/yield/useSetOperatorYieldSplit.test.ts src/__tests__/hooks/yield/useYieldStatus.test.ts
bun run --cwd packages/admin test src/__tests__/components/Garden/GardenYieldCard.yield-split.test.tsx src/__tests__/components/Vault/PositionCard.yield-split.test.tsx
bun run --cwd packages/client test src/__tests__/components/Dialogs/ConvictionDrawer.yield-split.test.tsx
bun run lint:vocab
node scripts/harness/plan-hub.mjs validate
node scripts/harness/plan-hub.mjs linear-sync --feature yield-split-ui --json
git status -sb
```

If exact test file names differ after implementation, keep the rerun targeted to the final changed yield split surfaces.
