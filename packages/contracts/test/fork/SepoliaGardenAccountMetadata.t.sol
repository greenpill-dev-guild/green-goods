// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount, NotGardenOwner, NotGardenOperator } from "../../src/accounts/Garden.sol";

/// @title SepoliaGardenAccountMetadataForkTest
/// @notice Fork tests for GardenAccount metadata access control against Sepolia.
contract SepoliaGardenAccountMetadataForkTest is ForkTestBase {
    /// @notice Operator role allows updating garden metadata via the account's setter functions.
    function testForkSepolia_operatorCanUpdateDescription() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Operator Metadata Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        vm.prank(forkOperator);
        gardenAcct.updateDescription("Updated by operator on Sepolia");
        _assertTextHash(gardenAcct.description(), keccak256(bytes("Updated by operator on Sepolia")));
    }

    /// @notice Owner can update all metadata fields: name, description, location, bannerImage.
    function testForkSepolia_ownerUpdatesMetadata() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Metadata Test Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        gardenAcct.updateName("Sepolia Renamed Garden");
        _assertTextHash(gardenAcct.name(), keccak256(bytes("Sepolia Renamed Garden")));

        gardenAcct.updateDescription("Sepolia new description");
        _assertTextHash(gardenAcct.description(), keccak256(bytes("Sepolia new description")));

        gardenAcct.updateLocation("Sepolia Location");
        _assertTextHash(gardenAcct.location(), keccak256(bytes("Sepolia Location")));

        gardenAcct.updateBannerImage("ipfs://QmSepoliaBanner");
        _assertTextHash(gardenAcct.bannerImage(), keccak256(bytes("ipfs://QmSepoliaBanner")));
    }

    /// @notice Non-owner/non-operator cannot call metadata setters.
    function testForkSepolia_nonOwnerMetadataSettersRevert() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Access Control Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        vm.startPrank(forkNonMember);

        vm.expectRevert(NotGardenOwner.selector);
        gardenAcct.updateName("Unauthorized");

        vm.expectRevert(NotGardenOperator.selector);
        gardenAcct.updateDescription("Unauthorized");

        vm.expectRevert(NotGardenOperator.selector);
        gardenAcct.updateLocation("Unauthorized");

        vm.expectRevert(NotGardenOperator.selector);
        gardenAcct.updateBannerImage("Unauthorized");

        vm.stopPrank();
    }

    function _assertTextHash(string memory actual, bytes32 expectedHash) private {
        assertEq(keccak256(bytes(actual)), expectedHash);
    }
}
