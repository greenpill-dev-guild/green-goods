// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";

/// @title IntegrationTest
/// @notice Comprehensive integration tests for the Green Goods protocol
/// @dev Tests full workflows across multiple contracts
contract IntegrationTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    ActionRegistry private actionRegistry;
    GardenAccount private gardenAccountImplementation;
    MockERC20 private communityToken;

    address private multisig = address(0x123);
    address private gardener1 = address(0x201);
    address private gardener2 = address(0x202);
    address private operator1 = address(0x301);

    address private gardenAccountAddress;
    GardenAccount private gardenAccount;

    function setUp() public {
        // Deploy ERC6551 Registry at canonical Tokenbound address
        _deployERC6551Registry();

        // Deploy community token
        communityToken = new MockERC20();

        // Deploy GardenAccount implementation
        gardenAccountImplementation = new GardenAccount(
            address(0x1001), // erc4337EntryPoint
            address(0x1002), // multicallForwarder
            address(0x1003), // erc6551Registry - will be overridden by TOKENBOUND_REGISTRY in actual use
            address(0x1004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        );

        // Deploy and initialize GardenToken
        GardenToken gardenTokenImpl = new GardenToken(address(gardenAccountImplementation));
        bytes memory gardenTokenInitData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy gardenTokenProxy = new ERC1967Proxy(address(gardenTokenImpl), gardenTokenInitData);
        gardenToken = GardenToken(address(gardenTokenProxy));

        // Deploy and initialize ActionRegistry
        ActionRegistry actionRegistryImpl = new ActionRegistry();
        bytes memory actionRegistryInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionRegistryProxy = new ERC1967Proxy(address(actionRegistryImpl), actionRegistryInitData);
        actionRegistry = ActionRegistry(address(actionRegistryProxy));
    }

    /// @notice Test complete happy path: mint garden → add action → verify setup
    function testCompleteHappyPath() public {
        // Step 1: Mint a garden
        address[] memory gardeners = new address[](2);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener1;
        gardeners[1] = gardener2;
        operators[0] = operator1;

        vm.prank(multisig);
        gardenAccountAddress = gardenToken.mintGarden(
            address(communityToken),
            "Integration Test Garden",
            "A garden for testing",
            "Test City",
            "banner.jpg",
            gardeners,
            operators
        );

        gardenAccount = GardenAccount(payable(gardenAccountAddress));

        // Verify garden setup
        assertEq(gardenAccount.name(), "Integration Test Garden", "Garden name should match");
        assertTrue(gardenAccount.gardeners(gardener1), "Gardener1 should be added");
        assertTrue(gardenAccount.gardeners(gardener2), "Gardener2 should be added");
        assertTrue(gardenAccount.gardenOperators(operator1), "Operator1 should be added");
        assertEq(gardenAccount.communityToken(), address(communityToken), "Community token should match");

        // Step 2: Register an action
        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        string[] memory media = new string[](1);
        media[0] = "ipfs://QmTestMedia";

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Plant Trees", "ipfs://QmTestInstructions", capitals, media
        );

        // Verify action
        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.title, "Plant Trees", "Action title should match");
        assertEq(action.startTime, block.timestamp, "Action start time should match");
        assertEq(action.endTime, block.timestamp + 30 days, "Action end time should match");
        assertEq(action.capitals.length, 2, "Should have 2 capitals");
        assertEq(action.media.length, 1, "Should have 1 media item");

        // Step 3: Verify token ownership
        assertEq(gardenToken.ownerOf(0), multisig, "Multisig should own the garden token");
    }

    /// @notice Test multiple gardens can be minted and managed independently
    function testMultipleGardensIndependence() public {
        address[] memory gardeners1 = new address[](1);
        address[] memory operators1 = new address[](1);
        gardeners1[0] = gardener1;
        operators1[0] = operator1;

        address[] memory gardeners2 = new address[](1);
        address[] memory operators2 = new address[](1);
        gardeners2[0] = gardener2;
        operators2[0] = operator1; // Same operator for both gardens

        // Mint two gardens
        vm.startPrank(multisig);
        address garden1 = gardenToken.mintGarden(
            address(communityToken), "Garden 1", "First garden", "City 1", "banner1.jpg", gardeners1, operators1
        );

        address garden2 = gardenToken.mintGarden(
            address(communityToken), "Garden 2", "Second garden", "City 2", "banner2.jpg", gardeners2, operators2
        );
        vm.stopPrank();

        // Verify independence
        GardenAccount g1 = GardenAccount(payable(garden1));
        GardenAccount g2 = GardenAccount(payable(garden2));

        assertTrue(g1.gardeners(gardener1), "Garden 1 should have gardener1");
        assertFalse(g1.gardeners(gardener2), "Garden 1 should not have gardener2");

        assertFalse(g2.gardeners(gardener1), "Garden 2 should not have gardener1");
        assertTrue(g2.gardeners(gardener2), "Garden 2 should have gardener2");

        assertTrue(g1.gardenOperators(operator1), "Garden 1 should have operator1");
        assertTrue(g2.gardenOperators(operator1), "Garden 2 should have operator1");
    }

    /// @notice Test batch minting multiple gardens
    function testBatchMinting() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](3);

        for (uint256 i = 0; i < 3; i++) {
            address[] memory gardeners = new address[](1);
            address[] memory operators = new address[](1);
            gardeners[0] = address(uint160(100 + i));
            operators[0] = address(uint160(200 + i));

            configs[i] = GardenToken.GardenConfig({
                communityToken: address(communityToken),
                name: string(abi.encodePacked("Garden ", uint2str(i))),
                description: string(abi.encodePacked("Description ", uint2str(i))),
                location: string(abi.encodePacked("Location ", uint2str(i))),
                bannerImage: string(abi.encodePacked("banner", uint2str(i), ".jpg")),
                gardeners: gardeners,
                gardenOperators: operators
            });
        }

        vm.prank(multisig);
        address[] memory gardens = gardenToken.batchMintGardens(configs);

        // Verify all gardens were created
        assertEq(gardens.length, 3, "Should create 3 gardens");
        for (uint256 i = 0; i < 3; i++) {
            assertTrue(gardens[i] != address(0), "Garden should be created");
            GardenAccount g = GardenAccount(payable(gardens[i]));
            assertEq(g.name(), string(abi.encodePacked("Garden ", uint2str(i))), "Garden name should match");
        }
    }

    /// @notice Test action lifecycle: register → update times → update metadata
    function testActionLifecycle() public {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.MATERIAL;
        string[] memory media = new string[](1);
        media[0] = "ipfs://original";

        // Register action
        vm.startPrank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 7 days, "Original Title", "ipfs://original-instructions", capitals, media
        );

        // Update start time
        actionRegistry.updateActionStartTime(0, block.timestamp + 1 days);
        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, block.timestamp + 1 days, "Start time should be updated");

        // Update end time
        actionRegistry.updateActionEndTime(0, block.timestamp + 14 days);
        action = actionRegistry.getAction(0);
        assertEq(action.endTime, block.timestamp + 14 days, "End time should be updated");

        // Update title
        actionRegistry.updateActionTitle(0, "Updated Title");
        action = actionRegistry.getAction(0);
        assertEq(action.title, "Updated Title", "Title should be updated");

        // Update instructions
        actionRegistry.updateActionInstructions(0, "ipfs://updated-instructions");
        action = actionRegistry.getAction(0);
        assertEq(action.instructions, "ipfs://updated-instructions", "Instructions should be updated");

        vm.stopPrank();
    }

    /// @notice Test garden member management
    function testGardenMemberManagement() public {
        // Mint garden
        address[] memory initialGardeners = new address[](1);
        address[] memory initialOperators = new address[](1);
        initialGardeners[0] = gardener1;
        initialOperators[0] = operator1;

        vm.prank(multisig);
        gardenAccountAddress = gardenToken.mintGarden(
            address(communityToken),
            "Test Garden",
            "Description",
            "Location",
            "banner.jpg",
            initialGardeners,
            initialOperators
        );

        gardenAccount = GardenAccount(payable(gardenAccountAddress));

        // Operator adds new gardener
        vm.prank(operator1);
        gardenAccount.addGardener(gardener2);
        assertTrue(gardenAccount.gardeners(gardener2), "Gardener2 should be added");

        // Operator removes gardener
        vm.prank(operator1);
        gardenAccount.removeGardener(gardener1);
        assertFalse(gardenAccount.gardeners(gardener1), "Gardener1 should be removed");

        // Operator adds another operator
        address newOperator = address(0x302);
        vm.prank(operator1);
        gardenAccount.addGardenOperator(newOperator);
        assertTrue(gardenAccount.gardenOperators(newOperator), "New operator should be added");
    }

    /// @notice Test invite system workflow
    /// @dev SKIPPED: Invite system not yet implemented (createInviteCode, joinGardenWithInvite)
    function skip_testInviteSystemWorkflow() public {
        // Test disabled - awaiting invite system implementation
    }

    /// @notice Test access control across contracts
    function testAccessControlAcrossContracts() public {
        // Non-multisig cannot register actions
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;
        string[] memory media = new string[](0);

        vm.prank(gardener1);
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 days, "Unauthorized Action", "instructions", capitals, media
        );

        // Non-multisig cannot mint gardens (without deployment registry)
        address[] memory gardeners = new address[](0);
        address[] memory operators = new address[](0);

        vm.prank(gardener1);
        vm.expectRevert(GardenToken.DeploymentRegistryNotConfigured.selector);
        gardenToken.mintGarden(
            address(communityToken), "Unauthorized Garden", "Description", "Location", "banner.jpg", gardeners, operators
        );
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
