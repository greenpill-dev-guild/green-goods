# Conviction sync checks for a garden launch

The Gardens module registers each garden's two signal pools with the Hats module and
the voting power registry. That does not authorize the Hats module inside the pools.
Only the pool's council or owner can grant that authority. A garden is not ready for
conviction voting until both pools authorize the upgraded Hats module.

The reviewed PRD-1377 authorization packet covers the gardens that existed when it was
built. A garden minted after that packet is not in it. For every such garden, and every
future garden, prepare the missing authorizations with the read-only release command:

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

## Rehearse against current chain state

Before the upgrade broadcast, the upgrade wrapper runs the `hats-module-upgrade-arbitrum`
fork shard. It discovers every garden from the garden token, including gardens minted
through the upgradeable account proxy, and takes the account the Hats module configured.

The activation sequence has its own shard, `conviction-sync-activation-arbitrum`, which
you run by hand before the upgrade and before any pool is authorized. It asserts that
pre-activation state, so once either step has happened on chain it no longer applies. On
the first garden it shows that a role grant fails to sync today, that authorizing without
the upgrade still fails, and that the upgrade without authorizing still fails. On every
live garden it authorizes both pools after the upgrade and checks that a grant and a
revocation sync both of them. On the newest garden it clears six stale support positions
from both pools when the member loses their last role. Run it with a fresh block, the live
garden count and the live implementation:

```sh
HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER="$PROOF_BLOCK" ARBITRUM_FORK_BLOCK_NUMBER="$PROOF_BLOCK" \
HATS_MODULE_UPGRADE_GARDEN_COUNT="$LIVE_GARDEN_COUNT" \
HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION="$LIVE_HATS_IMPLEMENTATION" \
  bun run test:shard run conviction-sync-activation-arbitrum
```

The rehearsal pranks each pool's council instead of signing, so it complements the
private Safe packet rehearsal rather than replacing it.

## Pools a community has not enabled

Sync does not need it, but a member can only activate points in a pool that its
community has enabled. Some communities have not enabled their gardens' pools, and
`activatePoints` then reverts `StrategyDisabled()`. Only the community council can call
`addStrategy(pool)`, so each such pool needs its own reviewed Safe call. The rehearsal
logs how many live pools are not enabled and enables the newest garden's pools on the
fork only. Authorizing the Hats module as sync caller does not enable a pool.

## Before governance returns

Governance remains hidden until its separate release decision. A successful sync
check alone is not approval to expose proposal creation or voting. That decision needs,
at a fresh block:

- the upgraded Hats implementation active, with `release conviction-sync --mode verify`
  passing for every live garden;
- every live pool enabled in its community;
- one real role removal that logs `ConvictionSyncTriggered` on both of that garden's
  pools.

## Hook gas and app headroom

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
