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
        uint256 protocolGardenersHat = HatsLib.getProtocolGardenersHatId();

        assertTrue(communityHat != 0, "Community hat should be configured");
        assertTrue(gardensHat != 0, "Gardens hat should be configured");
        assertTrue(protocolGardenersHat != 0, "Protocol gardeners hat should be configured");
        assertGt(address(hats).code.length, 0, "Hats protocol should be deployed");

        assertTrue(hats.isTopHat(communityHat), "Community hat should be a top hat");
        assertEq(hats.getHatLevel(gardensHat), 1, "Gardens hat should be level 1");
        assertEq(hats.getHatLevel(protocolGardenersHat), 1, "Protocol gardeners hat should be level 1");
    }

    function _getRpc(string memory envVar) internal view returns (string memory) {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            return rpcUrl;
        } catch {
            return "";
        }
    }
}
