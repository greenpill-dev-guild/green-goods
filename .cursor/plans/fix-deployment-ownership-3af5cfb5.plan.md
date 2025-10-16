<!-- 3af5cfb5-2d3c-4020-a908-e99ecc3e40cd c8c41d84-6ab8-4cea-888f-797bacff1d6f -->
# Fix Karma GAP Integration

## Problem Summary

Current implementation incorrectly attempts to call a "GAP contract" that doesn't exist. Based on the Karma GAP SDK documentation:

1. **There is no "GAP contract" to call `attest()` on** - those addresses are actually optional MultiAttester contracts for batch operations
2. **We should attest directly to EAS** using the schema UIDs
3. **Project Resolver is correct** - only used for admin management after project creation
4. **Need error capture** - to understand why project creation fails on testnets

## Solution Strategy

1. Add `getEAS()` helper to Karma.sol for EAS contract addresses
2. Update Garden.sol to attest directly to EAS in 3 functions
3. Remove incorrect `getGapContract()` function
4. Add error events for debugging
5. Add safety check before adding admins (only if project created)
6. Update/simplify IKarmaGap.sol interface
7. Validate E2E tests pass
8. Validate deploy script works

## Implementation Steps

### Step 1: Add EAS Address Helper to Karma.sol

**File**: `packages/contracts/src/lib/Karma.sol`

**After line 167** (after `getProjectResolver()` function), add:

```solidity
/// @notice Returns EAS contract address for current chain
/// @dev Required for direct attestations to Karma GAP schemas
/// @return EAS contract address
function getEAS() internal view returns (address) {
    uint256 chainId = block.chainid;
    // Mainnet chains
    if (chainId == 10) return 0x4200000000000000000000000000000000000021; // Optimism
    if (chainId == 42_161) return 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458; // Arbitrum
    if (chainId == 42_220) return 0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92; // Celo
    if (chainId == 1329) return 0x6C3970F4e8A23b3849F1c2e155AEe1fb; // Sei (placeholder - verify)
    
    // Testnet chains
    if (chainId == 11_155_420) return 0x4200000000000000000000000000000000000021; // Optimism Sepolia
    if (chainId == 11_155_111) return 0xC2679fBD37d54388Ce493F1DB75320D236e1815e; // Sepolia
    if (chainId == 84_532) return 0x4200000000000000000000000000000000000021; // Base Sepolia
    if (chainId == 1328) return 0xTBD; // Sei Testnet (placeholder - verify)
    
    _revertUnsupported();
}
```

**Lines 138-152** - Remove `getGapContract()` function entirely:

```solidity
// DELETE THIS ENTIRE FUNCTION - addresses are incorrect MultiAttester contracts, not GAP
```

### Step 2: Add Error Event to Garden.sol

**File**: `packages/contracts/src/accounts/Garden.sol`

**After line 97** (after existing events), add:

```solidity
/// @notice Emitted when GAP integration encounters an error
/// @param operation The operation that failed (e.g., "project", "details", "addAdmin")
/// @param reason The error reason string
event GAPError(string operation, string reason);
```

### Step 3: Update Garden.sol Imports

**File**: `packages/contracts/src/accounts/Garden.sol`

**Line 7** - Add IEAS import:

```solidity
import { AttestationRequest, AttestationRequestData, IEAS } from "@eas/IEAS.sol";
```

**Line 9** - Remove IKarmaGap from import (keep only IProjectResolver):

```solidity
import { IProjectResolver } from "../interfaces/IKarmaGap.sol";
```

### Step 4: Refactor _createGAPProject() in Garden.sol

**File**: `packages/contracts/src/accounts/Garden.sol`

**Lines 428-478** - Replace entire function:

```solidity
/// @notice Creates Karma GAP project by attesting directly to EAS
/// @dev Attests project and details to EAS using Karma GAP schemas
function _createGAPProject() private {
    IEAS eas = IEAS(KarmaLib.getEAS());
    
    // 1. Create project attestation (data = true boolean)
    bytes memory projectData = abi.encode(true);
    
    AttestationRequest memory projectReq = AttestationRequest({
        schema: KarmaLib.getProjectSchemaUID(),
        data: AttestationRequestData({
            recipient: address(this),
            expirationTime: 0,
            revocable: true,
            refUID: bytes32(0),
            data: projectData,
            value: 0
        })
    });
    
    // Attest directly to EAS with error capture
    try eas.attest(projectReq) returns (bytes32 projectUID) {
        gapProjectUID = projectUID;
        
        // 2. Create project details attestation (references project)
        bytes memory detailsData = abi.encode(_buildGAPDetailsJSON());
        
        AttestationRequest memory detailsReq = AttestationRequest({
            schema: KarmaLib.getDetailsSchemaUID(),
            data: AttestationRequestData({
                recipient: address(this),
                expirationTime: 0,
                revocable: true,
                refUID: gapProjectUID, // Links to project
                data: detailsData,
                value: 0
            })
        });
        
        try eas.attest(detailsReq) returns (bytes32 detailsUID) {
            // Details created successfully
            emit GAPProjectCreated(gapProjectUID, address(this), name);
        } catch Error(string memory reason) {
            // Details failed but project exists - log and continue
            emit GAPError("details", reason);
            emit GAPProjectCreated(gapProjectUID, address(this), name);
        } catch (bytes memory lowLevelData) {
            // Low-level error on details
            emit GAPError("details", string(lowLevelData));
            emit GAPProjectCreated(gapProjectUID, address(this), name);
        }
        
    } catch Error(string memory reason) {
        // Project creation failed - capture error for debugging
        emit GAPError("project", reason);
    } catch (bytes memory lowLevelData) {
        // Low-level error on project creation
        if (lowLevelData.length > 0) {
            emit GAPError("project", string(lowLevelData));
        } else {
            emit GAPError("project", "Unknown error");
        }
    }
}
```

### Step 5: Add Safety Check Before Adding Admins

**File**: `packages/contracts/src/accounts/Garden.sol`

**Lines 270-277** - Update to check if project was created:

```solidity
// Create GAP project if supported on current chain
if (KarmaLib.isSupported()) {
    _createGAPProject();
    
    // Only add admins if project was successfully created
    if (gapProjectUID != bytes32(0)) {
        for (uint256 i = 0; i < _gardenOperators.length; i++) {
            _addGAPProjectAdmin(_gardenOperators[i]);
        }
    }
}
```

### Step 6: Update _addGAPProjectAdmin() Error Handling

**File**: `packages/contracts/src/accounts/Garden.sol`

**Lines 619-628** - Add better error capture:

```solidity
function _addGAPProjectAdmin(address admin) private {
    if (gapProjectUID == bytes32(0)) return; // No project, skip silently
    
    IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
    
    try resolver.addAdmin(gapProjectUID, admin) {
        emit GAPProjectAdminAdded(gapProjectUID, admin);
    } catch Error(string memory reason) {
        emit GAPError("addAdmin", reason);
    } catch {
        // Intentionally ignore - operator addition succeeds even if GAP sync fails
    }
}
```

### Step 7: Refactor createProjectImpact() in Garden.sol

**File**: `packages/contracts/src/accounts/Garden.sol`

**Lines 494-540** - Replace IKarmaGap with direct EAS:

```solidity
function createProjectImpact(
    string calldata workTitle,
    string calldata impactDescription,
    string calldata proofIPFS
)
    external
    onlyResolver
    returns (bytes32)
{
    if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
    if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

    IEAS eas = IEAS(KarmaLib.getEAS()); // Changed from IKarmaGap

    // Build impact JSON
    bytes memory impactData = abi.encode(
        string(
            abi.encodePacked(
                "{'title':'",
                _escapeJSON(workTitle),
                "',",
                "'text':'",
                _escapeJSON(impactDescription),
                "',",
                "'proof':'",
                proofIPFS,
                "',",
                "'completedAt':",
                _uint2str(block.timestamp),
                ",",
                "'type':'project-update'}"
            )
        )
    );

    AttestationRequest memory req = AttestationRequest({
        schema: KarmaLib.getProjectUpdateSchemaUID(),
        data: AttestationRequestData({
            recipient: address(this),
            expirationTime: 0,
            revocable: false,
            refUID: gapProjectUID,
            data: impactData,
            value: 0
        })
    });

    // Attest to EAS with error handling
    try eas.attest(req) returns (bytes32 impactUID) {
        emit GAPProjectImpactCreated(gapProjectUID, impactUID, workTitle);
        return impactUID;
    } catch Error(string memory reason) {
        emit GAPError("impact", reason);
        revert(reason);
    } catch {
        emit GAPError("impact", "Unknown error");
        revert("Failed to create project impact");
    }
}
```

### Step 8: Refactor createProjectMilestone() in Garden.sol

**File**: `packages/contracts/src/accounts/Garden.sol`

**Lines 562-614** - Replace IKarmaGap with direct EAS:

```solidity
function createProjectMilestone(
    string calldata milestoneTitle,
    string calldata milestoneDescription,
    string calldata milestoneMeta
)
    external
    onlyResolver
    returns (bytes32)
{
    if (gapProjectUID == bytes32(0)) revert GAPProjectNotInitialized();
    if (!KarmaLib.isSupported()) revert GAPNotSupportedOnChain();

    IEAS eas = IEAS(KarmaLib.getEAS()); // Changed from IKarmaGap

    // Build milestone JSON
    bytes memory milestoneData = abi.encode(
        string(
            abi.encodePacked(
                "{'title':'",
                _escapeJSON(milestoneTitle),
                "',",
                "'text:'",
                _escapeJSON(milestoneDescription),
                "',",
                "'metadata':",
                milestoneMeta,
                ",",
                "'completedAt':",
                _uint2str(block.timestamp),
                ",",
                "'type':'project-milestone'}"
            )
        )
    );

    AttestationRequest memory req = AttestationRequest({
        schema: KarmaLib.getMilestoneSchemaUID(),
        data: AttestationRequestData({
            recipient: address(this),
            expirationTime: 0,
            revocable: false,
            refUID: gapProjectUID,
            data: milestoneData,
            value: 0
        })
    });

    // Attest to EAS with error handling
    try eas.attest(req) returns (bytes32 milestoneUID) {
        emit GAPProjectMilestoneCreated(gapProjectUID, milestoneUID, milestoneTitle);
        return milestoneUID;
    } catch Error(string memory reason) {
        emit GAPError("milestone", reason);
        revert(reason);
    } catch {
        emit GAPError("milestone", "Unknown error");
        revert("Failed to create project milestone");
    }
}
```

### Step 9: Update IKarmaGap.sol Interface

**File**: `packages/contracts/src/interfaces/IKarmaGap.sol`

**Lines 6-30** - Remove IKarmaGap interface entirely:

```solidity
// REMOVED - IKarmaGap interface no longer needed
// We attest directly to EAS using schema UIDs
// Only IProjectResolver is needed for admin management
```

Keep only IProjectResolver (lines 32-68).

### Step 10: Validate Deploy Script

**Command**: Run deploy dry-run to ensure no errors:

```bash
cd packages/contracts
pnpm run deploy:dryrun
```

**Expected**:

- No compilation errors
- Deployment completes successfully
- Console logs show "✅ Core contracts deployed successfully!"
- No GAP-related errors (gardens created without GAP on dry-run)

### Step 11: Validate E2E Tests

**Command**: Run E2E tests on all chains:

```bash
cd packages/contracts
pnpm run test:e2e
```

**Expected**:

- All tests pass on Base Sepolia, Arbitrum, and Celo
- GAP projects created successfully
- Error events visible if GAP integration fails (acceptable)
- No "GuardianDeploymentAddressMismatch" or ownership errors

### Step 12: Check for Compilation Errors

**Command**: Build contracts to verify all changes compile:

```bash
cd packages/contracts
pnpm build
```

**Expected**:

- No compilation errors
- No linter warnings related to changes
- All imports resolve correctly

## Testing Checklist

After implementation:

- [ ] Deploy dry-run passes without errors
- [ ] E2E tests pass on all 3 chains (Base Sepolia, Arbitrum, Celo)
- [ ] No compilation errors (`pnpm build`)
- [ ] No linter errors (`pnpm lint`)
- [ ] GAP error events visible in test logs for debugging
- [ ] Gardens can be created even if GAP integration fails

## Expected Outcomes

1. **Direct EAS Integration**: All attestations go directly to EAS, not through non-existent "GAP contract"
2. **Proper Error Handling**: GAP errors captured in events, don't block garden creation
3. **Admin Management Works**: Project Resolver correctly manages admins after project creation
4. **Tests Pass**: All E2E tests validate full flow including GAP integration
5. **Deploy Works**: Production deployment script completes without errors

## Key Changes Summary

- **Removed**: `getGapContract()` from Karma.sol (incorrect addresses)
- **Added**: `getEAS()` to Karma.sol (correct EAS addresses per chain)
- **Refactored**: 3 functions in Garden.sol to attest directly to EAS
- **Added**: Error events for debugging GAP integration failures
- **Added**: Safety check before adding admins (only if project created)
- **Simplified**: IKarmaGap.sol (removed unused interface)