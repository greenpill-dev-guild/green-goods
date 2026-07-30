# Steward hat relabel operation

This is the one-shot operations surface for PRD-747 and PRD-748. Preparation reads live
GardenToken and Hats Protocol state at one fixed block, captures the UUPS/configuration baseline,
emits a direct common-admin plan when proven, and retains controller partitions as fallback
evidence. Preparation never broadcasts. The separate relabel wrapper executes only a reviewed,
fixed-count plan and remains human password-gated.

## Prepare an upgrade baseline

```bash
bun .plans/active/commitment-pooling/operations/steward-hat-relabel/prepare.ts \
  --network sepolia
```

Repeat for `--network arbitrum`. The generated `steward-upgrade-baseline-*.json` is an input to
the opt-in post-upgrade verifier together with the reviewed new implementation address. Mint
enumeration is recorded in each preflight. Providers that reject a full `eth_getLogs` range are
scanned from the GardenToken deployment block in adaptive, bounded chunks. With an explicit
reviewed `--expected-count`, the script instead verifies the contiguous zero-based GardenToken IDs
and rejects the operation when the next ID exists.

After an authorized upgrade, pass both required review inputs explicitly:

```bash
bun run contracts:verify:steward-upgrade:sepolia -- \
  --steward-baseline <REVIEWED_BASELINE_PATH> \
  --expected-hats-implementation <BROADCAST_IMPLEMENTATION_ADDRESS>
```

Use the Arbitrum wrapper for Arbitrum One. The expected implementation must come from the final
broadcast artifact, not an older transaction plan whose sender nonce may have changed.

Before any future HatsModule broadcast, review the current block, exact contiguous GardenToken
count, and proxy implementation from that same chain snapshot. Pass all three inputs through the
documented wrapper so its fork rehearsal can prove that it is testing the reviewed live state:

```bash
HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER=<REVIEWED_CURRENT_BLOCK> \
HATS_MODULE_UPGRADE_GARDEN_COUNT=<REVIEWED_EXACT_GARDEN_COUNT> \
HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION=<REVIEWED_CURRENT_IMPLEMENTATION> \
bun run contracts:upgrade:hats-module:arbitrum
```

Use `contracts:upgrade:hats-module:sepolia` for Sepolia. The wrapper fails before simulation or
broadcast when any input is absent, malformed, stale, or does not match the implementation and
garden inventory at the reviewed block.

## Prepare the PRD-748 operation

First run without `--safe-batch` and review the live count, details, mutability, and authorization
results. The preparation always tests the live HatsModule owner as a common ancestor admin:

```bash
bun .plans/active/commitment-pooling/operations/steward-hat-relabel/prepare.ts \
  --network arbitrum \
  --expected-count <REVIEWED_LIVE_COUNT>
```

When that owner is an effective admin for every target, the command emits
`direct-admin-plan-*.json`. This is the preferred path: the one password-controlled account calls
`Hats.changeHatDetails` directly for every reviewed hat. Regenerate this nonce-independent plan
immediately before execution so its target inventory and labels are current.

If a public RPC makes the historical enumeration path impractical, refresh the previously reviewed
inventory through one fixed-block multicall. This rechecks the exact count, token/GardenAccount
ownership, all stored hat IDs, details, mutability, active state, and both GardenAccount and common
owner admin rights. It emits matching plan evidence under `.plans` plus the executable copy inside
the contracts package:

```bash
bun .plans/active/commitment-pooling/operations/steward-hat-relabel/refresh-direct-plan.ts \
  --inventory <REVIEWED_PREFLIGHT_PATH> \
  --expected-count <REVIEWED_LIVE_COUNT> \
  --rpc-url <REVIEWED_ARBITRUM_RPC>
```

Simulate the exact executable plan before asking for a signature:

```bash
bun run contracts:relabel:steward-hats:dry:arbitrum -- \
  --plan packages/contracts/deployments/tx-plans/<REVIEWED_RELABEL_PLAN>.json
```

After the HatsModule upgrade verifier passes, Afo can run the same fail-closed script with the
password-gated broadcast wrapper:

```bash
bun run contracts:relabel:steward-hats:arbitrum -- \
  --plan packages/contracts/deployments/tx-plans/<REVIEWED_RELABEL_PLAN>.json
```

The Foundry script checks all current labels, mutability, active state, and caller authorization
before broadcasting, then checks every target label in simulation after the writes. The wrapper
prompts once for the configured `green-goods-deployer` keystore.

To separately assess a proposed Safe, lock the expected count and declared caller:

```bash
bun .plans/active/commitment-pooling/operations/steward-hat-relabel/prepare.ts \
  --network arbitrum \
  --expected-caller <SAFE_ADDRESS> \
  --expected-count <REVIEWED_LIVE_COUNT> \
  --safe-batch
```

The command fails if enumeration differs from the reviewed count, any garden/config/hat is
missing or duplicated, details are not an exact `Operator` suffix, a hat is immutable, or the
declared Safe is not an effective admin. It writes the failed preflight before stopping so the
per-hat authorization result can be reviewed, but it does not emit a Safe batch.

`execution-partitions-*.json` remains a fallback when neither the module owner nor a reviewed Safe
is a common admin. Each partition is grouped by the live GardenToken owner that controls the
GardenAccount; each nested transaction calls `GardenAccount.execute`, which then calls
`Hats.changeHatDetails`. Do not coordinate those controllers when a proven direct common-admin
plan exists.

## Execution boundary

- Review the immutable preflight plus the matching direct-admin plan, Safe JSON, or fallback
  authorization partitions at one block height.
- Afo reviews, signs, and executes with the proven caller through the password-gated wrapper.
- After execution, re-read every target and record transaction hashes and UI evidence in
  `post-execution-evidence.md`.
