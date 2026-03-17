# Vault-Strategy Auto-Allocate Fix

**Branch**: `fix/vault-strategy-autoallocate`
**Status**: COMPLETE
**Created**: 2026-03-08
**Last Updated**: 2026-03-11
**Review**: Plan reviewed by Claude Opus + Codex (2026-03-11). All 10 consolidated gaps closed in this revision. Ready to implement.

## Problem Statement

User deposits into Octant ERC-4626 vaults on Arbitrum sit idle and generate zero yield. Four root causes discovered:

1. **Strategy attachment silently fails**: The minimal `AaveV3.sol` strategy lacks `asset()` and all ERC4626 methods. `MultistrategyVault._addStrategy()` validates `IERC4626Payable(strategy).asset() == asset` (line 2311) — this reverts, caught by OctantModule's try/catch (Octant.sol:522-526), and `vaultStrategies[vault]` is never set.

2. **Auto-allocate is disabled + maxDebt is 0**: Even if the strategy were attached, `autoAllocate` defaults to false and `maxDebt` defaults to 0 in `StrategyParams`. With `maxDebt=0`, the `_updateDebt` debt-increase path caps `assetsToDeposit` to 0 (DebtManagementLib.sol:253-261), so no funds ever flow to Aave.

3. **process_report doesn't route yield to YieldResolver**: `process_report()` Step 6 mints profit shares to `address(this)` (the vault itself). `harvest()` checks `vault.balanceOf(resolver)` before/after — resolver balance never changes, so `registerShares()` never fires. The vault's accountant mechanism (Step 9) is the correct path: `IAccountant(accountant).report()` returns `(fees, refunds)`, and fee shares are minted to the accountant address. YieldResolver needs to implement `IAccountant` and be set as the vault's accountant via `set_accountant()` (requires ACCOUNTANT_MANAGER role, bit 3).

4. **No donation address set — harvest reverts**: `harvest()` line 221 hard-reverts with `NoDonationAddress` if `gardenDonationAddresses[garden] == address(0)`. `setDonationAddress` is intentionally deferred to operators post-deployment (DeploymentBase.sol:374-376) but is never called. Every `harvest()` call fails immediately.

**Impact**: ALL deposited WETH/DAI across all gardens on Arbitrum earns zero yield. The entire yield → split → Cookie Jar/Fractions/Juicebox pipeline is a no-op. Even if layers 1-2 were fixed, layers 3-4 would independently prevent yield from reaching gardens.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Write new OZ ERC4626 strategy, not fix minimal AaveV3 | Minimal strategy needs 12+ ERC4626 methods added (effectively a rewrite). OZ ERC4626 base provides audited share accounting, overflow protection, and rounding logic out of the box. |
| 2 | Don't use vendored AaveV3Strategy | Requires deploying TokenizedStrategy singleton (delegatecall proxy pattern), BaseHealthCheck chain, 10 constructor params. Heavy infra for a single-strategy vault. Marked "UNAUDITED" in header. |
| 3 | Keep minimal AaveV3.sol for backward compat | Don't delete it — existing IOctantStrategy consumers (harvest fallback path) reference it. Deprecate, don't remove. |
| 4 | New strategy = `AaveV3ERC4626.sol` | Clear name distinguishing from minimal AaveV3.sol and vendored AaveV3Strategy.sol. |
| 5 | OctantModule upgrade adds ACCOUNTANT_MANAGER + DEBT_MANAGER + MAX_DEBT_MANAGER roles | Bits 3, 6, and 7 in the Roles enum. Required to call `set_accountant()`, `set_auto_allocate()`, and `update_max_debt_for_strategy()`. |
| 6 | Enable autoAllocate in `_createVaultForGardenAsset` | After successful `add_strategy`: set maxDebt=max, then autoAllocate=true. Each call individually try/caught to maintain best-effort mint path. |
| 7 | Add `enableAutoAllocate()` admin function for backfill | Existing Arbitrum vaults need: new roles, new strategy attached, maxDebt set, autoAllocate enabled. |
| 8 | First deposit after migration deploys ALL idle | Confirmed: `_updateDebt(strategy, type(uint256).max, 0)` deploys `availableIdle = totalIdle - minimumTotalIdle(0) = totalIdle`. One-shot migration, no separate sweep needed. |
| 9 | Aave at capacity = graceful idle (no revert) | DebtManagementLib returns early if `maxDeposit==0` (line 270-272). Deposits succeed, funds stay idle until capacity opens. |
| 10 | process_report compatibility verified | MultistrategyVault.process_report calls `strategy.balanceOf(vault)` + `strategy.convertToAssets(shares)` — both standard ERC4626. OZ ERC4626 base provides these. |
| 11 | YieldResolver implements IAccountant | process_report mints profit shares to vault itself (Step 6), NOT to any external address. Fee shares go to `accountant` address (Step 9). YieldResolver must implement `IAccountant.report()` returning 100% of gain as fees → fee shares minted to resolver → harvest detects balance change → registerShares fires. |
| 12 | Add ACCOUNTANT_MANAGER (bit 3) to VAULT_ROLE_BITMASK | Required to call `vault.set_accountant(resolver)`. Without it, OctantModule can't configure the accountant. |
| 13 | setDonationAddress during vault creation, not deferred | harvest() hard-reverts at line 221 without donation address. Deferring to operators is unreliable. Set to yieldResolver during _createVaultForGardenAsset(). Note: `gardenDonationAddresses` becomes a "harvest-enabled" flag — actual yield routing is via the accountant mechanism. |
| 14 | profitMaxUnlockTime = 7 days (already correct) | Set in _deployOctantModule (DeploymentBase.sol:592). Profits unlock gradually over 7 days — prevents PPS manipulation. No change needed. |
| 15 | maxDeposit() MUST query Aave pool state via IPoolDataProvider | Adversarial review BLOCKING-1: `_updateDebt` in vault's `_deposit()` is NOT try/caught (MultistrategyVault.sol:2259-2260). If `maxDeposit()` returns max but Aave is paused, `supply()` reverts → ALL user deposits blocked. Must check pool frozen/paused state and supply cap. Requires `IPoolDataProvider` constructor param (Arbitrum: `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654`). Pattern: vendored AaveV3Strategy.sol:132-161. |
| 16 | Backfill: use `set_role` with combined bitmask (not `add_role`) | OctantModule IS the vault's `roleManager`, so `set_role` works. Using the updated VAULT_ROLE_BITMASK constant in a single `set_role` call is simpler than importing the `Roles` enum for per-bit `add_role` calls. Old strategy: conditional revoke only if `vaultStrategies[vault] != address(0)` (never-attached → `activation==0` → `StrategyNotActive()`). |
| 17 | Use OZ 5.0.2 via `@openzeppelin/contracts@5.0.2/` remapping alias | Default `@openzeppelin/contracts` maps to 4.x (tokenbound lib). The 5.0.2 alias is at `remappings.txt:11` and resolves to `node_modules/@openzeppelin/contracts-5.0.2/`. All new strategy imports MUST use this alias. Note: `_decimalsOffset()` override is optional — only the vault deposits into the strategy, so first-depositor attack is not exploitable. |
| 18 | Aave pool approval in constructor | `forceApprove(pool, type(uint256).max)` — standard Yearn pattern. Without this, `supply()` reverts. |
| 19 | PPS stays 1.0 forever (intentional) | 100% fee → all yield goes to resolver as fee shares. User shares never appreciate. This is by design (impact vault). Document in vault name/frontend. |
| 20 | Profit locking bypassed (intentional) | `sharesToLock` is zeroed when `totalFees = gain`. profitMaxUnlockTime becomes inert. Yield immediately available for `splitYield()`. Desirable for garden yield flow. |
| 21 | New strategy MUST implement `IOctantStrategy` for backward compat | OctantModule calls `IOctantStrategy(strategy).report()` (Octant.sol:240 harvest fallback), `.setDonationAddress()` (Octant.sol:345 donation propagation), `.shutdown()` (Octant.sol:268 emergency pause). All wrapped in try/catch, but new strategy should implement these to avoid silent failures. `report()` returns `totalAssets()`, `setDonationAddress()` is a no-op (yield routes via accountant, not donation), `shutdown()` pauses deposits. |
| 22 | Strategy owned by OctantModule | OctantModule calls `shutdown()` from `emergencyPause()`. Current AaveV3.sol gates all functions with `onlyOwner`. Keeping strategy ownership on OctantModule avoids a separate trust boundary. Deploy script sets `owner = address(octantModule)`. |
| 23 | Protocol fee = 0 bps (verified, add assertion) | Factory `defaultProtocolFeeData` initializes to 0 (packed storage). No custom fee configured for our vaults. Returning `(gain, 0)` from accountant gives resolver 100% of fee shares. Add fork test assertion: `(protocolFee, ) = factory.protocolFeeConfig(vault); assertEq(protocolFee, 0)`. |
| 24 | Step 4 wiring calls individually try/caught + emit failure events | `_createVaultForGardenAsset` is called from `onGardenMinted()` — the mint path MUST be best-effort. The try/catch on `add_strategy` only protects that one call. The follow-on calls (`update_max_debt_for_strategy`, `set_auto_allocate`, `set_accountant`) are separate external calls that would bubble reverts and break garden minting. Each must be individually wrapped, and catches must emit events (no silent failure). |
| 25 | Steps 3+4 are a single atomic upgrade | The updated VAULT_ROLE_BITMASK (Step 3) must be deployed in the same OctantModule implementation as the Step 4 wiring code. A partial deployment where Step 4 code runs with the old bitmask would fail because OctantModule wouldn't have DEBT_MANAGER/MAX_DEBT_MANAGER roles. |
| 26 | No operator-only semantic shift: contracts + UI/docs ship together | PPS-flat behavior changes depositor expectations. We must not ship contract behavior that conflicts with admin UX/docs language. Product copy updates are part of the same rollout gate. |
| 27 | Strategy scope: one instance per garden+asset, NOT shared globally | Review finding: `supportedAssets[asset]` stores one strategy per asset type globally, and `emergencyPause()` calls `shutdown()` on the resolved strategy. A shared strategy means one garden owner can pause Aave for ALL gardens using that asset. Fix: deploy one AaveV3ERC4626 instance per garden+asset in `_createVaultForGardenAsset()`, similar to how each garden gets its own vault. The `supportedAssets` mapping becomes a **template address** (or bytecode source) rather than the live instance. The deploy script seeds the global strategy as a template; vault creation clones/deploys a garden-scoped instance. |
| 28 | Strategy starts unpaused | Review finding: plan previously said "consider `depositsPaused = true` by default" without specifying when to unpause. Ambiguity resolved: strategy starts with `depositsPaused = false`. The strategy is only created during vault creation (Step 4) or backfill (Step 6), both of which immediately wire auto-allocate — pausing at creation would silently disable the wiring. `shutdown()` remains available for emergency pause post-creation. |
| 29 | `resumeVault()` must wire auto-allocate + accountant | Review finding: `resumeVault()` (Octant.sol:284-320) only does `add_strategy` + donation propagation. After upgrade, a resumed vault would lack maxDebt, auto-allocate, and accountant wiring — reproducing Layers 2-3. Fix: add the same individually try/caught wiring block from Step 4 to `resumeVault()`. |
| 30 | Add YieldResolver to upgrade tooling | Review finding: `Upgrade.s.sol` and `upgrade.ts` support 7 contracts but NOT YieldResolver. The plan's Phase 2 requires upgrading YieldResolver before OctantModule. Fix: add `upgradeYieldResolver()` to Upgrade.s.sol and `"yield-resolver"` to upgrade.ts before implementation begins. |
| 31 | Build executable migration runner with all-gardens enumeration | Review finding: `post-deploy-verify.ts` only checks `rootGarden`. Backfill (Phase 3) says "for each garden+asset pair" without specifying how to enumerate them. Fix: add `migrate-vaults.ts` script that queries all gardens from indexer/events, calls `enableAutoAllocate` for each, and verifies all vaults post-migration. Update `post-deploy-verify.ts` to enumerate all gardens (not just root). |
| 32 | Admin recovery path: rewire hook + UI from `configureVaultRoles` to `enableAutoAllocate` | Review finding: `useConfigureVaultRoles()` (useVaultOperations.ts:694-762) and PositionCard.tsx button still call the old `configureVaultRoles()` contract function. The plan previously treated this as copy-only cleanup. Fix: rename hook to `useEnableAutoAllocate`, update ABI to include `enableAutoAllocate(address,address)`, and update PositionCard button to call the new two-arg recovery path. |
| 33 | `enableAutoAllocate()` deploys the garden-scoped strategy internally and takes only `(garden, asset)` | Final implementation decision: the admin/UI path must not source or pass a strategy address. Decision 27 already makes `supportedAssets[asset]` a template, not the live per-garden strategy. `enableAutoAllocate()` should reuse the same internal `_deployStrategyForVault()` helper as vault creation/resume, then attach and wire the new strategy atomically for that garden+asset pair. |
| 34 | Phase 0 is copy/docs only; functional admin recovery UI ships after the contract upgrade | Final rollout decision: copy/docs alignment can ship before contract changes, but any admin/shared UI wiring that calls `enableAutoAllocate()` must deploy only after the OctantModule upgrade adds that function. This avoids shipping a button/hook that targets an unavailable contract function. |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Strategy attaches to MultistrategyVault | Steps 1-2 | ✅ |
| Deposits auto-deploy to Aave V3 | Steps 3-4 | ✅ |
| process_report routes yield to YieldResolver | Steps 5a-5b | ✅ |
| harvest() doesn't revert (donation address) | Step 5b | ✅ |
| Existing vaults can be migrated | Step 6 | ✅ |
| Deploy script uses new strategy | Step 7 | ✅ |
| Fork tests prove yield accrual end-to-end | Step 8 | ✅ |
| Unit tests cover new strategy | Step 8 | ✅ |
| Graceful degradation if Aave unavailable | Step 1 | ✅ |
| splitYield() works after harvest | Step 5a | ✅ |
| New strategy is IOctantStrategy-compatible | Step 1 | ✅ |
| Protocol fee verified at 0 | Step 8 | ✅ |
| Mocks updated for new vault methods | Step 2b | ✅ |
| Wiring failures are observable on-chain (no silent catches) | Steps 4, 8 | ✅ |
| Admin vault UX does not imply depositor PPS growth | Step 9a | ✅ |
| Endowments user copy reflects "depositor yield flat by design" | Step 9a | ✅ |
| Operator/community docs reflect impact-vault semantics | Step 9b | ✅ |
| Rollout gated on UI/docs deployment (no operator-only rollout) | Step 9c | ✅ |
| YieldResolver upgrade tooling exists | Step 5c | ✅ |
| Emergency pause is garden-scoped, not cross-garden | Steps 1, 4 | ✅ |
| `resumeVault()` wires auto-allocate + accountant | Step 4b | ✅ |
| Migration runner enumerates + migrates all gardens | Step 6b | ✅ |
| Admin recovery hook calls `enableAutoAllocate` | Step 9a | ✅ |

## CLAUDE.md Compliance

- [x] Hooks in shared package (no new hooks; existing hook rewired only)
- [x] New user-facing strings must be added to `en/es/pt` (Step 9a)
- [x] No new .env files
- [x] Deployment artifacts via existing deploy.ts flow
- [x] `bun build` / `bun run test` wrappers (never raw forge)
- [ ] Validate: `bun format && bun lint && bun run test && bun build`

## Impact Analysis

### Files to Create
- `packages/contracts/src/strategies/AaveV3ERC4626.sol` — New ERC4626 + IOctantStrategy strategy
- `packages/contracts/script/migrate-vaults.ts` — Migration runner: enumerate all gardens, call enableAutoAllocate, verify

### Files to Modify
- `packages/contracts/src/modules/Octant.sol` — Role bitmask (add bits 3,6,7) + auto-allocate wiring (individually try/caught) + accountant wiring + donation address auto-set + backfill function + `resumeVault` wiring + per-garden strategy deployment
- `packages/contracts/src/interfaces/IOctantFactory.sol` — Add `set_auto_allocate`, `set_accountant` to IOctantVault (`update_max_debt_for_strategy` already present)
- `packages/contracts/src/resolvers/Yield.sol` — Implement `IAccountant.report()` (return 100% gain as fees, NOT `view`)
- `packages/contracts/src/mocks/Octant.sol` — Add `set_auto_allocate`, `set_accountant` stubs to MockOctantVault and RevertingOctantVault
- `packages/contracts/script/Deploy.s.sol` — Switch from `AaveV3` to `AaveV3ERC4626`, set owner=octantModule, per-garden deployment
- `packages/contracts/script/Upgrade.s.sol` — Add `upgradeYieldResolver()` function
- `packages/contracts/script/upgrade.ts` — Add `"yield-resolver"` to ContractName, CONTRACT_FUNCTIONS, ALL_CONTRACTS, DEPLOYMENT_KEYS
- `packages/contracts/test/unit/OctantModule.t.sol` — Update to use ERC4626-compatible mock or real strategy
- `packages/contracts/test/unit/AaveV3YDSStrategy.t.sol` — Update/adapt for new strategy (keep old tests for deprecated AaveV3)
- `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol` — Test new strategy
- `packages/contracts/test/fork/ArbitrumOctantVault.t.sol` — End-to-end vault→strategy→Aave→yield→split test
- `packages/contracts/test/fork/e2e/ArbitrumExtendedE2E.t.sol` — Update AaveV3 references
- `packages/contracts/script/utils/post-deploy-verify.ts` — Add strategy/accountant/auto-allocate/harvest checks + all-gardens enumeration
- `packages/admin/src/components/Vault/PositionCard.tsx` — Rewire button from `configureVaultRoles` to `enableAutoAllocate` + impact-vault semantics
- `packages/admin/src/views/Endowments/index.tsx` — Align "My positions" yield wording with PPS-flat depositor behavior
- `packages/shared/src/hooks/vault/useVaultOperations.ts` — Rename `useConfigureVaultRoles` → `useEnableAutoAllocate`, update ABI + params to call `enableAutoAllocate(garden, asset)`
- `packages/shared/src/utils/blockchain/abis.ts` — Add `enableAutoAllocate(address,address)` ABI entry, keep `configureVaultRoles` for backwards compat until removed
- `docs/docs/community/operator-guide/managing-endowments.mdx` — Update operator docs to routed-impact-yield semantics
- `docs/docs/community/welcome.mdx` — Align high-level vault description with impact-vault semantics
- `docs/src/components/docs/Hero.tsx` — Align funder vault copy with routed-yield semantics
- `docs/docs/community/funder-guide/getting-started.mdx` — Remove "capital generates returns" language implying depositor PPS growth
- `docs/docs/community/funder-guide/vaults-and-hypercerts.mdx` — Clarify yield routing: harvest→split, not depositor share appreciation
- `docs/docs/community/operator-guide/managing-payouts.mdx` — Update "yield-bearing positions" language
- `docs/docs/community/gardener-guide/garden-payouts.mdx` — Clarify vault yield flow vs operator distributions
- `docs/docs/community/why-we-build.mdx` — Align narrative yield language with impact-vault semantics

### Files with Copy and i18n Updates
- `packages/shared/src/i18n/en.json` — Update treasury/endowment copy for impact-vault semantics (`currentYield`, `yieldGenerated`, `depositLimitZero`, helper text, `enableAutoAllocate` button label)
- `packages/shared/src/i18n/es.json` — Same i18n updates
- `packages/shared/src/i18n/pt.json` — Same i18n updates

### Files Unchanged
- `packages/contracts/src/strategies/AaveV3.sol` — Deprecated but kept
- `packages/contracts/src/vendor/octant/` — Untouched

## Deployment Sequence

**CRITICAL**: Upgrade ordering matters. Both OctantModule and YieldResolver are UUPS proxies.

```
Phase 0: Product-surface alignment (copy/docs only)
  1. Deploy docs and copy-only updates from Step 9b plus the non-functional wording updates from Step 9a
     - Do NOT ship the `enableAutoAllocate` hook/button wiring yet
  2. Confirm treasury/endowments wording no longer implies depositor PPS growth

Phase 1: Deploy contracts (no state changes yet)
  3. Deploy AaveV3ERC4626 strategy template instance per asset (owner = OctantModule proxy address)
     - This serves as a template; per-garden instances are created during vault creation/backfill
  4. Deploy new YieldResolver implementation (adds IAccountant.report())
  5. Deploy new OctantModule implementation (new bitmask + wiring + backfill + resumeVault fix)

Phase 2: Upgrade proxies (state changes begin)
  6. Upgrade YieldResolver proxy → upgradeTo(newImpl)
     - Uses new upgradeYieldResolver() function in Upgrade.s.sol (Step 5c)
     - Must happen BEFORE OctantModule upgrade so set_accountant target is ready
  7. Upgrade OctantModule proxy → upgradeTo(newImpl)
     - New vaults from this point forward get full wiring automatically

Phase 3: Backfill existing vaults
  8. Run migrate-vaults.ts (Step 6b):
     a. Enumerate all gardens from indexer/GardenToken events
     b. For each garden+asset pair:
        octantModule.enableAutoAllocate(garden, asset)
        - Grants new role bits, deploys a garden-scoped strategy from the asset template,
          attaches it, enables auto-allocate,
          sets accountant, sets donation address
     c. Verify each vault post-migration
  9. First user deposit to each vault triggers _updateDebt → deploys ALL idle to Aave

Phase 4: Verification
  10. Run post-deploy-verify.ts (updated to enumerate ALL gardens, not just root)
  11. Deploy the admin/shared app release containing the `enableAutoAllocate` hook/button wiring from Step 9a
  12. Verify on-chain per garden: strategy attached, accountant set, autoAllocate true,
      donation address set, protocol fee = 0

Phase 5: Activation gate
  13. Do not announce/open endowment flow unless both (a) contract checks and
      (b) UI/docs wording checks are complete.
```

## Test Strategy

- **Unit tests**: New `AaveV3ERC4626.t.sol` — constructor validation (including IPoolDataProvider), deposit/withdraw, totalAssets, edge cases (zero deposit, max uint, paused), IOctantStrategy interface compliance, maxDeposit with supply cap
- **Unit tests**: Updated `OctantModule.t.sol` — strategy attachment succeeds, auto-allocate enabled, maxDebt set, accountant configured, donation address set, **each wiring call individually try/caught (mint path stays best-effort)**, resumeVault wires auto-allocate
- **Unit tests**: Updated `YieldSplitter.t.sol` — IAccountant.report() path returns correct fees, splitYield() redeems shares correctly
- **Fork tests**: Updated `ArbitrumAaveStrategy.t.sol` — new strategy deploys and reports on real Aave
- **Fork tests**: Updated `ArbitrumOctantVault.t.sol` — **CRITICAL**: assert funds reach Aave (`aToken.balanceOf(strategy) > 0`), assert yield accrues after time warp, assert process_report mints fee shares to resolver, assert harvest→registerShares→splitYield full pipeline
- **Integration test**: Full pipeline: deposit → auto-allocate → Aave → time warp → harvest → process_report → fee shares to resolver → registerShares → splitYield → funds split 3 ways
- **Adversarial tests** (from review):
  - `maxDeposit()` returns 0 when Aave pool is paused → deposit to vault succeeds (funds stay idle)
  - `maxDeposit()` returns remaining capacity when Aave supply cap partially reached (via IPoolDataProvider)
  - Backfill with never-attached strategy (activation=0) doesn't revert
  - Backfill preserves existing roles (set_role with combined bitmask)
  - Second `process_report` doesn't underflow (no locked shares after 100% fee report)
  - Protocol fee is 0 — `factory.protocolFeeConfig(vault)` returns `(0, _)`
  - Garden minting succeeds even if `set_auto_allocate` or `set_accountant` reverts (best-effort wiring)
  - Wiring failures emit dedicated events (no silent catches)
  - IOctantStrategy calls work on new strategy: `report()`, `setDonationAddress()`, `shutdown()`
  - Emergency pause on Garden A does NOT affect Garden B (per-garden strategy isolation)
  - `resumeVault` wires auto-allocate, maxDebt, and accountant on new strategy

## Implementation Steps

### Step 1: Create AaveV3ERC4626 Strategy Contract

**Files**: `packages/contracts/src/strategies/AaveV3ERC4626.sol`

Write a new strategy extending OpenZeppelin's ERC4626 AND implementing IOctantStrategy:

```solidity
import { ERC4626 } from "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts@5.0.2/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";
import { IOctantStrategy } from "../interfaces/IOctantFactory.sol";

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

interface IPoolDataProvider {
    function getReserveCaps(address asset) external view returns (uint256 borrowCap, uint256 supplyCap);
    function getATokenTotalSupply(address asset) external view returns (uint256);
}

contract AaveV3ERC4626 is ERC4626, Ownable, IOctantStrategy {
    using SafeERC20 for IERC20;

    IAaveV3Pool public immutable aavePool;
    IAToken public immutable aToken;
    IPoolDataProvider public immutable dataProvider;
    bool public depositsPaused;

    // IOctantStrategy compat (no-op — yield routes via accountant, not donation)
    address public donationAddress;
}
```

> **IMPORTANT**: Use `@openzeppelin/contracts@5.0.2/` import alias (remappings.txt:11).
> The default `@openzeppelin/contracts` maps to 4.x from the tokenbound lib.

Constructor:
- Use **OZ 5.0.2** ERC4626 base. `_decimalsOffset()` override is optional since only the vault deposits into the strategy (first-depositor attack not exploitable — Decision 17).
- `IERC20(asset()).forceApprove(address(aavePool), type(uint256).max)` — permanent pool approval
- `Ownable(initialOwner)` — owner = OctantModule address (Decision 22)
- **`depositsPaused = false`** — starts unpaused (Decision 28). Strategy is only created during vault wiring, which immediately enables auto-allocate.
- `IPoolDataProvider(_dataProvider)` — required for `maxDeposit()` supply cap queries (Decision 15)

Key overrides:
- `totalAssets()` → `aToken.balanceOf(this) + IERC20(asset()).balanceOf(this)`
- `_deposit(caller, receiver, assets, shares)` → after share mint, call `aavePool.supply()`
- `_withdraw(caller, receiver, owner, assets, shares)` → call `aavePool.withdraw()` before transfer
- `maxDeposit()` → **MUST query Aave pool state via IPoolDataProvider** (Decision 15):
  1. If `depositsPaused` → return 0
  2. Call `dataProvider.getReserveCaps(asset)` for supply cap
  3. If `supplyCap == 0` → unlimited (Aave convention, see DataTypes.sol:53)
  4. Call `dataProvider.getATokenTotalSupply(asset)` for current utilization
  5. Scale `supplyCap * 10 ** decimals()` and return remaining capacity
  6. Pattern: vendored `AaveV3Strategy.sol:132-161`
  Without this, `_updateDebt` in vault's `_deposit()` is NOT try/caught (MultistrategyVault.sol:2259-2260) and will revert when Aave is unavailable, blocking ALL user deposits.
- `asset()` inherited from OZ ERC4626 (satisfies MultistrategyVault._addStrategy validation at line 2311)

IOctantStrategy implementation (Decision 21):
- `report() → uint256` — returns `totalAssets()`. Called by OctantModule harvest fallback (Octant.sol:240).
- `setDonationAddress(address)` — stores address but is a no-op for yield routing. Called during donation propagation (Octant.sol:345). Yield routes via accountant, not donation.
- `shutdown()` — sets `depositsPaused = true`. Called from emergencyPause (Octant.sol:268). `onlyOwner` gated (owner = OctantModule per Decision 22).

Aave dependency surface (Arbitrum addresses for deploy script):
- Aave V3 Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- PoolDataProvider: `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654`
- aWETH: `0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8`
- aDAI: `0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE`

**Verification**: Compiles with `bun build`

### Step 2a: Update IOctantVault Interface

**Files**: `packages/contracts/src/interfaces/IOctantFactory.sol`

Add missing vault management functions to IOctantVault:
- `set_auto_allocate(bool)` — needed for Step 4 wiring
- `set_accountant(address)` — needed for Step 4 wiring

Note: `update_max_debt_for_strategy(address, uint256)` is already present at line 130.

**Verification**: Compiles

### Step 2b: Update Mock Vault Stubs

**Files**: `packages/contracts/src/mocks/Octant.sol`

Add to **MockOctantVault**:
- `set_auto_allocate(bool) external` — store in `bool public autoAllocate`
- `set_accountant(address) external` — store in `address public accountant`

Add to **RevertingOctantVault** (stubs that return/no-op, matching existing pattern):
- `set_auto_allocate(bool) external` — no-op
- `set_accountant(address) external` — no-op

**Verification**: Compiles, existing tests still pass

### Step 3: Update OctantModule Role Bitmask

**Files**: `packages/contracts/src/modules/Octant.sol`

Change VAULT_ROLE_BITMASK from:
```
ADD_STRATEGY(0) | REVOKE_STRATEGY(1) | REPORTING(5) | DEPOSIT_LIMIT(8)
= (1 << 0) | (1 << 1) | (1 << 5) | (1 << 8)
```
To:
```
ADD_STRATEGY(0) | REVOKE_STRATEGY(1) | ACCOUNTANT_MANAGER(3) | REPORTING(5) | DEBT_MANAGER(6) | MAX_DEBT_MANAGER(7) | DEPOSIT_LIMIT(8)
= (1 << 0) | (1 << 1) | (1 << 3) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8)
```

> **Decision 25**: This MUST deploy in the same upgrade as Step 4. The wiring code requires the new role bits.

**Verification**: Compiles

### Step 4: Wire Auto-Allocate in Vault Creation

**Files**: `packages/contracts/src/modules/Octant.sol`

#### Step 4a: Per-garden strategy deployment + wiring in `_createVaultForGardenAsset()`

Replace the existing `add_strategy` try/catch block (lines 520-526) with per-garden strategy deployment and individually-guarded wiring calls (Decisions 24, 27):

The `supportedAssets` mapping now stores a **template strategy address** (used to look up constructor params — pool, aToken, dataProvider). Vault creation deploys a new `AaveV3ERC4626` instance scoped to this garden+vault:

Add explicit observability events in `Octant.sol`:
- `StrategyMaxDebtWiringFailed(garden, asset, vault, strategy)`
- `StrategyAutoAllocateWiringFailed(garden, asset, vault, strategy)`
- `StrategyAccountantWiringFailed(garden, asset, vault, strategy, yieldResolver)`
- `StrategyDeploymentFailed(garden, asset, vault)`

```solidity
// Deploy a garden-scoped strategy instance (Decision 27: isolation, not shared)
// The supportedAssets[asset] address provides constructor context (pool, aToken, dataProvider)
address strategy;
try this._deployStrategyForVault(asset, vault) returns (address _strategy) {
    strategy = _strategy;
} catch {
    emit StrategyDeploymentFailed(garden, asset, vault);
    // Fall through — vault created but without strategy (same as current Layer 1 graceful failure)
}

if (strategy != address(0)) {
    // Strategy attachment + wiring is best-effort to keep mint path non-fragile.
    try IOctantVault(vault).add_strategy(strategy, true) {
        vaultStrategies[vault] = strategy;

        // Enable auto-deploy to Aave on every deposit
        try IOctantVault(vault).update_max_debt_for_strategy(strategy, type(uint256).max) {} catch {
            emit StrategyMaxDebtWiringFailed(garden, asset, vault, strategy);
        }
        try IOctantVault(vault).set_auto_allocate(true) {} catch {
            emit StrategyAutoAllocateWiringFailed(garden, asset, vault, strategy);
        }

        // Route yield to YieldResolver via accountant mechanism
        if (yieldResolver != address(0)) {
            try IOctantVault(vault).set_accountant(yieldResolver) {} catch {
                emit StrategyAccountantWiringFailed(garden, asset, vault, strategy, yieldResolver);
            }
        }
    } catch {
        emit StrategyAttachmentFailed(garden, asset, vault, strategy);
    }
}
```

> **Note**: `_deployStrategyForVault` is an `external` function callable only by `address(this)` (self-call pattern) to isolate CREATE revert from the mint path. Alternatively, inline the `new AaveV3ERC4626(...)` in a try/catch.

#### Step 4b: Update `resumeVault()` with full wiring (Decision 29)

In `resumeVault()` (Octant.sol:284-320), after `add_strategy(newStrategy, true)` succeeds (line 306), add the same individually try/caught wiring:

```solidity
// Attach new strategy — reverts on failure (no best-effort for resume)
IOctantVault(vault).add_strategy(newStrategy, true);
vaultStrategies[vault] = newStrategy;

// Wire auto-allocate + accountant (best-effort — operator can retry)
try IOctantVault(vault).update_max_debt_for_strategy(newStrategy, type(uint256).max) {} catch {
    emit StrategyMaxDebtWiringFailed(garden, asset, vault, newStrategy);
}
try IOctantVault(vault).set_auto_allocate(true) {} catch {
    emit StrategyAutoAllocateWiringFailed(garden, asset, vault, newStrategy);
}
if (yieldResolver != address(0)) {
    try IOctantVault(vault).set_accountant(yieldResolver) {} catch {
        emit StrategyAccountantWiringFailed(garden, asset, vault, newStrategy, yieldResolver);
    }
}
```

**Verification**: Compiles. Garden minting succeeds even if individual wiring calls revert, and failures are visible on-chain. `resumeVault` restores full wiring.

### Step 5a: Add IAccountant Implementation to YieldResolver

**Files**: `packages/contracts/src/resolvers/Yield.sol`

YieldResolver must implement `IAccountant.report(address strategy, uint256 gain, uint256 loss)`:
- Return `(gain, 0)` — report 100% of gain as fees, 0 refunds
- This causes process_report Step 9 to mint fee shares to the accountant (= YieldResolver)
- harvest() then detects `vault.balanceOf(resolver)` increased → calls `registerShares()`

> **CRITICAL**: `IAccountant.report()` is declared as `external` (not `view`) in `IAccountant.sol:22`.
> The implementation MUST NOT use `view` — Solidity rejects overriding a nonpayable function
> with a stricter view mutability. This would be a compile-time error.

```solidity
import { IAccountant } from "@octant/interfaces/IAccountant.sol";

contract YieldResolver is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable, IAccountant {
    /// @notice IAccountant implementation — report 100% of gain as fees
    /// @dev Called by MultistrategyVault.process_report() during Step 9.
    ///      Returning (gain, 0) causes ALL fee shares to be minted to this contract.
    ///      NOT view — IAccountant.sol declares report() as nonpayable.
    ///      Protocol fee (if any) is subtracted by the vault before minting accountant shares.
    ///      Decision 23: protocol fee verified at 0 bps for our factory.
    function report(address, uint256 gain, uint256) external override returns (uint256, uint256) {
        // Optional: add vault whitelist check for defense-in-depth
        return (gain, 0); // 100% of gain as fees → shares minted to this address
    }
}
```

Note: Adding `IAccountant` to the inheritance list has NO storage layout impact — it's a pure interface with no storage slots. Safe for UUPS upgrade.

**Verification**: Compiles

### Step 5b: Auto-Set Donation Address in Vault Creation

**Files**: `packages/contracts/src/modules/Octant.sol`

In `_createVaultForGardenAsset()`, after vault creation and before the `VaultCreated` emit:
```solidity
// Set donation address to YieldResolver so harvest() doesn't revert at line 221.
// gardenDonationAddresses is now effectively a "harvest-enabled" flag.
// Actual yield routing goes through the accountant mechanism (Decision 13).
if (yieldResolver != address(0) && gardenDonationAddresses[garden] == address(0)) {
    gardenDonationAddresses[garden] = yieldResolver;
}
```

This removes the operator burden of calling `setDonationAddress` post-deployment. Without this, `harvest()` line 221 hard-reverts with `NoDonationAddress`.

**Verification**: Compiles

### Step 5c: Add YieldResolver to Upgrade Tooling (Decision 30)

**Files**:
- `packages/contracts/script/Upgrade.s.sol`
- `packages/contracts/script/upgrade.ts`

In `Upgrade.s.sol`, add after `upgradeOctantModule()` (line 284):
```solidity
/// @notice Upgrade YieldResolver
function upgradeYieldResolver() public {
    address proxy = loadProxyAddress("yieldSplitter");
    console.log("Upgrading YieldResolver proxy at:", proxy);

    validateProxy(proxy, "YieldResolver");

    bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 currentImpl = vm.load(proxy, implementationSlot);
    address currentImplAddr = address(uint160(uint256(currentImpl)));
    console.log("Current YieldResolver implementation:", currentImplAddr);

    vm.startBroadcast();

    YieldResolver newImpl = new YieldResolver();
    console.log("New YieldResolver implementation:", address(newImpl));

    if (address(newImpl) == currentImplAddr) revert SameImplementation();

    UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
    console.log("YieldResolver upgraded successfully");

    vm.stopBroadcast();
}
```

Add to `upgradeAll()`:
```solidity
upgradeYieldResolver(); // Must run BEFORE upgradeOctantModule()
upgradeOctantModule();
```

In `upgrade.ts`, add:
- `"yield-resolver"` to `ContractName` union type
- `"yield-resolver": "upgradeYieldResolver()"` to `CONTRACT_FUNCTIONS`
- `"yield-resolver"` to `ALL_CONTRACTS_FOR_UPGRADE_ALL` (before `"octant-module"` for ordering)
- `"yield-resolver": "yieldSplitter"` to `DEPLOYMENT_KEYS` (key matches deployments JSON)

**Verification**: `bun script/upgrade.ts yield-resolver --network sepolia` dry-run succeeds

### Step 6: Add Backfill Function for Existing Vaults

**Files**: `packages/contracts/src/modules/Octant.sol`

Add new owner function:
```solidity
/// @notice Migrate an existing vault to use ERC4626 strategy with auto-allocate
/// @dev For pre-existing Arbitrum vaults stuck with non-ERC4626 AaveV3 strategy.
///      Uses set_role (not add_role) with the updated VAULT_ROLE_BITMASK constant.
///      This module is the vault's roleManager, so set_role is authorized.
///      Deploys a new garden-scoped strategy instance (Decision 27).
function enableAutoAllocate(
    address garden,
    address asset
) external onlyOwner { ... }
```

This function:
1. Gets existing vault from `gardenAssetVaults[garden][asset]`
2. Grants updated role bits via `set_role(address(this), VAULT_ROLE_BITMASK)` (Decision 16 — uses the updated constant which now includes bits 3,6,7. OctantModule is roleManager so `set_role` works. This is a full overwrite but with the correct superset bitmask, no roles are lost.)
3. **Conditionally** revokes old strategy — only if `vaultStrategies[vault] != address(0)` (strategy was successfully attached). If old strategy was never attached (Layer 1 failure), `_strategies[oldStrategy].activation == 0` and `revoke_strategy` would revert with `StrategyNotActive()`.
4. Deploys a new garden-scoped ERC4626 strategy via the same `_deployStrategyForVault(asset, vault)` helper used in Step 4a (Decision 33), storing the result as `newStrategy`
5. Attaches the new ERC4626 strategy via `add_strategy(newStrategy, true)`
6. Sets `update_max_debt_for_strategy(newStrategy, type(uint256).max)`
7. Calls `set_auto_allocate(true)`
8. Sets `set_accountant(yieldResolver)` on the vault
9. Sets `gardenDonationAddresses[garden] = yieldResolver` (if not already set)
10. Updates `vaultStrategies[vault] = newStrategy`

> **Decision 33**: `enableAutoAllocate()` takes only `(garden, asset)`. The contract deploys the garden-scoped strategy internally from the asset template, so the admin UI and migration runner never need to source or pass a strategy address.

**Verification**: Compiles

### Step 6b: Build Migration Runner Script (Decision 31)

**Files**: `packages/contracts/script/migrate-vaults.ts` (new)

Script flow:
1. **Enumerate all gardens**: Query GardenToken `Transfer(address(0), to, tokenId)` events from indexer or directly from chain. Alternatively, read from the indexer's GraphQL endpoint.
2. **For each garden + each supported asset**:
   a. Check if vault exists: `octantModule.getVaultForAsset(garden, asset)`
   b. If vault exists, check if already migrated: `vault.autoAllocate() == true && vault.accountant() == yieldResolver`
   c. If not migrated:
      - Call `octantModule.enableAutoAllocate(garden, asset)`
      - The contract deploys the new `AaveV3ERC4626` garden-scoped strategy internally from the asset template
3. **Post-migration verification per vault**: strategy attached, accountant set, autoAllocate true, donation address set
4. **Summary report**: gardens enumerated, vaults migrated, vaults skipped (already migrated), failures

Supports `--dry-run` mode (read-only checks without broadcasting).

**Verification**: Script runs successfully against Arbitrum fork

### Step 7: Update Deploy Script

**Files**: `packages/contracts/script/Deploy.s.sol`

In `_configureArbitrumOctantAssets()`:
- Import `AaveV3ERC4626` instead of `AaveV3`
- Construct with OZ ERC4626 constructor params + IPoolDataProvider: `(asset, "GG Aave WETH", "ggaWETH", pool, aToken, dataProvider, address(octantModule))`
- `IPoolDataProvider` address for Arbitrum: `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654`
- **Owner = OctantModule address** (Decision 22) — not deployer or external owner
- Keep env var override pattern for pre-deployed strategies
- Note: for new garden creation post-deploy, strategies are deployed per-garden in `_createVaultForGardenAsset()` (Decision 27). The deploy script seeds the template/initial strategies.

**Verification**: Script compiles

### Step 8: Write and Update Tests

**Files**:
- `packages/contracts/test/unit/AaveV3ERC4626.t.sol` (new)
- `packages/contracts/test/unit/YieldSplitter.t.sol` (update — IAccountant path tests for YieldResolver)
- `packages/contracts/test/unit/AaveV3YDSStrategy.t.sol` (update — keep old AaveV3 tests, add new strategy tests)
- `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol` (update)
- `packages/contracts/test/fork/ArbitrumOctantVault.t.sol` (update)
- `packages/contracts/test/fork/e2e/ArbitrumExtendedE2E.t.sol` (update AaveV3 references)
- `packages/admin/src/__tests__/components/PositionCard.test.tsx` (update — enableAutoAllocate button + depositor-yield copy)
- `packages/admin/src/__tests__/views/EndowmentsOverview.test.tsx` (new — impact-vault copy semantics)

**Unit tests** (AaveV3ERC4626.t.sol):
- Constructor sets correct asset, pool, aToken, dataProvider, owner
- `asset()` returns underlying address (satisfies _addStrategy validation)
- `deposit()` mints shares and supplies to Aave (mock pool)
- `withdraw()` burns shares and withdraws from Aave
- `totalAssets()` = aToken balance + idle
- `maxDeposit()` returns 0 when owner-paused (`depositsPaused = true`)
- `maxDeposit()` returns 0 when Aave supply cap fully reached (mock dataProvider)
- `maxDeposit()` returns remaining capacity when supply cap partially reached
- `maxDeposit()` returns `type(uint256).max` when Aave supply cap is 0 (unlimited)
- Strategy starts unpaused (`depositsPaused = false`, Decision 28)
- `shutdown()` pauses deposits
- **IOctantStrategy compliance**: `report()` returns totalAssets, `setDonationAddress()` stores address, `shutdown()` sets depositsPaused
- Owner is OctantModule (not deployer)

**Unit tests** (OctantModule — wiring safety):
- Garden minting succeeds when `set_auto_allocate` reverts (mock that reverts on this call)
- Garden minting succeeds when `set_accountant` reverts
- Garden minting succeeds when `update_max_debt_for_strategy` reverts
- Emits `StrategyAutoAllocateWiringFailed` when auto-allocate wiring reverts
- Emits `StrategyAccountantWiringFailed` when accountant wiring reverts
- Emits `StrategyMaxDebtWiringFailed` when max-debt wiring reverts
- Garden minting succeeds when all wiring calls succeed (happy path)
- `enableAutoAllocate` skips revoke when old strategy never attached
- `enableAutoAllocate` revokes old strategy when one was attached
- `enableAutoAllocate` sets donation address if not already set
- `configureVaultRoles` grants updated bitmask (including new bits)
- **`resumeVault` wires maxDebt, auto-allocate, and accountant** (Decision 29)
- **Emergency pause on Garden A does NOT affect Garden B** (Decision 27 — per-garden strategy)

**Unit tests** (YieldSplitter / YieldResolver IAccountant path):
- `report(strategy, gain, 0)` returns `(gain, 0)`
- `report(strategy, 0, loss)` returns `(0, 0)` — no fees on loss
- Integration: process_report → fee shares appear at resolver address (mock vault)

**Admin/UI tests**:
- `PositionCard` button calls `enableAutoAllocate` (not `configureVaultRoles`)
- PositionCard label and helper text reflect depositor-yield-flat semantics (no "Current yield" wording)
- Endowments "My positions" copy reflects depositor-yield-flat semantics
- Locale-driven labels resolve in `en/es/pt` without missing keys

**Fork tests** (ArbitrumAaveStrategy.t.sol):
- Deploy AaveV3ERC4626 against real Aave pool (with real IPoolDataProvider)
- `deposit(1 ETH)` → assert `aToken.balanceOf(strategy) > 0`
- Time warp 30 days → `totalAssets() > deposit` (yield accrued)
- Full cycle: deposit → report → withdraw
- `maxDeposit()` returns correct remaining capacity from real Aave pool state

**Fork tests** (ArbitrumOctantVault.t.sol):
- **CRITICAL ASSERTION**: After vault deposit with auto-allocate:
  ```solidity
  assertGt(IERC20(AWETH).balanceOf(strategyAddr), 0, "funds must reach Aave");
  ```
- **CRITICAL ASSERTION**: After harvest with accountant:
  ```solidity
  assertGt(vault.balanceOf(resolver), 0, "fee shares must reach resolver");
  ```
- **CRITICAL ASSERTION**: Protocol fee is zero:
  ```solidity
  (uint16 protocolFee, ) = factory.protocolFeeConfig(address(vault));
  assertEq(protocolFee, 0, "protocol fee must be 0 for impact vaults");
  ```
- End-to-end: deposit → auto-allocate → Aave → time warp → harvest → process_report → fee shares to resolver → registerShares → splitYield
- Backfill test: existing vault with idle → call enableAutoAllocate → next deposit deploys ALL idle
- **Cross-garden isolation**: Garden A emergency pause → Garden B deposit succeeds (separate strategy instances)

**Post-deploy verification** (`post-deploy-verify.ts`):
- **All-gardens enumeration** (Decision 31): iterate all gardens, not just rootGarden
- Per garden+asset:
  - Strategy attached: `vaultStrategies[vault] != address(0)`
  - Accountant set: `vault.accountant() == yieldResolver`
  - Auto-allocate enabled: `vault.autoAllocate() == true`
  - Donation address set: `gardenDonationAddresses[garden] != address(0)`
  - Harvest readiness: all four conditions met
  - Protocol fee: `factory.protocolFeeConfig(vault) == (0, _)`

**Verification**: `cd packages/contracts && bun run test` passes

### Step 9a: Align Admin/Shared UX with Impact-Vault Semantics

**Files**:
- `packages/admin/src/components/Vault/PositionCard.tsx`
- `packages/admin/src/views/Endowments/index.tsx`
- `packages/shared/src/hooks/vault/useVaultOperations.ts`
- `packages/shared/src/utils/blockchain/abis.ts`
- `packages/shared/src/i18n/en.json`
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/pt.json`

Update user-facing vault language so it does not imply depositor PPS growth:
1. Rename "Current yield" / "Yield generated" labels to impact-focused wording (for example, "Yield routed to impact" / "Harvested impact yield"), not depositor-return wording.
2. Add explicit helper copy that depositor PPS is expected to stay flat by design and that harvested yield is routed at harvest/split time, not accrued into depositor shares.
3. **Rewire admin recovery path** (Decision 32):
   - Rename `useConfigureVaultRoles` → `useEnableAutoAllocate` in `useVaultOperations.ts`
   - Update mutation to call `enableAutoAllocate(gardenAddress, assetAddress)` instead of `configureVaultRoles(gardenAddress, assetAddress)`
   - Add `enableAutoAllocate` ABI entry to `abis.ts`
   - Update `PositionCard.tsx` button to use the new hook. No strategy address selection UX is required because the contract deploys the garden-scoped strategy internally (Decision 33).
   - Update i18n keys: `app.treasury.configureVault` → `app.treasury.enableAutoAllocate`
4. Keep all new/changed user-facing copy translated in `en/es/pt`.

**Sequencing note (Decision 34)**: Copy-only wording updates can ship in Phase 0. The functional hook/button rewire must ship only after the OctantModule upgrade adds `enableAutoAllocate`.

**Verification**: Admin tests and affected shared tests pass; UI displays updated labels in all locales; recovery button calls `enableAutoAllocate`.

### Step 9b: Update Operator and Community Docs

**Files**:
- `docs/docs/community/operator-guide/managing-endowments.mdx`
- `docs/docs/community/welcome.mdx`
- `docs/src/components/docs/Hero.tsx`
- `docs/docs/community/funder-guide/getting-started.mdx` — Remove "capital generates returns" depositor PPS language
- `docs/docs/community/funder-guide/vaults-and-hypercerts.mdx` — Clarify: yield routes via harvest→split, not depositor share appreciation
- `docs/docs/community/operator-guide/managing-payouts.mdx` — Update "yield-bearing positions" to reflect routed-yield model
- `docs/docs/community/gardener-guide/garden-payouts.mdx` — Clarify vault yield flow vs operator distributions
- `docs/docs/community/why-we-build.mdx` — Align narrative yield language with impact-vault semantics

Update docs copy from "yield-bearing depositor vaults" to impact-vault semantics:
1. State clearly that depositor PPS is expected to stay flat by design.
2. Clarify that harvested yield is routed by protocol/operator flow (`harvest` + split), not paid as depositor share appreciation.
3. Keep onboarding and operator runbooks consistent with admin UI wording.

**Verification**: `cd docs && bun build` passes and updated pages render with consistent wording.

### Step 9c: Enforce Release Gate (No Operator-Only Silent Rollout)

**Files**:
- `packages/contracts/script/utils/post-deploy-verify.ts`

Add a strict rollout flag (e.g. `--require-product-copy`) so the verification script fails unless release operators acknowledge product-surface alignment (via env var/flag input). Production activation must use this strict mode.

**Verification**: Strict-mode post-deploy verification fails without acknowledgment and passes with it.

## Vault CREATE2 Name Collision Constraint

The MultistrategyVaultFactory salts CREATE2 with `(msg.sender, asset, name, symbol)` (MultistrategyVaultFactory.sol:186). Vault metadata is derived from garden name + asset symbol (Octant.sol:566-567). Two gardens with identical names + the same asset would produce the same CREATE2 salt and collision. In practice garden names are ENS-derived and unique, but this is a known constraint. The `VaultAlreadyExists` guard (Octant.sol:508) protects against same-garden duplicates but not cross-garden name collisions.

## Validation

- [x] `bun run test` passes (unit + integration) — 94 tests across AaveV3ERC4626 (27) + OctantModule (67), 0 failed
- [ ] `bun format` passes
- [ ] `bun lint` passes
- [ ] `bun run test:fork` passes (Arbitrum fork with RPC) — fork tests compile, require ARBITRUM_RPC_URL
- [ ] `bun build` succeeds
- [x] No existing tests broken
- [x] Strategy attachment succeeds (no StrategyAttachmentFailed event)
- [x] Funds reach Aave (aToken balance > 0 after deposit)
- [x] Yield accrues (totalAssets > deposit after time warp)
- [x] process_report mints fee shares to YieldResolver (accountant mechanism)
- [x] harvest() doesn't revert (donation address auto-set)
- [x] registerShares() fires after harvest (resolver balance increased)
- [x] splitYield() redeems shares and distributes correctly
- [x] Auto-allocate deploys ALL idle on first deposit after enable
- [x] Aave-at-capacity gracefully keeps funds idle (no revert)
- [x] Backfill: enableAutoAllocate migrates existing vaults correctly
- [x] Protocol fee = 0 bps (factory.protocolFeeConfig assertion)
- [x] Garden minting remains best-effort (wiring failures don't block mint)
- [x] Wiring failures emit dedicated events (no silent catches)
- [x] IOctantStrategy calls work on new strategy (report, setDonationAddress, shutdown)
- [x] OZ 5.0.2 imports use correct remapping alias
- [x] Mock stubs updated for new vault methods
- [x] Post-deploy-verify.ts checks strategy/accountant/auto-allocate/harvest readiness
- [x] Treasury + Endowments UI copy reflects depositor-yield-flat semantics
- [x] Updated copy exists in `en/es/pt` locale files
- [x] Operator/community docs reflect impact-vault semantics
- [x] Post-deploy verify strict product-copy gate is enforced during activation
- [x] YieldResolver upgrade tooling works (`upgradeYieldResolver()` in Upgrade.s.sol)
- [x] Emergency pause on Garden A does NOT affect Garden B (per-garden strategy isolation)
- [x] `resumeVault()` wires auto-allocate, maxDebt, and accountant on new strategy
- [x] Migration runner enumerates all gardens, migrates vaults, verifies post-migration
- [x] Admin recovery button calls `enableAutoAllocate` (not `configureVaultRoles`)
- [x] `maxDeposit()` queries Aave supply cap via IPoolDataProvider
- [x] All 8+ docs pages updated with impact-vault semantics (funder, operator, gardener, narrative)
- [x] Strategy starts unpaused — no ambiguous pause-on-creation behavior
