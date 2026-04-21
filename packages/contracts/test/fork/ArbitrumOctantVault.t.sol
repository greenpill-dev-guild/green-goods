// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { AaveOctantForkBase } from "./helpers/AaveOctantForkBase.sol";

abstract contract ArbitrumOctantVaultForkBase is AaveOctantForkBase {
    function _createBrokenVault(address garden) internal returns (address vault) {
        octantModule.setOctantFactory(_deployVaultFactory("Broken Fork Vaults"));
        octantModule.setSupportedAsset(DAI, address(0xBEEF));

        vault = octantModule.createVaultForAsset(garden, DAI);
        assertTrue(vault != address(0), "vault should still be created");
        assertEq(octantModule.vaultStrategies(vault), address(0), "broken template should leave vault without strategy");
    }
}

/// @notice Verifies fork repair for the broken "vault exists but no strategy attached" state.
contract ArbitrumOctantEnableAutoAllocateForkTest is ArbitrumOctantVaultForkBase {
    function test_forkRepair_enableAutoAllocateRepairsBrokenVaultAndRestoresAaveDeployment() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        address garden = _mintTestGarden("Broken Auto Allocate Garden", 0x0F);
        address vault = _createBrokenVault(garden);

        octantModule.setSupportedAsset(DAI, _deployAaveTemplateForAsset(DAI, ADAI, "Green Goods Repair DAI", "ggaREPAIR"));
        octantModule.enableAutoAllocate(garden, DAI);

        address liveStrategy = octantModule.vaultStrategies(vault);
        assertTrue(liveStrategy != address(0), "repair should attach a live strategy");
        assertTrue(IOctantVault(vault).autoAllocate(), "auto allocate should be enabled after repair");
        assertEq(IOctantVault(vault).accountant(), address(yieldSplitter), "yield resolver should be accountant");

        address[] memory queue = IOctantVault(vault).get_default_queue();
        assertTrue(queue.length > 0, "default queue should contain repaired strategy");
        assertEq(queue[0], liveStrategy, "repaired strategy should be queue head");

        _depositLiveAaveAssetIntoVault(vault, DAI, ADAI, 0.25 ether);
        assertGt(IERC20(ADAI).balanceOf(liveStrategy), 0, "repaired vault should deploy into Aave");
    }
}
