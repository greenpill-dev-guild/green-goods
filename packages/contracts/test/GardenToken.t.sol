// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { MockNonERC20 } from "../src/mocks/NonERC20.sol";

contract GardenTokenTest is Test {
    GardenToken private gardenToken;
    address private multisig = address(0x123);
    address private gardenAccountImplementation = address(
        new GardenAccount(
            address(0x001), // erc4337EntryPoint
            address(0x002), // multicallForwarder
            address(0x003), // erc6551Registry
            address(0x004) // guardian
        )
    );
    address private owner = address(this);
    MockERC20 private mockToken;
    MockNonERC20 private mockNonERC20;

    function setUp() public {
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
        gardenToken.mintGarden(
            address(0), // Zero address
            "Test Garden",
            "Description",
            "Location",
            "Banner",
            gardeners,
            gardenOperators
        );
    }

    function testMintGarden_RevertsWithEOA() public {
        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);
        address eoa = address(0x999); // EOA with no code

        vm.prank(multisig);
        vm.expectRevert(GardenToken.CommunityTokenNotContract.selector);
        gardenToken.mintGarden(
            eoa,
            "Test Garden",
            "Description",
            "Location",
            "Banner",
            gardeners,
            gardenOperators
        );
    }

    function testMintGarden_RevertsWithNonERC20Contract() public {
        address[] memory gardeners = new address[](0);
        address[] memory gardenOperators = new address[](0);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidERC20Token.selector);
        gardenToken.mintGarden(
            address(mockNonERC20),
            "Test Garden",
            "Description",
            "Location",
            "Banner",
            gardeners,
            gardenOperators
        );
    }

    function testMintGarden_SucceedsWithValidERC20() public {
        address[] memory gardeners = new address[](1);
        address[] memory gardenOperators = new address[](1);
        gardeners[0] = address(0x1);
        gardenOperators[0] = address(0x2);

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(
            address(mockToken),
            "Test Garden",
            "Description",
            "Location",
            "Banner",
            gardeners,
            gardenOperators
        );

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
            gardeners: gardeners,
            gardenOperators: gardenOperators
        });

        configs[1] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 2",
            description: "Description 2",
            location: "Location 2",
            bannerImage: "Banner 2",
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

    // function testMintGarden() public {
    //     // Test minting a new Garden token
    //     address[] memory gardeners = new address[](1);
    //     address[] memory gardenOperators = new address[](1);

    //     gardeners[0] = address(0x1);
    //     gardenOperators[0] = address(0x2);

    //     vm.prank(multisig);

    //     gardenToken.mintGarden(address(0x3), "Test Garden", gardeners, gardenOperators);

    //     assertEq(gardenToken.ownerOf(0), owner, "Owner should be the contract owner");
    // }

    // function testEmitGardenMintedEvent() public {
    //     // Test that the GardenMinted event is emitted correctly
    //     address[] memory gardeners = new address[](1);
    //     address[] memory gardenOperators = new address[](1);

    //     gardeners[0] = address(0x1);
    //     gardenOperators[0] = address(0x2);

    //     vm.expectEmit(true, true, true, true);
    //     emit GardenToken.GardenMinted(owner, 0, "Test Garden");

    //     gardenToken.mintGarden(address(0x3), "Test Garden", gardeners, gardenOperators);
    // }

    // function testOnlyOwnerCanMint() public {
    //     // Test that only the owner can mint new Garden tokens
    //     address notOwner = address(0x999);
    //     vm.prank(notOwner); // Change the msg.sender to notOwner

    //     address[] memory gardeners = new address[](1);
    //     address[] memory gardenOperators = new address[](1);

    //     gardeners[0] = address(0x1);
    //     gardenOperators[0] = address(0x2);

    //     vm.expectRevert("Ownable: caller is not the owner");
    //     gardenToken.mintGarden(address(0x3), "Test Garden", gardeners, gardenOperators);
    // }

    // function testAuthorizeUpgrade() public {
    //     // Test that only the owner can authorize an upgrade
    //     address newImplementation = address(0x456);

    //     gardenToken.upgradeTo(newImplementation);
    //     // We can't directly check this since the function is internal,
    //     // but we are verifying that no revert occurs for the owner.
    // }

    // function testNonOwnerCannotUpgrade() public {
    //     // Test that non-owners cannot authorize an upgrade
    //     address notOwner = address(0x999);
    //     vm.prank(notOwner); // Change the msg.sender to notOwner
    //     address newImplementation = address(0x456);

    //     vm.expectRevert("Ownable: caller is not the owner");
    //     gardenToken.upgradeTo(newImplementation);
    // }
}
