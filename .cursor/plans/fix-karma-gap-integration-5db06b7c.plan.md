<!-- 5db06b7c-773a-461a-bad4-bac603562055 d5b8ac16-708b-4427-9409-c6a449627589 -->
# Fix ProjectResolver Interface Mismatch

## Root Cause

The `IProjectResolver` interface in our codebase doesn't match the actual deployed Karma GAP ProjectResolver contract. This causes all fork tests to revert when calling these mismatched functions.

**Function Name Mismatches:**

1. Interface: `isProjectAdmin()` → Real contract: `isAdmin()`
2. Interface: `isProjectOwner()` → Real contract: `isOwner()`
3. Interface: `getProjectAdmins()` → Real contract: **Does not exist**

**Evidence:** Test trace shows revert at `isProjectAdmin()` call on real deployed contract at `0x6dC1D6b864e8BEf815806f9e4677123496e12026`.

## Implementation Steps

### Step 1: Update IProjectResolver Interface

**File:** `packages/contracts/src/interfaces/IKarmaGap.sol`

**Action:** Replace function declarations to match real contract:

```solidity
interface IProjectResolver {
    /// @notice Adds an admin to a project
    function addAdmin(bytes32 projectUid, address addr) external;

    /// @notice Removes an admin from a project
    function removeAdmin(bytes32 projectUid, address addr) external;

    /// @notice Transfers ownership of a project
    function transferProjectOwnership(bytes32 projectUid, address newOwner) external;

    /// @notice Checks if an address is a project admin or owner
    /// @dev In the real contract, this is called 'isAdmin' not 'isProjectAdmin'
    function isAdmin(bytes32 projectId, address addr) external view returns (bool);

    /// @notice Checks if an address is the project owner
    /// @dev In the real contract, this is called 'isOwner' not 'isProjectOwner'
    function isOwner(bytes32 projectId, address addr) external view returns (bool);
}
```

**Changes:**

- Rename `isProjectAdmin` → `isAdmin`
- Rename `isProjectOwner` → `isOwner`
- Remove `getProjectAdmins()` (doesn't exist in real contract)
- Update parameter name from `projectUid` to `projectId` to match real contract

### Step 2: Update Test Calls in E2EKarmaGAPFork.t.sol

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Line 92** - Update `_validateGardenCreation`:

```solidity
// 4. Validate operator is GAP admin
IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
assertTrue(resolver.isAdmin(projectUID, operator), "Operator must be GAP admin");
```

**Change:** From `isProjectAdmin(projectUID, operator)` to `isAdmin(projectUID, operator)`

### Step 3: Update Operator Management Test

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Line 333** - Update operator verification:

```solidity
// 3. Verify synced to GAP
IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
bool isGAPAdmin = resolver.isAdmin(projectUID, newOperator);
assertTrue(isGAPAdmin, "New operator must be GAP admin");
```

**Change:** From `isProjectAdmin()` to `isAdmin()`

### Step 4: Remove or Modify getProjectAdmins Test Logic

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Lines 337-348** - Update multi-operator verification:

Since `getProjectAdmins()` doesn't exist on the real contract, remove this query and verify individually:

```solidity
// 4. Verify both operators individually (no getProjectAdmins in real contract)
bool originalIsAdmin = resolver.isAdmin(projectUID, operator);
bool newIsAdmin = resolver.isAdmin(projectUID, newOperator);
assertTrue(originalIsAdmin, "Original operator must be GAP admin");
assertTrue(newIsAdmin, "New operator must be GAP admin");
```

**Change:** Replace lines 337-348 (getProjectAdmins query loop) with individual isAdmin checks

### Step 5: Update Multi-Operator Test

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Lines 399-408** - Update admin verification:

```solidity
// Verify all operators are GAP admins
IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());

for (uint256 i = 0; i < multiOperators.length; i++) {
    bool isAdmin = resolver.isAdmin(projectUID, multiOperators[i]);
    assertTrue(isAdmin, "All operators must be GAP admins");
}

// No getProjectAdmins function, so verify count by individual checks only
```

**Change:** From `isProjectAdmin()` to `isAdmin()`, remove `getProjectAdmins()` call

### Step 6: Run Tests and Validate

**Command:**

```bash
cd packages/contracts
pnpm run test:e2e 2>&1 | tail -100
```

**Expected Results:**

- All 21 E2E fork tests should now pass
- No more revert errors on ProjectResolver calls
- Tests correctly verify GAP admin status using `isAdmin()`

## Testing Checklist

- [ ] Interface updated with correct function names
- [ ] All test calls updated from `isProjectAdmin()` to `isAdmin()`
- [ ] All test calls updated from `isProjectOwner()` to `isOwner()`
- [ ] `getProjectAdmins()` usage removed/replaced
- [ ] Garden creation tests pass (3 tests)
- [ ] Operator management tests pass (3 tests)
- [ ] Multi-operator tests pass (3 tests)
- [ ] All 21 E2E fork tests pass
- [ ] No revert errors in test output

## Files Modified

1. `packages/contracts/src/interfaces/IKarmaGap.sol` - Update interface
2. `packages/contracts/test/E2EKarmaGAPFork.t.sol` - Update all test calls (5 locations)

## Notes

- The real ProjectResolver contract has `isAdmin()` which checks both ownership AND admin status
- The `isOwner()` function checks if address is the actual project owner
- There is NO `getProjectAdmins()` function to enumerate admins in the real contract
- Parameter name is `projectId` not `projectUid` in the real contract (but Solidity doesn't enforce this for interface calls)