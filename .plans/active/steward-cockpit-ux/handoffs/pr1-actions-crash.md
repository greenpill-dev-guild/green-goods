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

## Implementation Notes

- The source-structure cap (500 lines) and the need below moved the parser into
  `packages/shared/src/modules/data/indexer-capitals.ts`. It derives names from the numeric enum
  instead of restating them. `parseIndexerDomain` stays in `greengoods.ts`, which the ontology's
  `parsedomain-unknown-coercion` watch reads.
- Codex's review of 608bc9957 found that the reading cache (kept for days) already holds rows with
  the indexer's names for every deployer who met the crash, and restoring it skips the fetch that
  parses. `useActions` and `useSuspenseActions` now pass data through `withKnownCapitals` as a query
  `select`, so fetched and restored lists reach components with known capitals only.

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

Recorded 2026-09-25 (engine: Claude Browser pane, Chromium; session: mock-auth localhost,
`?mockAuth=deployer`, admin dev server on port 3013 reading the hosted indexer `e6edffd`, with
`VITE_DEV_CHAIN_MODE=arbitrum_fork` and `VITE_LOCAL_FORK_RPC_URL=https://arb1.arbitrum.io/rpc` so
the deployer check can read Arbitrum without an Alchemy key): the indexer answered
`capitals: ["MATERIAL", "SOCIAL", "EXPERIENTIAL"]` for Repair Event; `/actions` listed 23 actions
with named capitals ("Material · Social · Experiential") and no route error; the Repair Event
detail dialog opened with Material, Social, and Experiential chips.

## TDD Proof

- RED: `bun run --filter @green-goods/shared test -- src/__tests__/modules/greengoods.module.test.ts`
  on 768bb0b0c plus the new tests → 7 failed | 14 passed: the six table rows failed because
  `parseIndexerCapital` did not exist, and `getActions` returned
  `["MATERIAL", "UNKNOWN", "SOCIAL"]` unparsed where `[1, 0]` was expected.
- RED (restored cache): `bun run --filter @green-goods/shared test -- src/__tests__/hooks/blockchain/useBaseLists.test.ts`
  with the list hook's `select` removed → 1 failed | 14 passed: a list seeded into the cache with
  `["MATERIAL", "UNKNOWN", "SOCIAL"]` came back unparsed.
- GREEN: on 2095e6662, `greengoods.module.test.ts`, `useBaseLists.test.ts`, and
  `useSuspenseBaseLists.test.ts` → 48 passed (the capital table gained a `"toString"` row, which
  guards the enum lookup against prototype keys).
- Proof limit: none

## Validation Receipt

- Tested implementation commit SHA: `2095e6662d896e2eca3a482be16dae53cf9d76d6`
- Run at (UTC): `2026-09-25T06:58:55Z`
- Exact command(s): `bun run --filter @green-goods/shared test -- src/__tests__/modules/greengoods.module.test.ts src/__tests__/hooks/blockchain/useBaseLists.test.ts src/__tests__/hooks/blockchain/useSuspenseBaseLists.test.ts`; `bun run --filter @green-goods/shared typecheck`; `PATH="$PWD/node_modules/.bin:$PATH" node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/hooks/blockchain/useBaseLists.test.ts`
- Result: 48 passed (3 files); shared typecheck exit 0; push gate (critical plan, 23 checks: format, lint, shared/client/admin/agent typechecks, suites, and builds, source-structure, design-guardrails, ontology, agent-guidance, supply-chain) "Selected validation plan passed"
- Validated paths: `packages/shared/src/modules/data/indexer-capitals.ts`, `packages/shared/src/modules/data/greengoods.ts`, `packages/shared/src/hooks/blockchain/useBaseLists.ts`, `packages/shared/src/hooks/blockchain/useSuspenseBaseLists.ts`, `packages/shared/src/__tests__/modules/greengoods.module.test.ts`, `packages/shared/src/__tests__/hooks/blockchain/useBaseLists.test.ts`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/shared/src/modules/data/indexer-capitals.ts packages/shared/src/modules/data/greengoods.ts packages/shared/src/hooks/blockchain/useBaseLists.ts packages/shared/src/hooks/blockchain/useSuspenseBaseLists.ts packages/shared/src/__tests__/modules/greengoods.module.test.ts packages/shared/src/__tests__/hooks/blockchain/useBaseLists.test.ts` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 2095e6662d896e2eca3a482be16dae53cf9d76d6..HEAD -- packages/shared/src/modules/data/indexer-capitals.ts packages/shared/src/modules/data/greengoods.ts packages/shared/src/hooks/blockchain/useBaseLists.ts packages/shared/src/hooks/blockchain/useSuspenseBaseLists.ts packages/shared/src/__tests__/modules/greengoods.module.test.ts packages/shared/src/__tests__/hooks/blockchain/useBaseLists.test.ts` → empty (exit 0); the later commit changes only `.plans/`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/shared/src/modules/data/indexer-capitals.ts packages/shared/src/modules/data/greengoods.ts packages/shared/src/hooks/blockchain/useBaseLists.ts packages/shared/src/hooks/blockchain/useSuspenseBaseLists.ts packages/shared/src/__tests__/modules/greengoods.module.test.ts packages/shared/src/__tests__/hooks/blockchain/useBaseLists.test.ts` → empty

## Risks / Blockers

- Production may run a different indexer deployment that returns numbers; the parser accepts
  both.
