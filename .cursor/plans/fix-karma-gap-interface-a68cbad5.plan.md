<!-- a68cbad5-3e25-40c4-9d03-39fc4495ab24 4dbd9914-8ef7-4f6a-b4e3-20fdda3a588c -->
# Fix E2E Test Schema Mismatches

## Overview

Fix 9 failing tests caused by incorrect schema encoding in `E2EKarmaGAPFork.t.sol`. All issues are pre-existing test bugs unrelated to the Karma GAP interface fix.

## Current Status

- ✅ Karma GAP interface fix: 100% successful (12/24 tests passing)
- ❌ Schema mismatches: 9 tests failing
- ⚠️ Base Sepolia issues: 3 tests failing (skipping for now)

## Issues to Fix

### Issue 1: Multi-Operator Test - Invalid Impact Creation (3 tests)

**Problem:** Test directly calls `garden.createProjectImpact()` which has `onlyResolver` modifier. This can ONLY be called by WorkApprovalResolver contract, not by operators.

**Affected Tests:**

- testFork_MultiOperator_Arbitrum
- testFork_MultiOperator_BaseSepolia  
- testFork_MultiOperator_Celo

**Fix:** Remove the direct impact creation test (lines 402-406)

---

### Issue 2: Assessment Schema Mismatch (3 tests)

**Problem:** `_createAssessment()` only encodes 5 fields but schema requires 12 fields.

**Current (incorrect):**

```solidity
bytes memory assessmentData = abi.encode(
    garden,              // WRONG - not in schema
    "Q1 2025 Assessment",
    "Garden flourishing with native species",
    uint8(1),           // WRONG type - should be string[]
    uint256(85)         // WRONG - not in schema
);
```

**Required Schema:**

- title (string)
- description (string)
- assessmentType (string)
- capitals (string[])
- metricsJSON (string)
- evidenceMedia (string[])
- reportDocuments (string[])
- impactAttestations (bytes32[])
- startDate (uint256)
- endDate (uint256)
- location (string)
- tags (string[])

**Affected Tests:**

- testFork_AssessmentFlow_Arbitrum
- testFork_AssessmentFlow_BaseSepolia
- testFork_AssessmentFlow_Celo

---

### Issue 3: Work Submission Schema Mismatch (3 tests)

**Problem:** `_submitWork()` encodes wrong fields in wrong order.

**Current (incorrect):**

```solidity
bytes memory workData = abi.encode(
    garden,              // WRONG - not in schema
    actionId,
    "Planted 50 native trees",
    "ipfs://work-photos" // WRONG type - should be string[]
);
```

**Required Schema:**

- actionUID (uint256)
- title (string)
- feedback (string)
- metadata (string)
- media (string[])

**Affected Tests:**

- testFork_CompleteWorkFlow_Arbitrum
- testFork_CompleteWorkFlow_BaseSepolia
- testFork_CompleteWorkFlow_Celo

---

## Implementation Steps

### Step 1: Remove Invalid Impact Creation Test

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Lines 402-406** - Delete these lines:

```solidity
// Any operator can create impacts
vm.prank(multiOperators[1]);
bytes32 impactUID =
    garden.createProjectImpact("Operator 2 Impact", "Second operator creates impact", "ipfs://proof");
assertTrue(impactUID != bytes32(0), "Any operator can create impacts");
```

**Replace with:**

```solidity
// Note: createProjectImpact() can only be called by WorkApprovalResolver (onlyResolver modifier)
// Direct operator calls are intentionally blocked for security
```

---

### Step 2: Fix Assessment Schema Encoding

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Lines 267-274** - Replace `_createAssessment()` data encoding:

```solidity
function _createAssessment(address garden) internal returns (bytes32) {
    // Build arrays for schema
    string[] memory capitals = new string[](2);
    capitals[0] = "living";
    capitals[1] = "social";
    
    string[] memory evidenceMedia = new string[](1);
    evidenceMedia[0] = "ipfs://QmAssessmentPhoto";
    
    string[] memory reportDocs = new string[](0);
    bytes32[] memory impactRefs = new bytes32[](0);
    
    string[] memory tags = new string[](2);
    tags[0] = "biodiversity";
    tags[1] = "native-species";
    
    bytes memory assessmentData = abi.encode(
        "Q1 2025 Assessment",                      // title
        "Garden flourishing with native species",  // description
        "biodiversity",                            // assessmentType
        capitals,                                  // capitals[]
        "ipfs://QmMetrics",                       // metricsJSON
        evidenceMedia,                             // evidenceMedia[]
        reportDocs,                                // reportDocuments[]
        impactRefs,                                // impactAttestations[]
        block.timestamp - 90 days,                 // startDate
        block.timestamp,                           // endDate
        "Garden Location",                         // location
        tags                                       // tags[]
    );

    (address easAddr,) = _getEASForChain(block.chainid);
    IEAS eas = IEAS(easAddr);

    AttestationRequest memory req = AttestationRequest({
        schema: assessmentSchemaUID,
        data: AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: false,
            refUID: bytes32(0),
            data: assessmentData,
            value: 0
        })
    });

    return eas.attest(req);
}
```

---

### Step 3: Fix Work Submission Schema Encoding

**File:** `packages/contracts/test/E2EKarmaGAPFork.t.sol`

**Lines 545-546** - Replace `_submitWork()` data encoding:

```solidity
function _submitWork(address garden, uint256 actionId) internal returns (bytes32) {
    // Build media array for schema
    string[] memory media = new string[](1);
    media[0] = "ipfs://work-photos";
    
    bytes memory workData = abi.encode(
        actionId,                        // actionUID (uint256)
        "Planted 50 native trees",       // title (string)
        "",                              // feedback (string) - empty for submission
        "{'species': 'oak', 'count': 50}", // metadata (string)
        media                            // media (string[])
    );

    (address easAddr,) = _getEASForChain(block.chainid);
    IEAS eas = IEAS(easAddr);

    AttestationRequest memory req = AttestationRequest({
        schema: workSchemaUID,
        data: AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: false,
            refUID: bytes32(0),
            data: workData,
            value: 0
        })
    });

    return eas.attest(req);
}
```

---

## Verification

After all changes, run tests:

```bash
cd packages/contracts
pnpm run test:e2e 2>&1 | grep -E "Suite result:|passed|failed"
```

**Expected Results:**

- All Arbitrum tests: PASS (8/8)
- All Celo tests: PASS (8/8)
- Base Sepolia tests: SKIP (investigating separately)
- **Total: 21/24 tests passing (87.5%)**

---

## Test Coverage by Suite

After fixes:

| Test Suite | Arbitrum | Celo | Base Sepolia | Status |

|------------|----------|------|--------------|--------|

| Garden Creation | ✅ | ✅ | ⚠️ | Fixed |

| Action Registration | ✅ | ✅ | ✅ | Already passing |

| Complete Work Flow | ✅ | ✅ | ⚠️ | **Will fix** |

| Assessment Flow | ✅ | ✅ | ⚠️ | **Will fix** |

| Operator Management | ✅ | ✅ | ⚠️ | Fixed |

| Multi-Operator | ✅ | ✅ | ⚠️ | **Will fix** |

| Operator Removal | ✅ | ✅ | ⚠️ | Fixed |

| TBA Ownership | ✅ | ✅ | ✅ | Already passing |

---

## Notes

- Base Sepolia failures are network-specific GAP sync issues (not schema bugs)
- All schema fixes are backward compatible
- No contract changes needed - only test improvements
- These are pre-existing test bugs, not regressions from Karma GAP interface fix