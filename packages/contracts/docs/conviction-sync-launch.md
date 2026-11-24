# Conviction sync checks for a garden launch

The Gardens module registers each garden's two signal pools with the Hats module and
the voting power registry. That does not authorize the Hats module inside the pools.
Only the pool's council or owner can grant that authority. A garden is not ready for
conviction voting until both pools authorize the upgraded Hats module.

This page is the runbook for that authorization: for every garden minted after the
Hats upgrade, and for any live garden whose pools are still unauthorized. Every value
it needs is read from chain when you run it. Nothing here signs or sends a transaction;
signing stays with the Green Goods Safe's owners.

## Who can change what on Arbitrum

- **The Hats module's implementation.** The module's owner is the Green Goods
  AccessManager. `upgradeTo` needs the AccessManager's admin role, which the Green Goods
  Safe holds with a 24-hour execution delay. An upgrade is therefore two Safe
  transactions: the Safe schedules the call, then executes it from the same Safe once the
  delay has passed and before the schedule expires. The upgrade wrapper's
  `upgrade hats-module --network arbitrum` cannot send it: its owner preflight refuses,
  because the deployer does not own the module.
- **A pool's sync authorization.** Only the pool's council or owner can call
  `setAuthorizedSyncCaller`. The Green Goods Safe is the council of every garden
  community the planner accepts.
- **A garden's sync hooks.** The module's owner, or the garden's Owner or Steward, can call
  `setConvictionStrategies(garden, strategies)` directly, with no delay. See
  [If role changes start to revert](#if-role-changes-start-to-revert).

## 1. Read the live state

Run from the repository root. Use any Arbitrum RPC that serves recent state.

```sh
export ARBITRUM_RPC_URL="${ARBITRUM_RPC_URL:-https://arb1.arbitrum.io/rpc}"
DEPLOYMENT=packages/contracts/deployments/42161-latest.json
SAFE=0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19   # the Green Goods Safe
HATS=$(jq -r .hatsModule "$DEPLOYMENT")
SLOT=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
IMPLEMENTATION=$(cast storage "$HATS" "$SLOT" --rpc-url "$ARBITRUM_RPC_URL" | cast parse-bytes32-address)
RUNTIME_HASH=$(cast keccak "$(cast code "$IMPLEMENTATION" --rpc-url "$ARBITRUM_RPC_URL")")
PROOF_BLOCK=$(cast block-number --rpc-url "$ARBITRUM_RPC_URL")
echo "$IMPLEMENTATION $RUNTIME_HASH $PROOF_BLOCK"
```

**Check before going on:** `IMPLEMENTATION` and `RUNTIME_HASH` must match the
implementation the approved release installed, as its release record names it (the pull
request or Linear issue that approved the upgrade). If the proxy still runs the earlier
implementation, the upgrade has not executed: stop, and see
[Scheduled Hats upgrades](#scheduled-hats-upgrades).

## 2. Plan the missing authorizations

```sh
bun run contracts -- release conviction-sync --network arbitrum --mode plan --all-gardens \
  --block "$PROOF_BLOCK" \
  --expected-implementation "$IMPLEMENTATION" --expected-runtime-hash "$RUNTIME_HASH" \
  --output "$PRIVATE_REVIEW_DIRECTORY"
```

`--all-gardens` walks the garden token at the proof block and takes, for each token, the
account the Hats module configured. Use `--garden <address>` (repeatable) instead to plan
named gardens only. The command prints one line:

```json
{"status":"review-only","proofBlock":…,"gardens":N,"pendingAuthorizations":K,"broadcast":false}
```

It writes `readback.json` (every garden's community, registry, council, pools and their
authorization at the proof block) and, when `K` is above zero, `authorize-sync.safe.json`:
one `setAuthorizedSyncCaller(<Hats module>, true)` call per unauthorized pool, in Safe
Transaction Builder format. The output directory must not exist yet; keep it outside Git.
If `K` is 0, go to step 5.

The command refuses when:

| Message | Meaning | What to do |
|---|---|---|
| `Hats upgrade is not active` | The proxy does not run the expected implementation. | Re-read step 1. Do not authorize the old module: its sync gas limit is too small, and authorizing it makes every role change more expensive without making sync work. |
| `Hats runtime differs from the reviewed gas-bound release` | Different bytes at that address. | Stop and review. |
| `review changed Safe policy` | The Safe threshold is no longer 2. | Have the new signing policy reviewed first. |
| `pool council must be the reviewed Safe`, `pool community mismatch`, `Hats strategies do not match garden signal pools` | A garden's wiring changed. | That garden needs its own review; plan the others with `--garden`. |
| `exactly one account must be configured for garden token N` | Both or neither account kind is configured for a token. | Review that token before planning it. |

## 3. Rehearse on a fork

Run this before anyone signs. It is a heavy job: run it alone on the machine.

```sh
cd packages/contracts
HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER="$PROOF_BLOCK" ARBITRUM_FORK_BLOCK_NUMBER="$PROOF_BLOCK" \
HATS_MODULE_UPGRADE_GARDEN_COUNT="$N" \
HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION="$IMPLEMENTATION" \
  bun run test:shard run conviction-sync-activation-arbitrum
```

`N` is the `gardens` value from step 2. The shard runs the deployed implementation; it never
upgrades. It authorizes each still-unauthorized pool by pranking its council, then checks
that a grant and a revocation sync both pools on every live garden, and that revoking a
member's last role on the newest garden clears six stale support positions from both
pools. It prints `2 passed; 0 failed` and takes several minutes. `setUp` fails if `N` is not
the exact garden count at the proof block. The fork RPC must serve the proof block; a
`setUp` failure about pruned or missing state is the node, not the code.

## 4. Sign the authorizations

1. Read the Safe's next nonce and threshold at signing time:
   `cast call "$SAFE" "nonce()(uint256)"` and `cast call "$SAFE" "getThreshold()(uint256)"`
   (add `--rpc-url "$ARBITRUM_RPC_URL"`).
   Check the Safe queue holds nothing else at that nonce.
2. Load `authorize-sync.safe.json` into the Safe Transaction Builder. Check there are `K`
   calls, each `setAuthorizedSyncCaller(<Hats module>, true)` to a pool that
   `readback.json` lists as unauthorized.
3. The Safe's owners sign and execute it. The receipt holds `K` `AuthorizedSyncCallerUpdated`
   events.

If the transaction reverts, plan again at a fresh block. A pool someone authorized in the
meantime drops out of the batch; a revert on a pool that is still listed means its council
changed.

## 5. Verify at a fresh block

```sh
FRESH_PROOF_BLOCK=$(cast block-number --rpc-url "$ARBITRUM_RPC_URL")
bun run contracts -- release conviction-sync --network arbitrum --mode verify --all-gardens \
  --block "$FRESH_PROOF_BLOCK" \
  --expected-implementation "$IMPLEMENTATION" --expected-runtime-hash "$RUNTIME_HASH"
```

It prints `{"status":"sync-ready",…,"pendingAuthorizations":0,…}`. It exits 1 with
`pool sync authorization is pending` while any pool is unauthorized, and with the messages
above if any binding differs. Keep the receipt and the output with the garden's launch
evidence.

## 6. Prove one real role removal

Production role changes need their own authorization; this runbook does not grant it. Once
someone authorized removes a member's role, set `GARDEN` to that garden's account and
`ROLE_CHANGE_TX` to the transaction hash, then check it:

```sh
TRIGGERED=$(cast keccak "ConvictionSyncTriggered(address,address,address)")
FAILED=$(cast keccak "ConvictionSyncFailed(address,address,address,string)")
cast receipt "$ROLE_CHANGE_TX" --rpc-url "$ARBITRUM_RPC_URL" --json \
  | jq --arg t "$TRIGGERED" --arg f "$FAILED" \
    '{triggered: [.logs[] | select(.topics[0] == $t) | .topics[3]], failed: [.logs[] | select(.topics[0] == $f) | .topics[3]]}'
cast call "$(jq -r .gardensModule "$DEPLOYMENT")" "getGardenSignalPools(address)(address[])" "$GARDEN" \
  --rpc-url "$ARBITRUM_RPC_URL"
```

`triggered` must list both of the garden's pools (as padded topics) and `failed` must be
empty. A role change in a garden that has not passed step 5 logs `ConvictionSyncFailed`
for its unauthorized pools, but the role change itself still succeeds.

## If role changes start to revert

The upgraded module requires enough caller gas for its sync hooks: each of a garden's
pools gets at most one million gas. A role change that sends less reverts whole with
`InsufficientConvictionSyncGas(available, required)` (selector `0xd6881c82`), instead of
starving the hooks. A bare `eth_estimateGas` finds that boundary exactly, with no margin,
so the apps add 10% to role grants, revocations and leaving. Clients from before that
change can fall short.

To see the boundary for a garden, set `GARDEN` to its account and simulate a Gardener grant
from it (read-only; the garden account may grant the Gardener role):

```sh
NEW_MEMBER=0x00000000000000000000000000000000C0FFEE01
ESTIMATE=$(cast estimate "$HATS" "grantRole(address,address,uint8)" "$GARDEN" "$NEW_MEMBER" 0 \
  --from "$GARDEN" --rpc-url "$ARBITRUM_RPC_URL")
cast call "$HATS" "grantRole(address,address,uint8)" "$GARDEN" "$NEW_MEMBER" 0 --from "$GARDEN" \
  --gas-limit "$ESTIMATE" --rpc-url "$ARBITRUM_RPC_URL"                  # 0x: succeeds
cast call "$HATS" "grantRole(address,address,uint8)" "$GARDEN" "$NEW_MEMBER" 0 --from "$GARDEN" \
  --gas-limit $((ESTIMATE * 99 / 100)) --rpc-url "$ARBITRUM_RPC_URL"     # reverts 0xd6881c82
```

If members' role changes fail this way:

1. Make sure the apps people use send the 10% headroom, and refresh installed apps.
2. To unblock one garden at once, its Owner or Steward calls
   `setConvictionStrategies(garden, [])` on the Hats module. Role changes in that garden then
   skip sync, and their gas falls back to what it was before the upgrade. Restore the hooks
   later with the garden's two pools, in the order `getGardenSignalPools` returns them.
3. Rolling the module back is a scheduled upgrade like any other (below), so it takes at
   least 24 hours.

## Scheduled Hats upgrades

The AccessManager keys each scheduled call by caller, target and calldata. With the Safe as
caller and `NEW_IMPLEMENTATION` set to the implementation being installed:

```sh
AM=$(cast call "$HATS" "owner()(address)" --rpc-url "$ARBITRUM_RPC_URL")
DATA=$(cast calldata "upgradeTo(address)" "$NEW_IMPLEMENTATION")
OPERATION=$(cast call "$AM" "hashOperation(address,address,bytes)(bytes32)" "$SAFE" "$HATS" "$DATA" \
  --rpc-url "$ARBITRUM_RPC_URL")
cast call "$AM" "getSchedule(bytes32)(uint48)" "$OPERATION" --rpc-url "$ARBITRUM_RPC_URL"
cast call "$AM" "expiration()(uint32)" --rpc-url "$ARBITRUM_RPC_URL"
```

`getSchedule` returns the earliest execution time as a Unix timestamp. The operation expires
at that time plus `expiration()` (one week when this was written). A result of 0 means the
operation was never scheduled, was cancelled, has expired or has already executed. To tell
which, look for `OperationExecuted` or `OperationCanceled` logs on the AccessManager with the
operation id as the first topic.

`execute(target, data)` from the Safe reverts with:

| Error | Selector | Meaning | What to do |
|---|---|---|---|
| `AccessManagerNotReady(bytes32)` | `0x18cb6b7a` | The delay has not passed. | Wait until the `getSchedule` time. |
| `AccessManagerExpired(bytes32)` | `0x78a5d6e4` | The execution window closed. | Schedule again, wait the delay, then execute within the new window. |
| `AccessManagerNotScheduled(bytes32)` | `0x60a299b0` | Nothing scheduled for this caller, target and calldata. | Check the calldata and that the Safe both scheduled and executes. |

After the upgrade executes, run this runbook from step 1. Its plan covers every garden the
upgrade's own batch did not authorize.

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

- the upgraded Hats implementation active, with `release conviction-sync --mode verify
  --all-gardens` passing;
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
