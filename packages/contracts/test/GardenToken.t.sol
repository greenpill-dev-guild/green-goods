// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";

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

    function setUp() public {
        // Deploy the implementation
        GardenToken implementation = new GardenToken(gardenAccountImplementation);

        // Deploy the proxy with initialization
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to GardenToken interface
        gardenToken = GardenToken(address(proxy));
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(gardenToken.owner(), multisig, "Owner should be the multisig address");
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
