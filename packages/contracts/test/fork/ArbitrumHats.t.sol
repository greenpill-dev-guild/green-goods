// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { HatsLib } from "../../src/lib/Hats.sol";

contract ArbitrumHatsForkTest is Test {
    function test_arbitrumHatTreeIsConfigured() public {
        string memory rpcUrl = _getRpc("ARBITRUM_RPC_URL");
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

    function _getRpc(string memory envVar) internal view returns (string memory) {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            return rpcUrl;
        } catch {
            return "";
        }
    }
}
