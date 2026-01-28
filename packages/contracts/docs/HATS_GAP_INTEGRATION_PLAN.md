# Hats Protocol + Karma GAP Module Integration Plan

## Overview

This plan outlines the refactoring of the Green Goods protocol to:
1. Move roles system to Hats Protocol via GardenHatsModule
2. Extract GAP attestation logic into KarmaGAPModule
3. Slim down GardenAccount to resolve contract size/stack depth issues
4. Integrate modules with GardenToken during garden minting

## Current State

### Problems to Solve
- **GardenAccount is too large**: 5 functions disabled due to contract size limits
- **Stack too deep errors**: Complex GAP operations cause compilation issues
- **Embedded logic**: Role management and GAP attestations are tightly coupled in GardenAccount
- **Limited extensibility**: Adding new role types or GAP features requires modifying core contracts

### Existing Infrastructure
- **Hat Tree 92** on Arbitrum: `0x0000005c00000000000000000000000000000000000000000000000000000000`
- **MockHats.sol**: Enhanced mock with full hat tree support
- **MockGAP.sol**: Mock implementing IGap and IProjectResolver
- **TDD Tests**: 48 GardenHatsModule tests, 54 KarmaGAPModule tests, 14 integration tests

---

## Phase 1: Create KarmaGAPModule

**Goal**: Extract all GAP attestation logic into a dedicated module.

### 1.1 Contract Structure
```solidity
// src/modules/KarmaGAPModule.sol
contract KarmaGAPModule is UUPSUpgradeable, OwnableUpgradeable {
    IGap public gap;
    bytes32 public projectSchema;
    bytes32 public impactSchema;
    bytes32 public milestoneSchema;

    // Garden → GAP Project UID mapping
    mapping(address => bytes32) public gardenProjects;

    // Garden → Impact UIDs
    mapping(address => bytes32[]) public gardenImpacts;

    // Impact UID → Milestone UIDs
    mapping(bytes32 => bytes32[]) public impactMilestones;
}
```

### 1.2 Core Functions
```solidity
// Create GAP project for a garden (called during garden minting)
function createProject(
    address garden,
    address operator,
    string calldata name,
    string calldata description
) external returns (bytes32 projectUid);

// Add operator as GAP project admin
function addProjectAdmin(address garden, address admin) external;

// Remove GAP project admin
function removeProjectAdmin(address garden, address admin) external;

// Transfer GAP project ownership
function transferProjectOwnership(address garden, address newOwner) external;

// Create impact attestation (called during assessment creation)
function createImpact(
    address garden,
    string calldata title,
    string calldata description,
    string calldata workType,
    string calldata evidence
) external returns (bytes32 impactUid);

// Create milestone attestation (called during work approval)
function createMilestone(
    bytes32 impactUid,
    string calldata title,
    string calldata description,
    string calldata evidence,
    uint256 mediaCount
) external returns (bytes32 milestoneUid);
```

### 1.3 Access Control
- Only GardenToken or authorized resolvers can call module functions
- Module validates caller is associated with the garden
- Graceful degradation: try/catch for all GAP calls, emit events on failure

### 1.4 Files to Create
- `src/modules/KarmaGAPModule.sol`
- `src/interfaces/IKarmaGAPModule.sol`

### 1.5 Tests (Already Written)
- `test/unit/KarmaGAPModule.t.sol` - 54 tests covering all functionality

---

## Phase 2: Enhance GardenHatsModule

**Goal**: Complete the hat tree management for gardens.

### 2.1 Contract Structure
```solidity
// src/modules/GardenHatsModule.sol
contract GardenHatsModule is UUPSUpgradeable, OwnableUpgradeable {
    IHats public hats;
    uint256 public gardensHatId;  // Parent hat for all gardens

    // Garden → Garden Admin Hat ID
    mapping(address => uint256) public gardenAdminHats;

    // Garden → Role Hat IDs
    mapping(address => mapping(uint8 => uint256)) public gardenRoleHats;
}
```

### 2.2 Role Types
```solidity
enum GardenRole {
    Operator,   // Can manage gardeners, assessments
    Gardener,   // Can submit work
    Evaluator,  // Can approve/reject work
    Funder,     // Eligibility-based (via external module)
    Community   // ERC-20 holder (via external module)
}
```

### 2.3 Core Functions
```solidity
// Create hat tree for a new garden
function createGardenHatTree(
    address garden,
    address operator,
    string calldata gardenName
) external returns (uint256 adminHatId);

// Grant role to address
function grantRole(
    address garden,
    address account,
    GardenRole role
) external;

// Revoke role from address
function revokeRole(
    address garden,
    address account,
    GardenRole role
) external;

// Check if address has role
function hasRole(
    address garden,
    address account,
    GardenRole role
) external view returns (bool);

// Batch operations
function batchGrantRoles(
    address garden,
    address[] calldata accounts,
    GardenRole[] calldata roles
) external;
```

### 2.4 Hat Tree Structure
```
Top Hat (Tree 92)
└── Gardens Hat (created once)
    └── Garden Admin Hat (per garden)
        ├── Operator Hat
        ├── Gardener Hat
        ├── Evaluator Hat
        ├── Funder Hat (eligibility module)
        └── Community Hat (ERC-20 gated)
```

### 2.5 Files to Create/Modify
- `src/modules/GardenHatsModule.sol` (exists, needs enhancement)
- `src/interfaces/IGardenHatsModule.sol`

### 2.6 Tests (Already Written)
- `test/unit/GardenHatsModule.t.sol` - 48 tests

---

## Phase 3: Integrate with GardenToken

**Goal**: Call modules during garden minting.

### 3.1 Modify GardenToken._mintGarden()

```solidity
function _mintGarden(
    address account,
    uint256 tokenId,
    bytes memory salt,
    string memory name,
    string[] memory operators,
    string memory description
) internal {
    // 1. Mint NFT
    _mint(account, tokenId);

    // 2. Create TBA (GardenAccount)
    address gardenAccount = _createAccount(tokenId, salt);

    // 3. Create hat tree via GardenHatsModule
    uint256 adminHat = gardenHatsModule.createGardenHatTree(
        gardenAccount,
        operators[0],  // Primary operator
        name
    );

    // 4. Grant operator roles to all operators
    for (uint i = 0; i < operators.length; i++) {
        gardenHatsModule.grantRole(
            gardenAccount,
            operators[i],
            GardenRole.Operator
        );
    }

    // 5. Create GAP project via KarmaGAPModule
    try karmaGAPModule.createProject(
        gardenAccount,
        operators[0],
        name,
        description
    ) returns (bytes32 projectUid) {
        emit GAPProjectCreated(gardenAccount, projectUid);
    } catch {
        emit GAPProjectFailed(gardenAccount);
    }
}
```

### 3.2 Storage Additions to GardenToken
```solidity
IGardenHatsModule public gardenHatsModule;
IKarmaGAPModule public karmaGAPModule;
```

### 3.3 Files to Modify
- `src/tokens/Garden.sol`

---

## Phase 4: Update Resolvers

**Goal**: Resolvers call KarmaGAPModule instead of GardenAccount.

### 4.1 AssessmentResolver Changes

```solidity
// When assessment is created, create GAP impact
function _afterAttest(Attestation memory attestation) internal override {
    // Decode assessment data
    (address garden, string memory title, ...) = abi.decode(...);

    // Create impact via module
    try karmaGAPModule.createImpact(
        garden,
        title,
        description,
        workType,
        evidence
    ) returns (bytes32 impactUid) {
        // Store mapping: assessment UID → impact UID
        assessmentToImpact[attestation.uid] = impactUid;
    } catch {
        emit ImpactCreationFailed(attestation.uid);
    }
}
```

### 4.2 WorkApprovalResolver Changes

```solidity
// When work is approved, create GAP milestone
function _afterAttest(Attestation memory attestation) internal override {
    // Get the impact UID from the assessment
    bytes32 assessmentUid = attestation.refUID;
    bytes32 impactUid = assessmentToImpact[assessmentUid];

    if (impactUid != bytes32(0)) {
        try karmaGAPModule.createMilestone(
            impactUid,
            title,
            description,
            evidence,
            mediaCount
        ) returns (bytes32 milestoneUid) {
            emit MilestoneCreated(attestation.uid, milestoneUid);
        } catch {
            emit MilestoneCreationFailed(attestation.uid);
        }
    }
}
```

### 4.3 Files to Modify
- `src/resolvers/Assessment.sol`
- `src/resolvers/WorkApproval.sol`
- `src/resolvers/Base.sol` (add module references)

---

## Phase 5: Slim Down GardenAccount

**Goal**: Remove GAP and role logic from GardenAccount.

### 5.1 Functions to Remove from GardenAccount
- `_createGAPProject()` → Now in KarmaGAPModule
- `createProjectImpact()` → Now in KarmaGAPModule
- `createProjectMilestone()` → Now in KarmaGAPModule
- `_addOperator()` → Now in GardenHatsModule
- `_removeOperator()` → Now in GardenHatsModule
- Role checking functions → Delegate to GardenHatsModule

### 5.2 Keep in GardenAccount
- Basic TBA functionality
- Execute function for operator-initiated actions
- Garden metadata storage

### 5.3 Add to GardenAccount
```solidity
// Reference to modules for role checks
IGardenHatsModule public hatsModule;
IKarmaGAPModule public gapModule;

// Delegate role checks to HatsModule
function isOperator(address account) external view returns (bool) {
    return hatsModule.hasRole(address(this), account, GardenRole.Operator);
}

function isGardener(address account) external view returns (bool) {
    return hatsModule.hasRole(address(this), account, GardenRole.Gardener);
}
```

### 5.4 Files to Modify
- `src/accounts/Garden.sol`

---

## Phase 6: Migration Strategy

**Goal**: Support existing gardens while transitioning to new architecture.

### 6.1 Migration Approach
1. **Deploy new modules** alongside existing contracts
2. **Run migration script** to:
   - Create hat trees for existing gardens
   - Create GAP projects for existing gardens
   - Grant roles based on current operator lists
3. **Update GardenToken** to use new modules
4. **Deprecate old paths** after verification

### 6.2 Migration Script
```solidity
function migrateGarden(address garden) external {
    // 1. Get existing operators
    address[] memory operators = GardenAccount(garden).getOperators();

    // 2. Create hat tree
    uint256 adminHat = gardenHatsModule.createGardenHatTree(
        garden,
        operators[0],
        gardenName
    );

    // 3. Grant operator roles
    for (uint i = 0; i < operators.length; i++) {
        gardenHatsModule.grantRole(garden, operators[i], GardenRole.Operator);
    }

    // 4. Create GAP project
    karmaGAPModule.createProject(garden, operators[0], gardenName, "");
}
```

### 6.3 Files to Create
- `script/MigrateGardens.s.sol`

---

## Implementation Order

1. **Phase 1**: KarmaGAPModule (2 files, 54 tests ready)
2. **Phase 2**: GardenHatsModule enhancement (2 files, 48 tests ready)
3. **Phase 3**: GardenToken integration (1 file)
4. **Phase 4**: Resolver updates (3 files)
5. **Phase 5**: GardenAccount slimdown (1 file)
6. **Phase 6**: Migration script (1 file)

## Files Summary

### New Files
- `src/modules/KarmaGAPModule.sol`
- `src/interfaces/IKarmaGAPModule.sol`
- `src/interfaces/IGardenHatsModule.sol`
- `script/MigrateGardens.s.sol`

### Modified Files
- `src/modules/GardenHatsModule.sol`
- `src/tokens/Garden.sol` (GardenToken)
- `src/accounts/Garden.sol` (GardenAccount)
- `src/resolvers/Assessment.sol`
- `src/resolvers/WorkApproval.sol`
- `src/resolvers/Base.sol`

### Test Files (Already Created)
- `test/unit/KarmaGAPModule.t.sol`
- `test/unit/GardenHatsModule.t.sol`
- `test/integration/HatsGAPIntegration.t.sol`
- `test/helpers/GAPTestHelper.sol`

## Success Criteria

1. All 48 GardenHatsModule tests pass
2. All 54 KarmaGAPModule tests pass
3. All 14 integration tests pass
4. GardenAccount contract size reduced by ~40%
5. No stack too deep errors
6. Existing gardens can be migrated without data loss
7. New gardens automatically get hat trees and GAP projects
