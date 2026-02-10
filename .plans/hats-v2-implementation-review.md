# Deep Review: Hats v2 Sepolia-First Cutover Implementation Plan

## Context

This is a **readiness review** of `.plans/hats-v2-sepolia-cutover-implementation-plan.md` — the unified plan for legacy role removal, Hats-only access control, and deployment cutover.

**Decision**: Base mainnet (8453) is **deferred**. This implementation targets existing chains only: Sepolia, Arbitrum, Celo. Base mainnet support (HatsLib constants, networks.json entry, foundry.toml profile) will be a separate follow-up.

The review cross-references every plan claim against the actual codebase state to produce:
1. A gap analysis (what's done, what's missing, what the plan gets wrong)
2. Required amendments before implementation can begin
3. A corrected rollout sequence

---

## Plan Accuracy: 72/100

The plan is structurally sound and correctly identifies the major workstreams. However, it has significant blind spots about what is already implemented and misses several critical blockers.

---

## 1. Already Done (Plan Proposes as Future Work)

These items are complete and should be marked as such to avoid duplicate work:

| Item | Evidence |
|------|----------|
| HatsModule contract | `src/modules/Hats.sol` — full implementation with role hierarchy, eligibility modules, KarmaGAP sync |
| IHatsModule interface | `src/interfaces/IHatsModule.sol` — complete with GardenRole enum |
| HatsModule tests | `test/unit/HatsModule.t.sol` + `test/integration/HatsModule.t.sol` |
| GardenToken Hats tree creation during mint | `src/tokens/Garden.sol:261` — calls `hatsModule.createGardenHatTree()` |
| Indexer Hats event handlers | `EventHandlers.ts:688-878` — RoleGranted, RoleRevoked, GardenHatTreeCreated, PartialGrantFailed fully working |
| Indexer Hats tests | `test/test.ts:1179-1313` — all 6 role arrays tested |
| Shared `fetchHatsModuleAddress()` | `utils/blockchain/garden-hats.ts` — complete |
| Shared `HATS_MODULE_ABI` | `utils/blockchain/abis.ts` — grantRole/revokeRole/isConfigured |
| Shared `GARDEN_ROLE_IDS` | `utils/blockchain/garden-roles.ts` — all 6 roles mapped |
| Shared blockchain config loads hatsModule | `config/blockchain.ts` — reads from deployment JSONs |
| createGardenOperation Hats branching | `createGardenOperation.ts:224-246` — detects HatsModule, routes to grantRole/revokeRole |
| `configureGarden()` allows garden self-call | `Hats.sol:370` — `msg.sender == garden` check exists for **configuration** |

---

## 2. Confirmed Gaps (Plan Correctly Identifies)

### Workstream A: GardenAccount Legacy Removal

All of these remain and need removal:

- **Storage mappings**: `gardeners` (line 110) and `gardenOperators` (line 113) — must become reserved slots
- **Mutation methods**: `addGardener()` :230, `removeGardener()` :237, `addGardenOperator()` :244, `removeGardenOperator()` :252
- **Dual-mode branches**: `_isHatsEnabled()` branching in `initialize()`, `_isOwner()`, `_isOperatorOrOwner()`, `_isEvaluator()`, `_isGardener()`
- **`joinGarden()`**: Calls `_requireLegacyRoles()` at line 260 — reverts for all Hats gardens
- **`_getHatsModule()`**: Soft-fails (returns zero address) instead of hard-failing
- **Legacy events**: `GardenerAdded/Removed`, `GardenOperatorAdded/Removed` (lines 67-84)
- **Legacy errors**: `TooManyGardeners`, `TooManyOperators`, `HatsEnabled`
- **Legacy constants**: `MAX_INIT_GARDENERS=50`, `MAX_INIT_OPERATORS=20`

### Interfaces

- **`IGardenAccount.InitParams`** (lines 17-27): Still has `gardeners` and `gardenOperators` fields
- **`GardenToken.GardenMinted`** event (lines 36-46): Still has `address[] gardeners, address[] operators`
- **`GardenToken.GardenConfig`** struct (lines 55-65): Still has `gardeners` and `gardenOperators`

### Shared Package

- **`useJoinGarden`** (lines 203-206): Throws error for Hats-enabled gardens
- **`checkGardenOpenJoining`** (lines 55-58): Returns `false` for all Hats gardens

### Deployment Infrastructure

- No release gate, checkpoint file, or `--override-sepolia-gate` flag
- `deploy:mainnet` still exists (ambiguous)
- ~~`networks.json`/`foundry.toml` missing Base~~ — DEFERRED

---

## 3. CRITICAL Missing Gaps (Plan Does NOT Address)

### ~~Gap 1: HatsLib has no Base mainnet (8453) support~~ — DEFERRED

Base mainnet deployment is deferred to a follow-up. No changes to `src/lib/Hats.sol` `isSupported()` needed for this implementation. Existing chains (Arbitrum 42161, Celo 42220, Sepolia 11155111) are all supported.

### Gap 1 (BLOCKER): `_requireOwnerOrOperator` does NOT allow garden self-management

**File**: `packages/contracts/src/modules/Hats.sol:485-491`

```solidity
function _requireOwnerOrOperator(address garden) internal view {
    if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
    if (msg.sender == gardenToken) return;   // <-- only gardenToken bypasses
    if (!isOwnerOf(garden, msg.sender) && !isOperatorOf(garden, msg.sender)) {
        revert NotGardenAdmin(msg.sender, garden);
    }
}
```

The plan says "allow garden self-management by accepting `msg.sender == garden`" — **this is NOT done in `_requireOwnerOrOperator()`**. The `configureGarden()` function (line 370) has this check, but `_requireOwnerOrOperator()` (used by `grantRole`/`revokeRole`) does not. Without this fix, the rewritten `joinGarden()` calling `hatsModule.grantRole(address(this), joiner, GardenRole.Gardener)` would revert with `NotGardenAdmin`.

### Gap 2: ABI regeneration pipeline not mentioned

After contract interface changes, `forge build` must regenerate ABIs, and `packages/shared/src/utils/blockchain/abis.ts` + `contracts.ts` must be updated. The plan has no step for this.

### Gap 3: `createGardenOperation` dead code after legacy removal

After v1 removal, the entire non-Hats branch (lines 228-246), `functionName` type field, and `GARDEN_OPERATIONS` entries with legacy function names (`addGardener`, `removeGardener`, etc.) become dead code. Plan doesn't mention cleanup.

### Gap 4: Storage layout slot numbers not specified

Plan says "replace with reserved slots" but doesn't specify: `gardeners` is at slot offset 6, `gardenOperators` at slot offset 7. Must be replaced with `uint256 private __reservedSlotX` at those exact positions. `StorageLayout.t.sol` must be updated to verify.

### Gap 5: `GardenToken.GardenConfig` struct not mentioned

Plan addresses `InitParams` and `GardenMinted` event but not the `GardenConfig` struct (lines 55-65) which also has `gardeners` and `gardenOperators`. All three must change in lockstep.

### Gap 6: `checkGardenOpenJoining` utility not mentioned

Plan mentions the `joinGarden` mutation but not the exported `checkGardenOpenJoining()` function (lines 53-79) which independently rejects Hats gardens and is used by UI components.

### Gap 7: Indexer historical data decision

Removing legacy event handlers while indexer starts from pre-migration blocks would silently drop historical role data. Since this is a clean-break migration with new addresses, start_blocks must be updated to post-migration deployment blocks. Plan doesn't state this.

### ~~Gap 9: Shared `blockchain.ts` has no 8453 config~~ — DEFERRED

Base mainnet config deferred with the rest of the Base mainnet work.

### Gap 8: Specific test files not enumerated

Plan says "update integration tests" generically. Specific files needing changes:
- `test/integration/GardenAccessControl.t.sol`
- `test/integration/GardenMinting.t.sol`
- `test/unit/WorkResolver.t.sol`
- `test/unit/WorkApprovalResolver.t.sol`
- `test/unit/AssessmentResolver.t.sol`
- `test/StorageLayout.t.sol`
- `test/FuzzTests.t.sol`

---

## 4. Corrected Rollout Sequence

The plan's current order (A → B → C → D → E) has dependency issues. Corrected:

### Phase 1: Contract Changes (Workstream A + A1 fix)

1. Add `if (msg.sender == garden) return;` to `_requireOwnerOrOperator()` in `Hats.sol`
2. Remove legacy storage → reserved slots (exact offsets 6 and 7)
3. Remove legacy methods, events, errors, constants from `GardenAccount`
4. Remove dual-mode branches from all role check functions
5. Rewrite `joinGarden()` to grant gardener hat via HatsModule
6. Make `_getHatsModule()` hard-fail
7. Slim `InitParams`, `GardenConfig` struct, `GardenMinted` event
8. Run `forge build` → verify storage layout → run all tests

### Phase 2: Workstream B (Resolver Boundary Verification)

- Verify GAP callers unchanged — no code changes expected

### Phase 3: ABI Sync (implicit step, plan must add)

- `forge build` regenerates ABIs in `packages/contracts/out/`
- Update `packages/shared/src/utils/blockchain/abis.ts` if interfaces changed
- Root `bun build` to propagate

### Phase 4: Deployment Infrastructure (Workstream C — scoped to existing chains)

- Build release gate utility + Sepolia checkpoint
- Remove ambiguous `deploy:mainnet` aliases
- Add `--override-sepolia-gate` flag
- ~~Base network config~~ — DEFERRED

### Phase 5: Shared Package (Workstream D)

- Remove Hats rejection from `useJoinGarden` AND `checkGardenOpenJoining`
- Clean `createGardenOperation` dead v1 code paths
- Update types for slimmed InitParams/events

### Phase 6: Indexer (Workstream E)

- Update `GardenMinted` ABI/event signature
- Remove legacy event handlers
- Update start_blocks to post-migration deployment blocks
- Update config.yaml HatsModule addresses from deployment artifacts

### Phase 7: Deploy + Validate
- Sepolia deployment → checkpoint creation
- Production deployments (arbitrum, celo) with new salt
- ~~Base deployment~~ — DEFERRED

---

## 5. Updated Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Auth regression from legacy removal | HIGH | Explicit role-check tests for every gated action |
| R2 | Event/indexer drift after payload change | HIGH | Update ABI signatures + regression fixtures before deploy |
| R3 | Deployment scripts reusing old addresses | MEDIUM | Enforce explicit salt + assert addresses differ |
| ~~R4~~ | ~~Base Hats env misconfiguration~~ | ~~MEDIUM~~ | ~~DEFERRED with Base~~ |
| ~~R5~~ | ~~HatsLib missing 8453~~ | ~~CRITICAL~~ | ~~DEFERRED with Base~~ |
| **R6** | **`_requireOwnerOrOperator` missing garden bypass — `joinGarden()` reverts** | **HIGH** | **Add `msg.sender == garden` + integration test** |
| **R7** | **Indexer historical data loss from removed handlers** | **MEDIUM** | **Update start_blocks to post-migration blocks** |
| **R8** | **Storage slot corruption on upgrade** | **HIGH** | **Use exact reserved slot offsets 6,7 + StorageLayout.t.sol** |
| **R9** | **GardenConfig struct out of sync with InitParams** | **MEDIUM** | **Change all three (InitParams, GardenConfig, GardenMinted) together** |

---

## 6. Required Amendments Before Implementation

1. ~~**Add Phase 0**: HatsLib Base mainnet (8453) support~~ — DEFERRED
2. **Fix Workstream A Task 1**: Clarify `_requireOwnerOrOperator` needs `msg.sender == garden` (NOT already done)
3. **Add ABI regeneration step** between contract changes and shared/indexer updates
4. **Add `GardenConfig` struct** to Workstream A Task 4 file list
5. **Add `checkGardenOpenJoining`** to Workstream D Task 1
6. **Add storage slot numbers** (offsets 6, 7) to Workstream A Task 3
7. **Add `createGardenOperation` v1 dead code cleanup** to Workstream D
8. ~~**Add `8453` deployment config** to Workstream D~~ — DEFERRED
9. **Add indexer start_block updates** to Workstream E
10. **Enumerate specific test files** in Testing Plan

---

## 7. Verification Plan

After all workstreams complete:

```bash
# Contracts
cd packages/contracts && forge build && forge test

# Storage layout check
forge test --match-contract StorageLayout

# Shared package
cd packages/shared && bun test && bun build

# Indexer
cd packages/indexer && bun test && bun build

# Full workspace
cd /project-root && bun format && bun lint && bun test && bun build
```

Integration checks:
- [ ] `joinGarden()` succeeds for open Hats garden (new integration test)
- [ ] `joinGarden()` reverts for closed garden
- [ ] `joinGarden()` reverts for already-gardener
- [ ] Garden mint path reverts without HatsModule configured
- [ ] Storage layout matches pre-migration slot positions
- [ ] Sepolia gate blocks production deploy without checkpoint
- [ ] `--override-sepolia-gate` bypasses gate
- [ ] Indexer processes new `GardenMinted` event shape correctly

---

## Summary

The plan is **well-structured and ~72% accurate**. The Hats v2 foundation is solid — the module, indexer handlers, and shared utilities are production-ready. The remaining work is the legacy removal itself (the breaking change), which is 0% done.

**One critical blocker** the plan misses:
- `_requireOwnerOrOperator` needs `msg.sender == garden` bypass for `joinGarden()` to work

**Base mainnet (8453) deferred** — eliminates the HatsLib chain support blocker and deployment config gaps, narrowing scope to existing chains (Sepolia, Arbitrum, Celo).

With the 7 active amendments above applied (3 deferred with Base), the plan is ready for implementation.
