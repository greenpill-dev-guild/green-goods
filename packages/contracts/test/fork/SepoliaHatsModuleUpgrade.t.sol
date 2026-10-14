// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { HatsModuleUpgradeForkHarness } from "./helpers/HatsModuleUpgradeForkHarness.sol";

/// @title SepoliaHatsModuleUpgradeForkTest
/// @notice Rehearses the HatsModule upgrade against reviewed live Sepolia state.
contract SepoliaHatsModuleUpgradeForkTest is HatsModuleUpgradeForkHarness {
    function setUp() public {
        _setUpHatsModuleUpgrade("SEPOLIA_RPC_URL", 11_155_111);
    }

    function testForkSepolia_hatsModuleUpgradePreservesLiveState() public {
        _rehearseHatsModuleUpgrade();
    }
}
