# ADR-011: Six-Role Hats Tree Structure

**Date**: 2026-04-02
**Status**: Accepted

## Context

Gardens need role-based access control with varying permission levels. The platform distinguishes between garden owners, operators who manage day-to-day operations, evaluators who assess work quality, gardeners who perform the regenerative work, funders who provide capital, and community members who participate in governance. A custom RBAC system would be expensive to build and audit, and wouldn't compose with the broader Hats Protocol ecosystem (eligibility modules, accountability chains, delegation).

## Decision

Each garden gets a Hats Protocol hat tree with 7 hats: 1 admin hat (parent) + 6 role hats (Owner, Operator, Evaluator, Gardener, Funder, Community). Roles form an implicit hierarchy: Owner > Operator > Evaluator > Gardener. Funder and Community are orthogonal roles -- they are not part of the operational hierarchy and are gated by ERC20 eligibility modules instead of manual assignment.

Key files:
- `packages/contracts/src/modules/Hats.sol` (GardenHats struct lines 36-45, tree creation lines 386-402)
- `packages/contracts/src/accounts/Garden.sol` (role hierarchy enforcement lines 333-352)
- `packages/contracts/src/interfaces/IHatsModule.sol` (GardenRole enum)

The hat tree structure per garden:

```
Admin Hat (top hat - owned by GardenToken contract)
├── Owner Hat       (manually granted, max supply configurable)
├── Operator Hat    (manually granted by Owner)
├── Evaluator Hat   (manually granted by Owner/Operator)
├── Gardener Hat    (manually granted by Owner/Operator)
├── Funder Hat      (ERC20 eligibility - automatic based on token balance)
└── Community Hat   (ERC20 eligibility - automatic based on token balance)
```

`configureEligibilityModules()` deploys HatsModuleFactory-based ERC20 balance check modules for the Funder and Community hats. These make role membership automatic: holding enough tokens grants the hat, dropping below the threshold revokes it, with no manual intervention required.

The `GardenRole` enum defines the canonical ordering, and `GardenAccount` enforces hierarchy checks -- e.g., only Owner or Operator can grant the Gardener hat, and no one can self-grant a role above their current level.

## Consequences

- **Enables**: Flexible per-garden RBAC without custom contract deployment. Roles compose naturally with Hats Protocol ecosystem (eligibility modules, accountability chains, toggle modules). Token-gated roles (Funder, Community) enable permissionless participation based on economic commitment.
- **Constrains**: The hat tree structure is immutable after creation -- the 6-role set is fixed. Adding a new role type (e.g., "Auditor") requires a contract upgrade to HatsModule plus a migration for existing gardens. Maximum role count is bounded by the gas cost of tree creation.
- **Trade-off**: 7 hat creation calls per garden mint adds significant gas cost (~300k gas for the full tree setup). This is acceptable because garden creation is infrequent (tens per season, not thousands), and the role infrastructure is used for every subsequent access control check. The alternative -- lazy hat creation -- would add complexity to every permission check ("does this hat exist yet?").
