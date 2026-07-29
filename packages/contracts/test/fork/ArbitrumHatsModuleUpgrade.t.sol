// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { HatsModuleUpgradeForkHarness } from "./helpers/HatsModuleUpgradeForkHarness.sol";

/// @title ArbitrumHatsModuleUpgradeForkTest
/// @notice Rehearses the HatsModule upgrade against the reviewed live Arbitrum state.
contract ArbitrumHatsModuleUpgradeForkTest is HatsModuleUpgradeForkHarness {
    function setUp() public {
        _setUpHatsModuleUpgrade("ARBITRUM_RPC_URL", 42_161);
    }

    function testForkArbitrum_hatsModuleUpgradePreservesLiveState() public {
        _rehearseHatsModuleUpgrade();
    }
}
