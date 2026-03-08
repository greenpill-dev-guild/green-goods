# Adversarial Review Prompt: Vault-Strategy Auto-Allocate Fix

**Purpose**: Run this prompt against the plan at `.plans/vault-strategy-autoallocate-fix.todo.md` to surface gaps, incorrect assumptions, and security risks before implementation.

**How to use**: Copy the prompt below into a new Claude session (or use as a `/plan --mode check` input). Provide it the plan file and access to the codebase.

---

## PROMPT

You are a senior DeFi security auditor and Yearn V3 / Octant vault architecture expert. Your job is to adversarially review the implementation plan at `.plans/vault-strategy-autoallocate-fix.todo.md` for a fix to a 4-layer yield pipeline disconnection in the Green Goods protocol.

**Your mandate**: Find every gap, incorrect assumption, race condition, storage collision, and economic attack vector. Be ruthless. Cite specific file paths and line numbers from the codebase. Do not accept hand-waving.

### CONTEXT

The plan proposes:
1. New `AaveV3ERC4626.sol` strategy using OpenZeppelin ERC4626 base
2. Expanded `VAULT_ROLE_BITMASK` (adding bits 3, 6, 7)
3. Auto-allocate wiring in vault creation flow
4. YieldResolver implementing `IAccountant.report()` returning 100% gain as fees
5. Auto-setting donation address during vault creation
6. Backfill function for existing Arbitrum vaults
7. Updated deploy script and tests

### REVIEW DIMENSIONS

For each dimension, challenge the plan with the specific anchoring references provided.

---

#### A. IAccountant.report() — Fee Math & Share Accounting

The plan says YieldResolver should return `(gain, 0)` from `report()`. Validate against the actual fee math in `process_report()`:

**Anchor**: `MultistrategyVault.sol` lines 785-829
- Step 3 (line 790): `(vars.totalFees, vars.totalRefunds) = IAccountant(vars.accountant).report(strategy_, vars.gain, vars.loss)`
- Fee shares calculation (line 817): `vars.totalFeesShares = (vars.sharesToBurn * vars.totalFees) / (vars.loss + vars.totalFees)`
- But `sharesToBurn` is calculated at line 812: `vars.sharesToBurn = _convertToShares(vars.loss + vars.totalFees, Rounding.ROUND_UP)`

**Challenge questions**:
1. If `gain > 0` and `loss == 0`, what is `sharesToBurn`? Is it `_convertToShares(0 + gain, ROUND_UP) = _convertToShares(gain, ROUND_UP)`? That means the vault burns `gain`-worth of shares — from WHERE? Trace line 868: `_burnShares(vars.toBurn, address(this))` — burns from the vault's own locked shares. But if this is the FIRST report and there are no locked shares, what happens?
2. Step 6 (line 848-863) adjusts `endingSupply`. With `gain > 0` and `totalFees = gain` (100% fee), does `endingSupply` equal `currentTotalSupply`? Walk through the exact math: `endingSupply = currentSupply - sharesToBurn + sharesToLock`. If `totalFees = gain`, then `sharesToLock = _convertToShares(gain + 0 - gain - 0, ROUND_DOWN) = _convertToShares(0, ROUND_DOWN) = 0`. So `endingSupply = currentSupply - sharesToBurn + 0`. Then Step 6 mints: `_issueShares(endingSupply - currentTotalSupply, address(this))` — but `endingSupply < currentTotalSupply`, so this is NEGATIVE. Does it revert?
3. With 100% fees, does the profit locking mechanism (7-day unlock at `profitMaxUnlockTime = 7 days`) still work? Or does returning 100% as fees BYPASS the locking entirely — meaning all yield is immediately extractable? Is this desired or a security risk?
4. What happens at line 994: `if (vars.loss + vars.totalFees > vars.gain + vars.totalRefunds || vars.profitMaxUnlockTimeVar == 0)`? With `totalFees = gain` and `loss = 0, totalRefunds = 0`: `gain > gain` is false, so this branch is NOT taken. What does this mean for the unlock schedule?

**Critical**: The fee math assumes fees are LESS than gains. Returning 100% of gain as fees may create an edge case where `sharesToBurn > totalLockedShares`, causing the vault to burn from circulating supply or revert. Trace the exact flow for a first-ever report with zero prior locked shares.

---

#### B. IAccountant.report() Is NOT a View Function

**Anchor**: `IAccountant.sol` line 22: `function report(address strategy, uint256 gain, uint256 loss) external returns (uint256, uint256);`

The plan shows YieldResolver implementing `report()` as `external view`. But the interface declares it as `external` (state-changing, NOT view).

**Challenge questions**:
1. Can a `view` function satisfy a non-view interface? In Solidity ≥0.8, a `view` function CAN satisfy a non-view interface function (it's a narrowing of the mutability). But does the MultistrategyVault call it with `staticcall` or `call`? Check line 790 — it uses a regular call (`IAccountant(vars.accountant).report(...)`). A `view` function called via regular `call` works fine. But verify this assumption holds with the Solidity version used.
2. Should `report()` actually be state-changing? Could YieldResolver need to track which vaults have reported, to prevent double-counting or replay?

---

#### C. Refund Pull — Does YieldResolver Need to Approve the Vault?

**Anchor**: `MultistrategyVault.sol` lines 795-800, 887

```solidity
vars.totalRefunds = Math.min(
    vars.totalRefunds,
    Math.min(
        IERC20(asset).balanceOf(vars.accountant),
        IERC20(asset).allowance(vars.accountant, address(this))
    )
);
```

And line 887:
```solidity
if (vars.totalRefunds > 0) {
    IERC20(asset).safeTransferFrom(vars.accountant, address(this), vars.totalRefunds);
}
```

**Challenge questions**:
1. The plan returns `(gain, 0)` — zero refunds. So `totalRefunds = 0` and line 887 is skipped. But what if a future scenario has loss > 0? If YieldResolver hasn't approved the vault to pull tokens, `safeTransferFrom` will revert. Should the plan account for this defensive case?
2. Even with `refunds = 0`, the vault still checks `IERC20(asset).allowance(vars.accountant, address(this))`. This is a wasted SLOAD but not a bug. Confirm.

---

#### D. Reentrancy Risk: Accountant Called Before State Finalization

**Anchor**: `MultistrategyVault.sol` — `process_report()` flow order:
- Step 3 (line 790): External call to `accountant.report()` ← **HERE**
- Step 8 (line 903-927): Debt/idle updates ← state not yet finalized
- Step 9 (line 930-941): Fee share minting

**Challenge questions**:
1. If YieldResolver's `report()` calls back into the vault (e.g., reads `totalAssets()`, `balanceOf(resolver)`, or any view function), it sees PRE-update state. Is this a problem for the plan's harvest flow?
2. The `nonReentrant` guard prevents re-entering `process_report()`. But can `report()` call `deposit()` or `redeem()` on the vault? These also have `nonReentrant`, so they'd revert. But `balanceOf()`, `totalAssets()`, `convertToShares()` are NOT guarded — the accountant can read stale intermediate values. Does this matter?
3. If YieldResolver is the accountant AND holds vault shares, could a malicious `report()` implementation front-run the fee share minting to extract value? The plan's `report()` is a pure getter (`return (gain, 0)`), so no — but should there be a comment or safety invariant documenting this?

---

#### E. `set_role` Overwrites — Backfill Correctness

**Anchor**: `MultistrategyVault.sol` line 589-594:
```solidity
function set_role(address account_, uint256 rolesBitmask_) external override {
    require(msg.sender == roleManager, NotAllowed());
    roles[account_] = rolesBitmask_;  // OVERWRITES
}
```

vs. `add_role` (line 604-609) which uses bitwise OR.

**Challenge questions**:
1. Step 6 (backfill) calls `set_role(address(this), VAULT_ROLE_BITMASK)`. This OVERWRITES the existing roles. If the vault previously had roles granted by other mechanisms (e.g., manual admin calls), they're lost. Is this acceptable?
2. Should the backfill use `add_role()` for each new bit instead? That preserves existing roles. The plan's `VAULT_ROLE_BITMASK` is a superset, but what if someone added FORCE_REVOKE_MANAGER(2) or QUEUE_MANAGER(4) manually? Those would be wiped.
3. For NEW vaults (Step 4), `set_role` with the full bitmask is correct — fresh vault, no prior roles. But backfill should be different. Verify.

---

#### F. revoke_strategy Requires Zero Debt — Backfill Ordering

**Anchor**: `MultistrategyVault.sol` line 2550:
```solidity
if (currentDebt != 0) {
    require(force, StrategyHasDebt());
}
```

**Challenge questions**:
1. The backfill function calls `revoke_strategy()` (soft revoke). But if the old strategy somehow has debt (it shouldn't, since `add_strategy` never succeeded), would this revert? Trace: if `vaultStrategies[vault]` is `address(0)` (strategy never attached), does the backfill even need to revoke?
2. If the old minimal AaveV3 strategy was never attached (Layer 1 failure), `_strategies[oldStrategy].activation == 0`. Calling `revoke_strategy(oldStrategy)` would revert with `StrategyNotActive()` at line 2543. The backfill needs a conditional: only revoke if strategy is active.
3. What if there ARE funds in the old strategy (e.g., manual `deployFunds` call outside the vault)? The backfill needs to handle both cases: (a) strategy never attached, (b) strategy attached with debt.

---

#### G. ERC4626 First-Depositor Attack on AaveV3ERC4626

**Anchor**: The project uses OZ 4.8.3/5.0.2. The MultistrategyVault has its own share math (lines 2058-2085) with NO virtual offset.

**Challenge questions**:
1. The new `AaveV3ERC4626.sol` uses OZ's ERC4626 base. Which OZ version will it use — 4.8.3 or 5.0.2? Version 5.0.2 includes virtual share offsets (`_decimalsOffset()`) to mitigate first-depositor attacks. Version 4.8.3 does NOT.
2. The strategy is NOT the vault users interact with — users deposit into MultistrategyVault, which then deposits into the strategy. So the "first depositor" of the strategy is always the vault. Is the first-depositor attack still relevant? The vault is the only depositor, so it can't be front-run by an attacker... unless the strategy is deployed and someone deposits directly before the vault does. Should the constructor set `depositsPaused = true` until the vault attaches it?
3. Does OZ ERC4626 use `_deposit` and `_withdraw` virtual hooks that can be overridden? In OZ 5.0.2, `ERC4626._deposit()` calls `SafeERC20.safeTransferFrom()` then `_mint()`. Can you override `_deposit` to add `aavePool.supply()` AFTER the default behavior? Or do you need to override `deposit()` entirely?

---

#### H. Aave Supply Approval in AaveV3ERC4626

**Anchor**: Vendored `AaveV3Strategy.sol` line 124:
```solidity
IERC20(_asset).forceApprove(address(pool), type(uint256).max);
```

**Challenge questions**:
1. The plan's `AaveV3ERC4626` must approve the Aave pool to spend the underlying asset. Where is this done — constructor? `_deposit` override? If in `_deposit`, it's a gas-wasting repeated approval.
2. `forceApprove` is an OZ SafeERC20 function that handles non-standard tokens (USDT). Is this needed for WETH/DAI on Arbitrum? WETH and DAI are standard ERC20 — `approve` suffices. But defensive coding says use `forceApprove`. Verify OZ version provides it.
3. After `aavePool.supply()`, the underlying tokens leave the strategy. But OZ ERC4626's default `_deposit()` does `safeTransferFrom(caller, address(this), assets)` then `_mint(receiver, shares)`. If you override `_deposit` to add `supply()` after, the tokens are: (a) transferred to strategy, (b) supplied to Aave. But `totalAssets()` returns `aToken.balanceOf(this) + asset.balanceOf(this)`. Right after supply, `asset.balanceOf(this) == 0` and `aToken.balanceOf(this) == assets`. Correct. But what about the OZ `_deposit` calling `_mint` BEFORE the supply? The shares are minted with the correct amount because `totalAssets()` already includes the just-transferred assets (they're in the strategy's balance before supply). After supply, `totalAssets()` still equals the same amount (aTokens replace underlying 1:1 initially). Verify this is atomic and safe.

---

#### I. Donation Address vs. Accountant — Conceptual Confusion

**Anchor**: `Octant.sol` lines 83, 310-313, 528-537

The `gardenDonationAddresses` mapping is used in TWO places:
1. `harvest()` line 221: Guard — reverts if zero (the plan fixes this)
2. `_configureStrategy()` lines 310-313: Sets `donationAddress` on the IOctantStrategy

**Challenge questions**:
1. The plan sets `gardenDonationAddresses[garden] = yieldResolver`. But `donationAddress` on the IOctantStrategy is for the MINIMAL AaveV3's `setDonationAddress()` — a completely different mechanism from the vault's accountant. With the new ERC4626 strategy, does `setDonationAddress` even exist? If not, lines 528-537 will try to call it and fail silently (try/catch). Is this acceptable?
2. The `harvest()` guard at line 221 just checks `gardenDonationAddresses[garden] != address(0)`. It doesn't USE the donation address for anything else in the harvest flow. The address is checked but never used in harvest. Is the guard even necessary, or is it a vestigial check from an earlier design? Should we remove the guard entirely instead of working around it?
3. If the donation address is set to the YieldResolver, and someone later calls `setDonationAddress(garden, someOtherAddress)`, does harvest still work? Yes (guard passes). But is there a semantic confusion — the "donation address" doesn't actually receive donations in the new flow; it's just a gate check.

---

#### J. process_report Gain Calculation with autoAllocate

**Anchor**: `MultistrategyVault.sol` lines 754-779
```solidity
// Step 1: snapshot strategy position
vars.strategyTotalAssets = IERC4626Payable(strategy_).convertToAssets(
    IERC4626Payable(strategy_).balanceOf(address(this))
);
// Step 2: gain/loss
if (vars.strategyTotalAssets > vars.currentDebt) {
    vars.gain = vars.strategyTotalAssets - vars.currentDebt;
}
```

**Challenge questions**:
1. `convertToAssets(balanceOf(vault))` on the AaveV3ERC4626 strategy: this returns the vault's share of `totalAssets()` in the strategy. `totalAssets()` = `aToken.balanceOf(strategy) + asset.balanceOf(strategy)`. After auto-allocate, the vault owns 100% of strategy shares (it's the only depositor). So `convertToAssets` should return the full `totalAssets()`. Verify this is correct for a single-depositor strategy.
2. If Aave accrues yield between deposits, `totalAssets()` increases. The gain = `totalAssets() - currentDebt`. But `currentDebt` was set when `_updateDebt` ran. If auto-allocate runs on EVERY deposit, `currentDebt` is updated each time. So gain is only the yield since the LAST deposit (or last `process_report`). Is this correct? Or does it accumulate?
3. What if two gardens share the same asset vault (e.g., both use WETH)? They share a single vault and single strategy. Yield is split at the vault level, not per-garden. The `registerShares()` function tracks per-garden shares. But if Garden A deposited 90% and Garden B deposited 10%, do they get proportional yield? Or does `registerShares()` just track the NEW fee shares minted during harvest — which are proportional to the TOTAL vault, not per-garden deposits? This seems like a fairness issue.

---

#### K. Storage Layout Safety — YieldResolver Upgrade

**Anchor**: `Yield.sol` — 17 storage variables + `uint256[33] private __gap` (50 slots total)

**Challenge questions**:
1. Adding `IAccountant` to YieldResolver means adding the `report()` function. Since it's just a function (no new storage), the storage layout is unchanged. But if `report()` needed to track state (e.g., whitelisted vaults), a new mapping would consume a gap slot. Does the plan need a vault whitelist? If any contract can call `report()`, a malicious contract could use the YieldResolver as a fee sink.
2. Should `report()` validate that `msg.sender` is a vault managed by the OctantModule? Without this, anyone could call `report(strategy, 1000000 ether, 0)` — but the return value is just `(gain, 0)`, which is informational. The vault uses it to calculate fees, but only the vault calls it during `process_report`. A direct external call to `report()` has no effect on the vault. So is access control unnecessary? Confirm.

---

#### L. Migration Atomicity — Backfill Race Conditions

**Challenge questions**:
1. The backfill function `enableAutoAllocate()` does 9 operations. If it reverts partway through (e.g., `add_strategy` fails), the vault is left in a partially-configured state. Should the entire function be atomic (all-or-nothing)?
2. Between `revoke_strategy(oldStrategy)` and `add_strategy(newStrategy)`, is there a window where the vault has NO strategy? If a user deposits during this window, auto-allocate has nothing to deploy to. Funds sit idle. Is this a problem?
3. Can `enableAutoAllocate` be called twice on the same vault? What prevents double-configuration? The second call would try to `add_strategy` on an already-active strategy → reverts with `StrategyAlreadyActive()`. Is this the desired guard?

---

#### M. Aave-Specific Edge Cases

**Challenge questions**:
1. **Pool paused**: If Aave V3 pool is paused, `supply()` reverts. With auto-allocate, EVERY deposit would revert. Check: does `_updateDebt` in the vault catch this? `DebtManagementLib.sol` line 268-272 checks `maxDeposit()`. If the strategy's `maxDeposit()` returns 0 when paused, the vault skips allocation gracefully. But the plan's `AaveV3ERC4626.maxDeposit()` returns 0 only when `depositsPaused` is set by the owner. **It does NOT check Aave pool pause state.** Should `maxDeposit()` also query Aave's pool configuration?
2. **Supply cap reached**: Aave V3 has per-reserve supply caps. If WETH supply cap is reached, `supply()` reverts. Same question: does `maxDeposit()` need to check `IPoolDataProvider.getReserveCaps()`?
3. **aToken rebasing**: Aave V3 aTokens are rebasing (balance increases over time). The strategy's `totalAssets()` increases without any action. This is correct and desired. But verify: does `convertToAssets()` in OZ ERC4626 handle a `totalAssets()` that changes between `deposit()` and a later `convertToAssets()` call? Yes — it uses the current ratio at call time. Confirm.

---

#### N. End-to-End Flow Trace — The Happy Path

Trace the EXACT sequence of calls for a single deposit → yield → harvest → split cycle. At each step, cite the file:line. Flag any step where the plan's changes are insufficient.

1. User calls `vault.deposit(assets, receiver)` → `MultistrategyVault.sol:1312`
2. `_deposit()` transfers assets, issues shares → `:2240-2262`
3. `autoAllocate` triggers `_updateDebt(strategy, type(uint256).max, 0)` → `:2259-2261`
4. `_updateDebt` calls `strategy.maxDeposit()` → `DebtManagementLib.sol:268`
5. `strategy.deposit(assets, vault)` → OZ ERC4626 deposit → `aavePool.supply()` → funds in Aave
6. Time passes, Aave accrues yield, `aToken.balanceOf(strategy)` increases
7. Operator calls `octantModule.harvest(garden, asset)` → `Octant.sol:220`
8. Line 221: `gardenDonationAddresses[garden] != address(0)` — CHECK (plan sets this)
9. Line 237: `vault.process_report(strategy)` → `MultistrategyVault.sol:736`
10. Step 1: `strategy.convertToAssets(strategy.balanceOf(vault))` → includes yield
11. Step 2: `gain = strategyTotalAssets - currentDebt` → positive gain
12. Step 3: `accountant.report(strategy, gain, 0)` → `YieldResolver.report()` returns `(gain, 0)`
13. **TRACE THE FEE MATH HERE** — what exactly happens with sharesToBurn, sharesToLock, endingSupply, fee share issuance? Walk through every line from 810-941 with `totalFees = gain, totalRefunds = 0, loss = 0`.
14. Step 9: `_issueShares(totalFeesShares, accountant)` → shares minted to YieldResolver
15. Back in `harvest()`: `sharesAfter = vault.balanceOf(resolver)` → increased by fee shares
16. `registerShares(garden, vault, newShares)` → `Yield.sol:379`
17. Later: `splitYield(garden, asset)` → `Yield.sol:224`
18. `_redeemAndAccumulate` redeems shares → vault sends assets → split 3 ways

**THE CRITICAL GAP**: Step 13. Walk through the fee math with `totalFees = gain`. If this creates a mathematical impossibility (negative shares, underflow, revert), the ENTIRE plan fails. This is the single most important thing to verify.

---

### DELIVERABLES

After reviewing each dimension (A through N), produce:

1. **BLOCKING issues**: Changes to the plan that MUST be made before implementation (mathematical errors, reverts, storage collisions)
2. **HIGH-RISK issues**: Likely problems that should be addressed but might not cause immediate failure
3. **MEDIUM-RISK issues**: Design concerns that should be tracked but can be deferred
4. **ACCEPTED risks**: Known limitations that are documented and acceptable

For each issue, provide:
- Dimension letter (A-N)
- Severity (BLOCKING / HIGH / MEDIUM / ACCEPTED)
- File:line reference
- Exact failure mode
- Proposed fix
