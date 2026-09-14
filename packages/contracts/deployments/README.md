# Deployment artifacts

This directory holds the per-chain `*-latest.json` deployment artifacts. Each
artifact records the addresses and configuration that deployment tooling writes
for a chain; other packages consume it as their deployment configuration source
of truth. For example, `42161-latest.json` is the Arbitrum One (chain ID
`42161`) artifact.

## Zero-address convention

`0x0000000000000000000000000000000000000000` is a sentinel: the artifact has
no usable contract address for that field. A zero address alone is not a
deployment-status verdict. Before a broadcast, it can represent pending work;
after an authorized broadcast, review the artifact together with the relevant
deployment and dependent-configuration evidence.

## Arbitrum zero-valued subsystems

`42161-latest.json` currently has these three top-level subsystem values set to
the zero-address sentinel:

| Artifact key | Current label |
| --- | --- |
| `ensReceiver` | Intentional L1/CCIP receiver; see `../src/registries/ENSReceiver.sol` and the current contracts builder docs. |
| `gardenerRegistry` | Pending deployment. |
| `gardenerAccountLogic` | Pending deployment. |

**PR review note:** Afo confirms the `gardenerRegistry` and
`gardenerAccountLogic` labels at PR review.

## Consumer guard pattern

If future code reaches one of these addresses, give it a subsystem-specific
non-zero guard following
[`isGreenWillDeployed`](../../shared/src/config/blockchain.ts#L262-L266):
check that the configured address is present and not the zero-address sentinel
before using it. `isGreenWillDeployed` itself guards `greenWill`; it is the
pattern, not a guard for these three keys.

## Deployment runbook

Use the package-owned contracts CLI; never run raw `forge` deployment commands. The root
environment supplies chain RPCs and keystore configuration. Run these examples from the repository root.

```sh
# Compile-only preflight, then target-chain simulation.
bun run contracts -- deploy core --network sepolia --mode preflight
bun run contracts -- deploy core --network sepolia --mode simulate

# Broadcast only after release-owner approval.
bun run contracts -- deploy core --network sepolia --mode broadcast
bun run contracts -- verify --network sepolia
```

Use command-specific help for supported networks and modes. Legacy `deploy:celo` selected a
schema-only path; it is not an equivalent core-deployment recipe. Consult the generated
[operation reference](../../../docs/docs/builders/packages/contract-operations.mdx) before replacing
historical commands.
A deploy is not complete until its `*-latest.json` artifact is persisted, dependent indexer/config
inputs are updated, and the matching post-deploy verifier passes.

Approved immutable EAS schema additions use their standalone registration paths. Do not restore
or use the retired bulk `--update-schemas` flow.
