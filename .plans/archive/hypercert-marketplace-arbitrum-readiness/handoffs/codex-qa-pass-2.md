# QA Pass 2 Handoff

**Actual branch**: `main` per operator branch lock.
**Planned branch**: `codex/qa-pass-2/hypercert-marketplace-arbitrum-readiness`
**Status**: passed.
**Date**: 2026-05-10 America/Los_Angeles.

## Scope

Regression and integrity sweep only. No implementation fixes were made. No contract broadcast commands were invoked. Existing dirty files outside this QA lane were preserved as other agents' work-in-progress.

## Validation Results

| # | Command | Result |
|---|---|---|
| 1 | `node scripts/harness/plan-hub.mjs set-lane --feature hypercert-marketplace-arbitrum-readiness --lane qa_pass_2 --status in_progress --actor codex --note "Operator authorized direct in_progress; staying on main."` | Exit 0. Output: `Updated hypercert-marketplace-arbitrum-readiness lane qa_pass_2 -> in_progress`. |
| 2 | `node scripts/harness/plan-hub.mjs validate` | Exit 0. Output: `Validated 20 feature hubs.` |
| 3 | `cd packages/contracts && bun run test:script -- script/utils/marketplace-readiness.test.ts` | Exit 0. Vitest ran `script/utils/marketplace-readiness.test.ts` and package script glob. Test Files: 2 passed (2). Tests: 16 passed (16). Duration: 223ms. |
| 4 | `cd packages/contracts && bun run test:script` | Exit 0. Test Files: 2 passed (2). Tests: 16 passed (16). Duration: 188ms. |
| 5 | `cd packages/shared && bun run test src/__tests__/utils/marketplace-readiness.test.ts src/__tests__/modules/marketplace src/__tests__/hooks/hypercerts/useMarketplaceApprovals.test.ts src/__tests__/hooks/hypercerts/useCreateListing.test.ts src/__tests__/hooks/hypercerts/useBatchListForYield.test.ts src/__tests__/hooks/hypercerts/useCancelListing.test.ts src/__tests__/hooks/hypercerts/useHypercertListings.test.ts src/__tests__/hooks/hypercerts/useTradeHistory.test.ts src/__tests__/hooks/query-keys.test.ts src/__tests__/i18n/locale-coverage.test.ts` | Exit 0. Test Files: 12 passed (12). Tests: 106 passed (106). Duration: 4.22s. |
| 6 | `cd packages/shared && bun run typecheck` | Exit 0. `tsc --noEmit` completed with no diagnostics. |
| 7 | `cd packages/admin && bun run test src/__tests__/components/hypercerts/MarketplaceApprovalGate.test.tsx` | Exit 0. Test Files: 1 passed (1). Tests: 8 passed (8). Duration: 6.48s. |
| 8 | `cd packages/admin && bun run test src/__tests__/components/hypercerts/` | Exit 0. Test Files: 7 passed (7). Tests: 153 passed (153). Duration: 8.72s. |
| 9 | `cd packages/admin && bun run test src/__tests__/components/` | Exit 0. Test Files: 30 passed (30). Tests: 314 passed, 3 skipped, 317 total. Duration: 91.09s. |
| 10 | `cd packages/admin && VITE_CHAIN_ID=11155111 bun run build` | Exit 0. `tsc --noEmit` and Vite build succeeded. `12031 modules transformed`; final line `built in 1m 41s`. Existing Rollup pure-comment notices and large chunk warning remain non-blocking. |
| 11 | `bun run lint:vocab` | Exit 0. Output: `check-vocab: no banned vocabulary found in 3 i18n file(s).` |
| 12 | `bun run --filter @green-goods/shared check:stories` | Exit 0. `173/173 required Storybook surfaces have stories (100%)`. Final output: `PASS: Required Storybook contract is satisfied.` |
| 13 | `bun run check:design-tokens` | Exit 1 on known unrelated client drift. Output listed `packages/client/vite/social-preview.ts` hardcoded values: four `#000000` SVG shadow/stop colors plus `HERO_CARD_ACCENT_COLOR = "#167947"`, `HERO_CARD_FILL = "#f7f0e4"`, `HERO_CARD_LEDE_COLOR = "#514a3d"`, and `HERO_CARD_TITLE_COLOR = "#221f18"`. Not fixed in this lane. |
| 14 | `bun run check:design-generated` | Exit 1 on known unrelated docs drift. Output: `DesignMD generated artifact is stale: docs/docs/builders/packages/client-pwa-token-audit.generated.md`. Not fixed in this lane. |
| 15 | `node scripts/harness/plan-hub.mjs set-lane --feature hypercert-marketplace-arbitrum-readiness --lane qa_pass_2 --status passed --actor codex --note "QA pass 2 passed: regression validated, plan-hub clean, no unauthorized broadcast, post-tx evidence recorded."` | Exit 0. Output: `Updated hypercert-marketplace-arbitrum-readiness lane qa_pass_2 -> passed`. |
| 16 | `node scripts/harness/plan-hub.mjs validate` | Exit 0. Output: `Validated 20 feature hubs.` Status check after refresh shows `workflow.overall_status: "done"` and `lanes.qa_pass_2.status: "passed"`. |

## Broadcast / AC-11 Verification

Verdict: **pass**.

- No broadcast happened from qa_pass_2. I did not invoke `contracts:marketplace:configure:arbitrum`, `contracts:marketplace:configure:dry:arbitrum`, or the known-faulty `contracts:marketplace:status:arbitrum` wrapper.
- `packages/contracts/deployments/42161-latest.json` contains the marketplace fields that match the contracts handoff's direct JSON-RPC evidence:
  - `hypercertsModule`: `0x9CB6300cb0DD64dfe577944d7a8AF70799Fe3ef0`
  - `hypercertExchange`: `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83`
  - `hypercertMinter`: `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`
  - `marketplaceAdapter`: `0xE396137ef12c30075fd0B8509C6e389750f36159`
  - `transferManager`: `0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB`
  - `strategyHypercertFractionOffer`: `0xecab24cade0261fc6513ca13bb3d10f760af3da8`
- `packages/contracts/script/marketplace-readiness.ts` still throws before any configure broadcast unless `MARKETPLACE_CONFIGURE_APPROVED=true`: `Marketplace configure broadcast requires MARKETPLACE_CONFIGURE_APPROVED=true and fresh operator approval.`
- Root wrapper `contracts:marketplace:configure:arbitrum` does not set `MARKETPLACE_CONFIGURE_APPROVED=true`; fresh operator approval remains required before the broadcast path can run.
- Post-transaction evidence exists in `handoffs/codex-contracts.md`: Blockscout tx `0xc7db7c247d4b770d2ebbd32f3fa1dc47dcb82acbebaaff2c148dfb29fb7071e5`, adapter `setHypercertMinter`, from `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`, timestamp `2026-05-10T20:50:31Z`, plus direct JSON-RPC reads for adapter exchange/minter, module minter/adapter, authorized module, owners, transfer manager, and strategy `1`.

## Acceptance Criteria Cross-Check

| AC | Result | Evidence |
|---|---|---|
| AC-1 | Pass with proof-limit note | `handoffs/codex-contracts.md` records direct viem JSON-RPC evidence for adapter/module/owner/authorized module/exchange/minter. The local `cast` status wrapper is known false-zero and was not used as authority. |
| AC-2 | Pass | `handoffs/codex-contracts.md` records the dry-run call plan and zero/config mismatch checks; qa_pass_2 confirmed the broadcast script still requires `MARKETPLACE_CONFIGURE_APPROVED=true`. |
| AC-3 | Pass with proof-limit note | `handoffs/codex-contracts.md` records post-broadcast direct JSON-RPC evidence for adapter/module/exchange/minter/transfer manager/strategy/owner/authorized module state. |
| AC-4 | Pass | `handoffs/codex-contracts.md` records narrowed Envio verifier scope and skipped deployed-but-undefined contracts. |
| AC-4a | Pass | Operator broadcast resolved the enable-now stall; the old blocked state was reconciled in `status.json` and `handoffs/codex-contracts.md`. |
| AC-5 | Pass | `handoffs/codex-state-api.md`; qa_pass_2 shared readiness tests passed, 12 files / 106 tests. |
| AC-6 | Pass | `handoffs/codex-state-api.md`; qa_pass_2 hook guard tests passed for approval, create, batch, cancel, listings, trade history, and query keys. |
| AC-7 | Pass | `handoffs/claude-ui.md` and `handoffs/claude-qa-pass-1.md`; qa_pass_2 `MarketplaceApprovalGate` test passed 8/8. |
| AC-8 | Pass | UI state matrix covered by qa_pass_1; qa_pass_2 hypercert component suite passed 7 files / 153 tests. |
| AC-9 | Pass with known unrelated drift | Locale and vocab checks passed; Storybook contract passed 173/173. `check:design-tokens` and `check:design-generated` fail only on known unrelated client/docs drift. |
| AC-10 | Pass | `handoffs/claude-qa-pass-1.md` passed operator clarity, restrained admin design, and no unsupported marketplace claims. |
| AC-11 | Pass | This handoff: regression validation clean except known unrelated design drift; plan-hub valid; no unauthorized broadcast in qa_pass_2; post-transaction evidence recorded. |

## Non-Blocking Observations

1. `bun run check:design-tokens` remains blocked by pre-existing `packages/client/vite/social-preview.ts` hardcoded color values. This matches qa_pass_1 observation 4 and is outside this lane.
2. `bun run check:design-generated` remains blocked by stale `docs/docs/builders/packages/client-pwa-token-audit.generated.md`. This also matches qa_pass_1 observation 4 and is outside this lane.
3. Admin tests still emit noisy non-blocking warnings: deprecated Node `punycode`, missing `VITE_CHAIN_ID` fallback to 42161 in test setup, a React Router `HydrateFallback` warning in `PageTransition.test.tsx`, and jsdom `Window.scrollTo()` not implemented. None produced test failures.

## Recommendation

Archive the feature. Plan-hub now marks `qa_pass_2` as `passed` and the feature `workflow.overall_status` as `done`. No regression blocker remains in this lane.
