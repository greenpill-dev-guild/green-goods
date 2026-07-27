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
