# Cookie Jar Contracts — NFT Gating Audit Findings

**Status**: Action Required
**Audited**: 2026-02-10
**Repo**: `/Users/afo/Code/greenpill/cookie-jar/`
**Scope**: ERC-1155 access control, withdrawal flow, factory integration, test coverage
**Context**: Pre-integration audit for Green Goods cookie jar module (Hats Protocol gating)

---

## Critical Path: How ERC-1155 Gating Works

```
withdraw() → _checkAccess() → IERC1155(hatsProtocol).balanceOf(msg.sender, gardenerHatId)
                                    │
                                    ├── bal >= 1 → proceed to withdrawal validation
                                    └── bal < 1 or revert → NotAuthorized
```

The access check is a **read-only external call** wrapped in try/catch. If the target contract reverts for any reason (not ERC-1155, gas issues, contract paused), it catches and reverts with `NotAuthorized`. Defensive but generic.

---

## Findings

### Finding 9 — HIGH: Factory Overrides 0% Fee With Default

**File**: `CookieJarFactory.sol:157`

```solidity
uint256 feePerc = params.feePercentageOnDeposit == 0
    ? DEFAULT_FEE_PERCENTAGE
    : params.feePercentageOnDeposit;
```

**Problem**: Green Goods wants 0% fee jars. When `CookieJarModule` passes `feePercentageOnDeposit: 0`, the factory replaces it with `DEFAULT_FEE_PERCENTAGE`. There is no way to explicitly set 0% fee through the factory.

**Impact**: Every garden jar would charge the factory's default fee (likely non-zero), contradicting the plan's "0% — no protocol fee" design decision.

**Fix Options** (pick one):

| Option | Effort | Tradeoff |
|--------|--------|----------|
| A. Deploy factory with `DEFAULT_FEE_PERCENTAGE = 0` | Low | Green Goods gets its own factory instance; other consumers unaffected |
| B. Use sentinel value in factory (`type(uint256).max` = use default) | Medium | Requires factory code change; backwards compatible if sentinel is large |
| C. Pass `feePercentageOnDeposit: 1` (0.01%) | None | Not truly 0%; leaks small fees to collector |

**Recommended**: Option A — deploy a Green Goods-specific factory instance with 0% default fee. This requires no code changes and isolates Green Goods jars from other deployments.

---

### Finding 13 — MEDIUM: Hats Protocol Test Uses Wrong Mock

**File**: `CookieJarProtocols.t.sol:250-269`

**Problem**: The `jarHats` jar is created with `createAccessConfigWithProtocols()` which uses `mockPoap` (an ERC-721 mock) as the NFT contract, NOT the `mockHats` contract. The `MockHats` contract (lines 56-65) implements `isWearerOfHat()` but not `balanceOf(address, uint256)` which is what `_checkAccess()` actually calls for ERC-1155.

```solidity
// What the test creates (WRONG):
function createAccessConfigWithProtocols() internal view returns (CookieJarLib.AccessConfig memory) {
    // ...
    nftRequirement: CookieJarLib.NftRequirement({
        nftContract: mockNftAddresses[0],  // ← This is mockPoap, not mockHats!
        tokenId: 0,
        minBalance: 1
    })
}

// What it SHOULD create:
nftRequirement: CookieJarLib.NftRequirement({
    nftContract: address(mockHats),  // ← Must be the ERC-1155 mock
    tokenId: testHatId,              // ← Specific hat ID
    minBalance: 1
})
```

**Impact**: The "Hats Protocol withdrawal test" passes but doesn't actually test Hats-style ERC-1155 gating. It's testing ERC-721 POAP semantics. The real Hats path (`_checkAccess()` ERC1155 branch at CookieJar.sol:429-443) is only tested by `CookieJar.t.sol`'s `DummyERC1155` — not with Hats-like semantics (0-or-1 balance, specific hat IDs).

**Fix**:

1. Update `MockHats` to implement ERC-1155 `balanceOf()`:

```solidity
contract MockHats {
    mapping(address => mapping(uint256 => bool)) public wearerStatus;

    function setWearerStatus(address user, uint256 hatId, bool status) external {
        wearerStatus[user][hatId] = status;
    }

    function isWearerOfHat(address user, uint256 hatId) external view returns (bool) {
        return wearerStatus[user][hatId];
    }

    // ADD: ERC-1155 balanceOf for Cookie Jar _checkAccess() compatibility
    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return wearerStatus[account][id] ? 1 : 0;
    }
}
```

2. Fix `jarHats` creation to use `mockHats` as the NFT contract with the correct `testHatId`.

3. Add test cases:
   - User wearing hat → withdraw succeeds
   - User NOT wearing hat → withdraw reverts `NotAuthorized`
   - User wearing DIFFERENT hat ID → withdraw reverts `NotAuthorized`
   - Hat revoked between withdrawals → second withdraw reverts

---

### Finding 12 — MEDIUM: Cooldown Test Broken for Hats/ERC-1155 Path

**File**: `CookieJarProtocols.t.sol:529-549`

**Problem**: `test_WithdrawalIntervalEnforcement` has commented-out assertions:

```solidity
// Second withdrawal should fail (too soon)
// uint256 nextAllowed = jarHats.lastWithdrawalProtocol(user) + withdrawalInterval;
skip(100);
vm.prank(user);
// vm.expectRevert(abi.encodeWithSelector(CookieJarLib.WithdrawalTooSoon.selector, nextAllowed));
jarHats.withdrawWithErc1155(fixedAmount, purpose);  // ← This should FAIL but test doesn't check
```

The test name says "enforcement" but the revert expectation is commented out. The second and third withdrawals execute without any assertion that cooldowns work.

**Fix**: Uncomment and fix the assertion using `lastWithdrawalTime()`:

```solidity
function test_WithdrawalIntervalEnforcement() public {
    mockHats.setWearerStatus(user, testHatId, true);
    vm.warp(block.timestamp + withdrawalInterval + 1);

    // First withdrawal succeeds
    vm.prank(user);
    jarHats.withdrawWithErc1155(fixedAmount, purpose);

    // Second withdrawal too soon — should revert
    uint256 nextAllowed = jarHats.lastWithdrawalTime(user) + withdrawalInterval;
    skip(100);
    vm.prank(user);
    vm.expectRevert(abi.encodeWithSelector(CookieJarLib.WithdrawalTooSoon.selector, nextAllowed));
    jarHats.withdrawWithErc1155(fixedAmount, purpose);

    // Third withdrawal after interval — should succeed
    vm.warp(nextAllowed + 1);
    vm.prank(user);
    jarHats.withdrawWithErc1155(fixedAmount, purpose);
}
```

---

### Finding 14 — LOW: Build Configuration Broken

**File**: `foundry.toml` + `contracts/remappings.txt`

**Problem**: `foundry.toml` sets `src = "contracts/src"` and `libs = ["lib"]` (root-relative), but `contracts/remappings.txt` uses relative paths from the `contracts/` directory (e.g., `../lib/protocol-monorepo/...`). Forge doesn't find the Superfluid import:

```
Source "@superfluid-finance/ethereum-contracts/interfaces/superfluid/ISuperfluid.sol" not found
```

**Fix Options**:

| Option | Description |
|--------|-------------|
| A. Add remappings to `foundry.toml` | Add `remappings = [...]` section with root-relative paths |
| B. Create root `remappings.txt` | Copy `contracts/remappings.txt` and adjust paths to be root-relative |
| C. Change foundry.toml to `cd` into contracts | Set `src = "src"`, `test = "test"`, `libs = ["../lib"]` and run from `contracts/` |

---

### Finding 5 — LOW: `require` String Instead of Custom Error

**File**: `CookieJar.sol:523`

```solidity
// Current:
require(success, "ETH transfer failed");

// Should be:
if (!success) revert CookieJarLib.TransferFailed();
```

Wastes gas on string encoding and breaks the custom error pattern used everywhere else.

---

### Finding 4 — MEDIUM: NFT Requirement Immutable After Construction

**File**: `CookieJar.sol:139`

`nftRequirement` (including `nftContract` and `tokenId`) is set once in the constructor and cannot be changed. If a garden's Hats hat tree is rebuilt (e.g., migration, reconfiguration), the `gardenerHatId` changes but the jar still checks the old hat ID.

**Impact**: Hat migrations require deploying a new jar. The old jar becomes inaccessible (no one wears the old hat ID) but its funds need emergency withdrawal.

**Mitigation**: Already acceptable per the plan — jars are cheap to create via factory, and emergency withdrawal can recover stuck funds. Document in the ops runbook.

---

### Finding 1 — LOW: Generic Error Hides Failure Reason

**File**: `CookieJar.sol:437-439`

```solidity
} catch {
    revert CookieJarLib.NotAuthorized();  // Could be: contract paused, gas, not ERC-1155...
}
```

**Fix**: Split into two distinct errors:

```solidity
} catch {
    revert CookieJarLib.NFTContractCallFailed();  // External call reverted
}
// And in the success path:
if (bal < minBal) revert CookieJarLib.InsufficientNFTBalance();  // Has token, not enough
```

Both errors already exist in `CookieJarLib` (lines 146-148) — they're just not used.

---

### Finding 6 — LOW: Period Reset Logic Duplicated

**Files**: `CookieJar.sol:491-497` and `CookieJar.sol:510-513`

The period reset check (`block.timestamp >= lastWithdrawalTime + WITHDRAWAL_PERIOD`) appears in both `_validateWithdrawalConstraints` (read-only) and `_executeWithdrawal` (mutating). If one changes without the other, period limits could be bypassed or double-enforced.

**Fix**: Extract to a shared helper or have `_executeWithdrawal` return the computed values from `_validateWithdrawalConstraints`.

---

### Finding 8 — INFO: Emergency Withdraw Doesn't Update `pendingTokenBalances`

**File**: `CookieJar.sol:276-290`

If the jar owner emergency-withdraws tokens that are tracked in `pendingTokenBalances`, the mapping becomes stale. A subsequent `swapPendingTokens()` call would try to swap tokens that no longer exist, reverting at the transfer step (safe failure). Not exploitable but causes confusing accounting.

---

### Finding 7 — INFO: Fee Event Emitted When Fee is 0%

**File**: `CookieJar.sol:338`

`FeeCollected` event fires on every deposit even with 0% fee. For Green Goods (0% fee), every deposit emits `FeeCollected(feeCollector, 0, currency)`. Noisy for indexers.

---

### Finding 10 — LOW: `cookieJars[]` Array Grows Unbounded

**File**: `CookieJarFactory.sol:22, 98-100`

`getAllJars()` returns the full array. At scale, this becomes a gas-heavy view call. Not a practical concern for Green Goods (one jar per garden, ~100s of gardens), and the factory's own comment acknowledges it.

---

## Action Items — Ordered by Priority

### Must Fix Before Integration

| # | Finding | Owner | Effort |
|---|---------|-------|--------|
| 1 | **Deploy factory with 0% default fee** (Finding 9) | Green Goods | Low — redeploy factory with `_feePercentage = 0` |
| 2 | **Fix MockHats to implement ERC-1155 balanceOf** (Finding 13) | Cookie Jar | Low — add one function to mock |
| 3 | **Fix Hats jar test to use mockHats contract** (Finding 13) | Cookie Jar | Low — change access config |
| 4 | **Fix cooldown test assertions** (Finding 12) | Cookie Jar | Low — uncomment and update |
| 5 | **Fix build configuration** (Finding 14) | Cookie Jar | Low — add root remappings |

### Should Fix Before Production

| # | Finding | Owner | Effort |
|---|---------|-------|--------|
| 6 | Split `NotAuthorized` into distinct errors (Finding 1) | Cookie Jar | Low |
| 7 | Replace `require` string with custom error (Finding 5) | Cookie Jar | Trivial |
| 8 | Document immutable NFT requirement in ops runbook (Finding 4) | Green Goods | Trivial |

### Nice to Have

| # | Finding | Owner | Effort |
|---|---------|-------|--------|
| 9 | Add ERC-165 check in constructor (Finding 2) | Cookie Jar | Low |
| 10 | Deduplicate period reset logic (Finding 6) | Cookie Jar | Low |
| 11 | Conditional fee event emission (Finding 7) | Cookie Jar | Trivial |
| 12 | Update `pendingTokenBalances` in emergency withdraw (Finding 8) | Cookie Jar | Low |

---

## Hats Protocol Compatibility Verification

| Check | Result | Notes |
|-------|--------|-------|
| Hats implements ERC-1155 `balanceOf(address, uint256)` | Yes | Returns 0 or 1 |
| Cookie Jar calls `balanceOf(msg.sender, tokenId)` | Yes | Line 433 |
| `minBalance: 1` correctly gates on hat wearing | Yes | `bal >= 1` check |
| `minBalance: 0` defaults to 1 | Yes | Line 432 |
| Hat ID is per-garden (unique) | Yes | Created by `HatsModule.createGardenHatTree()` |
| Operators/Owners pass gardener hat check | Yes | `HatsModule._grantRole()` auto-mints gardener hat |
| Standalone evaluators fail gardener hat check | Yes | No auto-grant of gardener hat |
| Constructor validates ERC-1155 interface | Yes | Calls `balanceOf(address(this), 0)` |
| External call failures caught gracefully | Yes | try/catch → `NotAuthorized` |

**Verdict**: The ERC-1155 access control path is functionally correct for Hats Protocol gating. The three blockers (factory fee, test mock, build config) are all low-effort fixes.
