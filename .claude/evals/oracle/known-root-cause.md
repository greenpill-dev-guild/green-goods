# Oracle Eval: ABI Encoding Root Cause Analysis

## Bug Report

**Title**: WorkApproval attestation reverts when called from EAS

**Reporter**: Garden operator on Arbitrum

**Symptoms**:

When an operator approves a work submission through the admin UI, the EAS transaction succeeds (the attestation is created) but the `WorkApprovalResolver.onAttest()` callback reverts. The revert has no error message — it's a raw EVM revert during `abi.decode`.

**Reproduction steps**:

1. Navigate to a garden's work submissions in the admin panel
2. Select a pending work submission
3. Click "Approve" and confirm the wallet transaction
4. EAS emits the `Attested` event but the resolver's `onAttest` returns false
5. The attestation is created (EAS doesn't require resolver success) but the on-chain validation fails silently

**Error trace** (from Tenderly simulation):

```
CALL WorkApprovalResolver.onAttest(attestation, 0)
  CALL abi.decode(attestation.data, (WorkApprovalSchema))
  REVERT (no data)
```

The revert happens at the `abi.decode` call inside `onAttest()`. The attestation data is non-empty and appears to be valid ABI-encoded bytes.

**What we've tried**:

- Verified the schema UID matches the registered schema
- Verified the attestation data is non-empty (256+ bytes)
- Verified the field types match the schema definition
- Tried decoding the data manually using `cast abi-decode` with the WorkApprovalSchema struct fields — this works, suggesting the data is valid

**Environment**: Arbitrum, resolver deployed at the address in `deployments/42161-latest.json`

**Question for oracle**: What is the root cause of the `abi.decode` revert, and what is the fix?

## Expected Root Cause

The root cause is the ABI encoding format mismatch between struct decode and tuple decode:

- **`abi.encode(struct)`** wraps data with an outer 32-byte offset pointer (struct encoding)
- **`abi.encode(field1, field2, ...)`** encodes fields flat without the offset wrapper (tuple encoding)
- The EAS SDK on the client side uses `encodeAbiParameters` (viem) which produces **flat tuple encoding**
- The resolver was using `abi.decode(data, (WorkApprovalSchema))` which expects **struct encoding**
- When dynamic types are present (like `string feedback`, `string reviewNotesCID`), the struct vs tuple format difference causes the decode to read incorrect offsets, leading to a revert

**Fix**: Change all three resolver contracts (Work.sol, WorkApproval.sol, Assessment.sol) to use flat tuple decode:

```solidity
// Before (broken):
WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));

// After (fixed):
WorkApprovalSchema memory schema;
(
    schema.actionUID,
    schema.workUID,
    schema.approved,
    schema.feedback,
    schema.confidence,
    schema.verificationMethod,
    schema.reviewNotesCID
) = abi.decode(attestation.data, (uint256, bytes32, bool, string, uint8, uint8, string));
```

**Files affected**:
- `packages/contracts/src/resolvers/Work.sol`
- `packages/contracts/src/resolvers/WorkApproval.sol`
- `packages/contracts/src/resolvers/Assessment.sol`
- `packages/contracts/src/Schemas.sol` (struct definitions for reference)

**Key insight**: `abi.encode(struct)` and `abi.encode(field1, field2, ...)` produce identical bytes ONLY when all fields are static types. When any field is a dynamic type (`string`, `bytes`, `array`), the encodings diverge and cross-decoding reverts.
