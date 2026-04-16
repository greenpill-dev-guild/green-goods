# ADR-013: UnifiedPowerRegistry Consolidation

**Date**: 2026-04-02
**Status**: Accepted

## Context

Gardens V2 uses an NFTPowerRegistry for conviction voting power in CVStrategy pools. Originally, each garden deployed its own registry instance during mint, creating gas-heavy deployments (~500k gas per registry) and making cross-garden power source management impossible. With 13+ gardens in Season One, this meant 13+ separate registry contracts with identical logic, each needing independent upgrades.

## Decision

A single UUPS-upgradeable `UnifiedPowerRegistry` (`packages/contracts/src/registries/Power.sol`) stores per-garden voting power configurations. Instead of one registry per garden, one registry serves all gardens with garden-scoped storage.

Core data model:
- **Power sources** (ERC721, ERC1155, Hats) are registered per garden with a token address, token type, and basis-point weight (10000 = 1x multiplier).
- **Garden-to-source mapping**: `gardenPowerSources[gardenId]` returns the array of configured sources.
- **Pool-to-garden mapping**: `poolToGarden[poolAddress]` enables `getMemberPowerInStrategy()` to route from a strategy/pool address back to the correct garden's power configuration.

Power calculation: `sum of (balance(member, source) * weight / 10000)` across all configured sources for a garden. This is called by CVStrategy during conviction voting to determine a member's voting weight.

Access control: Only `GardensModule` can register gardens and pools (enforced by `onlyGardensModule` modifier). Power sources are set at garden registration time and are immutable thereafter -- there is no `updatePowerSources()` function.

## Consequences

- **Enables**: Single deployment for all gardens. Consistent power calculation logic. Adding new source types (e.g., ERC20, soulbound tokens) requires only adding a new enum value and balance-check branch, not redeploying registries. Cross-garden analytics are trivial since all data is in one contract.
- **Constrains**: Power sources are immutable after garden registration (by design -- prevents mid-vote manipulation where a garden owner could change voting weights to swing an active conviction signal). Changing power configuration requires a new garden or a contract upgrade.
- **Trade-off**: Single point of failure -- if the registry is bricked or its upgrade goes wrong, all conviction voting across all gardens stops. This risk is mitigated by the UUPS upgrade path and thorough fork testing, but it is a real concentration risk compared to per-garden registries where a failure would be isolated.
