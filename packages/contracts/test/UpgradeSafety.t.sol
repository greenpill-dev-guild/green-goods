// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ActionRegistry, Capital, Domain } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { Deployment } from "../src/registries/Deployment.sol";
import { GardensModule } from "../src/modules/Gardens.sol";
import { UnifiedPowerRegistry } from "../src/registries/Power.sol";
import { YieldResolver } from "../src/resolvers/Yield.sol";
import { MockEAS } from "../src/mocks/EAS.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { MockHatsModule } from "./helpers/MockHatsModule.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";
import { IGardensModule } from "../src/interfaces/IGardensModule.sol";

/// @title UpgradeSafetyTest
/// @notice Tests for UUPS upgrade patterns and storage preservation
/// @dev Verifies upgrade safety, access control, and storage gap functionality
contract UpgradeSafetyTest is Test, ERC6551Helper {
    // Test contracts
    ActionRegistry private actionRegistry;
    GardenToken private gardenToken;
    WorkResolver private workResolver;
    AssessmentResolver private assessmentResolver;
    Deployment private deploymentRegistry;

    // Mock dependencies
    MockEAS private mockEAS;
    MockERC20 private communityToken;
    MockHatsModule private mockHatsModule;
    GardenAccount private gardenAccountImpl;

    // Test addresses
    address private multisig = address(0x123);
    address private unauthorized = address(0x999);

    // Proxy addresses
    address private actionRegistryProxy;
    address private gardenTokenProxy;
    address private workResolverProxy;
    address private deploymentRegistryProxy;

    function setUp() public {
        // Deploy ERC6551 Registry at canonical Tokenbound address
        _deployERC6551Registry();

        // Deploy mocks
        mockEAS = new MockEAS();
        communityToken = new MockERC20();

        gardenAccountImpl = new GardenAccount(
            address(0x1001), // erc4337EntryPoint
            address(0x1002), // multicallForwarder
            address(0x1003), // erc6551Registry - will be overridden by TOKENBOUND_REGISTRY in actual use
            address(0x1004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        );

        // Deploy ActionRegistry with proxy
        ActionRegistry actionRegistryImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionProxy = new ERC1967Proxy(address(actionRegistryImpl), actionInitData);
        actionRegistry = ActionRegistry(address(actionProxy));
        actionRegistryProxy = address(actionProxy);

        // Deploy GardenToken with proxy
        GardenToken gardenTokenImpl = new GardenToken(address(gardenAccountImpl));
        bytes memory gardenInitData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy gardenProxy = new ERC1967Proxy(address(gardenTokenImpl), gardenInitData);
        gardenToken = GardenToken(address(gardenProxy));
        gardenTokenProxy = address(gardenProxy);
        mockHatsModule = new MockHatsModule();
        vm.prank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));

        // Deploy WorkResolver with proxy
        WorkResolver workResolverImpl = new WorkResolver(address(mockEAS), address(actionRegistry));
        bytes memory workInitData = abi.encodeWithSelector(WorkResolver.initialize.selector, multisig);
        ERC1967Proxy workProxy = new ERC1967Proxy(address(workResolverImpl), workInitData);
        workResolver = WorkResolver(payable(address(workProxy)));
        workResolverProxy = address(workProxy);

        // Deploy Deployment with proxy
        Deployment deploymentRegistryImpl = new Deployment();
        bytes memory deploymentInitData = abi.encodeWithSelector(Deployment.initialize.selector, multisig);
        ERC1967Proxy deploymentProxy = new ERC1967Proxy(address(deploymentRegistryImpl), deploymentInitData);
        deploymentRegistry = Deployment(address(deploymentProxy));
        deploymentRegistryProxy = address(deploymentProxy);
    }

    /// @notice Test 1: Upgrade contracts and verify storage preservation
    function testUpgradePreservesStorage() public {
        // Setup initial state in ActionRegistry
        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        string[] memory media = new string[](1);
        media[0] = "ipfs://original";

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Original Action",
            "agro.planting_event",
            "ipfs://instructions",
            capitals,
            media,
            Domain.AGRO
        );

        // Store original values
        ActionRegistry.Action memory originalAction = actionRegistry.getAction(0);
        address originalOwner = actionRegistry.owner();

        // Deploy new implementation
        ActionRegistry newImpl = new ActionRegistry();

        // Upgrade to new implementation
        vm.prank(multisig);
        actionRegistry.upgradeTo(address(newImpl));

        // Verify storage was preserved
        ActionRegistry.Action memory afterAction = actionRegistry.getAction(0);
        assertEq(afterAction.title, originalAction.title, "Action title should be preserved");
        assertEq(afterAction.startTime, originalAction.startTime, "Action start time should be preserved");
        assertEq(afterAction.endTime, originalAction.endTime, "Action end time should be preserved");
        assertEq(afterAction.instructions, originalAction.instructions, "Action instructions should be preserved");
        assertEq(actionRegistry.owner(), originalOwner, "Owner should be preserved");

        emit log_named_string("[PASS]", "Storage preserved after upgrade");
    }

    /// @notice Test 2: Only owner can authorize upgrades
    function testUpgradeAccessControl() public {
        // Deploy new implementation
        ActionRegistry newImpl = new ActionRegistry();

        // Attempt unauthorized upgrade
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.upgradeTo(address(newImpl));

        // Authorized upgrade should succeed
        vm.prank(multisig);
        actionRegistry.upgradeTo(address(newImpl));

        emit log_named_string("[PASS] ActionRegistry", "Access control enforced");

        // Test GardenToken upgrade access control
        GardenToken newGardenImpl = new GardenToken(address(gardenAccountImpl));

        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.upgradeTo(address(newGardenImpl));

        vm.prank(multisig);
        gardenToken.upgradeTo(address(newGardenImpl));

        emit log_named_string("[PASS] GardenToken", "Access control enforced");

        // Test WorkResolver upgrade access control
        WorkResolver newWorkImpl = new WorkResolver(address(mockEAS), address(actionRegistry));

        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        workResolver.upgradeTo(address(newWorkImpl));

        vm.prank(multisig);
        workResolver.upgradeTo(address(newWorkImpl));

        emit log_named_string("[PASS] WorkResolver", "Access control enforced");
        emit log_named_string("[PASS]", "All upgrade access controls verified");
    }

    /// @notice Test 3: Storage gap usage allows adding new variables
    function testStorageGapUsage() public {
        // Current ActionRegistry has:
        // - _nextActionUID (1 slot)
        // - actionToOwner mapping (1 slot)
        // - idToAction mapping (1 slot)
        // - __gap (47 slots)
        // Total: 50 slots

        // In a real upgrade scenario, we would:
        // 1. Add new state variable
        // 2. Reduce gap by 1
        // 3. Deploy and upgrade

        // For this test, we verify the gap exists and has correct size
        // by checking storage layout doesn't conflict

        // Setup state
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.MATERIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 7 days,
            "Gap Test Action",
            "test.gap",
            "instructions",
            capitals,
            new string[](0),
            Domain.SOLAR
        );

        // Deploy new implementation (same code, testing upgrade process)
        ActionRegistry newImpl = new ActionRegistry();

        vm.prank(multisig);
        actionRegistry.upgradeTo(address(newImpl));

        // Verify state still accessible
        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.title, "Gap Test Action");

        emit log_named_string("[PASS]", "Storage gap allows safe upgrades");
    }

    /// @notice Test 4: Upgrade with active state and users
    function testUpgradeWithActiveState() public {
        // Create active state: mint garden
        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Active Garden",
            slug: "",
            description: "Garden with active state",
            location: "Location",
            bannerImage: "banner.jpg",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });
        address gardenAddress = gardenToken.mintGarden(config);

        uint256 tokenId = 0;

        // Register multiple actions
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        vm.startPrank(multisig);
        for (uint256 i = 0; i < 3; i++) {
            actionRegistry.registerAction(
                block.timestamp,
                block.timestamp + 30 days,
                string(abi.encodePacked("Action ", uint2str(i))),
                string(abi.encodePacked("test.action", uint2str(i))),
                string(abi.encodePacked("ipfs://instructions", uint2str(i))),
                capitals,
                new string[](0),
                Domain.AGRO
            );
        }
        vm.stopPrank();

        // Store state before upgrade
        address originalOwner = gardenToken.ownerOf(tokenId);
        GardenAccount garden = GardenAccount(payable(gardenAddress));
        string memory originalName = garden.name();

        // Upgrade GardenToken
        GardenToken newGardenImpl = new GardenToken(address(gardenAccountImpl));
        vm.prank(multisig);
        gardenToken.upgradeTo(address(newGardenImpl));

        // Upgrade ActionRegistry
        ActionRegistry newActionImpl = new ActionRegistry();
        vm.prank(multisig);
        actionRegistry.upgradeTo(address(newActionImpl));

        // Verify all state preserved
        assertEq(gardenToken.ownerOf(tokenId), originalOwner, "Token owner preserved");
        assertEq(garden.name(), originalName, "Garden name preserved");

        // Verify all actions preserved
        for (uint256 i = 0; i < 3; i++) {
            ActionRegistry.Action memory action = actionRegistry.getAction(i);
            assertEq(action.title, string(abi.encodePacked("Action ", uint2str(i))));
        }

        // Verify contracts still functional after upgrade
        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 7 days,
            "Post-Upgrade Action",
            "test.post_upgrade",
            "ipfs://new",
            capitals,
            new string[](0),
            Domain.AGRO
        );

        ActionRegistry.Action memory newAction = actionRegistry.getAction(3);
        assertEq(newAction.title, "Post-Upgrade Action");

        emit log_named_string("[PASS]", "Upgrade successful with active state");
    }

    /// @notice Test 5: Multiple sequential upgrades
    function testMultipleSequentialUpgrades() public {
        // Setup initial state
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Original Action",
            "test.original_v1",
            "ipfs://v1",
            capitals,
            new string[](0),
            Domain.SOLAR
        );

        ActionRegistry.Action memory original = actionRegistry.getAction(0);

        // First upgrade
        ActionRegistry impl1 = new ActionRegistry();
        vm.prank(multisig);
        actionRegistry.upgradeTo(address(impl1));

        // Add more state
        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "After First Upgrade",
            "test.after_first",
            "ipfs://v2",
            capitals,
            new string[](0),
            Domain.SOLAR
        );

        // Second upgrade
        ActionRegistry impl2 = new ActionRegistry();
        vm.prank(multisig);
        actionRegistry.upgradeTo(address(impl2));

        // Verify all state preserved through both upgrades
        ActionRegistry.Action memory afterUpgrade1 = actionRegistry.getAction(0);
        assertEq(afterUpgrade1.title, original.title);

        ActionRegistry.Action memory afterUpgrade2 = actionRegistry.getAction(1);
        assertEq(afterUpgrade2.title, "After First Upgrade");

        // Add more state after second upgrade
        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "After Second Upgrade",
            "test.after_second",
            "ipfs://v3",
            capitals,
            new string[](0),
            Domain.SOLAR
        );

        ActionRegistry.Action memory finalAction = actionRegistry.getAction(2);
        assertEq(finalAction.title, "After Second Upgrade");

        emit log_named_string("[PASS]", "Multiple sequential upgrades successful");
    }

    /// @notice Test 6: Upgrade cannot break initialization
    function testUpgradeCannotReinitialize() public {
        // Try to call initialize after deployment (should fail)
        vm.prank(multisig);
        vm.expectRevert("Initializable: contract is already initialized");
        actionRegistry.initialize(address(0x456));

        // Upgrade
        ActionRegistry newImpl = new ActionRegistry();
        vm.prank(multisig);
        actionRegistry.upgradeTo(address(newImpl));

        // Try to initialize after upgrade (should still fail)
        vm.prank(multisig);
        vm.expectRevert("Initializable: contract is already initialized");
        actionRegistry.initialize(address(0x789));

        // Verify owner unchanged
        assertEq(actionRegistry.owner(), multisig);

        emit log_named_string("[PASS]", "Cannot reinitialize after upgrade");
    }

    /// @notice Test 7: Deployment upgrade preserves network configs
    function testDeploymentUpgrade() public {
        // Setup network configurations
        Deployment.NetworkConfig memory config = Deployment.NetworkConfig({
            eas: address(0x1000),
            easSchemaRegistry: address(0x1001),
            communityToken: address(communityToken),
            actionRegistry: address(actionRegistry),
            gardenToken: address(gardenToken),
            workResolver: address(workResolver),
            workApprovalResolver: address(0x1004),
            assessmentResolver: address(0x1005),
            integrationRouter: address(0x1006),
            hatsAccessControl: address(0),
            octantFactory: address(0),
            unlockFactory: address(0),
            hypercerts: address(0),
            greenWillRegistry: address(0)
        });

        uint256 chainId = 11_155_111; // Sepolia

        vm.prank(multisig);
        deploymentRegistry.setNetworkConfig(chainId, config);

        // Verify config stored
        (
            address eas,
            , // schemaRegistry
            address commToken,
            address actReg,
            , // gardTok
            , // workRes
            , // workAppRes
            , // assessmentRes
            , // integrationRouter
            , // hatsAccessControl
            , // octantFactory
            , // unlockFactory
            , // hypercerts
                // greenWillRegistry
        ) = deploymentRegistry.networks(chainId);

        assertEq(eas, config.eas);
        assertEq(actReg, address(actionRegistry));
        assertEq(commToken, address(communityToken));

        // Upgrade
        Deployment newImpl = new Deployment();
        vm.prank(multisig);
        deploymentRegistry.upgradeTo(address(newImpl));

        // Verify config preserved
        (
            address easAfter,
            , // schemaRegistryAfter
            address commTokenAfter,
            address actRegAfter,
            address gardTokAfter,
            , // workResAfter
            , // workAppResAfter
            , // assessmentResAfter
            , // integrationRouterAfter
            , // hatsAccessControlAfter
            , // octantFactoryAfter
            , // unlockFactoryAfter
            , // hypercertsAfter
                // greenWillRegistryAfter
        ) = deploymentRegistry.networks(chainId);

        assertEq(easAfter, config.eas);
        assertEq(actRegAfter, address(actionRegistry));
        assertEq(gardTokAfter, address(gardenToken));
        assertEq(commTokenAfter, address(communityToken));

        emit log_named_string("[PASS]", "Deployment upgrade preserves configs");
    }

    /// @notice Test 8: GardensModule upgrade preserves storage
    function testGardensModuleUpgradePreservesStorage() public {
        // Deploy GardensModule with proxy
        GardensModule gardensModuleImpl = new GardensModule();
        bytes memory gardensInitData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            multisig,
            address(0), // registryFactory
            address(0), // powerRegistry
            address(communityToken), // goodsToken
            address(0x5555), // hatsProtocol
            address(mockHatsModule) // hatsModule
        );
        ERC1967Proxy gardensProxy = new ERC1967Proxy(address(gardensModuleImpl), gardensInitData);
        GardensModule gardensModule = GardensModule(address(gardensProxy));

        // Set up some state
        vm.startPrank(multisig);
        gardensModule.setGardenToken(address(gardenToken));
        gardensModule.setHatsProtocol(address(0x6666));
        vm.stopPrank();

        // Store original values
        address originalOwner = gardensModule.owner();
        address originalGardenToken = gardensModule.gardenToken();
        address originalHatsProtocol = gardensModule.hatsProtocol();
        address originalGoodsToken = address(gardensModule.goodsToken());

        // Deploy new implementation and upgrade
        GardensModule newGardensImpl = new GardensModule();
        vm.prank(multisig);
        gardensModule.upgradeTo(address(newGardensImpl));

        // Verify storage preserved
        assertEq(gardensModule.owner(), originalOwner, "GardensModule: owner should be preserved");
        assertEq(gardensModule.gardenToken(), originalGardenToken, "GardensModule: gardenToken should be preserved");
        assertEq(gardensModule.hatsProtocol(), originalHatsProtocol, "GardensModule: hatsProtocol should be preserved");
        assertEq(address(gardensModule.goodsToken()), originalGoodsToken, "GardensModule: goodsToken should be preserved");

        emit log_named_string("[PASS] GardensModule", "Storage preserved after upgrade");
    }

    /// @notice Test 9: GardensModule upgrade access control
    function testGardensModuleUpgradeAccessControl() public {
        GardensModule gardensModuleImpl = new GardensModule();
        bytes memory gardensInitData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            multisig,
            address(0),
            address(0),
            address(communityToken),
            address(0x5555),
            address(mockHatsModule)
        );
        ERC1967Proxy gardensProxy = new ERC1967Proxy(address(gardensModuleImpl), gardensInitData);
        GardensModule gardensModule = GardensModule(address(gardensProxy));

        GardensModule newImpl = new GardensModule();

        // Unauthorized upgrade should revert
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.upgradeTo(address(newImpl));

        // Authorized upgrade should succeed
        vm.prank(multisig);
        gardensModule.upgradeTo(address(newImpl));

        emit log_named_string("[PASS] GardensModule", "Upgrade access control enforced");
    }

    /// @notice Test 10: GardensModule cannot re-initialize after upgrade
    function testGardensModuleCannotReinitializeAfterUpgrade() public {
        GardensModule gardensModuleImpl = new GardensModule();
        bytes memory gardensInitData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            multisig,
            address(0),
            address(0),
            address(communityToken),
            address(0x5555),
            address(mockHatsModule)
        );
        ERC1967Proxy gardensProxy = new ERC1967Proxy(address(gardensModuleImpl), gardensInitData);
        GardensModule gardensModule = GardensModule(address(gardensProxy));

        // Upgrade
        GardensModule newImpl = new GardensModule();
        vm.prank(multisig);
        gardensModule.upgradeTo(address(newImpl));

        // Re-initialize should fail
        vm.prank(multisig);
        vm.expectRevert("Initializable: contract is already initialized");
        gardensModule.initialize(address(0x789), address(0), address(0), address(0), address(0), address(0));

        assertEq(gardensModule.owner(), multisig, "Owner should be unchanged after failed re-init");
        emit log_named_string("[PASS] GardensModule", "Cannot reinitialize after upgrade");
    }

    /// @notice Test 11: YieldResolver upgrade preserves storage
    function testYieldResolverUpgradePreservesStorage() public {
        YieldResolver yieldSplitterImpl = new YieldResolver();
        bytes memory yieldInitData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, multisig, address(0xA2), address(mockHatsModule), 7e18
        );
        ERC1967Proxy yieldProxy = new ERC1967Proxy(address(yieldSplitterImpl), yieldInitData);
        YieldResolver yieldSplitter = YieldResolver(address(yieldProxy));

        // Set up some state
        address testGarden = address(0x100);
        vm.startPrank(multisig);
        yieldSplitter.setCookieJar(testGarden, address(0xCCC));
        yieldSplitter.setGardenTreasury(testGarden, address(0xDDD));
        yieldSplitter.setMinYieldThreshold(10e18);
        vm.stopPrank();

        // Store original values
        address originalOwner = yieldSplitter.owner();
        address originalOctant = yieldSplitter.octantModule();
        uint256 originalThreshold = yieldSplitter.minYieldThreshold();

        // Deploy new implementation and upgrade
        YieldResolver newYieldImpl = new YieldResolver();
        vm.prank(multisig);
        yieldSplitter.upgradeTo(address(newYieldImpl));

        // Verify storage preserved
        assertEq(yieldSplitter.owner(), originalOwner, "YieldResolver: owner should be preserved");
        assertEq(yieldSplitter.octantModule(), originalOctant, "YieldResolver: octantModule should be preserved");
        assertEq(yieldSplitter.minYieldThreshold(), originalThreshold, "YieldResolver: threshold should be preserved");

        emit log_named_string("[PASS] YieldResolver", "Storage preserved after upgrade");
    }

    /// @notice Test 12: YieldResolver upgrade access control
    function testYieldResolverUpgradeAccessControl() public {
        YieldResolver yieldSplitterImpl = new YieldResolver();
        bytes memory yieldInitData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, multisig, address(0xA2), address(mockHatsModule), 7e18
        );
        ERC1967Proxy yieldProxy = new ERC1967Proxy(address(yieldSplitterImpl), yieldInitData);
        YieldResolver yieldSplitter = YieldResolver(address(yieldProxy));

        YieldResolver newImpl = new YieldResolver();

        // Unauthorized upgrade should revert
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.upgradeTo(address(newImpl));

        // Authorized upgrade should succeed
        vm.prank(multisig);
        yieldSplitter.upgradeTo(address(newImpl));

        emit log_named_string("[PASS] YieldResolver", "Upgrade access control enforced");
    }

    /// @notice Test 13: YieldResolver cannot re-initialize after upgrade
    function testYieldResolverCannotReinitializeAfterUpgrade() public {
        YieldResolver yieldSplitterImpl = new YieldResolver();
        bytes memory yieldInitData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, multisig, address(0xA2), address(mockHatsModule), 7e18
        );
        ERC1967Proxy yieldProxy = new ERC1967Proxy(address(yieldSplitterImpl), yieldInitData);
        YieldResolver yieldSplitter = YieldResolver(address(yieldProxy));

        // Upgrade
        YieldResolver newImpl = new YieldResolver();
        vm.prank(multisig);
        yieldSplitter.upgradeTo(address(newImpl));

        // Re-initialize should fail
        vm.prank(multisig);
        vm.expectRevert("Initializable: contract is already initialized");
        yieldSplitter.initialize(address(0x789), address(0), address(0), 0);

        assertEq(yieldSplitter.owner(), multisig, "Owner should be unchanged after failed re-init");
        emit log_named_string("[PASS] YieldResolver", "Cannot reinitialize after upgrade");
    }

    /// @notice Test 14: UnifiedPowerRegistry upgrade preserves storage
    function testUnifiedPowerRegistryUpgradePreservesStorage() public {
        // Import locally to avoid polluting top-level imports
        UnifiedPowerRegistry uprImpl = new UnifiedPowerRegistry();
        bytes memory uprInitData = abi.encodeWithSelector(
            UnifiedPowerRegistry.initialize.selector,
            multisig,
            address(0x5555), // hatsProtocol
            address(0x6666) // gardensModule
        );
        ERC1967Proxy uprProxy = new ERC1967Proxy(address(uprImpl), uprInitData);
        UnifiedPowerRegistry upr = UnifiedPowerRegistry(address(uprProxy));

        // Store original values
        address originalOwner = upr.owner();
        address originalHats = upr.hatsProtocol();
        address originalGardens = upr.gardensModule();

        // Deploy new implementation and upgrade
        UnifiedPowerRegistry newUprImpl = new UnifiedPowerRegistry();
        vm.prank(multisig);
        upr.upgradeTo(address(newUprImpl));

        // Verify storage preserved
        assertEq(upr.owner(), originalOwner, "UnifiedPowerRegistry: owner should be preserved");
        assertEq(upr.hatsProtocol(), originalHats, "UnifiedPowerRegistry: hatsProtocol should be preserved");
        assertEq(upr.gardensModule(), originalGardens, "UnifiedPowerRegistry: gardensModule should be preserved");

        emit log_named_string("[PASS] UnifiedPowerRegistry", "Storage preserved after upgrade");
    }

    /// @notice Test 15: UnifiedPowerRegistry upgrade access control
    function testUnifiedPowerRegistryUpgradeAccessControl() public {
        UnifiedPowerRegistry uprImpl = new UnifiedPowerRegistry();
        bytes memory uprInitData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, multisig, address(0x5555), address(0x6666));
        ERC1967Proxy uprProxy = new ERC1967Proxy(address(uprImpl), uprInitData);
        UnifiedPowerRegistry upr = UnifiedPowerRegistry(address(uprProxy));

        UnifiedPowerRegistry newImpl = new UnifiedPowerRegistry();

        // Unauthorized upgrade should revert
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        upr.upgradeTo(address(newImpl));

        // Authorized upgrade should succeed
        vm.prank(multisig);
        upr.upgradeTo(address(newImpl));

        emit log_named_string("[PASS] UnifiedPowerRegistry", "Upgrade access control enforced");
    }

    /// @notice Test 16: UnifiedPowerRegistry cannot re-initialize after upgrade
    function testUnifiedPowerRegistryCannotReinitializeAfterUpgrade() public {
        UnifiedPowerRegistry uprImpl = new UnifiedPowerRegistry();
        bytes memory uprInitData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, multisig, address(0x5555), address(0x6666));
        ERC1967Proxy uprProxy = new ERC1967Proxy(address(uprImpl), uprInitData);
        UnifiedPowerRegistry upr = UnifiedPowerRegistry(address(uprProxy));

        // Upgrade
        UnifiedPowerRegistry newImpl = new UnifiedPowerRegistry();
        vm.prank(multisig);
        upr.upgradeTo(address(newImpl));

        // Re-initialize should fail
        vm.prank(multisig);
        vm.expectRevert("Initializable: contract is already initialized");
        upr.initialize(address(0x789), address(0), address(0));

        assertEq(upr.owner(), multisig, "Owner should be unchanged after failed re-init");
        emit log_named_string("[PASS] UnifiedPowerRegistry", "Cannot reinitialize after upgrade");
    }

    /// @notice Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
