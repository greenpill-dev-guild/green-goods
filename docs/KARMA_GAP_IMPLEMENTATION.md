# Karma GAP Implementation Details

## Overview

This document provides technical implementation details for maintainers and contributors working with the Karma GAP integration in Green Goods smart contracts.

**Status:** Production-ready with full multi-chain support across 8 networks  
**Implementation Date:** 2025-10-11  
**Last Updated:** 2025-10-12

## Architecture

### Key Design Principles

1. **GardenAccount is the Authority:** Only `GardenAccount` directly interacts with Karma GAP
2. **Automatic Integration:** GAP projects created during garden initialization
3. **Multi-Chain Support:** Works seamlessly across 8 networks
4. **Graceful Degradation:** GAP failures don't revert core operations
5. **Identity-First Security:** All resolvers verify identity before any logic

### Contract Responsibilities

**GardenAccount:**
- Owns the GAP project
- Creates project attestation during initialization
- Provides `createProjectImpact()` for impact attestations
- Manages project admins (operators)

**WorkApprovalResolver:**
- Calls `GardenAccount.createProjectImpact()` when work is approved
- Provides work, action, and approval data for impact attestation
- Handles failures gracefully (approval succeeds even if GAP fails)

**AssessmentResolver:**
- No direct GAP integration (assessments do not create milestones)
- Implements identity-first validation

## Files Created

**Interfaces:**
- `src/interfaces/IKarmaGap.sol` - Karma GAP and ProjectResolver interfaces

**Libraries:**
- `src/lib/Karma.sol` - Centralized constants and helpers for all 8 networks

**Tests:**
- `test/E2EKarmaGAPFork.t.sol` - Comprehensive fork tests for all networks

## Contract Modifications

### GardenAccount (`src/accounts/Garden.sol`)

**New State Variables:**
```solidity
bytes32 public gapProjectUID;  // Karma GAP project attestation UID
```

**Immutable Resolver Addresses:**
```solidity
address public immutable WORK_APPROVAL_RESOLVER;
address public immutable ASSESSMENT_RESOLVER;
```

**New Functions:**
```solidity
/// @notice Creates a GAP project impact attestation (operator or resolver only)
function createProjectImpact(
    string calldata workTitle,
    string calldata impactDescription,
    string calldata proofIPFS
) external onlyOperatorOrResolver returns (bytes32 impactUID);

/// @notice Returns the GAP project UID
function getGAPProjectUID() external view returns (bytes32);

/// @notice Internal: Creates GAP project during initialization
function _createGAPProject() private;

/// @notice Internal: Adds operator as GAP project admin
function _addGAPProjectAdmin(address operator) private;
```

**Modified Functions:**
```solidity
/// initialize() - No signature changes, but now creates GAP project if supported
function initialize(
    address _communityToken,
    string calldata _name,
    string calldata _description,
    string calldata _location,
    string calldata _bannerImage,
    address[] calldata _gardeners,
    address[] calldata _gardenOperators
) external initializer {
    // ... existing logic ...
    
    // NEW: Create GAP project if on supported chain
    if (KarmaLib.isSupported()) {
        _createGAPProject();
        
        // Add all operators as GAP project admins
        for (uint256 i = 0; i < _gardenOperators.length; i++) {
            _addGAPProjectAdmin(_gardenOperators[i]);
        }
    }
}

/// addGardenOperator() - Now also adds operator as GAP project admin
function addGardenOperator(address operator) external onlyOperator {
    // ... existing logic ...
    
    // NEW: Add as GAP project admin if supported
    if (KarmaLib.isSupported() && gapProjectUID != bytes32(0)) {
        _addGAPProjectAdmin(operator);
    }
}
```

**Constructor Changes:**
```solidity
constructor(
    address erc4337EntryPoint,
    address multicallForwarder,
    address erc6551Registry,
    address guardian,
    address _workApprovalResolver,
    address _assessmentResolver
)
    AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian)
{
    WORK_APPROVAL_RESOLVER = _workApprovalResolver;
    ASSESSMENT_RESOLVER = _assessmentResolver;
    _disableInitializers();  // Prevent implementation from being initialized
}
```

**New Events:**
```solidity
/// @notice Emitted when GAP project is created
event GAPProjectCreated(
    bytes32 indexed projectUID,
    address indexed gardenAddress,
    string projectName
);

/// @notice Emitted when impact attestation is created
event GAPProjectImpactCreated(
    bytes32 indexed impactUID,
    bytes32 indexed projectUID,
    address indexed creator
);

/// @notice Emitted when operator is added as GAP project admin
event GAPProjectAdminAdded(
    bytes32 indexed projectUID,
    address indexed admin
);
```

**Storage Gap Update:**
```solidity
// Updated from uint256[36] to uint256[35] (added 1 state variable: gapProjectUID)
// Note: Immutables (WORK_APPROVAL_RESOLVER, ASSESSMENT_RESOLVER) stored in bytecode, not storage
uint256[35] private __gap;
```

### WorkApprovalResolver (`src/resolvers/WorkApproval.sol`)

**Modified onAttest():**
```solidity
function onAttest(Attestation calldata attestation, uint256) internal override returns (bool) {
    WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
    Attestation memory workAttestation = _eas.getAttestation(schema.workUID);

    // WORK RELATIONSHIP: Verify work was submitted to this garden
    if (workAttestation.attester != attestation.recipient) {
        revert NotInWorkRegistry();
    }

    GardenAccount gardenAccount = GardenAccount(payable(workAttestation.recipient));

    // IDENTITY CHECK: Verify operator status (FIRST CHECK)
    if (gardenAccount.gardenOperators(attestation.attester) == false) {
        revert NotGardenOperator();
    }

    // ACTION VALIDATION: Verify action exists
    if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).startTime == 0) {
        revert NotInActionRegistry();
    }

    // NEW: GAP INTEGRATION - Create project impact if approved
    if (schema.approved && KarmaLib.isSupported()) {
        _createGAPProjectImpact(schema, workAttestation, gardenAccount);
    }

    return (true);
}
```

**New Private Function:**
```solidity
/// @notice Creates GAP project impact via GardenAccount
function _createGAPProjectImpact(
    WorkApprovalSchema memory schema,
    Attestation memory workAttestation,
    GardenAccount gardenAccount
) private {
    // Skip if garden has no GAP project
    bytes32 projectUID = gardenAccount.getGAPProjectUID();
    if (projectUID == bytes32(0)) return;
    
    // Get work and action data
    WorkSchema memory workSchema = abi.decode(workAttestation.data, (WorkSchema));
    ActionRegistry.Action memory action = ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID);
    
    // Prepare impact data
    string memory workTitle = action.title;
    string memory impactDesc = schema.feedback;
    string memory proof = workSchema.media.length > 0 ? workSchema.media[0] : "";
    
    // SECURITY: Use try/catch to prevent GAP failures from reverting approval
    try gardenAccount.createProjectImpact(workTitle, impactDesc, proof) {
        // Success - event emitted by GardenAccount
    } catch {
        // Failed - approval still succeeds
    }
}
```

### Work, Assessment Resolvers

**Identity Verification Added:**

Both `WorkResolver.sol` and `AssessmentResolver.sol` now verify identity **as the first check**:

```solidity
// In WorkResolver
function onAttest(Attestation calldata attestation, uint256) internal view override returns (bool) {
    WorkSchema memory schema = abi.decode(attestation.data, (WorkSchema));
    GardenAccount gardenAccount = GardenAccount(payable(attestation.recipient));

    // IDENTITY CHECK: Verify gardener status FIRST
    if (gardenAccount.gardeners(attestation.attester) == false) {
        revert NotGardenerAccount();
    }
    
    // ... rest of validation ...
}

// In AssessmentResolver
function onAttest(Attestation calldata attestation, uint256) internal view override returns (bool) {
    AssessmentSchema memory schema = abi.decode(attestation.data, (AssessmentSchema));
    GardenAccount gardenAccount = GardenAccount(payable(attestation.recipient));

    // IDENTITY CHECK: Verify operator status FIRST
    if (gardenAccount.gardenOperators(attestation.attester) == false) {
        revert NotGardenOperator();
    }
    
    // ... rest of validation ...
}
```

## Libraries and Interfaces

### KarmaLib (`src/lib/Karma.sol`)

Centralized library for all Karma GAP interactions with full multi-chain support.

**Constants:**
- Contract addresses for 8 networks (Gap, ProjectResolver)
- Schema UIDs for 8 networks (Project, Details, Project Update)

**Helper Functions:**
```solidity
function getGapContract() internal view returns (address);
function getProjectResolver() internal view returns (address);
function getProjectSchemaUID() internal view returns (bytes32);
function getDetailsSchemaUID() internal view returns (bytes32);
function getProjectUpdateSchemaUID() internal view returns (bytes32);
function isSupported() internal view returns (bool);
```

### IKarmaGap Interface (`src/interfaces/IKarmaGap.sol`)

Interfaces for Karma GAP contracts:

```solidity
/// @title IKarmaGap - Karma GAP core contract interface
interface IKarmaGap {
    function attest(AttestationRequest calldata request) external payable returns (bytes32 uid);
    function addProjectAdmin(bytes32 projectUid, address addr) external;
    function removeProjectAdmin(bytes32 projectUid, address addr) external;
    function transferProjectOwnership(bytes32 projectUid, address newOwner) external;
}

/// @title IProjectResolver - Project Resolver contract interface
interface IProjectResolver {
    function addAdmin(bytes32 projectUid, address addr) external;
    function removeAdmin(bytes32 projectUid, address addr) external;
    function transferProjectOwnership(bytes32 projectUid, address newOwner) external;
    function isProjectAdmin(bytes32 projectUid, address addr) external view returns (bool);
    function isProjectOwner(bytes32 projectUid, address addr) external view returns (bool);
}
```

## Security Model

### Two-Layer Security

**Layer 1: Resolver Verification**
- WorkApprovalResolver verifies user is a garden operator before processing
- AssessmentResolver verifies user is a garden operator before processing
- WorkResolver verifies user is a gardener before processing

**Layer 2: Trusted Caller Check**
- GardenAccount.createProjectImpact() can ONLY be called by trusted resolvers or operators
- Resolver addresses are immutable (set at deployment, stored in bytecode)
- `onlyOperatorOrResolver` modifier enforces this

### Call Flow

```
User (Operator) → EAS.attest() → WorkApprovalResolver.onAttest()
                                   ↓ (verifies operator status)
                                   ↓
                                GardenAccount.createProjectImpact()
                                   ↓ (verifies caller is trusted resolver or operator)
                                   ↓
                                Karma GAP Contract
```

### Identity-First Validation

All resolvers verify identity as the first check:

1. **WorkResolver:** Checks `gardeners` mapping before any other logic
2. **WorkApprovalResolver:** Checks `gardenOperators` mapping before any other logic
3. **AssessmentResolver:** Checks `gardenOperators` mapping before any other logic

This prevents unauthorized attestations from being processed.

### Access Control

- `createProjectImpact()`: `onlyOperatorOrResolver` modifier
- `_createGAPProject()`: Private, called only during initialization
- `_addGAPProjectAdmin()`: Private, called by operator management functions

### Graceful Failure Handling

```solidity
// In WorkApprovalResolver
try gardenAccount.createProjectImpact(...) {
    // Success - event emitted by GardenAccount
} catch {
    // Failed - approval still succeeds
}

// In GardenAccount
try resolver.addAdmin(...) {
    emit GAPProjectAdminAdded(...);
} catch {
    // Failed - operator addition still succeeds
}
```

### Storage Safety

✅ **Storage layout unchanged:**
- Immutables stored in bytecode, not storage
- All state variables remain in same slots
- Storage gap properly maintained: `uint256[35]`
- UUPS upgrade pattern preserved

## Testing Strategy

### E2E Fork Tests

All testing is done via fork tests for accuracy - no unit tests with mocks.

**Test File:** `test/E2EKarmaGAPFork.t.sol`

**Test Coverage:**
- ✅ testForkOptimism()
- ✅ testForkOptimismSepolia()
- ✅ testForkArbitrum_createGarden()
- ✅ testForkArbitrum_operatorBecomesProjectAdmin()
- ✅ testForkSepolia()
- ✅ testForkBaseSepolia_createGarden()
- ✅ testForkBaseSepolia_fullWorkflow()
- ✅ testForkCelo()
- ✅ testForkSei()
- ✅ testForkSeiTestnet()

**Running Tests:**

```bash
# All GAP tests
bun test:gap

# Specific networks
bun test:gap:fork:arbitrum
bun test:gap:fork:celo
bun test:gap:fork:base
bun test:gap:fork:optimism
bun test:gap:fork:sepolia
bun test:gap:fork:sei
```

### Test Results

```
Total Tests: 129
Passed: 129 (100%)
Status: All passing ✅
```

**Test Suites:**
- AssessmentResolver: 3/3 ✅
- GardenToken: 12/12 ✅
- GardenAccount: 30/30 ✅ (including proxy-based tests)
- E2EKarmaGAPFork: 10/10 ✅
- WorkApproval: 7/7 ✅
- UpgradeSafety: 7/7 ✅
- ActionRegistry: 20/20 ✅
- FuzzTests: 25/25 ✅
- DeploymentRegistry: 8/8 ✅
- WorkResolver: 5/5 ✅
- Miscellaneous: 2/2 ✅

## Configuration

### Foundry Config (`foundry.toml`)

RPC endpoints removed from config file - fork tests load RPC URLs via `vm.envString()`:

```toml
[rpc_endpoints]
localhost = "http://localhost:8545"
# Fork tests use environment variables instead
```

### Package Scripts (`package.json`)

```json
{
  "test:gap": "forge test --match-contract E2EKarmaGAPFork --gas-report",
  "test:gap:fork:optimism": "forge test --match-contract E2EKarmaGAPFork --match-test testForkOptimism --fork-url $OPTIMISM_RPC_URL -vv",
  "test:gap:fork:arbitrum": "forge test --match-contract E2EKarmaGAPFork --match-test testForkArbitrum --fork-url $ARBITRUM_RPC_URL -vv",
  "test:gap:fork:celo": "forge test --match-contract E2EKarmaGAPFork --match-test testForkCelo --fork-url $CELO_RPC_URL -vv",
  "test:gap:fork:base": "forge test --match-contract E2EKarmaGAPFork --match-test testForkBaseSepolia --fork-url $BASE_SEPOLIA_RPC_URL -vv",
  "test:gap:fork:sepolia": "forge test --match-contract E2EKarmaGAPFork --match-test testForkSepolia --fork-url $SEPOLIA_RPC_URL -vv",
  "test:gap:fork:sei": "forge test --match-contract E2EKarmaGAPFork --match-test testForkSei --fork-url $SEI_RPC_URL -vv"
}
```

## Deployment

### Automatic Integration

When deploying to a GAP-supported chain:

1. Deploy core contracts (resolvers deployed before GardenAccount)
2. GardenAccount deployed with resolver addresses as immutables
3. Gardens automatically create GAP projects on initialization
4. Operators automatically become project admins
5. Approved work automatically creates impact attestations

**No additional configuration needed** - the integration is automatic!

### Deployment Order

**Critical:** Resolvers must be deployed BEFORE GardenAccount:

1. Deploy WorkApprovalResolver
2. Deploy AssessmentResolver  
3. Deploy GardenAccount with resolver addresses
4. Rest of infrastructure

### Supported vs Unsupported Chains

**Supported chains (GAP integration active):**
- Optimism, Optimism Sepolia, Arbitrum, Sepolia, Base Sepolia, Celo, Sei, Sei Testnet

**Unsupported chains (GAP integration skipped):**
- Localhost, other testnets
- `KarmaLib.isSupported()` returns `false`
- Gardens work normally without GAP features

## Gas Impact

### Estimated Costs

| Operation | Base | With GAP | Increase |
|-----------|------|----------|----------|
| Mint Garden | ~300k | ~400k | +33% |
| Assessment | ~150k | ~150k | 0% (no GAP) |
| Approve Work | ~100k | ~160k | +60% |

### Optimization

**Immutable Resolver Addresses:**
- Gas savings: ~2100 gas per `createProjectImpact()` call (no SLOAD)
- Stored in bytecode, not storage

**Optional GAP Integration:**
- Set to unsupported chain to skip GAP (no gas overhead)
- Graceful failures prevent expensive reverts

## What Was NOT Implemented

1. **Assessments → Milestones:** Assessments do NOT create GAP milestones
2. **Indexer Entities:** No GAPProject, GAPMilestone, or GAPImpact entities in Green Goods indexer
3. **Admin Dashboard Queries:** Impact Reports query Karma GAP directly (future implementation)
4. **Localhost Testing:** GAP integration not supported on localhost (use fork tests)

## Upgrade Path

When resolvers are upgraded, a new GardenAccount implementation must be deployed with updated addresses.

See [UPGRADES.md](./UPGRADES.md) for complete upgrade guide.

**Quick Reference:**

```bash
# Deploy new GardenAccount implementation
forge script script/Upgrade.s.sol:Upgrade \
  --sig "deployNewGardenAccountImplementation(address,address)" \
  <NEW_WORK_APPROVAL_RESOLVER> \
  <NEW_ASSESSMENT_RESOLVER> \
  --network arbitrum --broadcast

# Upgrade specific garden
forge script script/Upgrade.s.sol:Upgrade \
  --sig "upgradeGardenProxy(address,address)" \
  <GARDEN_PROXY> <NEW_IMPL> \
  --network arbitrum --broadcast
```

## Troubleshooting

### GAP Project Not Created

**Issue:** `gapProjectUID` is zero after garden creation

**Debug:**
1. Check `KarmaLib.isSupported()` returns `true` for your chain
2. Verify GAP contract address for your network in `src/lib/Karma.sol`
3. Check initialization transaction for revert
4. Verify garden has operators (operators trigger project creation)

### Impact Attestation Failed

**Issue:** Work approved but no impact attestation created

**Debug:**
1. Check if GAP project exists (`gapProjectUID != 0`)
2. Verify caller is an operator
3. Look for try/catch failure in transaction logs
4. Confirm GAP contract is accessible on-chain
5. Check WorkApprovalResolver is in trusted resolver list

### Operator Not Project Admin

**Issue:** Operator added but not GAP project admin

**Debug:**
1. Check if `_addGAPProjectAdmin()` was called
2. Verify Project Resolver address in `src/lib/Karma.sol`
3. Look for try/catch failure in transaction logs
4. Confirm operator was added AFTER garden creation (must have GAP project first)

### Schema Field Format Issues

**Issue:** Attestations created but not displaying in Karma GAP UI

**Verify JSON format matches Karma GAP SDK:**
- Milestones use `text` (not `description`) and `type: "project-milestone"`
- Impacts use `title` and `text` (not `work` and `impact`)

## Known Limitations

1. **Assessments → Milestones:** Not implemented (assessments don't create GAP milestones)
2. **Localhost Testing:** Not supported for GAP (use fork tests instead)
3. **RPC Requirements:** Fork tests require valid RPC URLs for each network
4. **Resolver Upgrades:** Require new GardenAccount implementation deployment

## References

### Documentation
- Integration Guide: [KARMA_GAP.md](./KARMA_GAP.md)
- Upgrade Guide: [UPGRADES.md](./UPGRADES.md)
- Change History: [archive/CHANGELOG_KARMA_GAP.md](./archive/CHANGELOG_KARMA_GAP.md)

### Code
- KarmaLib: `packages/contracts/src/lib/Karma.sol`
- Interfaces: `packages/contracts/src/interfaces/IKarmaGap.sol`
- Fork Tests: `packages/contracts/test/E2EKarmaGAPFork.t.sol`

### External
- Karma GAP SDK: https://github.com/show-karma/karma-gap-sdk
- Karma GAP Contracts: https://github.com/show-karma/gap-contracts
- EAS Documentation: https://docs.attest.sh/
- CIDS Standard: https://commonsimpact.org/

## Production Readiness Checklist

- ✅ All contracts compile successfully
- ✅ 100% test pass rate (129/129)
- ✅ Security model implemented and documented
- ✅ Multi-chain support (8 networks)
- ✅ Graceful failure handling
- ✅ Identity-first validation
- ✅ Storage layout safe for upgrades
- ✅ Gas optimization maintained
- ✅ Comprehensive documentation

**Status:** Production-ready for deployment ✅

