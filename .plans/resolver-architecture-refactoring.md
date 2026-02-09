# Resolver Refactoring — Centralize Module Dispatch + Add `onGardenCreated`

## Context

The GreenGoodsResolver fan-out pattern is sound but incomplete: GAP lives in two places, AssessmentResolver bypasses the router, and there's no garden-creation lifecycle hook. This refactoring consolidates ALL module dispatch through GreenGoodsResolver (fixing the 3 review issues) and adds `onGardenCreated` with 4 modules for the next few quarters: **GAP project**, **Octant vault**, **ConvictionVoting community**, and **Hats tree** (stays in GardenToken — mandatory/blocking).

## Architecture After

```
GardenToken.mintGarden()
  → HatsModule.createGardenHatTree()     ← STAYS (mandatory, blocking)
  → HatsModule.grantRole(owner/ops/gardeners) ← STAYS
  → GardenAccount.initialize()            ← STAYS (moved before resolver call)
  → GreenGoodsResolver.onGardenCreated()  ← NEW (non-blocking fan-out)
      → KarmaGAPModule.createProject()        try/catch
      → OctantModule.onWorkApproved()         try/catch (reuses existing, idempotent)
      → ConvictionVotingModule.onGardenCreated() try/catch

WorkApprovalResolver.onAttest()
  → greenGoodsResolver.onWorkApproved()   ← UNCHANGED caller
      → KarmaGAPModule.createImpact()         try/catch  ← MOVED HERE (was direct)
      → OctantModule.onWorkApproved()         try/catch  ← STAYS (fallback for legacy)
      → UnlockModule.onWorkApproved()         try/catch  ← STAYS

AssessmentResolver.onAttest()
  → greenGoodsResolver.onAssessmentCreated() ← NEW wiring
      → KarmaGAPModule.createMilestone()      try/catch  ← MOVED HERE (was direct)
```

---

## Batch 1: Quick Fixes (no storage changes)

### 1A. Fix double ActionRegistry read — `src/resolvers/Work.sol`

Cache `getAction()` result in a local variable (lines 78-85):
```solidity
ActionRegistry.Action memory action = ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID);
if (action.startTime == 0) revert NotInActionRegistry();
if (action.endTime < block.timestamp) revert NotActiveAction();
```

### 1B. Remove `_createGAPProjectImpact` from WorkApprovalResolver — `src/resolvers/WorkApproval.sol`

- Delete `_createGAPProjectImpact()` function (lines 197-216)
- Delete the direct call at lines 125-127
- Keep `karmaGAPModule` storage variable (preserve proxy layout), add `@deprecated` comment
- The `_callGreenGoodsResolver()` call at line 131 now handles all integrations

### 1C. Remove GAP from AssessmentResolver — `src/resolvers/Assessment.sol`

- Delete `_createGAPProjectMilestone()`, `_buildMilestoneMetadata()`, `_escapeJSON()` (lines 147-211)
- Delete the direct call at lines 118-120
- Keep `karmaGAPModule` storage variable, add `@deprecated` comment

---

## Batch 2: Wire AssessmentResolver + Expand GreenGoodsResolver

### 2A. Update `IGreenGoodsResolver` — `src/interfaces/IGreenGoodsResolver.sol`

Add `metricsJSON` to `onAssessmentCreated` and add `onGardenCreated`:

```solidity
function onAssessmentCreated(
    address garden, bytes32 assessmentUID, address attester,
    string calldata title, string calldata description,
    string[] calldata capitals, string calldata assessmentType,
    string calldata metricsJSON  // NEW param
) external;

function onGardenCreated(
    address garden, string calldata name, string calldata description,
    string calldata location, string calldata bannerImage,
    address communityToken, address operator
) external;
```

### 2B. Wire AssessmentResolver → GreenGoodsResolver — `src/resolvers/Assessment.sol`

Storage: add `IGreenGoodsResolver public greenGoodsResolver` (slot after karmaGAPModule), gap 49→48.

After validation in `onAttest()`, replace the deleted GAP call with:
```solidity
if (address(greenGoodsResolver) != address(0)) {
    try greenGoodsResolver.onAssessmentCreated(
        attestation.recipient, attestation.uid, attestation.attester,
        schema.title, schema.description, schema.capitals,
        schema.assessmentType, schema.metricsJSON
    ) {} catch {}
}
```
Add setter `setGreenGoodsResolver(address)` + event.

### 2C. Expand GreenGoodsResolver storage — `src/resolvers/GreenGoods.sol`

Add 3 new storage variables (after `unlockModule`):
- `IKarmaGAPModule public karmaGAPModule` (slot 4)
- `address public actionRegistry` (slot 5)
- `ConvictionVotingModule public convictionModule` (slot 6)
- `MODULE_CONVICTION = keccak256("CONVICTION")` constant
- Gap: 46→43

Add setters: `setKarmaGAPModule`, `setActionRegistry`, `setConvictionModule` + events.

### 2D. Implement real GAP dispatch in GreenGoodsResolver

Replace `_executeGAPWorkApproved` (currently event-only) with actual call:
```solidity
function _executeGAPWorkApproved(...) private {
    if (address(karmaGAPModule) == address(0)) return;
    (,, uint256 tokenId) = IERC6551Account(garden).token();
    string memory workTitle = ActionRegistry(actionRegistry).getAction(uint256(actionUID)).title;
    try karmaGAPModule.createImpact(garden, tokenId, workTitle, feedback, mediaIPFS, workUID) {
        emit ModuleExecutionSuccess(MODULE_GAP, garden, workUID);
    } catch { emit ModuleExecutionFailed(MODULE_GAP, garden, workUID); }
}
```

Replace `_executeGAPAssessmentCreated` with actual call:
```solidity
function _executeGAPAssessmentCreated(...) private {
    if (address(karmaGAPModule) == address(0)) return;
    string memory metaJSON = _buildMilestoneMetadata(capitals, assessmentType, metricsJSON);
    try karmaGAPModule.createMilestone(garden, title, description, metaJSON) {
        emit ModuleExecutionSuccess(MODULE_GAP, garden, assessmentUID);
    } catch { emit ModuleExecutionFailed(MODULE_GAP, garden, assessmentUID); }
}
```

Move `_buildMilestoneMetadata` and `_escapeJSON` helper functions from AssessmentResolver into GreenGoodsResolver. Update `onAssessmentCreated` signature to accept `metricsJSON`.

---

## Batch 3: ConvictionVoting Module Stub (new files)

### 3A. `src/interfaces/IConvictionVotingFactory.sol` (NEW)

```solidity
interface IConvictionVotingFactory {
    function createCommunity(
        address communityToken, string calldata name, address admin
    ) external returns (address community);
}
```

### 3B. `src/modules/ConvictionVoting.sol` (NEW)

Follows OctantModule pattern exactly:
- UUPS + OwnableUpgradeable
- Storage: `convictionFactory`, `router`, `gardenCommunities` mapping, gap[46]
- `onGardenCreated(garden, name, communityToken, operator)` — only callable by router
- Skip silently if factory not configured or community already exists
- `hasCommunity(garden)`, `getCommunity(garden)` view functions
- Admin: `setConvictionFactory`, `setRouter`, `createCommunityForGarden`

### 3C. `src/mocks/ConvictionVoting.sol` (NEW)

Mock factory + mock community for testing (same pattern as `src/mocks/Octant.sol`).

---

## Batch 4: Add `onGardenCreated` Flow

### 4A. Implement `onGardenCreated` in GreenGoodsResolver

```solidity
function onGardenCreated(
    address garden, string calldata name, string calldata description,
    string calldata location, string calldata bannerImage,
    address communityToken, address operator
) external override onlyAuthorized {
    if (_enabledModules[MODULE_GAP] && address(karmaGAPModule) != address(0)) {
        _executeGAPGardenCreated(garden, name, description, location, bannerImage, operator);
    }
    if (_enabledModules[MODULE_OCTANT] && address(octantModule) != address(0)) {
        _executeOctantGardenCreated(garden, name);
    }
    if (_enabledModules[MODULE_CONVICTION] && address(convictionModule) != address(0)) {
        _executeConvictionGardenCreated(garden, name, communityToken, operator);
    }
}
```

Each `_execute*` function follows the try/catch + event pattern.

`_executeGAPGardenCreated` calls `karmaGAPModule.createProject(garden, operator, name, description, location, bannerImage)`.

`_executeOctantGardenCreated` reuses `octantModule.onWorkApproved(garden, name)` — it's idempotent (returns existing vault if already created).

`_executeConvictionGardenCreated` calls `convictionModule.onGardenCreated(garden, name, communityToken, operator)`.

### 4B. Update GardenToken — `src/tokens/Garden.sol`

Storage: add `IGreenGoodsResolver public greenGoodsResolver` (slot 4, after karmaGAPModule), gap 46→45. `karmaGAPModule` stays at slot 3, marked `@deprecated`.

In `_initializeGardenModules()`:
1. Hats tree + role grants — **unchanged** (mandatory, blocking)
2. Move `GardenAccount.initialize()` **before** resolver call
3. **Replace** direct `karmaGAPModule.createProject()` with:
```solidity
if (address(greenGoodsResolver) != address(0)) {
    try greenGoodsResolver.onGardenCreated(
        gardenAccount, config.name, config.description, config.location,
        config.bannerImage, config.communityToken, config.gardenOperators[0]
    ) {} catch {}
}
```

Add setter `setGreenGoodsResolver(address)` + event.

---

## Batch 5: Wiring & Tests

### 5A. Deployment wiring (config calls, no code changes to KarmaGAPModule)

After upgrading all contracts:
```
// Authorize GardenToken to call GreenGoodsResolver.onGardenCreated
greenGoodsResolver.setAuthorizedCaller(gardenTokenAddr, true)

// Wire GreenGoodsResolver dependencies
greenGoodsResolver.setKarmaGAPModule(karmaGAPModuleAddr)
greenGoodsResolver.setActionRegistry(actionRegistryAddr)
greenGoodsResolver.setConvictionModule(convictionModuleAddr)  // when deployed
greenGoodsResolver.setModuleEnabled(MODULE_CONVICTION, true)  // when ready

// Wire GardenToken → GreenGoodsResolver
gardenToken.setGreenGoodsResolver(greenGoodsResolverAddr)

// Wire AssessmentResolver → GreenGoodsResolver
assessmentResolver.setGreenGoodsResolver(greenGoodsResolverAddr)

// Reconfigure KarmaGAPModule callers (no code change, just setter calls)
karmaGAPModule.setGardenToken(greenGoodsResolverAddr)           // createProject caller
karmaGAPModule.setWorkApprovalResolver(greenGoodsResolverAddr)  // createImpact caller
karmaGAPModule.setAssessmentResolver(greenGoodsResolverAddr)    // createMilestone caller
```

### 5B. Test updates

| Test File | Changes |
|-----------|---------|
| `test/unit/WorkResolver.t.sol` | Verify cached `getAction()` still validates correctly |
| `test/unit/WorkApprovalResolver.t.sol` | Remove GAP tests, verify only `greenGoodsResolver.onWorkApproved()` is called |
| `test/unit/AssessmentResolver.t.sol` | Remove GAP tests, add `greenGoodsResolver.onAssessmentCreated()` tests |
| `test/integration/GreenGoodsResolver.t.sol` | Add `onGardenCreated` tests (GAP + Octant + ConvictionVoting dispatch), update GAP impact/milestone tests to verify real calls |
| `test/unit/ConvictionVotingModule.t.sol` | **NEW** — init, create, skip, auth, manual admin |
| `test/helpers/DeploymentBase.sol` | Update wiring to include GreenGoodsResolver as orchestration hub |

---

## Storage Layout Summary

| Contract | Slots Used | Gap | Delta |
|----------|-----------|-----|-------|
| **GreenGoodsResolver** | 7 (was 4) | 43 | +karmaGAPModule, actionRegistry, convictionModule |
| **GardenToken** | 5 (was 4) | 45 | +greenGoodsResolver |
| **AssessmentResolver** | 2 (was 1) | 48 | +greenGoodsResolver |
| **WorkApprovalResolver** | 2 (unchanged) | 48 | karmaGAPModule deprecated in place |
| **WorkResolver** | 0 (unchanged) | 50 | No storage change |
| **KarmaGAPModule** | 5 (unchanged) | 45 | Config-only reconfiguration |
| **ConvictionVotingModule** | 4 (NEW) | 46 | New contract |

All existing slots preserved. New variables appended before gap.

---

## Files Modified/Created

**Modified (7):**
- `packages/contracts/src/interfaces/IGreenGoodsResolver.sol`
- `packages/contracts/src/resolvers/GreenGoods.sol`
- `packages/contracts/src/resolvers/Work.sol`
- `packages/contracts/src/resolvers/WorkApproval.sol`
- `packages/contracts/src/resolvers/Assessment.sol`
- `packages/contracts/src/tokens/Garden.sol`
- `packages/contracts/test/helpers/DeploymentBase.sol`

**Created (4):**
- `packages/contracts/src/interfaces/IConvictionVotingFactory.sol`
- `packages/contracts/src/modules/ConvictionVoting.sol`
- `packages/contracts/src/mocks/ConvictionVoting.sol`
- `packages/contracts/test/unit/ConvictionVotingModule.t.sol`

**Tests Updated (4):**
- `packages/contracts/test/unit/WorkResolver.t.sol`
- `packages/contracts/test/unit/WorkApprovalResolver.t.sol`
- `packages/contracts/test/unit/AssessmentResolver.t.sol`
- `packages/contracts/test/integration/GreenGoodsResolver.t.sol`

---

## Verification

```bash
# Compile all contracts
cd packages/contracts && bun build

# Run unit tests (skip fork tests)
bun test

# Run specific test files
forge test --match-path test/unit/WorkResolver.t.sol -vvv
forge test --match-path test/unit/ConvictionVotingModule.t.sol -vvv
forge test --match-path test/integration/GreenGoodsResolver.t.sol -vvv

# Verify storage layout safety
forge inspect GreenGoodsResolver storage-layout
forge inspect GardenToken storage-layout
forge inspect AssessmentResolver storage-layout
```
