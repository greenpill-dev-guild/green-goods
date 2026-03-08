# Vault-Strategy Auto-Allocate Fix

**Branch**: `fix/vault-strategy-autoallocate`
**Status**: ACTIVE
**Created**: 2026-03-08
**Last Updated**: 2026-03-08

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
| 5 | OctantModule upgrade adds DEBT_MANAGER + MAX_DEBT_MANAGER roles | Bits 6 and 7 in the Roles enum. Required to call `set_auto_allocate()` and `update_max_debt_for_strategy()`. |
| 6 | Enable autoAllocate in `_createVaultForGardenAsset` | After successful `add_strategy`: set maxDebt=max, then autoAllocate=true. Atomic deposit-to-Aave on every user deposit. |
| 7 | Add `enableAutoAllocate()` admin function for backfill | Existing Arbitrum vaults need: new roles, new strategy attached, maxDebt set, autoAllocate enabled. |
| 8 | First deposit after migration deploys ALL idle | Confirmed: `_updateDebt(strategy, type(uint256).max, 0)` deploys `availableIdle = totalIdle - minimumTotalIdle(0) = totalIdle`. One-shot migration, no separate sweep needed. |
| 9 | Aave at capacity = graceful idle (no revert) | DebtManagementLib returns early if `maxDeposit==0` (line 270-272). Deposits succeed, funds stay idle until capacity opens. |
| 10 | process_report compatibility verified | MultistrategyVault.process_report calls `strategy.balanceOf(vault)` + `strategy.convertToAssets(shares)` — both standard ERC4626. OZ ERC4626 base provides these. |
| 11 | YieldResolver implements IAccountant | process_report mints profit shares to vault itself (Step 6), NOT to any external address. Fee shares go to `accountant` address (Step 9). YieldResolver must implement `IAccountant.report()` returning 100% of gain as fees → fee shares minted to resolver → harvest detects balance change → registerShares fires. |
| 12 | Add ACCOUNTANT_MANAGER (bit 3) to VAULT_ROLE_BITMASK | Required to call `vault.set_accountant(resolver)`. Without it, OctantModule can't configure the accountant. |
| 13 | setDonationAddress during vault creation, not deferred | harvest() hard-reverts at line 221 without donation address. Deferring to operators is unreliable. Set to yieldResolver during _createVaultForGardenAsset(). |
| 14 | profitMaxUnlockTime = 7 days (already correct) | Set in _deployOctantModule (DeploymentBase.sol:592). Profits unlock gradually over 7 days — prevents PPS manipulation. No change needed. |
| 15 | maxDeposit() MUST query Aave pool state | Adversarial review BLOCKING-1: `_updateDebt` in vault's `_deposit()` is NOT try/caught. If `maxDeposit()` returns max but Aave is paused, `supply()` reverts → ALL user deposits blocked. Must check pool frozen/paused state and supply cap. |
| 16 | Backfill: conditional revoke + add_role (not set_role) | Adversarial review BLOCKING-2: Old strategy never attached (activation=0) → `revoke_strategy` reverts with `StrategyNotActive()`. Must skip revoke when `vaultStrategies[vault] == address(0)`. Also: `set_role` overwrites all roles; use `add_role()` per bit to preserve existing roles. |
| 17 | Use OZ 5.0.2 for ERC4626 base | First-depositor attack mitigation via `_decimalsOffset()`. Strategy is only deposited into by vault, but defense-in-depth. |
| 18 | Aave pool approval in constructor | `forceApprove(pool, type(uint256).max)` — standard Yearn pattern. Without this, `supply()` reverts. |
| 19 | PPS stays 1.0 forever (intentional) | 100% fee → all yield goes to resolver as fee shares. User shares never appreciate. This is by design (impact vault). Document in vault name/frontend. |
| 20 | Profit locking bypassed (intentional) | `sharesToLock` is zeroed when `totalFees = gain`. profitMaxUnlockTime becomes inert. Yield immediately available for `splitYield()`. Desirable for garden yield flow. |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Strategy attaches to MultistrategyVault | Steps 1-2 | ⏳ |
| Deposits auto-deploy to Aave V3 | Steps 3-4 | ⏳ |
| process_report routes yield to YieldResolver | Steps 5a-5b | ⏳ |
| harvest() doesn't revert (donation address) | Step 5c | ⏳ |
| Existing vaults can be migrated | Step 6 | ⏳ |
| Deploy script uses new strategy | Step 7 | ⏳ |
| Fork tests prove yield accrual end-to-end | Step 8 | ⏳ |
| Unit tests cover new strategy | Step 8 | ⏳ |
| Graceful degradation if Aave unavailable | Step 2 | ⏳ |
| splitYield() works after harvest | Step 5a | ⏳ |

## CLAUDE.md Compliance

- [x] Hooks in shared package (no shared changes needed — contract-only fix)
- [x] No new .env files
- [x] Deployment artifacts via existing deploy.ts flow
- [x] `bun build` / `bun run test` wrappers (never raw forge)
- [ ] Validate: `bun format && bun lint && bun run test && bun build`

## Impact Analysis

### Files to Create
- `packages/contracts/src/strategies/AaveV3ERC4626.sol` — New ERC4626 strategy

### Files to Modify
- `packages/contracts/src/modules/Octant.sol` — Role bitmask (add bits 3,6,7) + auto-allocate wiring + accountant wiring + donation address auto-set + backfill function
- `packages/contracts/src/interfaces/IOctantFactory.sol` — Add `set_auto_allocate`, `update_max_debt_for_strategy`, `set_accountant` to IOctantVault
- `packages/contracts/src/resolvers/Yield.sol` — Implement `IAccountant.report()` (return 100% gain as fees)
- `packages/contracts/script/Deploy.s.sol` — Switch from `AaveV3` to `AaveV3ERC4626`
- `packages/contracts/test/unit/OctantModule.t.sol` — Update to use ERC4626-compatible mock or real strategy
- `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol` — Test new strategy
- `packages/contracts/test/fork/ArbitrumOctantVault.t.sol` — End-to-end vault→strategy→Aave→yield→split test

### Files Unchanged
- `packages/contracts/src/strategies/AaveV3.sol` — Deprecated but kept
- `packages/contracts/src/vendor/octant/` — Untouched
- All frontend/shared code — Untouched (vault interface unchanged)

## Test Strategy

- **Unit tests**: New `AaveV3ERC4626.t.sol` — constructor validation, deposit/withdraw, totalAssets, edge cases (zero deposit, max uint, paused)
- **Unit tests**: Updated `OctantModule.t.sol` — strategy attachment succeeds, auto-allocate enabled, maxDebt set, accountant configured, donation address set
- **Unit tests**: Updated `Yield.t.sol` — IAccountant.report() returns correct fees, splitYield() redeems shares correctly
- **Fork tests**: Updated `ArbitrumAaveStrategy.t.sol` — new strategy deploys and reports on real Aave
- **Fork tests**: Updated `ArbitrumOctantVault.t.sol` — **CRITICAL**: assert funds reach Aave (`aToken.balanceOf(strategy) > 0`), assert yield accrues after time warp, assert process_report mints fee shares to resolver, assert harvest→registerShares→splitYield full pipeline
- **Integration test**: Full pipeline: deposit → auto-allocate → Aave → time warp → harvest → process_report → fee shares to resolver → registerShares → splitYield → funds split 3 ways
- **Adversarial tests** (from review):
  - `maxDeposit()` returns 0 when Aave pool is paused → deposit to vault succeeds (funds stay idle)
  - `maxDeposit()` returns remaining capacity when Aave supply cap partially reached
  - Backfill with never-attached strategy (activation=0) doesn't revert
  - Backfill preserves existing roles (verify with `add_role` not `set_role`)
  - Second `process_report` doesn't underflow (no locked shares after 100% fee report)

## Implementation Steps

### Step 1: Create AaveV3ERC4626 Strategy Contract

**Files**: `packages/contracts/src/strategies/AaveV3ERC4626.sol`

Write a new strategy extending OpenZeppelin's ERC4626:

```solidity
contract AaveV3ERC4626 is ERC4626, Ownable {
    IAaveV3Pool public immutable aavePool;
    IAToken public immutable aToken;
    bool public depositsPaused;
}
```

Constructor:
- Use **OZ 5.0.2** ERC4626 base (includes `_decimalsOffset()` for first-depositor attack mitigation)
- `IERC20(asset()).forceApprove(address(aavePool), type(uint256).max)` — permanent pool approval
- Consider `depositsPaused = true` by default, unpause only after vault attachment

Key overrides:
- `totalAssets()` → `aToken.balanceOf(this) + IERC20(asset()).balanceOf(this)`
- `_deposit(caller, receiver, assets, shares)` → after share mint, call `aavePool.supply()`
- `_withdraw(caller, receiver, owner, assets, shares)` → call `aavePool.withdraw()` before transfer
- `maxDeposit()` → **MUST query Aave pool state** (frozen/paused → 0, supply cap reached → remaining capacity, owner paused → 0, else `type(uint256).max`). Without this, `_updateDebt` in vault's `_deposit()` is NOT try/caught and will revert when Aave is unavailable, blocking ALL user deposits.
- `shutdown()` / `setDepositsPaused()` for emergency controls
- `asset()` inherited from OZ ERC4626 (satisfies MultistrategyVault._addStrategy validation)

**Verification**: Compiles with `bun build`

### Step 2: Update IOctantVault Interface

**Files**: `packages/contracts/src/interfaces/IOctantFactory.sol`

Add missing vault management functions to IOctantVault:
- `set_auto_allocate(bool)`
- `update_max_debt_for_strategy(address, uint256)`
- `set_accountant(address)`

**Verification**: Compiles

### Step 3: Update OctantModule Role Bitmask

**Files**: `packages/contracts/src/modules/Octant.sol`

Change VAULT_ROLE_BITMASK from:
```
ADD_STRATEGY(0) | REVOKE_STRATEGY(1) | REPORTING(5) | DEPOSIT_LIMIT(8)
```
To:
```
ADD_STRATEGY(0) | REVOKE_STRATEGY(1) | ACCOUNTANT_MANAGER(3) | REPORTING(5) | DEBT_MANAGER(6) | MAX_DEBT_MANAGER(7) | DEPOSIT_LIMIT(8)
```

**Verification**: Compiles

### Step 4: Wire Auto-Allocate in Vault Creation

**Files**: `packages/contracts/src/modules/Octant.sol`

In `_createVaultForGardenAsset()`, after `add_strategy` succeeds:
```solidity
try IOctantVault(vault).add_strategy(strategy, true) {
    vaultStrategies[vault] = strategy;
    // Enable auto-deploy to Aave on every deposit
    IOctantVault(vault).update_max_debt_for_strategy(strategy, type(uint256).max);
    IOctantVault(vault).set_auto_allocate(true);
    // Route yield to YieldResolver via accountant mechanism
    if (yieldResolver != address(0)) {
        IOctantVault(vault).set_accountant(yieldResolver);
    }
} catch { ... }
```

**Verification**: Compiles

### Step 5a: Add IAccountant Implementation to YieldResolver

**Files**: `packages/contracts/src/resolvers/Yield.sol`

YieldResolver must implement `IAccountant.report(address strategy, uint256 gain, uint256 loss)`:
- Return `(gain, 0)` — report 100% of gain as fees, 0 refunds
- This causes process_report Step 9 to mint ALL fee shares to the accountant (= YieldResolver)
- harvest() then detects `vault.balanceOf(resolver)` increased → calls `registerShares()`

```solidity
import { IAccountant } from "@octant/interfaces/IAccountant.sol";

contract YieldResolver is ..., IAccountant {
    function report(address, uint256 gain, uint256) external view returns (uint256, uint256) {
        // Only callable by vaults we manage (optional: add vault whitelist check)
        return (gain, 0); // 100% of gain as fees → shares minted to this address
    }
}
```

**Verification**: Compiles

### Step 5b: Auto-Set Donation Address in Vault Creation

**Files**: `packages/contracts/src/modules/Octant.sol`

In `_createVaultForGardenAsset()` or in `mintGardenToken()`, after vault creation:
```solidity
// Set donation address to YieldResolver so harvest() doesn't revert
if (yieldResolver != address(0)) {
    gardenDonationAddresses[garden] = yieldResolver;
}
```

This removes the operator burden of calling `setDonationAddress` post-deployment. Without this, `harvest()` line 221 hard-reverts with `NoDonationAddress`.

**Verification**: Compiles

### Step 6: Add Backfill Function for Existing Vaults

**Files**: `packages/contracts/src/modules/Octant.sol`

Add new owner function:
```solidity
function enableAutoAllocate(
    address garden,
    address asset,
    address newStrategy
) external onlyOwner { ... }
```

This function:
1. Gets existing vault from `gardenAssetVaults[garden][asset]`
2. Adds new role bits via `add_role()` (NOT `set_role` — `set_role` overwrites, `add_role` preserves existing roles via bitwise OR):
   - `add_role(address(this), Roles.ACCOUNTANT_MANAGER)` (bit 3)
   - `add_role(address(this), Roles.DEBT_MANAGER)` (bit 6)
   - `add_role(address(this), Roles.MAX_DEBT_MANAGER)` (bit 7)
3. **Conditionally** revokes old strategy — only if `vaultStrategies[vault] != address(0)` (strategy was successfully attached). If old strategy was never attached (Layer 1 failure), `_strategies[oldStrategy].activation == 0` and `revoke_strategy` would revert with `StrategyNotActive()`.
4. Attaches new ERC4626 strategy via `add_strategy`
5. Sets `update_max_debt_for_strategy(strategy, type(uint256).max)`
6. Calls `set_auto_allocate(true)`
7. Sets `set_accountant(yieldResolver)` on the vault
8. Sets `gardenDonationAddresses[garden] = yieldResolver` (if not already set)
9. Updates `vaultStrategies[vault]`

**Verification**: Compiles

### Step 7: Update Deploy Script

**Files**: `packages/contracts/script/Deploy.s.sol`

In `_configureArbitrumOctantAssets()`:
- Import `AaveV3ERC4626` instead of `AaveV3`
- Construct with OZ ERC4626 constructor params: `(asset, "GG Aave WETH", "ggaWETH", pool, aToken, owner)`
- Keep env var override pattern for pre-deployed strategies

**Verification**: Script compiles

### Step 8: Write and Update Tests

**Files**:
- `packages/contracts/test/unit/AaveV3ERC4626.t.sol` (new)
- `packages/contracts/test/unit/YieldResolver.t.sol` (update — IAccountant tests)
- `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol` (update)
- `packages/contracts/test/fork/ArbitrumOctantVault.t.sol` (update)

**Unit tests** (AaveV3ERC4626.t.sol):
- Constructor sets correct asset, pool, aToken
- `asset()` returns underlying address
- `deposit()` mints shares and supplies to Aave (mock pool)
- `withdraw()` burns shares and withdraws from Aave
- `totalAssets()` = aToken balance + idle
- `maxDeposit()` returns 0 when paused
- `shutdown()` pauses deposits

**Unit tests** (YieldResolver IAccountant):
- `report(strategy, gain, 0)` returns `(gain, 0)`
- Integration: process_report → fee shares appear at resolver address

**Fork tests** (ArbitrumAaveStrategy.t.sol):
- Deploy AaveV3ERC4626 against real Aave pool
- `deposit(1 ETH)` → assert `aToken.balanceOf(strategy) > 0`
- Time warp 30 days → `totalAssets() > deposit` (yield accrued)
- Full cycle: deposit → report → withdraw

**Fork tests** (ArbitrumOctantVault.t.sol):
- **CRITICAL ASSERTION**: After vault deposit with auto-allocate:
  ```solidity
  assertGt(IERC20(AWETH).balanceOf(strategyAddr), 0, "funds must reach Aave");
  ```
- **CRITICAL ASSERTION**: After harvest with accountant:
  ```solidity
  assertGt(vault.balanceOf(resolver), 0, "fee shares must reach resolver");
  ```
- End-to-end: deposit → auto-allocate → Aave → time warp → harvest → process_report → fee shares to resolver → registerShares → splitYield
- Backfill test: existing vault with idle → call enableAutoAllocate → next deposit deploys ALL idle

**Verification**: `cd packages/contracts && bun run test` passes

## Validation

- [ ] `bun format` passes
- [ ] `bun lint` passes
- [ ] `bun run test` passes (unit + integration)
- [ ] `bun run test:fork` passes (Arbitrum fork with RPC)
- [ ] `bun build` succeeds
- [ ] No existing tests broken
- [ ] Strategy attachment succeeds (no StrategyAttachmentFailed event)
- [ ] Funds reach Aave (aToken balance > 0 after deposit)
- [ ] Yield accrues (totalAssets > deposit after time warp)
- [ ] process_report mints fee shares to YieldResolver (accountant mechanism)
- [ ] harvest() doesn't revert (donation address auto-set)
- [ ] registerShares() fires after harvest (resolver balance increased)
- [ ] splitYield() redeems shares and distributes correctly
- [ ] Auto-allocate deploys ALL idle on first deposit after enable
- [ ] Aave-at-capacity gracefully keeps funds idle (no revert)
- [ ] Backfill: enableAutoAllocate migrates existing vaults correctly
