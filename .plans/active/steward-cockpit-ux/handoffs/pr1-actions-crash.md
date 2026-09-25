# Steward Cockpit UX Fixes — PR1 Actions Crash

## Lane

- Execution sub-lane: `pr1_actions_crash` (machine lane `state_api`)
- Branch: `fix/actions-capitals-crash` (already on origin; its first commit opens this hub)
- Depends on: nothing
- Merge: the implementing agent merges with `--merge` once CI Gate is green and bot reviews are
  resolved
- Linear child: see `status.json` → `execution_sub_lanes.pr1_actions_crash.linear.issue`

## Scope

- **D1 (P0)**: `/actions` renders the route error boundary ("[@formatjs/intl] An `id` must be
  provided to format a message") for every deployer reading the hosted indexer. The indexer returns
  action capitals as enum names (`"MATERIAL"`, `"SOCIAL"`, …).
  `packages/shared/src/modules/data/greengoods.ts:288` casts them with `c as Capital`, so
  `ACTION_CAPITAL_LABEL_IDS` (`packages/shared/src/hooks/admin-ui/actions/actions.utils.ts:19`,
  keyed by the numeric `Capital` enum in `packages/shared/src/types/domain.ts:28`) resolves to
  `undefined`, and `intl.formatMessage` throws in
  `packages/admin/src/views/Actions/index.tsx:214` and `ActionDetailPanel.tsx:167`. Storybook
  fixtures use numbers, which is why stories pass.

## Steps

1. Add `parseIndexerCapital(value: unknown): Capital | null` beside `parseIndexerDomain` (same
   file, line 28). Accept enum names (`SOCIAL` … `CULTURAL`), numbers `0`–`7`, and numeric strings;
   return `null` for anything else.
2. At line 288, map through it and drop nulls:
   `capitals: Array.isArray(capitals) ? capitals.map(parseIndexerCapital).filter(isCapital) : []`.
   This is the only unsafe `as Capital` cast in the repository.
3. No UI change is needed once only known capitals reach the views.

## Tests

- RED first: an `it.each` table in
  `packages/shared/src/__tests__/modules/greengoods.module.test.ts` for `parseIndexerCapital`
  (`"MATERIAL"` → 1, `"SOCIAL"` → 0, `3` → 3, `"3"` → 3, `"UNKNOWN"` → null, `9` → null).
- One `getActions` case whose indexer row has `capitals: ["MATERIAL", "SOCIAL"]` and expects
  `[Capital.MATERIAL, Capital.SOCIAL]`.

## QA and Docs

- Check ADM-100 to ADM-102 (Actions); change their text only if they describe the crash.
- No design-log rows to codify.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/modules/greengoods.module.test.ts
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/modules/greengoods.module.test.ts
```

## Rendered Proof

Mock-auth localhost (`?mockAuth=deployer`, admin dev server with
`VITE_ENVIO_INDEXER_URL=https://indexer.hyperindex.xyz/e6edffd/v1/graphql`): `/actions` shows the
registry with capital names, and an action's detail opens. Label the engine and session in the PR.

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none recorded

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Production may run a different indexer deployment that returns numbers; the parser accepts
  both.
