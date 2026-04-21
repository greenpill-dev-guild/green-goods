// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AaveOctantForkBase } from "./helpers/AaveOctantForkBase.sol";

/// @notice Runnable Arbitrum fork gate for YieldResolver split behavior using real Octant + Aave wiring.
contract ArbitrumYieldResolverCoreForkTest is AaveOctantForkBase {
    address internal yieldAsset = DAI;
    address internal yieldAToken = ADAI;

    function _createHarvestableGarden(string memory gardenName) internal returns (address garden, address vault) {
        _configureAaveVaultSupportForAsset(yieldAsset, yieldAToken, "Yield Core Vaults", "Yield Core DAI", "ggaCORE");
        (garden,) = _setupGardenWithRolesAndAction(gardenName);
        vault = octantModule.getVaultForAsset(garden, yieldAsset);
        if (vault == address(0)) {
            vault = octantModule.createVaultForAsset(garden, yieldAsset);
        }
        assertTrue(vault != address(0), "vault should exist");
        assertTrue(octantModule.vaultStrategies(vault) != address(0), "vault should have a live strategy");

        _depositLiveAaveAssetIntoVault(vault, yieldAsset, yieldAToken, 1 ether);
        _assertLiveAaveDepositAccounted(
            vault, yieldAsset, yieldAToken, 1 ether, "fork deposit should remain fully accounted"
        );
        yieldSplitter.setMinYieldThreshold(0);
        _warpForHarvestWindow();
        _harvestRegistersSharesWhenAaveHasYieldAsset(garden, yieldAsset, vault);
    }

    function test_forkDeploy_initializesWithRealAaveDai() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        assertGt(yieldAsset.code.length, 0, "DAI should exist on Arbitrum");
        assertEq(yieldSplitter.octantModule(), address(octantModule), "octant module should be wired");
    }

    function test_forkSplitYield_distributesAcrossCookieJarEscrowAndTreasury() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (address garden, address vault) = _createHarvestableGarden("Yield Core Garden");
        address cookieJar = address(0xC001);
        address treasury = address(0x7EA5);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, treasury);

        uint256 cookieJarBefore = IERC20(yieldAsset).balanceOf(cookieJar);
        uint256 treasuryBefore = IERC20(yieldAsset).balanceOf(treasury);
        uint256 escrowedBefore = yieldSplitter.getEscrowedFractions(garden, yieldAsset);

        yieldSplitter.splitYield(garden, yieldAsset, vault);

        uint256 cookieJarReceived = IERC20(yieldAsset).balanceOf(cookieJar) - cookieJarBefore;
        uint256 treasuryReceived = IERC20(yieldAsset).balanceOf(treasury) - treasuryBefore;
        uint256 escrowedReceived = yieldSplitter.getEscrowedFractions(garden, yieldAsset) - escrowedBefore;
        uint256 totalDistributed = cookieJarReceived + treasuryReceived + escrowedReceived;
        uint256 expectedCookieJar = (totalDistributed * 4865) / 10_000;
        uint256 expectedFractions = (totalDistributed * 4865) / 10_000;
        uint256 expectedJuicebox = totalDistributed - expectedCookieJar - expectedFractions;

        assertGt(totalDistributed, 0, "yield split should distribute non-zero value");
        assertApproxEqRel(cookieJarReceived, expectedCookieJar, 0.05e18, "cookie jar split ratio");
        assertApproxEqRel(escrowedReceived, expectedFractions, 0.05e18, "fractions split ratio");
        assertApproxEqRel(treasuryReceived, expectedJuicebox, 0.05e18, "treasury split ratio");
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "split should clear registered shares");
    }

    function test_forkSplitYield_allowsEscrowWithdrawalWhenNoFractionPool() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (address garden, address vault) = _createHarvestableGarden("Yield Escrow Garden");
        yieldSplitter.setCookieJar(garden, address(0xC002));
        yieldSplitter.setGardenTreasury(garden, address(0x7EA6));

        yieldSplitter.splitYield(garden, yieldAsset, vault);

        uint256 escrowed = yieldSplitter.getEscrowedFractions(garden, yieldAsset);
        address receiver = address(0xBEEF);
        uint256 receiverBefore = IERC20(yieldAsset).balanceOf(receiver);

        yieldSplitter.withdrawEscrowedFractions(garden, yieldAsset, escrowed, receiver);

        assertGt(escrowed, 0, "split should escrow fractions when no pool is configured");
        assertEq(IERC20(yieldAsset).balanceOf(receiver) - receiverBefore, escrowed, "withdraw should release escrow");
        assertEq(yieldSplitter.getEscrowedFractions(garden, yieldAsset), 0, "escrow should be cleared");
    }

    function test_forkSplitYield_preservesGardenIsolationAcrossVaults() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (address garden1, address vault1) = _createHarvestableGarden("Yield Garden One");
        (address garden2, address vault2) = _createHarvestableGarden("Yield Garden Two");

        yieldSplitter.setCookieJar(garden1, address(0xC003));
        yieldSplitter.setGardenTreasury(garden1, address(0x7EA7));
        yieldSplitter.setCookieJar(garden2, address(0xC004));
        yieldSplitter.setGardenTreasury(garden2, address(0x7EA8));

        uint256 garden2SharesBefore = yieldSplitter.gardenShares(garden2, vault2);
        yieldSplitter.splitYield(garden1, yieldAsset, vault1);

        assertEq(yieldSplitter.gardenShares(garden1, vault1), 0, "garden 1 shares should be consumed");
        assertEq(yieldSplitter.gardenShares(garden2, vault2), garden2SharesBefore, "garden 2 shares should remain intact");

        yieldSplitter.splitYield(garden2, yieldAsset, vault2);
        assertEq(yieldSplitter.gardenShares(garden2, vault2), 0, "garden 2 shares should be consumed independently");
    }
}
