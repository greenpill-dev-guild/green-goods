# Hats Protocol v2 Architecture Review & Legacy Role Removal

## Context

The Hats Protocol integration manages garden roles (Owner, Operator, Evaluator, Gardener, Funder, Community) via on-chain hat trees instead of direct storage mappings. The GardenAccount currently operates in **dual mode**: legacy v1 (direct `gardeners`/`gardenOperators` mappings) and Hats v2 (delegation to `HatsModule`). All deployment JSONs show `hatsModule: 0x0...0` — Hats hasn't been deployed yet, but the full architecture is ready.

**Goal:** Remove the legacy v1 role **mappings** from GardenAccount, making Hats the sole authority for role management. Keep the `joinGarden()` flow but rework it to mint the gardener hat via HatsModule for open gardens.

---

## Part 1: Architecture Review Findings

### Current State — What Works Well

| Aspect | Assessment |
|--------|-----------|
| **Modularity** | Excellent. HatsModule is a standalone UUPS proxy. GardenAccount delegates via `IGardenAccessControl` interface. |
| **Role Hierarchy** | Well-designed. Auto-cascading grants (Owner→Operator→Evaluator→Gardener) with idempotent revocation. Per-garden isolation. |
| **Graceful Degradation** | Strong. Eligibility module failures don't block creation. KarmaGAP sync non-blocking. |
| **Test Coverage** | Comprehensive. Unit, integration, and fork tests across Arbitrum/Sepolia/Celo. |
| **Deployment Scripts** | Solid. `deploy.ts` → `Deploy.s.sol` → `SetupHatsTree.s.sol` with migration support. |
| **Indexer** | Complete. All 6 roles indexed via `RoleGranted`/`RoleRevoked` events. |

### Concerns & Improvement Areas

1. **Dual-mode complexity** — Every role check branches on `_isHatsEnabled()`. Removing v1 eliminates 2x code paths.
2. **Inclusive hierarchy duplication** — GardenAccount reimplements the hierarchy (owner→operator→evaluator→gardener) outside HatsModule.
3. **Eligibility modules are `address(0)`** — `HatsLib.getAllowlistEligibilityModule()` returns zero on all chains. Needs production configuration.
4. **`_getHatsModule()` fails open** — Returns zero address, causing `isFunder`/`isCommunity` to silently return `false`. Should revert.
5. **GardenMinted event has redundant data** — Emits `gardeners[]`/`operators[]` while HatsModule also emits `RoleGranted` for each.
6. **`useJoinGarden` rejects Hats gardens** — Lines 203-206 throw if Hats module exists. Must be inverted.

---

## Part 2: Implementation Plan

### What Gets Removed
- `gardeners` and `gardenOperators` storage **mappings** → reserved slots
- `addGardener()`, `removeGardener()`, `addGardenOperator()`, `removeGardenOperator()`
- Events: `GardenerAdded`, `GardenerRemoved`, `GardenOperatorAdded`, `GardenOperatorRemoved`
- Errors: `TooManyGardeners`, `TooManyOperators`, `HatsEnabled`
- Constants: `MAX_INIT_GARDENERS`, `MAX_INIT_OPERATORS`
- `_isHatsEnabled()`, `_requireLegacyRoles()`, legacy fallback branches
- `gardeners`/`gardenOperators` arrays from `InitParams`
- Legacy role event handlers in indexer
- `functionName` from frontend `GardenOperationConfigBase`

### What Gets Kept (Reworked)
- **`openJoining`** — stays as gate for self-join
- **`joinGarden()`** — reworked to call `hatsModule.grantRole()` instead of setting mapping
- **`setOpenJoining()`** — kept as-is
- **`OpenJoiningUpdated` event** — kept
- **`AlreadyGardener` / `InvalidInvite` errors** — kept
- **`useJoinGarden` hook** — remove Hats guard, keep rest
- **`useAutoJoinRootGarden` hook** — works as-is (ABI unchanged)
- **`openJoining` in schema/config** — kept

---

### Phase 1: Smart Contracts

#### 1A. HatsModule — Add garden self-management bypass
**File:** `packages/contracts/src/modules/Hats.sol`

Add `msg.sender == garden` to `_requireOwnerOrOperator()` (line 485):
```solidity
function _requireOwnerOrOperator(address garden) internal view {
    if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
    if (msg.sender == gardenToken) return;
    if (msg.sender == garden) return; // Garden can self-manage (for joinGarden)
    if (!isOwnerOf(garden, msg.sender) && !isOperatorOf(garden, msg.sender)) {
        revert NotGardenAdmin(msg.sender, garden);
    }
}
```

This is safe because the garden account already wears the admin hat (minted in `createGardenHatTree` line 281). It only enables the garden to call `grantRole`/`revokeRole` on itself — which it could already do via the Hats Protocol directly as admin.

#### 1B. IGardenAccount — Slim down InitParams
**File:** `packages/contracts/src/interfaces/IGardenAccount.sol`

Remove `gardeners` and `gardenOperators` from `InitParams` (keep `openJoining`):
```solidity
struct InitParams {
    address communityToken;
    string name;
    string description;
    string location;
    string bannerImage;
    string metadata;
    bool openJoining;
}
```

#### 1C. GardenAccount — Remove legacy mappings, rework joinGarden
**File:** `packages/contracts/src/accounts/Garden.sol`

**Add error:**
```solidity
error HatsModuleNotConfigured();
```

**Remove errors:** `TooManyGardeners`, `TooManyOperators`, `HatsEnabled`

**Remove constants:** `MAX_INIT_GARDENERS`, `MAX_INIT_OPERATORS`

**Remove events:** `GardenerAdded`, `GardenerRemoved`, `GardenOperatorAdded`, `GardenOperatorRemoved`

**Replace storage mappings with reserved slots** (lines 109-113):
```solidity
/// @dev Reserved for removed gardeners mapping (storage layout compat)
uint256 private __reserved_slot_gardeners;
/// @dev Reserved for removed gardenOperators mapping (storage layout compat)
uint256 private __reserved_slot_operators;
```
Gap stays `uint256[35]` — total slot count unchanged.

**Keep:** `openJoining` storage, `OpenJoiningUpdated` event, `setOpenJoining()`, `AlreadyGardener`, `InvalidInvite`

**Remove functions:**
- `addGardener()`, `removeGardener()` (lines 229-241)
- `addGardenOperator()`, `removeGardenOperator()` (lines 243-256)

**Remove internal helpers:**
- `_isHatsEnabled()` (line 362)
- `_requireLegacyRoles()` (line 366)

**Rework `joinGarden()`** (lines 258-265):
```solidity
/// @notice Join garden if open joining is enabled (grants gardener hat via Hats)
function joinGarden() external {
    if (!openJoining) revert InvalidInvite();
    IHatsModule hatsModule = _getHatsModule();
    if (hatsModule.isGardenerOf(address(this), _msgSender())) revert AlreadyGardener();
    hatsModule.grantRole(address(this), _msgSender(), IHatsModule.GardenRole.Gardener);
}
```

**Simplify `initialize()`:** Remove array length validation and the `if (!_isHatsEnabled())` block. Only set metadata + openJoining.

**Make `_getHatsModule()` revert on zero address:**
```solidity
function _getHatsModule() internal view returns (IHatsModule) {
    (, address tokenContract,) = token();
    if (tokenContract == address(0)) revert HatsModuleNotConfigured();
    try IGardenTokenModules(tokenContract).hatsModule() returns (IHatsModule module) {
        if (address(module) == address(0)) revert HatsModuleNotConfigured();
        return module;
    } catch {
        revert HatsModuleNotConfigured();
    }
}
```

**Simplify all role check functions** — Remove legacy fallback branches:
- `_isOwner()` → `return _getHatsModule().isOwnerOf(address(this), account);`
- `_isOperatorOrOwner()` → Always delegate to HatsModule
- `_isEvaluator()` → Always delegate to HatsModule
- `_isGardener()` → Always delegate to HatsModule
- `isFunder()` / `isCommunity()` → Remove zero-address guard (reverts now built into `_getHatsModule`)

**Update storage gap comment** to reflect reserved slots.

#### 1D. GardenToken — Remove redundant event data, require Hats
**File:** `packages/contracts/src/tokens/Garden.sol`

**Add error:** `error HatsModuleNotConfigured();`

**Remove from `GardenConfig` struct:** Nothing — keep `gardeners`, `gardenOperators`, `openJoining` (still needed for Hats grants and InitParams).

**Simplify `GardenMinted` event** — Remove `gardeners`, `operators` arrays (redundant with RoleGranted):
```solidity
event GardenMinted(
    uint256 indexed tokenId,
    address indexed account,
    string name,
    string description,
    string location,
    string bannerImage,
    bool openJoining
);
```

**Add Hats guard** to `mintGarden()` and `batchMintGardens()`:
```solidity
if (address(hatsModule) == address(0)) revert HatsModuleNotConfigured();
```

**Simplify `_initializeGardenModules()`:**
- Remove `if (address(hatsModule) != address(0))` conditional (always true now)
- Update `InitParams` construction to exclude `gardeners`/`gardenOperators`

#### 1E. IGardenAccessControl — Doc update only
**File:** `packages/contracts/src/interfaces/IGardenAccessControl.sol`
- Update doc comment: remove "legacy mappings (v1)" reference

---

### Phase 2: Contract Tests

#### 2A. `packages/contracts/test/integration/GardenAccessControl.t.sol`
- Update `InitParams` construction: remove `gardeners`, `gardenOperators` arrays

#### 2B. `packages/contracts/test/integration/GardenMinting.t.sol`
- Update `GardenMinted` event assertions (remove `gardeners`, `operators` params)

#### 2C. `packages/contracts/test/integration/HatsModule.t.sol` & `HatsGAPIntegration.t.sol`
- Update any `InitParams` or `GardenConfig` using removed fields

#### 2D. `packages/contracts/test/helpers/DeploymentBase.sol`
- Update `GardenConfig` and `InitParams` construction

#### 2E. `packages/contracts/test/unit/HatsModule.t.sol`
- Add test for garden self-management bypass (joinGarden flow)

#### 2F. `packages/contracts/script/Deploy.s.sol`
- Update `_parseGardenConfigFromJson()` if it includes removed fields

---

### Phase 3: Indexer

#### 3A. `packages/indexer/config.yaml`
- Update `GardenMinted` event signature (remove `gardeners`, `operators` arrays)
- Remove legacy events: `GardenerAdded`, `GardenerRemoved`, `GardenOperatorAdded`, `GardenOperatorRemoved`
- Keep `OpenJoiningUpdated`, `GAPProjectCreated`

#### 3B. `packages/indexer/src/EventHandlers.ts`
- Remove legacy type imports
- Update `GardenMinted` handler: init `gardeners: []`, `operators: []` (filled by `RoleGranted` events)
- Remove handlers: `GardenerAdded`, `GardenerRemoved`, `GardenOperatorAdded`, `GardenOperatorRemoved`
- Keep `OpenJoiningUpdated` and `GAPProjectCreated` handlers

#### 3C. `packages/indexer/test/test.ts`
- Remove legacy event tests
- Update `GardenMinted` mock events

---

### Phase 4: Frontend (Shared Package)

#### 4A. `packages/shared/src/hooks/garden/useJoinGarden.ts`
- **Remove Hats guard** (lines 203-206): Currently throws if Hats module exists. Invert to allow Hats gardens.
- `checkGardenOpenJoining()`: Remove the Hats module check (lines 55-58). Just read `openJoining` directly.
- Rest works as-is — `joinGarden()` ABI signature unchanged.

#### 4B. `packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts`
- **No changes needed** — calls `GardenAccount.joinGarden()` which keeps the same signature.

#### 4C. `packages/shared/src/hooks/garden/createGardenOperation.ts`
- Remove `functionName` from `GardenOperationConfigBase` interface (line 75)
- Remove legacy `functionName` values from `GARDEN_OPERATIONS` (lines 94, 99, 104, 109)
- Simplify `createGardenOperation()`: remove `useHatsModule` branching — always use HatsModule path
- Remove `GardenAccountABI` import

#### 4D. `packages/shared/src/stores/useCreateGardenStore.ts`
- No changes — `openJoining` stays in the form

#### 4E. `packages/shared/src/types/contracts.ts`
- Remove `gardeners` and `gardenOperators` from `CreateGardenParams` if they're no longer passed to GardenConfig (verify)

#### 4F. `packages/shared/src/utils/blockchain/garden-hats.ts`
- Keep `fetchHatsModuleAddress()` — still used for routing in createGardenOperation

#### 4G. `packages/shared/src/__tests__/hooks/useJoinGarden.test.ts`
- Update: remove tests for "returns false when Hats enabled"
- Add: test for Hats-enabled gardens being joinable

---

### Phase 5: Verification

```bash
# 1. Contracts
cd packages/contracts && bun build && bun test

# 2. Indexer
cd packages/indexer && bun build && bun test

# 3. Shared
cd packages/shared && bun test

# 4. Full workspace
bun format && bun lint && bun test && bun build
```

**Manual verification:**
- Storage layout: Confirm reserved slots maintain same positions as removed mappings
- joinGarden flow: Test that garden account can successfully grant gardener role via HatsModule
- HatsModule bypass: Verify `msg.sender == garden` only works for the garden itself, not arbitrary callers
