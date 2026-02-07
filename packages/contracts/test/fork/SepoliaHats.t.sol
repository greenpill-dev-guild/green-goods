// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { HatsLib } from "../../src/lib/Hats.sol";

contract SepoliaHatsForkTest is Test {
    function testForkSepoliaHatTreeIsConfigured() public {
        string memory rpcUrl = _getRpc("SEPOLIA_RPC_URL");
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);

        uint256 gardensHat = HatsLib.getGardensHatId();
        if (gardensHat == 0) return;

        IHats hats = IHats(HatsLib.getHatsProtocol());
        assertGt(address(hats).code.length, 0, "Hats protocol should be deployed");
        assertEq(hats.getHatLevel(gardensHat), 1, "Gardens hat should be level 1");
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
