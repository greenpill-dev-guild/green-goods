# ADR-015: Self-Call Pattern for Try/Catch Isolation

**Date**: 2026-04-02
**Status**: Accepted

## Context

Solidity's try/catch only works on **external** calls, not internal function calls. Several operations in the system need graceful failure handling for sub-operations that are logically internal but must not revert the parent transaction. Examples: auto-staking in GardenAccount (a failed stake shouldn't revert a garden operation), ENS record setting on L1 (a failed record set shouldn't brick the CCIP message), and pool creation in GardensModule (failed pool deployment shouldn't block garden minting).

Without this pattern, the options are: (a) let sub-operations revert the entire transaction, (b) use low-level `call()` with manual ABI encoding/decoding, or (c) deploy separate "tryer" contracts. All are worse than the self-call approach.

## Decision

Wrap internal logic in an `external` function that checks `msg.sender == address(this)`, then call it via `this.functionName()` to create an external call to self. This enables try/catch on what is logically internal logic.

The pattern:

```solidity
// The "external wrapper" -- only callable by self
function executeOperation() external {
    require(msg.sender == address(this), "only self");
    _doActualWork();
}

// The caller -- uses try/catch on the self-call
function parentOperation() external {
    // ... required work ...
    try this.executeOperation() {
        // success path
    } catch {
        emit OperationFailed();
        // graceful degradation path
    }
}
```

Key implementations:
- `GardenAccount.executeAutoStake()` (line 424) -- called via `this.executeAutoStake()` (line 393). Isolates staking failures from the parent garden operation.
- `ENSReceiver._setENSRecordsExternal()` (line 141) -- called via `this._setENSRecordsExternal()` (line 131). Prevents ENS record failures from reverting the CCIP receive handler.
- `GardensModule.attemptPoolCreation()` (line 235) -- called via `this.attemptPoolCreation()`. Isolates pool creation failures from the garden mint flow.

**Important reentrancy note**: `GardensModule.attemptPoolCreation()` intentionally does NOT use the `nonReentrant` modifier because its parent function (`onGardenMinted`) already holds the reentrancy lock. A self-call with `nonReentrant` on both the parent and child would revert with "ReentrancyGuard: reentrant call" since the lock is already held. The `msg.sender == address(this)` check is sufficient for access control in this case.

## Consequences

- **Enables**: Graceful degradation for sub-operations without reverting the parent transaction. The pattern composes naturally with the module pattern (ADR-009) -- each module's self-call failures are caught independently.
- **Constrains**: The external wrapper functions are visible in the contract's ABI even though they are meant for internal use only. External callers who satisfy the `msg.sender == address(this)` check could invoke them -- which in practice means only the contract itself (but see ADR-016 for a TBA-specific edge case). Every self-call function must have robust access checks.
- **Trade-off**: Gas overhead of ~2600 gas per self-call (CALL opcode cost) plus calldata encoding/decoding. For operations like garden minting that happen infrequently, this is negligible. The functions polluting the ABI is a cosmetic issue -- they could be excluded from interface definitions but will always appear in the bytecode's function selector table.
