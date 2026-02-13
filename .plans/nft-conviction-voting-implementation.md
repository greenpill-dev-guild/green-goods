# NFT-Gated Conviction Voting — Implementation Plan

**GitHub Branch**: `feature/nft-conviction-voting`
**Status**: Planning → In Progress → Done
**Base Branch**: `feature/octant-defi-vaults`
**Architecture Spec**: `.plans/gardens-nft-conviction-voting-architecture (2).md`
**Decision Log**: `.plans/gardens-nft-conviction-voting-phase1-plan.md`

> **Canonical Source**: The **HypercertSignalPool** contract (signal-only conviction voting pool)
> is implemented in the **Gardens repo** (`greenpill-dev-guild/gardens`, branch `feature/nft-voting-power`),
> NOT in green-goods. The green-goods duplicate was deleted after the conviction voting review
> (Feb 2026). Green-goods owns only the **Hats.sol integration** (`_syncConvictionPower`,
> `ICVSyncPowerFacet`, `ConvictionSync.t.sol`) and the **shared hooks/types** that consume
> the gardens-deployed pool. See gardens repo at:
> `pkg/contracts/src/HypercertSignalPool/HypercertSignalPool.sol`

---

## Requirements Coverage

| # | Requirement | Planned Step | Status |
|---|-------------|--------------|--------|
| 1 | IVotingPowerRegistry interface (getMemberPower, isMember, assetAddress) | Step 1 | ⏳ |
| 2 | NFTPowerRegistry contract (ERC721/ERC1155/HAT power sources with weights) | Step 2 | ⏳ |
| 3 | ICVSyncPower interface for sync callbacks | Step 3 | ⏳ |
| 4 | HatsModule: gardenConvictionStrategies mapping + setConvictionStrategies() | Step 4 | ⏳ |
| 5 | HatsModule: _syncConvictionPower() on revoke only (best-effort, non-blocking) | Step 4 | ⏳ |
| 6 | IHatsModule interface: conviction sync events + setConvictionStrategies | Step 4 | ⏳ |
| 7 | MockHatsModule: conviction sync tracking for tests | Step 5 | ⏳ |
| 8 | Mock CVSyncPower target for integration tests | Step 5 | ⏳ |
| 9 | Unit tests: NFTPowerRegistry power computation (ERC721, ERC1155, HAT paths) | Step 6 | ⏳ |
| 10 | Unit tests: HatsModule conviction sync on revoke (success + failure paths) | Step 7 | ⏳ |
| 11 | Integration test: full flow (mint hat → configure strategies → revoke → sync triggered) | Step 8 | ⏳ |

---

## CLAUDE.md Compliance

- [x] Hooks in shared package (no new hooks needed in Phase 1 — contracts only)
- [x] Deployment artifacts for addresses (NFTPowerRegistry uses constructor args, not hardcoded)
- [x] Tests parallel to source in `__tests__/` / `test/` directories
- [x] Use `Address` type from shared for any TS additions
- [x] No console.log in production code
- [x] Error handling: sync failures MUST NOT revert role operations (best-effort try/catch)

---

## Impact Analysis

### Files to Create

| File | Description | Repo |
|------|-------------|------|
| `packages/contracts/src/interfaces/IVotingPowerRegistry.sol` | Abstract voting power source interface | green-goods |
| `packages/contracts/src/interfaces/ICVSyncPowerFacet.sol` | Sync power callback interface for CVStrategy | green-goods (EXISTS) |
| `packages/contracts/src/registries/NFTPowerRegistry.sol` | NFT/Hats-based power registry implementation | green-goods |
| `packages/contracts/src/mocks/NFTPowerRegistry.sol` | Mock for testing power values | green-goods |
| `packages/contracts/src/mocks/CVSyncPower.sol` | Mock sync target for integration tests | green-goods |
| `packages/contracts/test/unit/NFTPowerRegistry.t.sol` | Unit tests for power computation | green-goods |
| `packages/contracts/test/unit/ConvictionSync.t.sol` | Unit tests for HatsModule conviction sync | green-goods |
| `packages/contracts/test/integration/ConvictionSync.t.sol` | Integration test: full revoke → sync flow | green-goods (EXISTS) |

> **Note**: The HypercertSignalPool contract and IHypercertSignalPool interface are NOT in this
> list — they live in the **Gardens repo** (`pkg/contracts/src/HypercertSignalPool/`). The
> green-goods copies were deleted after the Feb 2026 conviction voting review.

### Files to Modify

| File | Change |
|------|--------|
| `packages/contracts/src/interfaces/IHatsModule.sol` | Add conviction sync events + setConvictionStrategies signature |
| `packages/contracts/src/modules/Hats.sol` | Add gardenConvictionStrategies mapping, setConvictionStrategies(), _syncConvictionPower() |
| `packages/contracts/test/helpers/MockHatsModule.sol` | Add conviction sync tracking |

---

## Implementation Steps

### Step 1: IVotingPowerRegistry Interface
**Files**: `packages/contracts/src/interfaces/IVotingPowerRegistry.sol` (NEW)
**Details**:
- Define `getMemberPower(address _member, address _strategy) returns (uint256)`
- Define `isMember(address _member) returns (bool)`
- Define `assetAddress() returns (address)` — lightweight metadata getter
- NatDoc matching architecture spec section 2.3

### Step 2: NFTPowerRegistry Contract
**Files**: `packages/contracts/src/registries/NFTPowerRegistry.sol` (NEW)
**Details**:
- Struct `NFTPowerSource { address token; NFTType nftType; uint256 weight; uint256 tokenId; uint256 hatId; }`
- Enum `NFTType { ERC721, ERC1155, HAT }`
- Constructor takes `address _hatsProtocol, NFTPowerSource[] memory _powerSources`
- `getMemberPower()`: iterate power sources, call balanceOf/isWearerOfHat, apply weight (basis points 10000=1x)
- `isMember()`: returns getMemberPower > 0
- `assetAddress()`: returns first power source token address
- Immutable after deployment (no admin functions — one registry per pool)
- Import `IERC721` and `IERC1155` from OpenZeppelin, `IHats` from local interfaces

### Step 3: ICVSyncPower Interface
**Files**: `packages/contracts/src/interfaces/ICVSyncPowerFacet.sol` (EXISTS)
**Details**:
- Define `syncPower(address _member) external`
- Define `batchSyncPower(address[] calldata _members) external`
- This is the interface HatsModule calls on CVStrategy addresses
- Minimal interface — the full facet implementation lives in **Gardens V2 repo** (`greenpill-dev-guild/gardens`, branch `feature/nft-voting-power`), not Green Goods
- The HypercertSignalPool contract also lives in the Gardens repo at `pkg/contracts/src/HypercertSignalPool/`

### Step 4: HatsModule Conviction Sync Integration
**Files**: `packages/contracts/src/modules/Hats.sol`, `packages/contracts/src/interfaces/IHatsModule.sol`
**Details**:

**IHatsModule additions:**
- Event `ConvictionSyncTriggered(address indexed garden, address indexed member, address indexed strategy)`
- Event `ConvictionSyncFailed(address indexed garden, address indexed member, address strategy, bytes reason)`
- Function `setConvictionStrategies(address garden, address[] calldata strategies) external`
- Function `getConvictionStrategies(address garden) external view returns (address[] memory)`

**HatsModule storage additions (uses __gap slots):**
- `mapping(address garden => address[] strategies) public gardenConvictionStrategies;`
- Consumes 1 of 38 __gap slots → 37 remaining

**HatsModule function additions:**
- `setConvictionStrategies(address garden, address[] calldata _strategies)` — requires owner/operator
- `getConvictionStrategies(address garden)` — view function
- `_syncConvictionPower(address _member, address _garden)` — internal, best-effort try/catch per strategy
  - Called from `_revokeRole()` AFTER the hat transfer (not before)
  - Sync failure emits `ConvictionSyncFailed` and does NOT revert
  - Only triggered on revoke, NOT on grant (grant handled by activatePoints reading current power)

**_revokeRole modification:**
- After existing revoke logic + KarmaGAP sync, add conviction sync call
- Conviction sync runs for ALL role revocations (any role revoke could affect voting power)

### Step 5: Mock Contracts for Testing
**Files**: `packages/contracts/src/mocks/NFTPowerRegistry.sol` (NEW), `packages/contracts/src/mocks/CVSyncPower.sol` (NEW), `packages/contracts/test/helpers/MockHatsModule.sol` (MODIFY)

**MockNFTPowerRegistry:**
- Configurable power values per member: `setMemberPower(address, uint256)`
- Configurable membership: `setIsMember(address, bool)`

**MockCVSyncPower:**
- Tracks calls: `SyncCall[] public syncCalls`
- Configurable revert: `setShouldRevert(bool)`
- Validates that HatsModule handles failures gracefully

**MockHatsModule updates:**
- Add `setConvictionStrategies` / `getConvictionStrategies` stubs
- Add conviction sync event tracking

### Step 6: NFTPowerRegistry Unit Tests
**Files**: `packages/contracts/test/unit/NFTPowerRegistry.t.sol` (NEW)
**Details**:
- Test ERC721 balanceOf path with weight calculation
- Test ERC1155 balanceOf(tokenId) path with weight
- Test HAT isWearerOfHat binary (0/1) with weight
- Test multiple power sources summing correctly
- Test isMember returns true/false correctly
- Test assetAddress returns first source
- Test zero balance → zero power
- Test weight calculation: balance * weight / 10000
- Use MockERC721, MockERC1155, MockHats from existing mocks

### Step 7: Conviction Sync Unit Tests
**Files**: `packages/contracts/test/unit/ConvictionSync.t.sol` (NEW)
**Details**:
- Test setConvictionStrategies stores strategies correctly
- Test setConvictionStrategies requires owner/operator
- Test getConvictionStrategies returns stored strategies
- Test _revokeRole triggers sync for configured strategies
- Test sync failure does NOT revert role revocation
- Test sync failure emits ConvictionSyncFailed event
- Test sync success emits ConvictionSyncTriggered event
- Test revoke with no configured strategies is no-op
- Test grant does NOT trigger sync
- Test batch revoke triggers sync for each member

### Step 8: Integration Test — Full Conviction Sync Flow
**Files**: `packages/contracts/test/integration/ConvictionSync.t.sol` (NEW)
**Details**:
- Deploy real HatsModule + MockCVSyncPower
- Create garden hat tree
- Configure conviction strategies for garden
- Grant gardener role → verify NO sync triggered
- Revoke gardener role → verify sync called on all configured strategies
- Revoke with failing strategy → verify other strategies still synced
- Revoke with all strategies failing → verify role still revoked

---

## Validation

```bash
# After each step:
cd packages/contracts
bun run test            # All unit tests pass
bun build               # Compilation succeeds

# After all steps:
bun format && bun lint  # Code quality
```

- [ ] TypeScript/Solidity compiles
- [ ] All existing tests still pass (no regressions)
- [ ] New tests pass with >80% coverage on new code
- [ ] `bun format && bun lint` passes
- [ ] No hardcoded addresses
- [ ] Sync failures never revert role operations
