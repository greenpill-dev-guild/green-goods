// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";

/// @title SepoliaGardenAccountConfigForkTest
/// @notice Fork tests for GardenAccount auth and token configuration against Sepolia.
contract SepoliaGardenAccountConfigForkTest is ForkTestBase {
    /// @notice Non-owner of the NFT cannot call execute() on the TBA.
    function testForkSepolia_execute_nonOwnerReverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Sepolia Non-Owner Execute Garden", 0x0F);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        vm.prank(forkNonMember);
        vm.expectRevert(bytes4(keccak256("NotAuthorized()")));
        gardenAcct.execute(address(0xDEAD), 0, "", 0);
    }

    /// @notice Owner can update the community token on GardenToken.
    function testForkSepolia_communityTokenUpdate() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        address newToken = address(goodsTokenContract);
        address oldToken = gardenToken.communityToken();
        assertTrue(oldToken != address(0), "old token should be set");

        gardenToken.setCommunityToken(newToken);
        assertEq(gardenToken.communityToken(), newToken, "community token should be updated");

        address garden = _mintTestGarden("Sepolia New Token Garden", 0x01);
        assertTrue(garden != address(0), "mint should succeed with new community token");

        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(gardenAcct.communityToken(), newToken, "garden should use new community token");
    }
}
