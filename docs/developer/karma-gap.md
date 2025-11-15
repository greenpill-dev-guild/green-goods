# Karma GAP Integration

> **Audience:** Engineers working on the GAP bridge inside `packages/contracts` or consuming GAP data in clients/indexer.
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532), plus Optimism/Sepolia/Sei variants supported by Karma. Resolver addresses live in `packages/contracts/src/lib/Karma.sol`. Updated November 2024.
> **External references:** [Karma GAP documentation](https://docs.karmahq.xyz/karma-gap/) explains the attestation format and SDK expectations; review it when updating the bridge.

Appendix covering how Green Goods synchronises approved work with the Karma Grantee Accountability Protocol (GAP).

## Overview

- GAP attestation support is embedded in the contracts package.
- Integration is active on Base Sepolia, Arbitrum, Celo, Optimism, Optimism Sepolia, Sepolia, Sei, and Sei Testnet (addresses are centralised in `packages/contracts/src/lib/Karma.sol`).
- The bridge is optional at runtime; core protocol flows continue even if a GAP call fails.

## Contract Touchpoints

- `GardenAccount` stores the GAP project UID and exposes helpers for impact/milestone attestations.
- `WorkApprovalResolver` and `AssessmentResolver` call into `GardenAccount` after validating approvals/assessments.
- Resolver addresses are immutable in the GardenAccount implementation; upgrading a resolver requires deploying a new implementation and letting gardens opt in.

Key files:

- `packages/contracts/src/lib/Karma.sol`
- `packages/contracts/src/accounts/Garden.sol`
- `packages/contracts/test/E2EKarmaGAPFork.t.sol`

## Integration Flow

1. **Garden creation** — During `GardenAccount.initialize`, the contract checks `KarmaLib.isSupported()` for the current chain. If supported, it creates a GAP project attestation and stores the resulting UID.
2. **Operator management** — Adding an operator triggers `_addGAPProjectAdmin`, granting GAP admin rights that mirror on-chain roles.
3. **Work approval** — When `WorkApprovalResolver` finalises an approval, it creates a GAP impact attestation that references the garden project and work metadata.
4. **Assessments** — `AssessmentResolver` produces milestone attestations that map to GAP milestones.

Failures in GAP calls emit logs but do not revert the parent transaction; this protects gardeners from losing approvals because of external RPC outages.

## Maintenance Checklist

- Update `Karma.sol` when Karma publishes new resolver addresses or schema UIDs.
- Extend `E2EKarmaGAPFork.t.sol` to cover any new network or schema permutations.
- Document new attestation data shapes in `packages/contracts/README.md` or the relevant frontend README so consumers understand changes before rollout.
