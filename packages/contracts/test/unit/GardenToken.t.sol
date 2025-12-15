// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {GardenToken} from "../../src/tokens/Garden.sol";
import {GardenAccount} from "../../src/accounts/Garden.sol";
import {MockERC20} from "../../src/mocks/ERC20.sol";
import {MockNonERC20} from "../../src/mocks/NonERC20.sol";
import {ERC6551Helper} from "../helpers/ERC6551Helper.sol";

contract GardenTokenTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    address private multisig = address(0x123);
    address private gardenAccountImplementation = address(
        new GardenAccount(
            address(0x001), // erc4337EntryPoint
            address(0x002), // multicallForwarder
            address(0x003), // erc6551Registry
            address(0x004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        )
    );
    address private owner = address(this);
    MockERC20 private mockToken;
    MockNonERC20 private mockNonERC20;

    function setUp() public {
        // Deploy ERC6551 Registry at canonical Tokenbound address
        _deployERC6551Registry();

        // Deploy the implementation
        GardenToken implementation = new GardenToken(gardenAccountImplementation);

        // Deploy the proxy with initialization
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to GardenToken interface
        gardenToken = GardenToken(address(proxy));

        // Deploy mock tokens
        mockToken = new MockERC20();
        mockNonERC20 = new MockNonERC20();
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(gardenToken.owner(), multisig, "Owner should be the multisig address");
    }

    // ERC-20 Validation Tests

    function testMintGarden_RevertsWithZeroAddressToken() public {
        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidCommunityToken.selector);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(0), // Zero address
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });
        gardenToken.mintGarden(config);
    }

    function testMintGarden_RevertsWithEOA() public {
        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);
        address eoa = address(0x999); // EOA with no code

        vm.prank(multisig);
        vm.expectRevert(GardenToken.CommunityTokenNotContract.selector);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: eoa,
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });
        gardenToken.mintGarden(config);
    }

    function testMintGarden_RevertsWithNonERC20Contract() public {
        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidERC20Token.selector);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockNonERC20),
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });
        gardenToken.mintGarden(config);
    }

    function testMintGarden_SucceedsWithValidERC20() public {
        address[] memory gardeners = new address[](1);
        address[] memory gardenOperators = new address[](1);
        gardeners[0] = address(0x1);
        gardenOperators[0] = address(0x2);

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });
        address gardenAccount = gardenToken.mintGarden(config);

        // Verify the garden was created
        assertTrue(gardenAccount != address(0), "Garden account should be created");
        assertEq(gardenToken.ownerOf(0), multisig, "Token should be minted to multisig");
    }

    function testBatchMintGardens_RevertsWithInvalidToken() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);

        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);

        // First config with valid token
        configs[0] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 1",
            description: "Description 1",
            location: "Location 1",
            bannerImage: "Banner 1",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });

        // Second config with invalid token (zero address)
        configs[1] = GardenToken.GardenConfig({
            communityToken: address(0),
            name: "Garden 2",
            description: "Description 2",
            location: "Location 2",
            bannerImage: "Banner 2",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidCommunityToken.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_SucceedsWithValidTokens() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);

        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);

        // Both configs with valid token
        configs[0] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 1",
            description: "Description 1",
            location: "Location 1",
            bannerImage: "Banner 1",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });

        configs[1] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 2",
            description: "Description 2",
            location: "Location 2",
            bannerImage: "Banner 2",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });

        vm.prank(multisig);
        address[] memory gardenAccounts = gardenToken.batchMintGardens(configs);

        // Verify both gardens were created
        assertEq(gardenAccounts.length, 2, "Should create 2 gardens");
        assertTrue(gardenAccounts[0] != address(0), "First garden should be created");
        assertTrue(gardenAccounts[1] != address(0), "Second garden should be created");
        assertEq(gardenToken.ownerOf(0), multisig, "First token should be minted");
        assertEq(gardenToken.ownerOf(1), multisig, "Second token should be minted");
    }

    function testOnlyOwnerOrAllowlistCanMint() public {
        // Test that non-authorized addresses cannot mint
        address notAuthorized = address(0x999);

        address[] memory gardeners = new address[](1);
        address[] memory gardenOperators = new address[](1);
        gardeners[0] = address(0x1);
        gardenOperators[0] = address(0x2);

        vm.prank(notAuthorized);
        vm.expectRevert(GardenToken.DeploymentRegistryNotConfigured.selector);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });
        gardenToken.mintGarden(config);
    }

    function testBatchMintGardensRevertsWithEmptyArray() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](0);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidBatchSize.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardensRevertsWithTooManyGardens() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](11); // Max is 10

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidBatchSize.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardensRevertsWithTooManyGardeners() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](1);

        // Create array with 101 gardeners (exceeds limit of 100)
        address[] memory tooManyGardeners = new address[](101);
        for (uint256 i = 0; i < 101; i++) {
            tooManyGardeners[i] = address(uint160(i + 1));
        }
        address[] memory operators = new address[](0);

        configs[0] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 1",
            description: "Description 1",
            location: "Location 1",
            bannerImage: "Banner 1",
            metadata: "",
            openJoining: false,
            gardeners: tooManyGardeners,
            gardenOperators: operators
        });

        vm.prank(multisig);
        vm.expectRevert(GardenToken.TooManyGardeners.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardensRevertsWithTooManyOperators() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](1);

        // Create array with 101 operators (exceeds limit of 100)
        address[] memory gardeners = new address[](0);
        address[] memory tooManyOperators = new address[](101);
        for (uint256 i = 0; i < 101; i++) {
            tooManyOperators[i] = address(uint160(i + 1));
        }

        configs[0] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 1",
            description: "Description 1",
            location: "Location 1",
            bannerImage: "Banner 1",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: tooManyOperators
        });

        vm.prank(multisig);
        vm.expectRevert(GardenToken.TooManyOperators.selector);
        gardenToken.batchMintGardens(configs);
    }
}
