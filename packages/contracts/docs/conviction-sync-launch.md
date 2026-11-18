# Conviction sync checks for a garden launch

The Gardens module registers each garden's two signal pools with the Hats module and
the voting power registry. That does not authorize the Hats module inside the pools.
Only the pool's council or owner can grant that authority. A garden is not ready for
conviction voting until both pools authorize the upgraded Hats module.

PRD-1377 includes the authorizations for the existing 18 gardens. For every future
garden, prepare the missing authorizations with the read-only release command:

```sh
bun run contracts -- release conviction-sync --network arbitrum --mode plan \
  --garden "$GARDEN_ADDRESS" --block "$PROOF_BLOCK" \
  --expected-implementation "$REVIEWED_HATS_IMPLEMENTATION" \
  --expected-runtime-hash "$REVIEWED_HATS_RUNTIME_HASH" \
  --output "$PRIVATE_REVIEW_DIRECTORY"
```

Repeat `--garden` to check several gardens together. Use the implementation and runtime
hash from the approved release packet. The command requires that implementation to be
active before it prepares authorizations. This prevents a new garden from authorizing
the old module with its insufficient sync gas limit.

The command checks the garden's community and power registry, the two unique pools,
their council, and the Hats module's registered strategy list at one explicit block.
It writes a private readback and, if needed, `authorize-sync.safe.json`. Review the
file and the Safe queue together before choosing a nonce. The command never signs,
sends a transaction or enables governance.

After the approved Safe transaction executes, reconcile its receipt, then verify at
a fresh block:

```sh
bun run contracts -- release conviction-sync --network arbitrum --mode verify \
  --garden "$GARDEN_ADDRESS" --block "$FRESH_PROOF_BLOCK" \
  --expected-implementation "$REVIEWED_HATS_IMPLEMENTATION" \
  --expected-runtime-hash "$REVIEWED_HATS_RUNTIME_HASH"
```

Verification fails if either authorization is missing or any binding differs. Keep
the receipt and readback with the garden's launch evidence. On a disposable fork,
also revoke a test member's role and confirm successful sync events from both pools
and removal of that member's stale support. Production role changes need their own
authorization; this check does not authorize changing anyone's roles.

Governance remains hidden until its separate release decision. A successful sync
check alone is not approval to expose proposal creation or voting.

The Hats contract requires enough caller gas for its configured sync hooks. Each hook receives
at most one million gas; CALL/EIP-150 overhead and a completion reserve are included. An
underfunded role transaction reverts atomically, so estimators cannot accept a cheaper role
write that silently starves its hooks. A genuine downstream revert is still caught and logged;
it does not restore a revoked Hat. Hook return data is bounded independently of the callee gas. Short Error(string) reasons of up to 256 bytes remain available; oversized failures emit `revert_data_too_large`, and malformed reasons emit an empty diagnostic. Successful extra return data is ignored. Check both pool events and the resulting support.

The app adds 10% headroom to role grants, revocations and self-departure using the existing
wallet, embedded and passkey sender support. A fork RPC's bare estimate rounded slightly below
the caller-gas boundary on self-departure; the buffered call succeeds. Deploy the updated apps
before activating the contract, and refresh older clients before role writes. Existing pending
submissions are reconciled before a new attempt, and newly prepared role batches include the
margin in their budget checks. Existing fee and batch ceilings still apply, so an expensive
role batch can fall back to individual signatures. No payout limit or fee ceiling is raised.
