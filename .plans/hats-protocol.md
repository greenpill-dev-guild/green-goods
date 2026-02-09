# Hats Protocol Integration Spec

**Status**: Ready for implementation
**Timeline**: ASAP (1-1.5 weeks)
**Scope**: New v2 deployments only (v1 gardens remain unchanged)

> **Note**: This is the consolidated spec merging all previous Hats plans with confirmed decisions from alignment review.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Role system | **Full replacement** | Remove native mappings, all gardens use Hats |
| Role types | **All 6 roles** | Owner, Operator, Evaluator, Gardener, Funder, Community |
| Hierarchy | **On-chain via Hats tree** | Owner > Operator > Evaluator > Gardener |
| Top hat governance | **Team multisig** | Delegates garden creation to GardenToken |
| GAP integration | **Required - separate module** | KarmaGAPModule extracted from GardenAccount |
| Eligibility modules | **Use existing Hats modules** | AllowlistEligibility, ERC20Eligibility |
| Migration | **Parallel v1/v2** | v1 feature-frozen, v2 for new gardens with Hats |
| Frontend UX | **Abstract "Hats" away** | Users see "Roles" terminology |
| Testing | **Full E2E required** | Mock + fork + frontend tests |
| Implementation order | **Contracts first, then frontend** | Complete backend before UI |

---

## Confirmed Decisions (From Alignment Review)

### Core Decisions
1. **Eligibility modules**: Deploy now with AllowlistEligibility + ERC20Eligibility
2. **Frontend priority**: Same sprint (complete integration)
3. **Base Sepolia tree**: Dev creates for testing
4. **Existing tests**: Delete `HatsModule.t.sol.skip` (stale)

### Architecture Decisions
5. **Version detection**: Version-keyed deployment JSON files (`84532-v1.json`, `84532-v2.json`)
   - Don't overwrite previous deployments
   - Frontend picks version dynamically
6. **Role inheritance**: Operator = separate hat, also gets Evaluator + Gardener (best-effort)
7. **Funder ACL**: Owner + Operator can manage AllowlistEligibility
8. **GAP errors**: Graceful degradation (emit event, don't revert)
9. **Community token**: Configurable per garden (owner specifies ERC20)

### Role Grant/Revoke Semantics
10. **Operator sub-grants**: Best-effort - emit `PartialGrantFailed` if sub-grant fails
11. **Revoke granularity**: Individual control per role
12. **Funder allowlist**: Empty on creation

---

## Role Hierarchy (On-Chain)

```
Green Goods Top Hat (Team Multisig)
└── Gardens Hat (GardenToken as admin)
    └── Garden Admin Hat (per garden)
        ├── Owner Hat ──────────────────────┐
        │   └── Operator Hat ───────────────┤ (inherits all below)
        │       ├── Evaluator Hat ←─────────┘
        │       │   (work approval + assessments, PARALLEL to Gardener)
        │       └── Gardener Hat
        │           (work submission)
        ├── Funder Hat (AllowlistEligibility module)
        └── Community Hat (ERC20Eligibility module)
```

**Key Design Decisions:**
- **Evaluator has dual-path inheritance** - Can be granted independently OR inherited via Operator
- **Evaluator without Gardener** - Evaluators cannot submit work unless also granted Gardener separately
- **Operator inherits Evaluator + Gardener** - Can do everything except garden management
- **Owner inherits all** - Full control
- **Multiple hats allowed** - A user can hold Gardener + Evaluator simultaneously
- **Initial roles on mint**: Owner (NFT minter) + Operator(s) from config
- **Owner assignment**: NFT minter (`_msgSender()`) receives Owner role
- **Operator requirement**: At least one operator required; revert if `gardenOperators` is empty

**Permissions by Role:**
| Role | Submit Work | Approve Work | Create Assessment | Manage Roles | Manage Garden |
|------|-------------|--------------|-------------------|--------------|---------------|
| Gardener | ✅ | ❌ | ❌ | ❌ | ❌ |
| Evaluator | ❌ | ✅ | ✅ | ❌ | ❌ |
| Operator | ✅ (inherits) | ✅ (inherits) | ✅ (inherits) | ✅ | ❌ |
| Owner | ✅ (inherits) | ✅ (inherits) | ✅ (inherits) | ✅ (inherits) | ✅ |
| Funder | ❌ | ❌ | ❌ | ❌ | ❌ (funding only) |
| Community | ❌ | ❌ | ❌ | ❌ | ❌ (view/participate) |

**Eligibility Module Configuration:**
- **Funder (AllowlistEligibility)**: Owner OR Operator can add addresses to allowlist
- **Community (ERC20Eligibility)**: Token is configurable per garden (garden owner specifies)

**GAP Integration Rules:**
- Impacts/milestones created in **same transaction** as assessment/approval
- If GAP attestation fails, **graceful degradation** - emit `GAPAttestationFailed` event, work approval succeeds
- Work is valid if submitter was Gardener at **submission time only** (role revocation doesn't invalidate pending work)

**v1/v2 Parallel Deployment Strategy:**
- **v1 GardenToken**: Remains operational, feature-frozen, no Hats integration
- **v2 GardenToken**: Fresh deploy, Hats integration, all new features
- **v1 gardens**: Continue working with native role mappings
- **v2 gardens**: New TBAs, Hats roles, GAP integration
- **Hats is v2 only**: v1 gardens cannot opt-in to Hats
- **Few production gardens**: Manageable, no forced migration

**Frontend Implications:**
- App detects garden version (v1 vs v2)
- v1 gardens: Use legacy role hooks
- v2 gardens: Use new Hats role hooks
- Simple role assignment UI (hide Hats complexity)
- Hide unavailable actions based on role

---

## Current State

| Component | Status | Tests |
|-----------|--------|-------|
| HatsModule (adapter) | ✅ Complete | 24 passing |
| HatsLib (constants) | ✅ Complete | Used in tests |
| MockHats | ✅ Complete | Full mock support |
| GardenToken integration | ❌ Not started | Phase 4 |
| Resolver updates | ❌ Not started | Phase 5 |
| Frontend hooks | ❌ Not started | No tests |
| Base Sepolia deployment | ❌ Placeholder zeros | Needs hat tree |

---

## 1. Current Implementation Status

### Completed Work (Phases 1-2)

**HatsModule Contract** ([src/modules/Hats.sol](packages/contracts/src/modules/Hats.sol))
- Implements `IGardenAccessControl` interface
- Garden configuration with three hat IDs (gardener, operator, owner)
- Role checks via `isWearerOfHat()`
- Config authority system for deployer/GardenToken authorization
- UUPS upgradeable pattern
- 277 lines, well-documented

**HatsLib Constants** ([src/lib/Hats.sol](packages/contracts/src/lib/Hats.sol))
- Hats Protocol address: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- Arbitrum mainnet: Tree 92 configured with real hat IDs
- Base Sepolia: **Placeholder zeros** (needs deployment)

**Supporting Infrastructure**
- `IHats` interface (235 lines)
- `IGardenAccessControl` interface (32 lines)
- `MockHats` for testing (456 lines)
- Integration plan doc (433 lines)

### Incomplete Work (Phases 3-6)

Per [HATS_GAP_INTEGRATION_PLAN.md](packages/contracts/docs/HATS_GAP_INTEGRATION_PLAN.md):

| Phase | Description | Files | Status |
|-------|-------------|-------|--------|
| 3 | GardenToken integration | `src/tokens/Garden.sol` | ❌ |
| 4 | Resolver updates | 3 resolver files | ❌ |
| 5 | GardenAccount slimdown | `src/accounts/Garden.sol` | ❌ |
| 6 | Migration script | `script/MigrateGardens.s.sol` | ❌ Removed |

---

## 2. Test Coverage Analysis

### Active Tests (61 total)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `test/unit/GardenHatsModule.t.sol` | 23 | Hat queries, role isolation, batch ops |
| `test/integration/HatsModule.t.sol` | 24 | Initialization, config, role checks |
| `test/integration/HatsGAPIntegration.t.sol` | 14 | Full flow, GAP sync, degradation |

### Skipped Tests

**File**: `HatsModule.t.sol.skip` (24 tests)
- **Reason**: API mismatch after refactoring
- Uses `MockHatsProtocol` instead of `MockHats`
- Calls `adapter.hatsProtocol()` but contract exposes `adapter.hats()`
- Uses `IHats.ZeroAddress` but error is in `HatsModule`

**Action**: Delete `.skip` file - active version is correct

### Coverage Gaps

1. **No frontend tests** - No React hooks for Hats exist yet
2. **No fork tests** - All tests use mocks, not real Hats Protocol
3. **No GardenToken integration tests** - Phase 3 not implemented
4. **No migration tests** - Phase 6 script was removed

---

## 3. Issues Identified

### Critical

| Issue | Location | Impact |
|-------|----------|--------|
| Base Sepolia hat IDs = 0 | [src/lib/Hats.sol:40-50](packages/contracts/src/lib/Hats.sol#L40) | Testnet unusable for Hats |
| GardenToken doesn't call modules | `src/tokens/Garden.sol` | Gardens don't get hat trees |
| MigrateGardens script removed | commit `2c9f3f97` | No migration path |

### Moderate

| Issue | Location | Impact |
|-------|----------|--------|
| Interface duplication | `IHats.sol` + `IHatsProtocol.sol` | Maintenance confusion |
| Skipped test file stale | `HatsModule.t.sol.skip` | Dead code |
| No frontend hooks | `packages/shared/` | UI can't use Hats |
| Deployment registry missing entry | `hatsAccessControl` | Frontend gets undefined |

### Minor

| Issue | Location | Impact |
|-------|----------|--------|
| Hat ID validation weak | `configureGarden()` | Only checks non-zero |
| No try/catch for Hats calls | `_checkRole()` | Hard revert on issues |
| Undocumented config flow | - | Ops complexity |

---

## 4. Recommended Improvements

### Architecture

1. **Consolidate interfaces** - Keep only `IHats.sol`, remove `IHatsProtocol.sol`
2. **Add graceful degradation** - `_checkRole()` should try/catch and fall back to native
3. **Validate hat structure** - Check hat levels/hierarchy in `configureGarden()`

### Testing

1. **Add fork tests** - Test against real Hats Protocol on Arbitrum/Base Sepolia
2. **Add frontend hook tests** - When hooks are created
3. **Add integration test for minting flow** - GardenToken → HatsModule → GAP

### Documentation

1. **Migration guide** - How to transition existing gardens
2. **Ops runbook** - How to create hat trees on new networks
3. **Config authority guide** - When/how to set authorities

---

## 5. Files Reference

### Core Implementation
- [packages/contracts/src/modules/Hats.sol](packages/contracts/src/modules/Hats.sol) - Main adapter
- [packages/contracts/src/lib/Hats.sol](packages/contracts/src/lib/Hats.sol) - Constants & helpers
- [packages/contracts/src/interfaces/IHats.sol](packages/contracts/src/interfaces/IHats.sol) - Protocol interface
- [packages/contracts/src/interfaces/IGardenAccessControl.sol](packages/contracts/src/interfaces/IGardenAccessControl.sol) - Abstract role interface

### Tests
- [packages/contracts/test/unit/GardenHatsModule.t.sol](packages/contracts/test/unit/GardenHatsModule.t.sol) - Unit tests
- [packages/contracts/test/integration/HatsModule.t.sol](packages/contracts/test/integration/HatsModule.t.sol) - Integration tests
- [packages/contracts/test/integration/HatsGAPIntegration.t.sol](packages/contracts/test/integration/HatsGAPIntegration.t.sol) - GAP integration

### Documentation
- [packages/contracts/docs/HATS_GAP_INTEGRATION_PLAN.md](packages/contracts/docs/HATS_GAP_INTEGRATION_PLAN.md) - Full integration plan

### Mocks
- [packages/contracts/src/mocks/Hats.sol](packages/contracts/src/mocks/Hats.sol) - MockHats

---

## 6. Verification Steps

To verify current state:

```bash
# Run Hats tests
cd packages/contracts
bun test GardenHatsModule
bun test HatsModule
bun test HatsGAPIntegration

# Check Base Sepolia constants
grep -n "BASE_SEPOLIA" src/lib/Hats.sol
```

To verify after completion:

```bash
# Full test suite
bun format && bun lint && bun test && bun build

# Fork test (requires RPC)
forge test --fork-url $ARBITRUM_RPC --match-contract HatsModule
```

---

## 7. Implementation Plan

**Goal**: Complete full Hats Protocol integration with all 6 roles, eligibility modules, and GAP integration.

### Phase 1: Contract Cleanup & Foundation (2 hours)

**Step 1.1: Remove stale files**
- Delete `test/integration/HatsModule.t.sol.skip`
- Delete `src/interfaces/IHatsProtocol.sol`
- Update any imports referencing `IHatsProtocol`

**Step 1.2: Extend HatsModule for 6 roles**
Update [src/modules/Hats.sol](packages/contracts/src/modules/Hats.sol):
```solidity
struct GardenHats {
    uint256 ownerHatId;
    uint256 operatorHatId;
    uint256 evaluatorHatId;    // NEW
    uint256 gardenerHatId;
    uint256 funderHatId;       // NEW
    uint256 communityHatId;    // NEW
    bool configured;
}

function isEvaluator(address account) external view returns (bool);
function isFunder(address account) external view returns (bool);
function isCommunity(address account) external view returns (bool);
```

**Step 1.3: Create IGardenHatsModule interface**
New file: `src/interfaces/IGardenHatsModule.sol`

```solidity
// Role enum for type-safe role management
enum GardenRole { Gardener, Evaluator, Operator, Owner, Funder, Community }

interface IGardenHatsModule {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════
    event GardenHatTreeCreated(address indexed garden, uint256 adminHatId);
    event RoleGranted(address indexed garden, address indexed account, GardenRole role);
    event RoleRevoked(address indexed garden, address indexed account, GardenRole role);
    event PartialGrantFailed(address indexed garden, address indexed account, GardenRole role, string reason);

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Hat Tree Lifecycle (onlyGardenToken)
    // ═══════════════════════════════════════════════════════════════════════════
    /// @notice Creates the full hat tree for a garden with all 6 roles
    /// @dev Only callable by GardenToken during mintGarden()
    function createGardenHatTree(
        address garden,
        address primaryOperator,
        string calldata name,
        address communityToken  // For ERC20Eligibility
    ) external returns (uint256 adminHatId);

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Management (onlyOwnerOrOperator of garden)
    // ═══════════════════════════════════════════════════════════════════════════
    /// @notice Grant a role to an account
    /// @dev For Operator: best-effort also grants Evaluator + Gardener
    function grantRole(address garden, address account, GardenRole role) external;
    function revokeRole(address garden, address account, GardenRole role) external;

    // Batch operations
    function grantRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external;
    function revokeRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Queries (view)
    // ═══════════════════════════════════════════════════════════════════════════
    function isGardenerOf(address garden, address account) external view returns (bool);
    function isEvaluatorOf(address garden, address account) external view returns (bool);
    function isOperatorOf(address garden, address account) external view returns (bool);
    function isOwnerOf(address garden, address account) external view returns (bool);
    function isFunderOf(address garden, address account) external view returns (bool);
    function isCommunityOf(address garden, address account) external view returns (bool);
}
```

**Access Control Notes:**
- `createGardenHatTree()`: Only callable by GardenToken (set via `setGardenToken()`)
- `grantRole()`/`revokeRole()`: Only callable by Owner or Operator of that garden
- Query functions: Public view, anyone can check roles

**Step 1.4: Implement grant/revoke semantics**
- **Operator grants**: Best-effort also grant Evaluator + Gardener
- If sub-grant fails, Operator grant succeeds + emit `PartialGrantFailed`
- **Revoke granularity**: Individual control per role
- `revokeRole(Operator)` only removes Operator hat, not sub-roles

**Step 1.5: Add events**
- `GardenHatTreeCreated(garden, adminHatId)`
- `RoleGranted(garden, account, role)`
- `RoleRevoked(garden, account, role)`
- `PartialGrantFailed(garden, account, role, reason)`

**Step 1.6: Add hard guard**
- Revert `HatsNotConfigured` when `gardensHatId == 0` (Base Sepolia safety)

Validation: `bun --filter contracts test`

---

### Phase 2: Base Sepolia Hat Tree (3 hours)

**Step 2.1: Create hat tree via Hats UI**

Structure to create at app.hatsprotocol.xyz (Base Sepolia):
```
Green Goods Top Hat (Team Multisig)
├── Gardens Hat (admin = GardenToken)
└── [Templates for per-garden structure]
```

**Step 2.2: Deploy eligibility modules**

Deploy on Base Sepolia:
- `AllowlistEligibility` - For Funder role
- `ERC20Eligibility` - For Community role (garden token holders)

**Step 2.3: Update HatsLib constants**

File: [src/lib/Hats.sol](packages/contracts/src/lib/Hats.sol)
```solidity
// Base Sepolia (testnet)
uint256 internal constant BASE_SEPOLIA_TOP_HAT = 0x...;
uint256 internal constant BASE_SEPOLIA_GARDENS_HAT = 0x...;

// Eligibility module addresses
address internal constant BASE_SEPOLIA_ALLOWLIST_ELIGIBILITY = 0x...;
address internal constant BASE_SEPOLIA_ERC20_ELIGIBILITY = 0x...;
```

Validation: Fork test on Base Sepolia

---

### Phase 3: KarmaGAPModule (1 hour) ✅ ALREADY IMPLEMENTED

> **Discovery**: KarmaGAPModule already exists at `src/modules/Karma.sol` with full implementation including graceful degradation.

**Existing files**:
- `src/modules/Karma.sol` - Full implementation
- `src/interfaces/IKarmaGAPModule.sol` - Interface

**Already complete** ✅:
- `src/interfaces/IKarmaGAPModule.sol` - Interface exists (148 lines)
- `test/unit/KarmaGAPModule.t.sol` - Unit tests exist (287 lines)

**Verification steps**:
- [ ] Run `bun test KarmaGAPModule` - confirm existing tests pass
- [ ] Review `createProject()`, `createImpact()`, `createMilestone()` signatures match Phase 4/5 usage

**Reference** - existing implementation at `src/modules/Karma.sol`:
```solidity
contract KarmaGAPModule is IKarmaGAPModule, OwnableUpgradeable, UUPSUpgradeable {
    mapping(address garden => bytes32 projectUID) public gardenProjects;

    // Called by GardenToken during garden creation
    function createProject(
        address garden,
        address operator,
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    ) external returns (bytes32 projectUID);

    // Called by WorkApprovalResolver when work is approved
    function createImpact(
        address garden,
        uint256 tokenId,
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID
    ) external onlyWorkApprovalResolver returns (bytes32 impactUID);

    // Called by AssessmentResolver when assessment is created
    function createMilestone(
        address garden,
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        string calldata milestoneMeta
    ) external onlyAssessmentResolver returns (bytes32 milestoneUID);
}
```

Validation: All GAP module tests pass

---

### Phase 4: GardenToken Integration (4 hours)

**Step 4.1: Add module references to GardenToken**

File: [src/tokens/Garden.sol](packages/contracts/src/tokens/Garden.sol)
```solidity
IGardenHatsModule public gardenHatsModule;
IKarmaGAPModule public karmaGAPModule;
```

**Step 4.2: Modify mintGarden() to create hat tree**

Add Hats integration to existing `mintGarden(GardenConfig calldata config)`:

```solidity
function mintGarden(GardenConfig calldata config) external onlyAuthorizedMinter returns (address) {
    // Existing validation
    _validateCommunityToken(config.communityToken);

    // NEW: Require at least one operator
    if (config.gardenOperators.length == 0) {
        revert NoOperatorsProvided();
    }

    uint256 tokenId = _nextTokenId++;
    _safeMint(_msgSender(), tokenId);

    address gardenAccount = TBALib.createAccount(_GARDEN_ACCOUNT_IMPLEMENTATION, address(this), tokenId);

    // ... existing event emission ...

    // NEW: Create hat tree with all 6 roles
    if (address(gardenHatsModule) != address(0)) {
        gardenHatsModule.createGardenHatTree(
            gardenAccount,
            config.gardenOperators[0],  // Primary operator
            config.name,
            config.communityToken       // For Community role ERC20Eligibility
        );

        // Grant Owner to NFT minter
        gardenHatsModule.grantRole(gardenAccount, _msgSender(), GardenRole.Owner);

        // Grant Operator roles (best-effort also grants Evaluator + Gardener)
        for (uint i = 0; i < config.gardenOperators.length; i++) {
            gardenHatsModule.grantRole(gardenAccount, config.gardenOperators[i], GardenRole.Operator);
        }
    }

    // NEW: Create GAP project (graceful degradation)
    if (address(karmaGAPModule) != address(0)) {
        try karmaGAPModule.createProject(
            gardenAccount,
            config.gardenOperators[0],
            config.name,
            config.description,
            config.location,
            config.bannerImage
        ) {
            // Success
        } catch {
            emit GAPProjectFailed(gardenAccount);
        }
    }

    // Existing: Initialize GardenAccount
    IGardenAccount(gardenAccount).initialize(/* params */);

    return gardenAccount;
}
```

**Note**: `communityToken` already exists in `GardenConfig` struct (line 46). No struct changes needed.

**Step 4.3: Write integration tests**

File: `test/integration/GardenMinting.t.sol`

Validation: Full minting flow creates hat tree + GAP project

---

### Phase 5: Resolver Updates (3 hours)

**Step 5.1: Update Base resolver**

File: [src/resolvers/Base.sol](packages/contracts/src/resolvers/Base.sol)
- Add `gardenHatsModule` and `karmaGAPModule` references
- Role checks via HatsModule instead of GardenAccount

**Step 5.2: Update AssessmentResolver**

File: [src/resolvers/Assessment.sol](packages/contracts/src/resolvers/Assessment.sol)
- Check `isEvaluator()` or `isOperator()` for assessment creation
- Call `karmaGAPModule.createMilestone()` on attestation (creates GAP milestone)

**Step 5.3: Update WorkApprovalResolver**

File: [src/resolvers/WorkApproval.sol](packages/contracts/src/resolvers/WorkApproval.sol)
- Check `isEvaluator()` or `isOperator()` for approval
- Call `karmaGAPModule.createImpact()` on approval (creates GAP impact)

Validation: All resolver tests pass with new role checks

---

### Phase 6: GardenAccount Slimdown (3 hours)

**Step 6.1: Remove native role mappings**

File: [src/accounts/Garden.sol](packages/contracts/src/accounts/Garden.sol)

Remove:
- `mapping(address operator => bool isOperator) public gardenOperators`
- `mapping(address gardener => bool isGardener) public gardeners`
- `_addOperator()`, `_removeOperator()`
- All GAP creation logic

Keep:
- Basic TBA functionality
- Execute function
- Garden metadata

**Step 6.2: Add module delegation**

```solidity
function isOperator(address account) external view returns (bool) {
    return gardenHatsModule.isOperatorOf(address(this), account);
}
```

**Step 6.3: Update tests**

All tests referencing native roles must use HatsModule

Validation: GardenAccount tests pass with delegated checks

---

### Phase 7: Migration Script (3 hours) — FUTURE-PROOFING

> **Note**: This phase creates infrastructure for potential future v1→v2 migration. **Not used at launch** - v1 gardens remain on native role mappings. Script kept for future flexibility if migration becomes desirable.

**Step 7.1: Create MigrateGardens script**

New file: `script/MigrateGardens.s.sol`

```solidity
function migrateGarden(address garden) external {
    // 1. Read current operators from old GardenAccount
    address[] memory operators = OldGardenAccount(garden).getOperators();

    // 2. Create hat tree
    gardenHatsModule.createGardenHatTree(garden, operators[0], gardenName);

    // 3. Grant roles
    for (uint i = 0; i < operators.length; i++) {
        gardenHatsModule.grantRole(garden, operators[i], GardenRole.Operator);
    }

    // 4. Create GAP project
    karmaGAPModule.createProject(garden, operators[0], gardenName, "");
}
```

**Step 7.2: Write migration tests**

Test against fork with real existing gardens

Validation: Migration script works on testnet

---

### Phase 8: Fork Tests (4 hours)

**Step 8.1: Base Sepolia fork tests**

File: `test/fork/BaseSepoliaHats.t.sol`
- Test against real Hats Protocol
- Test eligibility modules

**Step 8.2: Arbitrum fork tests**

File: `test/fork/ArbitrumHats.t.sol`
- Test against existing Tree 92
- Verify hat ID structure

Validation: All fork tests pass

---

### Phase 9: Frontend Integration (6 hours)

**Step 9.1: Create role hooks**

Files to create in `packages/shared/src/hooks/roles/`:
- `useGardenRoles.ts` - Query all 6 roles for a user
- `useHasRole.ts` - Check single role
- `useRolePermissions.ts` - Get permissions for a role
- `index.ts` - Barrel export

```typescript
type GardenRole = 'gardener' | 'evaluator' | 'operator' | 'owner' | 'funder' | 'community';

export function useGardenRoles(gardenAddress: Address, userAddress: Address) {
  // Returns { roles: GardenRole[], isLoading, error }
}

export function useHasRole(gardenAddress: Address, userAddress: Address, role: GardenRole) {
  // Returns boolean
}
```

**Step 9.2: Update deployment resolution**

File: [packages/shared/src/hooks/hypercerts/hypercert-contracts.ts](packages/shared/src/hooks/hypercerts/hypercert-contracts.ts)
- Add HatsModule ABI
- Resolve `gardenHatsModule` address
- **Version-keyed deployments**: Create `84532-v2.json` (preserve `84532-latest.json` as v1)
- Add version detection logic to pick correct deployment file

**Step 9.3: Update existing role checks**

Grep for `isOperator`, `isGardener` usage in client/admin and update to use new hooks.

**Step 9.4: Add frontend tests**

File: `packages/shared/src/__tests__/hooks/roles/useGardenRoles.test.ts`

Validation: All frontend tests pass

---

### Phase 10: Indexer Updates (2 hours)

**Step 10.1: Add Hats events to Envio schema**
- `RoleGranted(garden, account, role)`
- `RoleRevoked(garden, account, role)`
- `GardenHatTreeCreated(garden, adminHatId)`
- `PartialGrantFailed(garden, account, role, reason)`

**Step 10.2: Update indexer handlers**

**Step 10.3: Test indexing**

Validation: Events indexed correctly

---

### Phase 11: E2E Testing (4 hours)

**Step 11.1: Playwright E2E tests**

Test full flows:
- Garden creation → hat tree verification
- Work submission as gardener
- Work approval as evaluator
- Assessment creation as operator
- Role management as owner

**Step 11.2: Manual testing on testnet**

- Deploy full stack to Base Sepolia
- Create garden, verify hats in Hats UI
- Test all role permissions

Validation: Full E2E flow works

---

## 8. Estimated Effort

| Phase | Effort | Dependencies | Parallel? |
|-------|--------|--------------|-----------|
| 1. Cleanup & Foundation | 2-3 hours | None | No |
| 2. Base Sepolia Hat Tree | 3-4 hours | Phase 1 | No |
| 3. KarmaGAPModule | 1 hour ✅ | Phase 1 | No |
| 4. GardenToken Integration | 3-4 hours | Phases 2, 3 | No |
| 5. Resolver Updates | 2-3 hours | Phase 4 | No |
| 6. GardenAccount Slimdown | 3 hours | Phase 5 | No |
| 7. Migration Script | 3 hours | Phase 6 | No |
| 8. Fork Tests | 3-4 hours | Phase 7 | No |
| 9. Frontend Integration | 4-6 hours | Phase 4 | **Yes** |
| 10. Indexer Updates | 2 hours | Phase 4 | **Yes** |
| 11. E2E Testing | 3-4 hours | Phases 8, 9, 10 | No |

**Total**: ~31-38 hours (~1-1.5 week sprint)

---

## 9. Deployment Strategy

**Approach**: Big bang testnet first

```
Week 1: Contract Development (Critical Path)
├── Day 1-2: Phases 1-2 (Cleanup, Hat Tree)
├── Day 3-4: Phases 3-4 (KarmaGAP verify, GardenToken)
└── Day 5: Phases 5-7 (Resolvers, GardenAccount, Migration)

Week 2: Testing & Frontend (Parallel where possible)
├── Day 1-2: Phase 8 (Fork tests)
├── Day 3-4: Phases 9-10 (Frontend hooks, Indexer) — PARALLEL
└── Day 5: Phase 11 (E2E, Manual testing)
```

**Deployment Order (Base Sepolia)**:
1. Create hat tree in Hats UI
2. Deploy eligibility modules
3. Deploy HatsModule (upgraded or new)
4. Deploy KarmaGAPModule
5. Upgrade GardenToken
6. Upgrade Resolvers
7. Run migration script for test gardens
8. Full E2E verification

**Mainnet Deployment** (after testnet validation):
- Same order as testnet
- Team multisig wears top hat
- Monitor first few garden mints closely

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Hat tree misconfiguration | Fork test against real Hats before deployment |
| Migration data loss | Test migration script on fork with real gardens |
| GAP attestation failures | try/catch with graceful degradation events |
| Frontend breaks | Abstract hooks, existing auth still works during transition |
| Gas cost increase | Benchmark role checks, optimize if >2x increase |

---

## 11. Success Criteria

- [ ] All 61+ existing tests pass
- [ ] New tests for 6 roles (mock + fork)
- [ ] E2E tests for full garden lifecycle
- [ ] Base Sepolia hat tree functional
- [ ] Migration script tested on fork
- [ ] Frontend hooks with tests
- [ ] Indexer tracks Hats events
- [ ] No "Hats" terminology in UI
- [ ] Documentation updated
- [ ] Legacy v1 gardens unaffected
