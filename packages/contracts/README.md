# Green Goods Contracts

This package owns Green Goods smart contracts, deployment artifacts, and contract operations.
Gardeners record work, stewards manage garden roles and approvals, and protocol contracts connect
that work to funding, attestations, and shared infrastructure.

## Development setup

Follow [repository onboarding](../../ONBOARDING.md) and use the tool versions in
[.mise.toml](../../.mise.toml). Contract work also needs the pinned Foundry toolchain and initialized
contract submodules. Keep configuration in the root environment; setup preserves existing files.

Run these commands from the repository root:

```sh
bun run check --plan -- --intent qa
bun run --cwd packages/contracts build
bun run --cwd packages/contracts test --suite solidity --profile match -- test/YourContract.t.sol
```

The selector determines additional storage, fork, script, and release checks. Retain every selected
critical check. Package-native build, test, lint, formatting, and Anvil commands remain available.
See the [generated command inventory](../../docs/docs/builders/packages/commands.mdx).

## Contract operations

Use the package-owned CLI from the root or the contracts directory:

```sh
bun run contracts -- help
bun run --cwd packages/contracts contracts -- help
```

Deployment, upgrade, migration, and repair require an explicit network and execution mode.
Use command-specific help to discover supported targets, flags, and modes. The
[generated operational reference](../../docs/docs/builders/packages/contract-operations.mdx)
comes from the same definitions as the CLI. It also maps retired aliases to their replacements.

| Mode | Effects |
|---|---|
| `preflight` | Compile and inspect artifacts without RPC |
| `simulate` | Simulate against RPC without broadcasting transactions |
| `plan` | Produce the operation's existing transaction-plan artifacts |
| `broadcast` | Execute transactions on the selected network |
| `upload` | Upload artifacts, only for operations that support this mode |

Not every operation supports every mode. Compilation, planning, simulation, and upload can write
artifacts. They are distinct from transaction broadcasting.

Inspect a resolved operation without credentials or network access:

```sh
bun run contracts -- deploy core --network arbitrum --mode preflight --explain --json
bun run contracts -- upgrade hats-module --network arbitrum --mode simulate --explain
```

The CLI owns operation-specific signer defaults, credential handling, and mandatory checks.
Changing a network does not authorize a broadcast. Transactions on Arbitrum, Celo, and Ethereum
mainnet affect live funds and state; review the operation and obtain release authorization first.

## Deployment and upgrades

Release operators need the configured Foundry keystore, target-chain RPC, and capabilities named by
the operation. Keep keys out of commands and documentation. Shared environment onboarding is
covered in [environment guidance](../../docs/docs/builders/env-management.mdx).

Start with compile-only preflight, then simulate the chosen operation:

```sh
bun run contracts -- deploy core --network sepolia --mode preflight
bun run contracts -- deploy core --network sepolia --mode simulate
bun run contracts -- verify --network sepolia
```

A successful broadcast is not a complete release until deployment artifacts are persisted,
dependent configuration and indexing inputs are updated, and the appropriate verifier passes.
The [deployment runbook](deployments/README.md) explains artifact interpretation.

Use named upgrade targets for UUPS upgrades. Do not use forced deployment as an upgrade or rollback.
GreenWill is excluded from the aggregate upgrade target and needs its own reviewed plan. Storage
layout and fork checks remain mandatory where required by the operation.

Release sessions use the existing release operator through the CLI. Exact-commit checks,
allowlisted stages, transaction boundaries, receipts, and resume behavior remain required. See
[contributing](../../CONTRIBUTING.md) and [contract agent guidance](AGENTS.md) for validation policy.

### GreenWill upgrade runbook

GreenWill is funds-adjacent and deliberately excluded from `upgrade all`. Before upgrading,
exercise its Arbitrum fork coverage:

```sh
bun run --cwd packages/contracts test:fork -- --match-contract ArbitrumGreenWillSupportForkTest
bun run contracts -- upgrade greenwill --network arbitrum --mode preflight
bun run contracts -- upgrade greenwill --network arbitrum --mode plan --sender 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6
```

Keep generated artifacts tied to the exact implementation address and run date, such as
`42161-greenwill-0x<implementation>-YYYY-MM-DD-plan.json`. The transaction plan records the
simulated CREATE address. Only broadcast after the Sepolia gate and reviewed plan are approved;
then confirm the proxy points to that implementation. Finish with a controlled eligible
non-financial badge smoke, not a vault deposit, redemption, or other funds flow.

### Resolver and garden-account upgrades

When changing WorkApprovalResolver or AssessmentResolver addresses, review whether the
GardenAccount implementation embeds those addresses and deploy the required updated implementation.
Garden proxy opt-in must use a supported CLI operation before broadcasting. Consult the owning
implementation and deployment runbook rather than replacing an upgrade with forced deployment.

## Migrations and recovery

A migration is retained until completion evidence covers its intended networks and it has no
remaining recovery or maintenance role. Vault migration can require Octant repair when template
validation fails; keep that recovery path available. Existing action-instruction and open-minting
operations also remain available pending retirement evidence.

Use CLI help to select the operation, network, and supported mode. Historical reports describe
past executions and may contain retired aliases; use the generated migration table for current commands.

## Configuration

- `deployments/*-latest.json` records deployed addresses and configuration; see the deployment runbook
  for zero-address and pre-/post-broadcast interpretation.
- `deployments/networks.json` defines network configuration. Adding a network requires implementing
  and validating its operation support, not adding another manifest alias.
- `config/schemas.json` defines immutable production EAS schema identities. Use reviewed standalone
  registration paths for additions; do not restore bulk schema-update behavior.
- Foundry FFI is used to generate schema strings. Inspect FFI scripts before running untrusted changes.

### Yield split defaults

YieldResolver's default split is 48.65% Cookie Jar (garden operations), 48.65% Hypercert fractions
(impact allocation; escrowed if routing is unavailable), and 2.7% Juicebox (GOODS treasury backing).
Per-garden `setSplitRatio` settings must sum to 10,000 basis points.

### Troubleshooting

Use `bun run env:check` to check configured keys without printing values, and command-specific
`--explain` to inspect the selected operation. For compilation failures, use package
`clean:artifacts` followed by `build`; use `test:match` for a specific test and `test:gas` for gas
profiling. These package commands remain in the generated inventory. Inspect the selected
network, persisted artifacts, and signer policy before retrying a failed operation.

## Cookie Jar claim limits

`CookieJarModule` creates one jar per supported asset when a garden is minted. Each asset carries
its own per-claim limit (`assetMaxWithdrawal`), because one shared value cannot serve assets whose
units differ by orders of magnitude: 0.01 WETH is a fair claim and 0.01 DAI is one cent. An asset
with no limit of its own falls back to `defaultMaxWithdrawal`. The ruled values, 10 DAI and
0.01 WETH, live in `script/CookieJarAssetLimits.sol`; fresh deployments and the upgrade below both
apply them.

```sh
bun run contracts -- upgrade cookie-jar-module --network arbitrum --mode simulate
bun run contracts -- upgrade cookie-jar-module --network arbitrum --mode broadcast
```

The upgrade is an explicit target, excluded from `upgrade all`. A broadcast first checks the
module's storage layout against its committed baseline and rehearses the upgrade on a fork of live
Arbitrum state. The limits only reach jars created afterwards. A jar already deployed keeps its
own limit, and only the garden's owner can change it, through the garden account (Community →
Payouts in the admin).

## HatsModule Operational Notes

### Phantom hat wearers after revocation

Hats Protocol does not provide a burn function for ordinary wearer hats. Revocation is implemented by transferring the hat to another address, which means revocations can accumulate historical "phantom" wearers.

In `HatsModule`, revocation transfers to a unique nonce-derived burn address instead of a fixed sink (for example `0xdead`). This avoids `AlreadyWearingHat` reverts when the same hat type is revoked multiple times.

**Behavioral implications:**
- Revoked users no longer wear the role hat (`isWearerOfHat(user, hatId) == false`)
- Total historical wearers can still grow over time
- Indexers and analytics should treat revocation events as canonical membership state transitions

**Cleanup strategy:**
- Use `RoleRevoked` as the source of truth for active membership snapshots
- Rebuild role membership by replaying `RoleGranted` and `RoleRevoked` events in order
- Ignore holder counts that include burn recipients when presenting active member metrics

### Conviction power sync gas stipend

`HatsModule` calls conviction strategies with a defensive gas stipend (`SYNC_POWER_GAS_STIPEND = 100_000`). This isolates role changes from downstream strategy complexity by making sync best-effort.

If a strategy requires more gas, role revocation still succeeds and the module emits `ConvictionSyncFailed`. Operators should monitor these failures and either optimize strategy gas usage or increase stipend in a future upgrade if sustained failures occur.

### Duplicate strategy validation complexity

`setConvictionStrategies` currently validates duplicates with an O(n²) nested loop. This is acceptable because `MAX_CONVICTION_STRATEGIES` is hard-capped at 10, keeping worst-case comparisons bounded (45 checks).


## ENS Cross-Chain (CCIP) Flow

`GreenGoodsENS` runs on L2 (Arbitrum One or Sepolia testnet) and sends registration/release intents to L1 via Chainlink CCIP. `GreenGoodsENSReceiver` runs on Ethereum mainnet and executes ENS writes for `*.greengoods.eth`.

### End-to-End Message Path (Arbitrum → Mainnet)

1. A garden mint (`GardenToken.mintGarden`) or member name claim (`GreenGoodsENS.claimName`) triggers L2 registration logic.
2. `GreenGoodsENS` validates slug + local collision/cooldown constraints and builds a CCIP `EVM2AnyMessage` payload.
3. `GreenGoodsENS` estimates fee with `IRouterClient.getFee(...)` and sends message through `IRouterClient.ccipSend(...)` to the L1 chain selector.
4. Chainlink CCIP DON relays the message to Ethereum mainnet's CCIP router.
5. Mainnet router calls `GreenGoodsENSReceiver.ccipReceive(...)`.
6. `GreenGoodsENSReceiver` validates source chain + sender, decodes operation (`register` / `release`), and writes ENS via registry + resolver for `greengoods.eth` subdomains.
7. L2 keeps a protective cache (`slugOwner`, `ownerToSlug`) to prevent duplicate claims before L1 finalization.


After both sides are deployed:

- Set `ENS_L1_RECEIVER` before L2 deploys (or call `setL1Receiver` on `GreenGoodsENS`).
- Set `ENS_L2_SENDER` before L1 deploys (or call `setL2Sender` on `GreenGoodsENSReceiver`).
- Verify receiver has ENS operator approval on `greengoods.eth`.
