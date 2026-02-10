# Hats v2 Legacy Removal + Sepolia-First Cutover — Implementation Plan v2

> Updated from review in `.plans/hats-v2-implementation-review.md`.
> Base mainnet (8453) deferred to a follow-up. This plan targets Sepolia, Arbitrum, Celo only.

## Summary

Clean-break migration to Hats-only access control:
1. Remove all legacy role mappings, dual-mode branches, and v1 mutation methods from contracts.
2. Rewrite `joinGarden()` to mint gardener hat via HatsModule.
3. Update shared hooks to support Hats garden joining.
4. Update indexer event signatures and remove legacy event handlers.
5. Deploy with Sepolia gate enforcing validation before production broadcasts.

## Locked Decisions

1. Breaking changes acceptable — no backward compatibility layer.
2. Clean redeploy with new salt and new contract addresses.
3. GreenGoodsResolver centralization is **not** part of this plan.
4. Direct GAP callers preserved:
   - `GardenToken` → `createProject`
   - `WorkApprovalResolver` → `createImpact`
   - `AssessmentResolver` → `createMilestone`
5. `GardenAccount.joinGarden()` grants gardener hat via HatsModule.
6. Garden account receives its garden top hat for self-managed open joining.
7. Indexer updates required and in scope.
8. Sepolia mandatory before production (`arbitrum`, `celo`).
9. Base mainnet deferred — `HatsLib.isSupported()` unchanged, no `networks.json` or `foundry.toml` additions for 8453.

## Scope

**In scope:**
1. Contract legacy role removal → Hats-only role checks
2. HatsModule `_requireOwnerOrOperator` garden self-management bypass
3. Deployment pipeline Sepolia gate + clean redeploy salt
4. Shared hook/type updates for Hats-only join flow
5. Indexer event signature and handler updates
6. ABI regeneration and propagation to shared package
7. Tests across all affected packages

**Out of scope:**
1. GreenGoodsResolver module-centralization redesign
2. Base mainnet (8453) deployment and HatsLib chain support
3. Backfill/migration scripts for old deployments
4. Frontend redesign beyond Hats-only join behavior

---

## Already Complete (Do Not Reimplement)

These are verified as production-ready and need no changes:

| Component | Location |
|-----------|----------|
| HatsModule contract | `contracts/src/modules/Hats.sol` |
| IHatsModule interface | `contracts/src/interfaces/IHatsModule.sol` |
| HatsModule unit + integration tests | `contracts/test/unit/HatsModule.t.sol`, `contracts/test/integration/HatsModule.t.sol` |
| GardenToken hat tree creation on mint | `contracts/src/tokens/Garden.sol:261` |
| Indexer RoleGranted/RoleRevoked/PartialGrantFailed handlers | `indexer/src/EventHandlers.ts:688-878` |
| Indexer Hats tests | `indexer/test/test.ts:1179-1313` |
| Shared `fetchHatsModuleAddress()` | `shared/src/utils/blockchain/garden-hats.ts` |
| Shared `HATS_MODULE_ABI` | `shared/src/utils/blockchain/abis.ts` |
| Shared `GARDEN_ROLE_IDS` (6 roles) | `shared/src/utils/blockchain/garden-roles.ts` |
| Shared blockchain config hatsModule loading | `shared/src/config/blockchain.ts` |
| `configureGarden()` garden self-call | `contracts/src/modules/Hats.sol:370` (configuration context only) |

---

## Phase 1: Contracts — Hats-Only Access Control

### 1A: HatsModule — Garden Self-Management Bypass

**File:** `packages/contracts/src/modules/Hats.sol`

**Task:** Add `msg.sender == garden` to `_requireOwnerOrOperator()` (line 485-491).

Currently only `gardenToken` bypasses the owner/operator check. The garden account itself must also bypass to enable `joinGarden()` → `grantRole()` calls.

```solidity
// Current (line 485-491):
function _requireOwnerOrOperator(address garden) internal view {
    if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
    if (msg.sender == gardenToken) return;
    // MISSING: if (msg.sender == garden) return;
    if (!isOwnerOf(garden, msg.sender) && !isOperatorOf(garden, msg.sender)) {
        revert NotGardenAdmin(msg.sender, garden);
    }
}

// Target:
function _requireOwnerOrOperator(address garden) internal view {
    if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
    if (msg.sender == gardenToken) return;
    if (msg.sender == garden) return;   // <-- NEW: garden self-management
    if (!isOwnerOf(garden, msg.sender) && !isOperatorOf(garden, msg.sender)) {
        revert NotGardenAdmin(msg.sender, garden);
    }
}
```

**Acceptance:** Integration test where garden account calls `hatsModule.grantRole(address(this), joiner, GardenRole.Gardener)` succeeds.

---

### 1B: GardenAccount — Legacy Storage Removal

**File:** `packages/contracts/src/accounts/Garden.sol`

**Task:** Replace legacy storage mappings with reserved slots to preserve UUPS upgrade layout.

```
GardenAccount storage layout (10 slots):
  slot 0: communityToken
  slot 1: name
  slot 2: description
  slot 3: location
  slot 4: bannerImage
  slot 5: metadata
  slot 6: gardeners (mapping)      → REPLACE with uint256 __reservedSlot6
  slot 7: gardenOperators (mapping) → REPLACE with uint256 __reservedSlot7
  slot 8: openJoining
  slot 9: reserved (gapProjectUID)
  __gap[35] unchanged
```

**Remove these declarations** (lines 110-113):
```solidity
mapping(address gardener => bool isGardener) public gardeners;
mapping(address operator => bool isOperator) public gardenOperators;
```

**Replace with:**
```solidity
/// @dev Reserved slot — previously `gardeners` mapping. Do not reuse.
uint256 private __reservedSlot6;

/// @dev Reserved slot — previously `gardenOperators` mapping. Do not reuse.
uint256 private __reservedSlot7;
```

**Verify:** Update `test/StorageLayout.t.sol` to confirm gap remains 35 and slot positions unchanged.

---

### 1C: GardenAccount — Remove Legacy Methods + Helpers

**File:** `packages/contracts/src/accounts/Garden.sol`

**Remove these methods:**
- `addGardener()` (line 230)
- `removeGardener()` (line 237)
- `addGardenOperator()` (line 244)
- `removeGardenOperator()` (line 252)
- `_requireLegacyRoles()` (line 366)
- `_isHatsEnabled()` (line 362)

**Remove these events** (lines 66-84):
- `GardenerAdded`
- `GardenerRemoved`
- `GardenOperatorAdded`
- `GardenOperatorRemoved`

**Remove these errors** (lines 16-18):
- `TooManyGardeners`
- `TooManyOperators`
- `HatsEnabled`

**Remove these constants** (lines 21-24):
- `MAX_INIT_GARDENERS`
- `MAX_INIT_OPERATORS`

---

### 1D: GardenAccount — Remove Dual-Mode Branches

**File:** `packages/contracts/src/accounts/Garden.sol`

Replace all `_isHatsEnabled()` / `_getHatsModule()` branching with Hats-only paths:

**`initialize()`** (line 166): Remove `if (!_isHatsEnabled())` block and legacy array population. Simplify to only set scalar fields (communityToken, name, description, location, bannerImage, metadata, openJoining). Remove `params.gardeners` / `params.gardenOperators` usage.

**`_isOwner()`** (line 370): Remove zero-address branch. Hats-only:
```solidity
function _isOwner(address account) internal view returns (bool) {
    return _getHatsModule().isOwnerOf(address(this), account);
}
```

**`_isOperatorOrOwner()`** (line 378): Remove `gardenOperators[account]` fallback. Hats-only.

**`_isEvaluator()`** (line 386): Remove `gardenOperators[account]` fallback. Hats-only.

**`_isGardener()`** (line 396): Remove `gardeners[account]` fallback. Hats-only.

**`_getHatsModule()`** (line 340): Make hard-fail instead of returning zero address:
```solidity
function _getHatsModule() internal view returns (IHatsModule) {
    (, address tokenContract,) = token();
    if (tokenContract == address(0)) revert HatsModuleNotAvailable();
    IHatsModule module = IGardenTokenModules(tokenContract).hatsModule();
    if (address(module) == address(0)) revert HatsModuleNotAvailable();
    return module;
}
```

Add new error: `error HatsModuleNotAvailable();`

---

### 1E: GardenAccount — Rewrite `joinGarden()`

**File:** `packages/contracts/src/accounts/Garden.sol`

Replace current implementation (line 259-265) that uses legacy mappings:

```solidity
/// @notice Join garden if open joining is enabled
/// @dev Grants gardener hat via HatsModule
function joinGarden() external {
    if (!openJoining) revert InvalidInvite();

    IHatsModule hatsModule = _getHatsModule();
    if (hatsModule.isGardenerOf(address(this), _msgSender())) revert AlreadyGardener();

    hatsModule.grantRole(address(this), _msgSender(), IHatsModule.GardenRole.Gardener);
}
```

**Dependencies:** Requires Phase 1A (`_requireOwnerOrOperator` garden bypass) to be complete first.

---

### 1F: Interfaces — Slim InitParams + Event + Struct

**Files:**
- `packages/contracts/src/interfaces/IGardenAccount.sol`
- `packages/contracts/src/tokens/Garden.sol`

**IGardenAccount.InitParams** — Remove `gardeners` and `gardenOperators` fields:
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

**GardenToken.GardenMinted event** (lines 36-46) — Remove arrays:
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

**GardenToken.GardenConfig struct** (lines 55-65) — Remove arrays:
```solidity
struct GardenConfig {
    address communityToken;
    string name;
    string description;
    string location;
    string bannerImage;
    string metadata;
    bool openJoining;
}
```

Update all `emit GardenMinted(...)` calls and `_initializeGardenModules()` to match slimmed signatures.

---

### 1G: IGardenAccessControl — Update Docs

**File:** `packages/contracts/src/interfaces/IGardenAccessControl.sol`

Update NatSpec line 8: Replace "HatsModule (v2) or legacy mappings (v1)" with "HatsModule". Remove all v1 references.

---

### 1H: Contract Tests

**Files to update:**

| File | Changes |
|------|---------|
| `test/integration/GardenAccessControl.t.sol` | Remove legacy dual-mode test paths |
| `test/integration/GardenMinting.t.sol` | Update for slimmed InitParams, GardenMinted event, GardenConfig struct |
| `test/integration/HatsModule.t.sol` | Add garden self-management bypass test for `joinGarden()` flow |
| `test/unit/WorkResolver.t.sol` | Verify role checks still work with Hats-only |
| `test/unit/WorkApprovalResolver.t.sol` | Same |
| `test/unit/AssessmentResolver.t.sol` | Same |
| `test/StorageLayout.t.sol` | Update for reserved slots, verify gap=35 unchanged |
| `test/FuzzTests.t.sol` | Update for removed parameters |
| `test/helpers/DeploymentBase.sol` | Update InitParams construction |

**New integration tests to add:**
- `joinGarden()` succeeds for open Hats garden
- `joinGarden()` reverts for closed garden (`InvalidInvite`)
- `joinGarden()` reverts for already-gardener (`AlreadyGardener`)
- `joinGarden()` reverts when HatsModule not configured (`HatsModuleNotAvailable`)
- Garden mint reverts when HatsModule not set

**Run:** `forge build && forge test` — all must pass.

---

## Phase 2: Resolver Boundary Verification (No Code Changes)

**Files to verify** (read-only):
- `packages/contracts/src/resolvers/WorkApproval.sol`
- `packages/contracts/src/resolvers/Assessment.sol`
- `packages/contracts/src/resolvers/GreenGoods.sol`
- `packages/contracts/src/modules/Karma.sol`

**Verify:**
1. GAP callers are unchanged (direct-call architecture preserved).
2. Role checks use `IGardenAccessControl` interface (resolves to Hats-only after Phase 1).
3. No new `onGardenCreated` router introduced.

---

## Phase 3: ABI Sync

After contract changes compile:

1. Run `forge build` — regenerates ABIs in `packages/contracts/out/`.
2. Check if `GardenAccountABI` in `packages/shared/src/utils/blockchain/contracts.ts` needs updating (it imports from `contracts/out/`).
3. Check if `HATS_MODULE_ABI` in `packages/shared/src/utils/blockchain/abis.ts` needs updating.
4. Run root `bun build` to propagate changes across workspace.

---

## Phase 4: Deployment Infrastructure

### 4A: Sepolia Release Gate

**New file:** `packages/contracts/script/utils/release-gate.ts`

Schema for `deployments/validation/sepolia-checkpoint.json`:
```typescript
interface SepoliaCheckpoint {
  commitHash: string;        // git HEAD at time of Sepolia deploy
  timestamp: string;         // ISO 8601
  operation: "deploy" | "upgrade";
  deploymentHash: string;    // hash of deployment artifact
  smokeResults: {
    contractsBytecodeVerified: boolean;
    schemaUIDsNonZero: boolean;
    requiredFieldsPresent: boolean;
  };
}
```

**Freshness default:** 7 days + commit-hash bound.

### 4B: Gate Enforcement

**Files:** `packages/contracts/script/deploy/core.ts`, `packages/contracts/script/upgrade.ts`

Before production broadcast to `arbitrum` or `celo`:
1. Read Sepolia checkpoint.
2. Validate commit hash matches current HEAD.
3. Validate timestamp within freshness window.
4. Block if validation fails, unless `--override-sepolia-gate` flag is set.

### 4C: CLI + Scripts

**File:** `packages/contracts/script/deploy/cli-parser.ts`

Add `--override-sepolia-gate` flag.

**File:** `packages/contracts/package.json`

- Remove: `deploy:mainnet`, `deploy:dry:mainnet`, `upgrade:mainnet`, `upgrade:dry:mainnet`
- Keep: all `sepolia`, `arbitrum`, `celo` variants
- Keep: `deploy:testnet` → Sepolia alias

### 4D: Salt Configuration

Ensure configurable deployment salt in TS + Solidity deploy pipeline for clean redeploy with new deterministic addresses.

---

## Phase 5: Shared Package Updates

### 5A: `useJoinGarden` — Remove Hats Rejection

**File:** `packages/shared/src/hooks/garden/useJoinGarden.ts`

**`checkGardenOpenJoining()`** (lines 53-79): Remove Hats rejection. The function currently returns `false` for any garden with a HatsModule. After contract rewrite, Hats gardens with `openJoining=true` should return `true`:

```typescript
// Remove lines 55-58:
const hatsModule = await fetchHatsModuleAddress(gardenAddress as `0x${string}`);
if (hatsModule) {
  return false;
}

// Keep the openJoining contract read — it works for both v1 and Hats gardens
```

**`joinGarden()` callback** (lines 203-206): Remove the Hats rejection block:
```typescript
// Remove lines 203-206:
const hatsModule = await fetchHatsModuleAddress(gardenAddress as `0x${string}`);
if (hatsModule) {
  throw new Error(formatMessage({ id: "app.garden.openJoiningUnavailable" }));
}
```

### 5B: `createGardenOperation` — Remove v1 Dead Code

**File:** `packages/shared/src/hooks/garden/createGardenOperation.ts`

After legacy removal, simplify to Hats-only:

1. Remove `functionName` from `GardenOperationConfigBase` interface (line 75).
2. Remove `functionName` values from `GARDEN_OPERATIONS` entries (lines 93-112 — `addGardener`, `removeGardener`, `addOperator`, `removeOperator`).
3. Simplify execution path (lines 228-246): Remove the `!useHatsModule` branch and `UnsupportedRole` error. All operations route through HatsModule `grantRole`/`revokeRole`.
4. Remove `unsupportedRoleMessage` from `GardenOperationConfig`.

### 5C: Shared Types

**File:** `packages/shared/src/types/contracts.ts`

Update `CreateGardenParams` to match slimmed `InitParams` — remove `gardeners` and `gardenOperators` array fields if present.

### 5D: Shared Tests

**File:** `packages/shared/src/__tests__/hooks/useJoinGarden.test.ts`

- Update tests to verify Hats-enabled gardens **can** be joined (reverse current assertions).
- Add test: `checkGardenOpenJoining` returns `true` for Hats garden with `openJoining=true`.
- Remove any test that asserts Hats gardens are rejected.

**Run:** `bun --filter shared test`

---

## Phase 6: Indexer Updates

### 6A: `GardenMinted` Event Signature

**File:** `packages/indexer/config.yaml`

Update `GardenMinted` ABI to match slimmed event (no `gardeners`/`operators` arrays).

**File:** `packages/indexer/src/EventHandlers.ts`

Update `GardenMinted` handler to not reference `gardeners` or `operators` from event payload.

### 6B: Remove Legacy Event Handlers

**Files:** `packages/indexer/config.yaml`, `packages/indexer/src/EventHandlers.ts`

Remove handlers and ABI entries for:
- `GardenerAdded`
- `GardenerRemoved`
- `GardenOperatorAdded`
- `GardenOperatorRemoved`

All role state is now sourced from `RoleGranted`/`RoleRevoked` events (already implemented).

### 6C: Update Start Blocks

**File:** `packages/indexer/config.yaml`

After deployment (Phase 7), update `start_block` values for all chains to post-migration deployment blocks. This ensures the indexer doesn't encounter legacy events from old contracts at pre-migration blocks.

### 6D: Update HatsModule Addresses

**File:** `packages/indexer/config.yaml`

After deployment, replace zero-address placeholders with actual deployed HatsModule addresses.

### 6E: Indexer Tests

**File:** `packages/indexer/test/test.ts`

- Update `GardenMinted` event test fixtures for new payload shape.
- Remove tests for legacy role events.
- Add regression test confirming role projections come from `RoleGranted`/`RoleRevoked` only.

**Run:** `bun --filter indexer test`

---

## Phase 7: Deploy + Validate

### 7.1: Sepolia Deployment
```bash
bun script/deploy.ts core --network sepolia --broadcast
```
- Verify all contracts deploy with new salt.
- Write Sepolia checkpoint to `deployments/validation/sepolia-checkpoint.json`.
- Verify indexer processes events from new addresses.

### 7.2: Production Deployments
```bash
bun script/deploy.ts core --network arbitrum --broadcast
bun script/deploy.ts core --network celo --broadcast
```
- Gate enforces valid Sepolia checkpoint.
- Verify new addresses differ from previous deployment artifacts.
- Update indexer config.yaml with deployed addresses and start blocks.

### 7.3: Base Mainnet — DEFERRED
Requires separate follow-up:
- Create Green Goods hat tree on Base via Hats Protocol
- Add 8453 constants to `HatsLib`
- Add `base` to `networks.json`, `foundry.toml`, package.json scripts
- Add `8453` deployment config to shared `blockchain.ts`

---

## Rollout Order

| Step | Phase | Depends On | Validation |
|------|-------|------------|------------|
| 1 | 1A: HatsModule garden bypass | — | Integration test |
| 2 | 1B-1D: Legacy removal + branches | 1A | `forge build` + StorageLayout |
| 3 | 1E: `joinGarden()` rewrite | 1A, 1B-1D | Join path integration tests |
| 4 | 1F: InitParams/event/struct slimming | 1C | `forge build` |
| 5 | 1G-1H: Docs + all contract tests | 1A-1F | `forge test` — all pass |
| 6 | 2: Resolver verification | 1 | Read-only check |
| 7 | 3: ABI sync | 5 | `bun build` from root |
| 8 | 4: Deployment infrastructure | — (parallel with 1-6) | Gate dry-run test |
| 9 | 5: Shared package updates | 7 | `bun --filter shared test` |
| 10 | 6A-6B: Indexer event updates | 7 | `bun --filter indexer test` |
| 11 | 7.1: Sepolia deployment | 5, 8 | Checkpoint created |
| 12 | 6C-6D: Indexer addresses + start blocks | 11 | Indexer processes events |
| 13 | 7.2: Production deployments | 11, 12 | Gate validates checkpoint |

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Auth regression from legacy removal | HIGH | Role-check tests for every gated action in contracts |
| R2 | Event/indexer drift after payload change | HIGH | ABI sync step + indexer regression fixtures before deploy |
| R3 | Deployment scripts reusing old addresses | MEDIUM | Explicit salt + assert addresses differ from artifacts |
| R4 | `_requireOwnerOrOperator` missing garden bypass → `joinGarden()` reverts | HIGH | Phase 1A + dedicated integration test |
| R5 | Storage slot corruption on UUPS upgrade | HIGH | Reserved slots at exact offsets 6,7 + `StorageLayout.t.sol` verification |
| R6 | `GardenConfig` struct out of sync with `InitParams` | MEDIUM | Change all three (InitParams, GardenConfig, GardenMinted) in lockstep |
| R7 | Indexer historical data loss from removed handlers | MEDIUM | Update start_blocks to post-migration deployment blocks |

---

## Verification Checklist

```bash
# Contract compilation + tests
cd packages/contracts && forge build && forge test

# Storage layout specifically
forge test --match-contract StorageLayout

# Shared package
cd packages/shared && bun test && bun build

# Indexer
cd packages/indexer && bun test && bun build

# Full workspace
bun format && bun lint && bun test && bun build
```

**Integration assertions:**
- [ ] `joinGarden()` succeeds for open Hats garden
- [ ] `joinGarden()` reverts for closed garden (`InvalidInvite`)
- [ ] `joinGarden()` reverts for already-gardener (`AlreadyGardener`)
- [ ] `joinGarden()` reverts when HatsModule not configured (`HatsModuleNotAvailable`)
- [ ] Garden mint path requires HatsModule
- [ ] Storage layout matches pre-migration slot positions (gap=35)
- [ ] All role checks (owner, operator, evaluator, gardener) work Hats-only
- [ ] Sepolia gate blocks production deploy without checkpoint
- [ ] `--override-sepolia-gate` bypasses gate
- [ ] Indexer processes new `GardenMinted` event shape
- [ ] `checkGardenOpenJoining` returns `true` for Hats garden with openJoining=true
- [ ] `createGardenOperation` routes all operations through HatsModule

## Definition of Done

1. Contracts compile with zero legacy role mappings/functions — Hats-only role checks.
2. `joinGarden()` mints gardener hat via HatsModule for open gardens.
3. Shared join flow works for Hats gardens (no rejection).
4. Indexer ingests updated events and maintains correct role projections from `RoleGranted`/`RoleRevoked`.
5. Deployment scripts enforce Sepolia gate for production, support clean redeploy salt.
6. Full validation passes: `bun format && bun lint && bun test && bun build` + `forge test`.
