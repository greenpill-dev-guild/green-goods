<!-- 20ff98f2-ccb1-467d-b683-f43cf743366d 5b0ed4df-a123-4821-84ba-8ba99a586b8e -->
# Fix E2E Tests - Use Deploy Script + Complete User Flows

## Overview

Refactor E2E tests to leverage the existing Deploy script for setup (ensuring tests match production deployment exactly), cover ALL critical user workflows, validate integration with real Karma GAP contracts, add comprehensive TBA validation, and fix interface mismatches.

## Phase 1: Create Deployment Test Helper

Extract deployment logic from Deploy.s.sol into a reusable base contract that both the deploy script and E2E tests can use without breaking existing functionality.

### File: `test/helpers/DeploymentBase.sol` (NEW)

Create a base contract that contains all deployment logic:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { DeployHelper } from "../../script/DeployHelper.sol";
import { DeploymentRegistry } from "../../src/DeploymentRegistry.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { WorkResolver } from "../../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../../src/resolvers/Assessment.sol";

abstract contract DeploymentBase is Test, DeployHelper {
    // Deployment state - available to inheriting contracts
    DeploymentRegistry public deploymentRegistry;
    GardenAccount public gardenAccountImpl;
    GardenToken public gardenToken;
    ActionRegistry public actionRegistry;
    WorkResolver public workResolver;
    WorkApprovalResolver public workApprovalResolver;
    AssessmentResolver public assessmentResolver;
    
    // Schema UIDs - populated during deployment
    bytes32 public workSchemaUID;
    bytes32 public workApprovalSchemaUID;
    bytes32 public assessmentSchemaUID;
    
    address public deployer;
    
    /// @notice Deploy full stack on current fork
    /// @param communityToken The community token for this chain
    /// @param multisig The multisig address (for ownership)
    function deployFullStack(address communityToken, address multisig) internal {
        deployer = msg.sender;
        
        // 1. Deploy DeploymentRegistry
        deploymentRegistry = new DeploymentRegistry();
        deploymentRegistry.initialize(deployer);
        
        // 2. Get EAS addresses for current chain
        (address eas, address easSchemaRegistry) = _getEASForChain(block.chainid);
        
        // 3. Deploy all core contracts (same logic as Deploy.s.sol)
        _deployCore(communityToken, multisig, eas, easSchemaRegistry);
        
        // 4. Register EAS schemas (same logic as Deploy.s.sol)
        _registerSchemas(eas, easSchemaRegistry);
        
        // 5. Configure deployment registry
        _configureRegistry();
    }
    
    function _deployCore(
        address communityToken,
        address multisig,
        address eas,
        address easSchemaRegistry
    ) private {
        // Deploy GardenAccount implementation
        gardenAccountImpl = new GardenAccount(
            TBALib.ENTRYPOINT,
            TBALib.MULTICALL_FORWARDER,
            TBALib.REGISTRY,
            deployer,
            address(0),  // workApprovalResolver - set later
            address(0)   // assessmentResolver - set later
        );
        
        // Deploy GardenToken
        gardenToken = new GardenToken(address(gardenAccountImpl));
        gardenToken.initialize(multisig, address(deploymentRegistry));
        
        // Deploy ActionRegistry
        actionRegistry = new ActionRegistry();
        actionRegistry.initialize(multisig);
        
        // Deploy WorkResolver
        WorkResolver workResolverImpl = new WorkResolver(
            address(deploymentRegistry),
            address(actionRegistry)
        );
        bytes memory workResolverInitData = abi.encodeWithSelector(
            WorkResolver.initialize.selector,
            multisig
        );
        ERC1967Proxy workResolverProxy = new ERC1967Proxy(
            address(workResolverImpl),
            workResolverInitData
        );
        workResolver = WorkResolver(payable(address(workResolverProxy)));
        
        // Deploy WorkApprovalResolver
        WorkApprovalResolver workApprovalResolverImpl = new WorkApprovalResolver(
            address(deploymentRegistry),
            address(actionRegistry)
        );
        bytes memory workApprovalResolverInitData = abi.encodeWithSelector(
            WorkApprovalResolver.initialize.selector,
            multisig
        );
        ERC1967Proxy workApprovalResolverProxy = new ERC1967Proxy(
            address(workApprovalResolverImpl),
            workApprovalResolverInitData
        );
        workApprovalResolver = WorkApprovalResolver(
            payable(address(workApprovalResolverProxy))
        );
        
        // Deploy AssessmentResolver
        AssessmentResolver assessmentResolverImpl = new AssessmentResolver(
            address(deploymentRegistry)
        );
        bytes memory assessmentResolverInitData = abi.encodeWithSelector(
            AssessmentResolver.initialize.selector,
            multisig
        );
        ERC1967Proxy assessmentResolverProxy = new ERC1967Proxy(
            address(assessmentResolverImpl),
            assessmentResolverInitData
        );
        assessmentResolver = AssessmentResolver(
            payable(address(assessmentResolverProxy))
        );
    }
    
    function _registerSchemas(address eas, address easSchemaRegistry) private {
        // Register Work schema
        workSchemaUID = ISchemaRegistry(easSchemaRegistry).register(
            "address garden,uint256 actionId,string description,string proofIPFS",
            address(workResolver),
            false
        );
        
        // Register WorkApproval schema
        workApprovalSchemaUID = ISchemaRegistry(easSchemaRegistry).register(
            "address garden,string feedback,uint256 rating",
            address(workApprovalResolver),
            false
        );
        
        // Register Assessment schema
        assessmentSchemaUID = ISchemaRegistry(easSchemaRegistry).register(
            "address garden,string title,string description,uint8 capital,uint256 score",
            address(assessmentResolver),
            false
        );
    }
    
    function _configureRegistry() private {
        DeploymentRegistry.NetworkConfig memory config = DeploymentRegistry.NetworkConfig({
            eas: _getEASForChain(block.chainid).eas,
            easSchemaRegistry: _getEASForChain(block.chainid).registry,
            communityToken: communityToken,
            actionRegistry: address(actionRegistry),
            gardenToken: address(gardenToken),
            workResolver: address(workResolver),
            workApprovalResolver: address(workApprovalResolver)
        });
        
        deploymentRegistry.setNetworkConfig(block.chainid, config);
    }
    
    function _getEASForChain(uint256 chainId) 
        private 
        pure 
        returns (address eas, address registry) 
    {
        if (chainId == 84_532) {
            // Base Sepolia
            return (
                0x4200000000000000000000000000000000000021,
                0x4200000000000000000000000000000000000020
            );
        } else if (chainId == 42_161) {
            // Arbitrum One
            return (
                0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458,
                0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB
            );
        } else if (chainId == 42_220) {
            // Celo
            return (
                0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92,
                0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34
            );
        }
        revert("Unsupported chain");
    }
}
```

**Benefits:**

- E2E tests inherit from DeploymentBase
- Deploy.s.sol continues to work unchanged (uses its own logic)
- Tests get exact production deployment setup
- Single source of truth for test deployments

---

## Phase 2: Create Complete Sequence Diagrams

Create 6 mermaid diagrams covering all user flows.

### File: `test/E2E_TEST_FLOWS.md`

Add comprehensive sequence diagrams showing:

1. Garden Creation + GAP Project + TBA
2. Action Registration
3. Complete Work Flow (Submit → Approve → Impact)
4. Assessment Flow (Create → Milestone)
5. Operator Sync
6. TBA Ownership & Transfer

---

## Phase 3: Fix IKarmaGap Interface

Update to match real deployed contracts.

### File: `src/interfaces/IKarmaGap.sol`

**Changes:**

- `isProjectAdmin()` → `isAdmin()`
- `isProjectOwner()` → `isOwner()`
- Remove `getProjectAdmins()` (doesn't exist)
- Add `projectAdmins(projectId, addr)` mapping accessor

---

## Phase 4: Remove EAS Helpers

Delete `test/helpers/EASHelper.sol` - validate at Karma GAP level only.

---

## Phase 5: Update Garden.sol Helper Methods

### File: `src/accounts/Garden.sol`

Remove `getGAPProjectAdmins()` and fix method names to use `isAdmin()` and `isOwner()`.

---

## Phase 6: Refactor E2E Tests Using DeploymentBase

### File: `test/E2EKarmaGAPFork.t.sol`

**New Structure:**

```solidity
import { Test } from "forge-std/Test.sol";
import { DeploymentBase } from "./helpers/DeploymentBase.sol";
import { IEAS, Attestation } from "@eas/IEAS.sol";
import { IKarmaGap, IProjectResolver } from "../src/interfaces/IKarmaGap.sol";
import { KarmaLib } from "../src/lib/Karma.sol";
import { Capital } from "../src/registries/Action.sol";

contract E2EKarmaGAPForkTest is DeploymentBase {
    address public operator;
    address public gardener;
    address public communityToken;
    address public multisig;
    
    function setUp() public {
        operator = makeAddr("operator");
        gardener = makeAddr("gardener");
        multisig = makeAddr("multisig");
        
        vm.deal(deployer, 100 ether);
        vm.deal(operator, 10 ether);
        vm.deal(gardener, 10 ether);
        vm.deal(multisig, 10 ether);
    }
    
    // ============================================
    // SUITE 1: Garden Creation + GAP + TBA (3 tests)
    // ============================================
    
    function testFork_GardenCreation_BaseSepolia() public {
        _skipIfNoRPC("BASE_SEPOLIA_RPC_URL");
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
        _testGardenCreation(84_532);
    }
    
    function _testGardenCreation(uint256 chainId) internal {
        // Deploy using shared deployment base
        communityToken = _getCommunityToken(chainId);
        deployFullStack(communityToken, multisig);  // Uses DeploymentBase!
        
        // Now all contracts are deployed: gardenToken, actionRegistry, resolvers, etc.
        
        // Test garden creation with TBA + GAP validation
        address[] memory gardeners = new address[](1);
        gardeners[0] = gardener;
        address[] memory operators = new address[](1);
        operators[0] = operator;
        
        address gardenAddr = gardenToken.mintGarden(
            communityToken,
            "E2E Test Garden",
            "Testing",
            "Location",
            "ipfs://banner",
            gardeners,
            operators
        );
        
        // TBA Validation
        GardenAccount garden = GardenAccount(payable(gardenAddr));
        (,, uint256 tokenId) = garden.token();
        address nftHolder = gardenToken.ownerOf(tokenId);
        assertEq(garden.owner(), nftHolder, "TBA owner = NFT holder");
        
        // GAP Validation
        bytes32 projectUID = garden.getGAPProjectUID();
        assertTrue(projectUID != bytes32(0), "Project created");
        
        IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
        assertTrue(resolver.isAdmin(projectUID, operator), "Operator is admin");
    }
    
    // ============================================
    // SUITE 2: Action Registration (3 tests)
    // ============================================
    
    function testFork_ActionRegistration_BaseSepolia() public {
        _skipIfNoRPC("BASE_SEPOLIA_RPC_URL");
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
        _testActionRegistration(84_532);
    }
    
    function _testActionRegistration(uint256 chainId) internal {
        communityToken = _getCommunityToken(chainId);
        deployFullStack(communityToken, multisig);
        
        // Register action (actionRegistry is already deployed!)
        Capital[] memory caps = new Capital[](1);
        caps[0] = Capital.LIVING;
        string[] memory media = new string[](1);
        media[0] = "ipfs://test";
        
        vm.prank(multisig);
        uint256 actionId = actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Plant Native Trees",
            "Plant trees",
            caps,
            media
        );
        
        assertTrue(actionId > 0, "Action registered");
    }
    
    // ============================================
    // SUITE 3: Complete Work Flow (3 tests)
    // ============================================
    
    function testFork_CompleteWorkFlow_BaseSepolia() public {
        _skipIfNoRPC("BASE_SEPOLIA_RPC_URL");
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"));
        _testCompleteWorkFlow(84_532);
    }
    
    function _testCompleteWorkFlow(uint256 chainId) internal {
        communityToken = _getCommunityToken(chainId);
        deployFullStack(communityToken, multisig);
        
        // Create garden
        address gardenAddr = _createGarden();
        
        // Register action
        uint256 actionId = _registerAction();
        
        // Gardener submits work
        vm.prank(gardener);
        bytes32 workUID = _submitWork(gardenAddr, actionId);
        assertTrue(workUID != bytes32(0), "Work submitted");
        
        // Operator approves work
        vm.prank(operator);
        bytes32 approvalUID = _approveWork(gardenAddr, workUID);
        assertTrue(approvalUID != bytes32(0), "Work approved");
        
        // Verify GAP impact was created by WorkApprovalResolver
        // (Track via event logs)
    }
    
    // Helper: Submit work attestation
    function _submitWork(address garden, uint256 actionId) 
        internal 
        returns (bytes32) 
    {
        bytes memory workData = abi.encode(
            garden,
            actionId,
            "Planted 50 trees",
            "ipfs://photos"
        );
        
        IEAS eas = IEAS(_getEASForChain(block.chainid).eas);
        
        AttestationRequest memory req = AttestationRequest({
            schema: workSchemaUID,  // From DeploymentBase!
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: workData,
                value: 0
            })
        });
        
        return eas.attest(req);
    }
    
    // Similar helpers for _approveWork, _createAssessment, etc.
    
    // ============================================
    // SUITE 4: Assessment Flow (3 tests)
    // ============================================
    
    // ============================================
    // SUITE 5: Operator Sync (3 tests)
    // ============================================
    
    // ============================================
    // SUITE 6: Multi-Operator (3 tests)
    // ============================================
    
    // ============================================
    // SUITE 7: TBA Ownership (3 tests)
    // ============================================
    
    // Helper functions
    function _getCommunityToken(uint256 chainId) internal pure returns (address) {
        if (chainId == 84_532) return 0x4cB67033da4FD849a552A4C5553E7F532B93E516;
        if (chainId == 42_161) return 0x633d825006E4c659b061db7FB9378eDEe8bd95f3;
        if (chainId == 42_220) return 0x4cB67033da4FD849a552A4C5553E7F532B93E516;
        revert("Unsupported chain");
    }
    
    function _skipIfNoRPC(string memory envVar) internal {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            if (bytes(rpcUrl).length == 0) return;
        } catch {
            return;
        }
    }
}
```

**Key Benefits:**

- Uses `deployFullStack()` from DeploymentBase
- All contracts deployed exactly like production
- Schemas automatically registered
- Contract references (gardenToken, actionRegistry, etc.) available
- workSchemaUID, workApprovalSchemaUID, assessmentSchemaUID available
- No duplicate deployment logic

---

## Phase 7: Update Documentation

### File: `test/E2E_INTEGRATION_TESTS.md`

Document:

- How tests use DeploymentBase for production-accurate setup
- 7 test suites (21 total tests)
- Complete user flow coverage
- Sequence diagram references

---

## Success Criteria

**Phase 1: Deployment Helper**

- [ ] DeploymentBase.sol created
- [ ] Contains complete deployment logic
- [ ] Deploy.s.sol unchanged and still works
- [ ] Tests can inherit from DeploymentBase

**Phase 2: Diagrams**

- [ ] 6 mermaid sequence diagrams created

**Phase 3: Interface Fix**

- [ ] IKarmaGap.sol uses correct method names
- [ ] Compiles without errors

**Phase 4: Remove EAS Helpers**

- [ ] EASHelper.sol deleted

**Phase 5: Garden.sol Fix**

- [ ] Helper methods use correct interface names

**Phase 6: E2E Tests**

- [ ] 21 tests total (7 suites × 3 chains)
- [ ] Inherits from DeploymentBase
- [ ] Uses deployFullStack() for setup
- [ ] All contracts deployed via shared logic
- [ ] Schemas automatically registered
- [ ] Complete user flows tested

**Phase 7: Documentation**

- [ ] E2E_INTEGRATION_TESTS.md updated
- [ ] DeploymentBase usage documented

**Final Verification:**

```bash
cd packages/contracts
pnpm build  # Must compile
pnpm test   # Regular tests pass
# pnpm test:e2e  # E2E tests ready (requires RPC URLs)
```

**Test Coverage:**

- Garden creation + GAP + TBA ✓
- Action registration ✓
- Work submission ✓
- Work approval → GAP impact ✓
- Assessment → GAP milestone ✓
- Operator sync ✓
- TBA ownership ✓

**Total:** 21 E2E tests using production deployment logic

### To-dos

- [ ] Fix GardenToken immutable implementation bug to unblock E2EWorkflow tests
- [ ] Create EASHelper.sol with attestation query functions for deep validation
- [ ] Refactor E2EKarmaGAPFork into 5 test suites (15 tests total, 3 per chain)
- [ ] Implement full bidirectional validation in all test suites
- [ ] Add GAP query helper methods to Garden.sol contract
- [ ] Update package.json with per-chain E2E test scripts
- [ ] Create E2E_INTEGRATION_TESTS.md documentation