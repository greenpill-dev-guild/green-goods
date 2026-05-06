# Run 2 — diff-and-test lens

Different lens than Run 1 (which used Chrome MCP live verification). This pass looks at what's changed on the branch and whether the test suite + build is clean.

## Branch state vs main

- **2451 files changed**, +228k / -95k since branch from main. Massive scope.
- Recent commit themes (last ~10):
  - `test(playwright): skip ...` × 3 — explicit deferrals to v1.1.1 (commits 7fee5b9, 2927e2a, 722ee75)
  - `fix(stories): ...` × 2 — Storybook play-test alignment
  - `ci(playwright): ...` × 3 — CI infrastructure for e2e (env vars, webServer config)
  - `docs(audits)` × 4 — closing pre-release audit bundle
  - `fix(shared): default vault withdraw maxLoss to 1% (audit #2)` (e22c270e) — real product fix
  - `fix(shared,indexer): clear release/1.1.0 audit Bundle 1` (c476f70d) — audit closeout
- 520 commits since 2026-04-01. Heavy active branch. Contracts, indexer, shared, client, admin all touched.

## Lint state

`bun run lint` finished with **165 warnings, 0 errors**. All warnings are Solidity gas-optimization (`gas-indexed-events`, `gas-struct-packing`, `no-empty-blocks`, `immutable-vars-naming`) — none are correctness or security signals.

## Test state

`bun run test` started in background. Status streaming via Monitor. Will append to this section as results land.

## Public surface bug — verified more deeply

The `/gardens` editorial empty-state finding from Run 1 is confirmed as a real client-side bug, not a data wire-up gap:

- Indexer `Garden(where: {chainId: {_eq: 42161}}, ...)` returns 18 gardens.
- `getGardens()` invoked via dynamic import from the editorial page returns 18 gardens.
- React Query queryKey is `["greengoods", "public", "gardens", chainId]` — App.tsx persister filter (`key[0] === "greengoods"`) does include this, so persistence is not the cause.
- `usePublicGardens` is the consumer; same singleton `greenGoodsIndexer` (URL `http://localhost:8080/v1/graphql`) works for both call paths.
- **Hypothesis**: `usePublicGardens(chainId)` is called with a `chainId` that resolves to something other than 42161 at hook-call time, while the explicit `chainId: 42161` query I ran returned data. `DEFAULT_CHAIN_ID` resolution at module init may differ from what the editorial route's WalletRuntimeProviders surfaces — worth probing the `chainId` argument the hook actually receives in the `/gardens` render.

This is the single real code bug found in this audit; everything else is environment / permissions / not-yet-deployed-data.

## Skipped-tests inventory (re-read with cycle-2 categorization)

Four buckets, mapped to v1.1.0 release readiness:

1. **v1.1.1-deferred** — recent commit messages explicitly say so. **Not a release blocker; tracked in commit history. ✅**
2. **headless-auth** — auth state not persisting in CI test runs. Not a runtime bug; affects CI only. **Defer with bundle.** ⚠️
3. **no-seed-data** — `client.work-submission.spec.ts`, `client.work-approval.spec.ts` skip when no gardens are available. CI fixture issue, not product bug. **Defer.** ⚠️
4. **mock-tx-required / live-rpc-required / real-passkey-required** — environment-gated. **Not bugs.** ✅

## Run 2 conclusions

- Lint clean, branch healthy by static checks.
- One real code bug found: `usePublicGardens` returns empty in-component vs. 18 gardens via direct call. Affects all editorial public surfaces (`/gardens`, `/fund`, `/cookies`, `/impact`, `/actions`).
- Skipped tests are intentionally deferred or environment-gated; no surprises.
- Test results pending; will append.
