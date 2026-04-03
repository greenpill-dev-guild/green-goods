# ADR-016: _autoStaking Guard Flag (TBA Execution Bypass Prevention)

**Date**: 2026-04-02
**Status**: Accepted

## Context

GardenAccount is an ERC-6551 Token Bound Account (TBA). The `executeAutoStake()` function uses the self-call pattern (ADR-015), protected by `msg.sender == address(this)`. However, TBAs expose an `execute(address target, uint256 value, bytes calldata data)` function that allows the NFT owner to make arbitrary calls from the TBA's address. This means the NFT owner can call:

```solidity
garden.execute(
    target: address(garden),        // call the garden itself
    value: 0,
    data: abi.encodeWithSelector(GardenAccount.executeAutoStake.selector, ...)
);
```

In this execution context, `msg.sender == address(this)` is true -- because the TBA is calling itself via its own `execute()` function. This bypasses the self-call check entirely, allowing the NFT owner to invoke `executeAutoStake()` at will, outside the intended auto-staking flow. This could be used to stake at advantageous times, front-run conviction signals, or bypass rate limits.

## Decision

Double-guard with a transient boolean flag `_autoStaking` declared at `packages/contracts/src/accounts/Garden.sol` (line 111). The flag is set to `true` immediately before the self-call and cleared immediately after. Both `executeAutoStake()` and `executeGardenSelfStake()` check both conditions:

```solidity
if (msg.sender != address(this) || !_autoStaking) revert NotGardenOwner();
```

Execution flow:

```solidity
_autoStaking = true;
try this.executeAutoStake(...) {
    // success
} catch {
    emit AutoStakeFailed();
}
_autoStaking = false;
```

The flag serves as a "call origin proof" -- it can only be set by the contract's own internal execution path (not via `execute()`), so the combination of `msg.sender == address(this)` AND `_autoStaking == true` proves the call originated from the intended internal flow, not from an NFT owner routing through `execute()`.

If the self-call reverts, `_autoStaking` remains `true` in the parent context (the revert only rolls back the child frame's state changes). The subsequent `_autoStaking = false` in the parent function's catch/finally path clears it. If the parent function itself reverts (after setting the flag but before clearing it), all state changes including the flag are rolled back, so the flag returns to `false`.

## Consequences

- **Enables**: Safe self-call pattern in TBA context. The NFT owner retains full `execute()` capability for legitimate operations (transferring tokens, interacting with other contracts) but cannot invoke internal-only functions that happen to pass the `msg.sender == address(this)` check.
- **Constrains**: The flag must be set and cleared atomically around every self-call that needs TBA protection. Any new self-call function added to GardenAccount must evaluate whether it needs the `_autoStaking` guard (or a similar flag). The pattern does not generalize cleanly -- if multiple self-call functions need independent guards, each needs its own flag or a more general "internal call nonce" mechanism.
- **Trade-off**: Extra storage read and write per auto-stake operation (~5000 gas for SSTORE from zero to non-zero, ~2900 for non-zero to zero). This is a security-critical guard, not a gas optimization target -- the ~8000 gas overhead is the cost of preventing unauthorized staking in the TBA execution model. Future optimization could use transient storage (EIP-1153, available post-Cancun) to reduce this to ~200 gas.
