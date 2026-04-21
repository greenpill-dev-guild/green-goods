// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount, NotGardenOwner, NotGardenOperator } from "../../src/accounts/Garden.sol";

/// @title ArbitrumGardenAccountMetadataForkTest
/// @notice Fork tests for GardenAccount metadata access control against Arbitrum mainnet.
contract ArbitrumGardenAccountMetadataForkTest is ForkTestBase {
    /// @notice Operator role allows updating garden metadata via the account's setter functions.
    /// @dev Operators use the setter functions directly, which check onlyOperator.
    function testForkArbitrum_operatorCanUpdateDescription() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Operator Metadata Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        vm.prank(forkOperator);
        gardenAcct.updateDescription("Updated by operator");
        _assertTextHash(gardenAcct.description(), keccak256(bytes("Updated by operator")));
    }

    /// @notice Owner can update all metadata fields: name, description, location, bannerImage.
    function testForkArbitrum_ownerUpdatesMetadata() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Metadata Test Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        gardenAcct.updateName("Renamed Garden");
        _assertTextHash(gardenAcct.name(), keccak256(bytes("Renamed Garden")));

        gardenAcct.updateDescription("New description");
        _assertTextHash(gardenAcct.description(), keccak256(bytes("New description")));

        gardenAcct.updateLocation("New Location");
        _assertTextHash(gardenAcct.location(), keccak256(bytes("New Location")));

        gardenAcct.updateBannerImage("ipfs://QmNewBanner");
        _assertTextHash(gardenAcct.bannerImage(), keccak256(bytes("ipfs://QmNewBanner")));
    }

    /// @notice Non-owner/non-operator cannot call metadata setters.
    function testForkArbitrum_nonOwnerMetadataSettersRevert() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Access Control Garden");
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
