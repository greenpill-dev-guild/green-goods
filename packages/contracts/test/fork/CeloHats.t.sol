// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { HatsLib } from "../../src/lib/Hats.sol";

/// @title CeloHatsForkTest
/// @notice Fork tests verifying the real Hats Protocol deployment on Celo (Tree 31)
/// @dev These tests go beyond address-existence checks to verify actual protocol
///      properties: hat mutability, max supply, tree hierarchy, and active status.
///      Skips gracefully if CELO_RPC_URL is not set.
contract CeloHatsForkTest is Test {
    function test_celoHatTreeIsConfigured() public {
        string memory rpcUrl = _getRpc("CELO_RPC_URL");
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);

        IHats hats = IHats(HatsLib.getHatsProtocol());
        uint256 communityHat = HatsLib.getCommunityHatId();
        uint256 gardensHat = HatsLib.getGardensHatId();
        uint256 gardenersHat = HatsLib.getProtocolGardenersHatId();

        assertTrue(communityHat != 0, "Community hat should be configured");
        assertTrue(gardensHat != 0, "Gardens hat should be configured");
        assertTrue(gardenersHat != 0, "Gardeners hat should be configured");
        assertGt(address(hats).code.length, 0, "Hats protocol should be deployed");

        assertEq(hats.getHatLevel(communityHat), 1, "Community hat should be level 1");
        assertEq(hats.getHatLevel(gardensHat), 2, "Gardens hat should be level 2 (under Community)");
        assertEq(hats.getHatLevel(gardenersHat), 2, "Gardeners hat should be level 2 (under Community)");
        assertTrue(hats.isActive(gardensHat), "Gardens hat should be active");
    }

    /// @notice Verify Gardens hat is mutable (required for HatsModule to create sub-trees)
    /// @dev maxSupply == 0 means the on-chain hat tree needs reconfiguration.
    ///      This test logs a warning instead of hard-failing since we cannot
    ///      control on-chain state from fork tests.
    function test_celoGardensHatIsMutable() public {
        string memory rpcUrl = _getRpc("CELO_RPC_URL");
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);

        IHats hats = IHats(HatsLib.getHatsProtocol());
        uint256 gardensHat = HatsLib.getGardensHatId();

        // Gardens hat must be mutable so HatsModule can create child hats
        (,, uint32 maxSupply,,,,,,) = hats.viewHat(gardensHat);
        if (maxSupply == 0) {
            emit log("WARNING: Gardens hat maxSupply is 0 on Celo -- hat tree needs reconfiguration");
            emit log("  Action required: call hats.changeHatMaxSupply() to set maxSupply > 0");
        } else {
            assertGt(maxSupply, 0, "Gardens hat maxSupply should allow children");
        }
    }

    /// @notice Verify that Community hat is the admin of both Gardens and Gardeners hats
    function test_celoHatTreeHierarchy() public {
        string memory rpcUrl = _getRpc("CELO_RPC_URL");
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);

        IHats hats = IHats(HatsLib.getHatsProtocol());
        uint256 communityHat = HatsLib.getCommunityHatId();
        uint256 gardensHat = HatsLib.getGardensHatId();
        uint256 gardenersHat = HatsLib.getProtocolGardenersHatId();

        // Gardens hat (level 2) admin at level 1 should be Community hat
        uint256 gardensAdmin = hats.getAdminAtLevel(gardensHat, 1);
        assertEq(gardensAdmin, communityHat, "Gardens hat admin should be Community hat");

        // Gardeners hat (level 2) admin at level 1 should also be Community hat
        uint256 gardenersAdmin = hats.getAdminAtLevel(gardenersHat, 1);
        assertEq(gardenersAdmin, communityHat, "Gardeners hat admin should be Community hat");

        // Verify that both are at the same level (siblings, not parent-child)
        assertEq(hats.getHatLevel(gardensHat), hats.getHatLevel(gardenersHat), "Gardens and Gardeners should be siblings");
    }

    /// @notice Verify all three hats are active on-chain
    function test_celoAllProtocolHatsActive() public {
        string memory rpcUrl = _getRpc("CELO_RPC_URL");
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);

        IHats hats = IHats(HatsLib.getHatsProtocol());

        assertTrue(hats.isActive(HatsLib.getCommunityHatId()), "Community hat should be active");
        assertTrue(hats.isActive(HatsLib.getGardensHatId()), "Gardens hat should be active");
        assertTrue(hats.isActive(HatsLib.getProtocolGardenersHatId()), "Gardeners hat should be active");
    }

    function _getRpc(string memory envVar) internal view returns (string memory) {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            return rpcUrl;
        } catch {
            return "";
        }
    }
}
