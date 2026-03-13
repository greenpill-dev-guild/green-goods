// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { AaveOctantForkBase, IWETH9 } from "./helpers/AaveOctantForkBase.sol";

abstract contract ArbitrumOctantVaultForkBase is AaveOctantForkBase {
    function _createBrokenVault(address garden) internal returns (address vault) {
        octantModule.setOctantFactory(_deployVaultFactory("Broken Fork Vaults"));
        octantModule.setSupportedAsset(WETH, address(0xBEEF));

        vault = octantModule.createVaultForAsset(garden, WETH);
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

        octantModule.setSupportedAsset(WETH, _deployAaveTemplate("Green Goods Repair WETH", "ggaREPAIR"));
        octantModule.enableAutoAllocate(garden, WETH);

        address liveStrategy = octantModule.vaultStrategies(vault);
        assertTrue(liveStrategy != address(0), "repair should attach a live strategy");
        assertTrue(IOctantVault(vault).autoAllocate(), "auto allocate should be enabled after repair");
        assertEq(IOctantVault(vault).accountant(), address(yieldSplitter), "yield resolver should be accountant");

        address[] memory queue = IOctantVault(vault).get_default_queue();
        assertTrue(queue.length > 0, "default queue should contain repaired strategy");
        assertEq(queue[0], liveStrategy, "repaired strategy should be queue head");

        _depositWethIntoVault(vault, 0.25 ether);
        assertGt(IERC20(AWETH).balanceOf(liveStrategy), 0, "repaired vault should deploy into Aave");
    }
}

/// @notice Verifies owner recovery for resolver-held shares that were never registered to a garden.
contract ArbitrumOctantRecoverOrphanedSharesForkTest is ArbitrumOctantVaultForkBase {
    function test_forkRepair_recoverOrphanedSharesRegistersResolverBalance() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Orphaned Shares Garden");
        address vault = _setupOctantVaultWithAave(garden, "Green Goods Repair", "Green Goods Repair WETH", "ggaREC");

        vm.deal(address(this), 0.1 ether);
        IWETH9(WETH).deposit{ value: 0.1 ether }();
        IERC20(WETH).approve(vault, 0.1 ether);
        uint256 orphanedShares = IOctantVault(vault).deposit(0.1 ether, address(yieldSplitter));

        assertGt(orphanedShares, 0, "deposit should mint shares to resolver");
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "shares should start orphaned");

        octantModule.recoverOrphanedShares(garden, vault, orphanedShares);

        assertEq(yieldSplitter.gardenShares(garden, vault), orphanedShares, "repair should register orphaned shares");
        assertEq(yieldSplitter.totalRegisteredShares(vault), orphanedShares, "aggregate registration should match repair");
    }
}

/// @notice Verifies donation backfill for gardens minted before Octant asset support existed.
contract ArbitrumOctantDonationBackfillForkTest is ArbitrumOctantVaultForkBase {
    function test_forkRepair_backfillDonationAddressesSetsResolverForPreSupportGarden() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        address garden = _mintTestGarden("Donation Backfill Garden", 0x0F);
        assertEq(octantModule.gardenDonationAddresses(garden), address(0), "garden should start without donation");

        address[] memory gardens = new address[](1);
        gardens[0] = garden;
        octantModule.backfillDonationAddresses(gardens);

        assertEq(
            octantModule.gardenDonationAddresses(garden),
            address(yieldSplitter),
            "backfill should point donation address at resolver"
        );
    }
}
