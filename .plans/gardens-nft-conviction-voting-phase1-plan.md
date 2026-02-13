# Green Goods x Gardens NFT Conviction Voting Plan (Open Questions Resolved)

> **Canonical Source Note (Feb 2026)**: The HypercertSignalPool contract is implemented in the
> **Gardens repo** (`greenpill-dev-guild/gardens`, branch `feature/nft-voting-power`), not in
> green-goods. Green-goods owns only the Hats.sol integration layer and shared frontend
> hooks/types. A duplicate was deleted from green-goods after the conviction voting review.

## Summary

Implement Phase 1 as a registry-driven voting power integration with Hats-triggered sync, while preserving current ERC-20 garden creation and staking semantics. Ship single-transaction UX in Phase 1 via permit-first orchestration, remove delegation from delivery scope, and roll out on Sepolia first.

## Decision Log (Locked)

1. Phase 1 power model: `IVotingPowerRegistry` as the single source of truth.
2. Governance token optionality: keep ERC-20 required for garden creation in Phase 1.
3. Registry topology: one voting registry instance per pool.
4. Sync failure policy: best-effort non-blocking.
5. Single-tx UX: include in Phase 1.
6. Initial staking requirement: keep staking required.
7. Registry whitelist authority: Gardens CV admin council-safe.
8. Rollout order: Sepolia first.
9. Single-tx approval strategy: permit-first with fallback path.
10. Delegation: removed from delivery scope.
11. Interface shape: include lightweight asset metadata getter (`assetAddress()`).
12. PointSystem enum: add `PointSystem.Custom` — reads `votingPowerRegistry.getMemberPower()` as-is, no transformation.
13. Sync trigger: revoke only. Grant handled by `activatePoints()` reading current registry power.
14. Sync interface: `setConvictionStrategies(gardenId, strategies[])` admin-configured, best-effort try/catch per strategy.
15. Upgrade atomicity: diamond cut for existing communities MUST be single TX (Add CVSyncPowerFacet + Replace CVPowerFacet + diamondInit).
16. Streaming branch check: verify `votingPowerRegistry` slot in streaming-pool branch before writing storage code.

## Scope

### In Scope

1. Gardens contracts updates in `/Users/afo/Code/greenpill/gardens/pkg/contracts/src/...` for voting registry, sync facet, and whitelist enforcement.
2. Green Goods contract integration in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/modules/Hats.sol` and interface updates in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/interfaces/...`.
3. Shared/client transaction orchestration updates in `/Users/afo/Code/greenpill/green-goods/packages/shared/src/...` and `/Users/afo/Code/greenpill/green-goods/packages/client/src/...` for permit-first single-tx voting flow.
4. Plan/doc reconciliation in `/Users/afo/Code/greenpill/green-goods/.plans/gardens-nft-conviction-voting-architecture.md`.

### Out of Scope

1. Removing ERC-20 requirement from `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/tokens/Garden.sol`.
2. Conviction delegation implementation.
3. Shared chain-wide registry model.
4. Mainnet-first rollout.

## Important API / Interface / Type Changes

1. Gardens `IVotingPowerRegistry`:
- Add/standardize:
`getMemberPower(address member, address strategy) returns (uint256)`
`isMember(address member) returns (bool)`
`assetAddress() returns (address)` (new lightweight metadata getter)
2. Gardens strategy init/config:
- Use `votingPowerRegistry` naming consistently across structs, storage, events, and docs.
- Remove lingering `powerRegistry` naming to avoid split semantics.
3. Gardens admin whitelist:
- Add onchain whitelist controls in CV admin surface:
`setAllowedVotingPowerRegistry(address registry, bool allowed)`
`isAllowedVotingPowerRegistry(address registry) view returns (bool)`
- Enforce at pool creation and pool param updates.
4. Green Goods Hats integration:
- Extend `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/interfaces/IHatsModule.sol` with strategy sync configuration and sync event surface.
- Add best-effort `_syncConvictionPower(...)` calls in role **revoke** path only in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/modules/Hats.sol`. Grant is handled by `activatePoints()` reading current registry power.
5. Shared/client types:
- Add optional strategy metadata fields (pool address, registry address, sync status, permit support) in shared types under `/Users/afo/Code/greenpill/green-goods/packages/shared/src/types/...`.
- Add single-tx operation builder/hook for permit-first flow in `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/...`.

## Implementation Plan

1. Gardens contract updates (`/Users/afo/Code/greenpill/gardens`):
- **Pre-check**: Verify `votingPowerRegistry` slot position in streaming-pool branch matches planned slot 132.
- Implement `IVotingPowerRegistry` (with `getMemberPower`, `isMember`, `assetAddress`) and per-pool `NFTPowerRegistry`.
- Add `PointSystem.Custom` to enum — reads `votingPowerRegistry.getMemberPower()` as-is, no transformation.
- Add `votingPowerRegistry` storage slot in `CVStrategyBaseFacet` (gap-safe, slot 132).
- Update `CVPowerFacet` activation/power reads to registry-driven path for `PointSystem.Custom`.
- Add `CVSyncPowerFacet` for support recalculation and power sync.
- Add CV admin whitelist logic (`setAllowedVotingPowerRegistry`) and enforce only approved registries at pool init.
- No delegation code paths — removed from scope.
2. Green Goods contract integration (`/Users/afo/Code/greenpill/green-goods/packages/contracts`):
- Add `gardenConvictionStrategies` mapping and `setConvictionStrategies(gardenId, strategies[])` admin function in HatsModule.
- Trigger best-effort sync on **revoke only** — grant handled by `activatePoints()` reading current power.
- Emit `ConvictionSyncTriggered` / `ConvictionSyncFailed` events. Sync failure MUST NOT revert role revocation.
3. Diamond upgrade scripts:
- Single TX containing: `FacetCutAction.Add` for CVSyncPowerFacet + `FacetCutAction.Replace` for modified CVPowerFacet + `diamondInit` for votingPowerRegistry storage.
3. Single-tx UX implementation (`/Users/afo/Code/greenpill/green-goods/packages/shared` + `/Users/afo/Code/greenpill/green-goods/packages/client`):
- Primary path: `permit + join/register + activate + allocate` bundled.
- Fallback path: if token lacks permit, gracefully route to two-step UX while preserving same hook contract.
- Keep existing join semantics intact where no governance action is initiated.
4. Plan/doc reconciliation:
- Update `/Users/afo/Code/greenpill/green-goods/.plans/gardens-nft-conviction-voting-architecture.md` to remove contradictions: delegation removed, naming unified, scope aligned with staking-required + single-tx permit-first.
5. Rollout:
- Deploy on Sepolia test community first.
- Run upgrade scripts for existing test community.
- Promote only after passing all acceptance gates below.

## Testing and Validation

1. Gardens unit tests:
- Registry power computation for ERC721/ERC1155/Hat paths.
- Whitelist enforcement rejects unapproved registries.
- `activatePoints` and power updates use registry values consistently.
- `CVSyncPowerFacet` adjusts supports correctly and conviction follows expected math.
2. Gardens integration tests:
- End-to-end: grant role/NFT power gain, allocate support, revoke role/power loss, support rebalance.
- Batch sync behavior for multiple members.
- Upgrade path tests for storage compatibility and cut ordering in a single tx.
3. Green Goods contract tests:
- Hats revoke triggers sync calls to configured strategies (grant does NOT trigger sync).
- Sync failure emits failure event and does not revert role operation.
- Strategy config authorization and invalid strategy handling.
4. Shared/client tests:
- Permit-first operation builder success path.
- Non-permit token fallback behavior and messaging.
- Single-tx happy path with smart account and EOA compatibility checks.
5. E2E scenarios:
- New member with permit-capable token: one interaction flow reaches allocated support.
- Member with non-permit token: deterministic fallback with no inconsistent onchain state.
- Revoked role reflected in support/voting power after sync event processing.

## Acceptance Criteria

1. No delegation code in production scope.
2. All registry references use `votingPowerRegistry` naming.
3. Unapproved registry cannot be used in pool config.
4. Hats role changes never fail due to sync failures, but failures are observable by event/log.
5. Single-tx path works for permit tokens; fallback works for non-permit tokens.
6. Sepolia validation suite passes before any production promotion.

## Assumptions and Defaults

1. ERC-20 requirement in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/tokens/Garden.sol` remains unchanged.
2. Staking requirement remains in Gardens community join logic for Phase 1.
3. Per-pool registry deployments are managed through approved templates and admin workflow.
4. Council-safe controls whitelist governance on Gardens side.
5. Rollout starts on Sepolia and only then moves to target live environments.
