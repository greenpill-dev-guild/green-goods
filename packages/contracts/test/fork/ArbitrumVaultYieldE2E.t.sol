// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";
import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { MultistrategyVaultFactory } from "../../src/vendor/octant/factories/MultistrategyVaultFactory.sol";
import { IMultistrategyVaultFactory } from "../../src/vendor/octant/factories/interfaces/IMultistrategyVaultFactory.sol";
import { ICVStrategy } from "../../src/interfaces/ICVStrategy.sol";
import { AaveOctantForkBase } from "./helpers/AaveOctantForkBase.sol";

/// @title ArbitrumVaultYieldE2EForkTest
/// @notice Comprehensive end-to-end fork test for the vault strategy autoallocate fix.
///         Validates all 4 layers of the fix against real Aave V3 on Arbitrum:
///         Layer 1: AaveV3ERC4626 strategy attaches to MultistrategyVault
///         Layer 2: Auto-allocate + maxDebt routes deposits to Aave
///         Layer 3: process_report → IAccountant → fee shares to YieldResolver
///         Layer 4: Donation address set → harvest doesn't revert
///
///         Also verifies conviction-weighted fraction routing against a live Gardens V2 pool.
contract ArbitrumVaultYieldE2EForkTest is AaveOctantForkBase {
    address internal yieldAsset = DAI;
    address internal yieldAToken = ADAI;

    /// @dev Helper: configure Aave support, mint garden with roles+action, return vault.
    ///      The vault is auto-created during garden mint (onGardenMinted callback).
    function _createGardenWithAaveVault(
        string memory label,
        string memory stratName,
        string memory stratSymbol,
        string memory gardenName
    )
        internal
        returns (address garden, address vault)
    {
        _configureAaveVaultSupportForAsset(yieldAsset, yieldAToken, label, stratName, stratSymbol);
        (garden,) = _setupGardenWithRolesAndAction(gardenName);
        vault = octantModule.getVaultForAsset(garden, yieldAsset);
        if (vault == address(0)) {
            vault = octantModule.createVaultForAsset(garden, yieldAsset);
        }
        assertTrue(vault != address(0), "vault should exist");
        assertTrue(octantModule.vaultStrategies(vault) != address(0), "vault should have live strategy");
    }

    function _depositYieldAssetIntoVault(address vault, uint256 amount) internal {
        _depositLiveAaveAssetIntoVault(vault, yieldAsset, yieldAToken, amount);
    }

    function _depositYieldAssetIntoVaultAs(address vault, address user, uint256 amount) internal {
        _fundFromLiveAaveReserve(yieldAsset, yieldAToken, user, amount);

        vm.startPrank(user);
        IERC20(yieldAsset).approve(vault, amount);
        IOctantVault(vault).deposit(amount, user);
        vm.stopPrank();
    }

    function _assertYieldDepositAccounted(address vault, uint256 amount, string memory message) internal {
        _assertLiveAaveDepositAccounted(vault, yieldAsset, yieldAToken, amount, message);
    }

    function _harvestRegistersShares(address garden, address vault) internal {
        _harvestRegistersSharesWhenAaveHasYieldAsset(garden, yieldAsset, vault);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Full Happy Path — deposit → Aave → yield → harvest → split
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The golden path: a user deposits live DAI, it auto-routes to Aave,
    ///         yield accrues over 30 days, harvest triggers process_report which
    ///         mints fee shares to YieldResolver, and splitYield distributes 3 ways.
    function test_e2e_fullHappyPath_depositAaveYieldHarvestSplit() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        // ── Step 1: Configure Aave vault support and create garden ──
        (address garden, address vault) =
            _createGardenWithAaveVault("E2E Vaults", "E2E DAI Strategy", "ggaE2E", "E2E Happy Path Garden");

        // ── Step 2: Verify Layer 1 — strategy attachment ──
        address strategy = octantModule.vaultStrategies(vault);
        assertTrue(strategy != address(0), "strategy should be attached (Layer 1 fix)");
        assertEq(AaveV3ERC4626(strategy).asset(), yieldAsset, "strategy asset should be live DAI");

        // ── Step 3: Verify Layer 2 — auto-allocate + maxDebt wiring ──
        assertTrue(IOctantVault(vault).autoAllocate(), "autoAllocate should be enabled (Layer 2 fix)");
        (,,, uint256 maxDebt) = IOctantVault(vault).strategies(strategy);
        assertEq(maxDebt, type(uint256).max, "maxDebt should be unlimited (Layer 2 fix)");

        // ── Step 4: Verify Layer 3 — accountant = YieldResolver ──
        assertEq(
            IOctantVault(vault).accountant(), address(yieldSplitter), "accountant should be YieldResolver (Layer 3 fix)"
        );

        // ── Step 5: Verify Layer 4 — donation address set ──
        assertEq(
            octantModule.gardenDonationAddresses(garden),
            address(yieldSplitter),
            "donation address should be auto-set to resolver (Layer 4 fix)"
        );

        // ── Step 6: Verify strategy queue head ──
        address[] memory queue = IOctantVault(vault).get_default_queue();
        assertEq(queue.length, 1, "queue should have exactly one strategy");
        assertEq(queue[0], strategy, "strategy should be at queue head");

        // ── Step 7: Verify protocol fee = 0 (Decision 23) ──
        address factory = address(octantModule.octantFactory());
        (uint16 protocolFee,) = IMultistrategyVaultFactory(factory).protocolFeeConfig(vault);
        assertEq(protocolFee, 0, "protocol fee must be 0 for 100% fee share routing");

        // ── Step 8: User deposits live DAI → auto-allocates to Aave ──
        uint256 depositAmount = 1 ether;
        _depositYieldAssetIntoVault(vault, depositAmount);
        _assertYieldDepositAccounted(vault, depositAmount, "deposit should remain fully accounted");

        // ── Step 9: Snapshot PPS before yield accrual ──
        uint256 userSharesBefore = IOctantVault(vault).balanceOf(address(this));
        uint256 userAssetsBefore = IOctantVault(vault).convertToAssets(userSharesBefore);

        // ── Step 10: Time warp for Aave yield accrual ──
        _warpForHarvestWindow();

        // Verify yield accrued on strategy
        uint256 strategyTotalAssets = AaveV3ERC4626(strategy).totalAssets();
        assertGt(strategyTotalAssets, depositAmount, "strategy should show yield after time warp");

        // ── Step 11: Harvest — triggers process_report → fee shares to resolver ──
        uint256 resolverSharesBefore = IOctantVault(vault).balanceOf(address(yieldSplitter));

        // harvest() is onlyGardenOperatorOrOwner — we're the owner (deployer)
        _harvestRegistersShares(garden, vault);

        uint256 resolverSharesAfter = IOctantVault(vault).balanceOf(address(yieldSplitter));
        assertGt(
            resolverSharesAfter,
            resolverSharesBefore,
            "process_report should mint fee shares to resolver (accountant mechanism)"
        );

        // ── Step 12: Verify registerShares attributed shares to garden ──
        uint256 registeredShares = yieldSplitter.gardenShares(garden, vault);
        assertGt(registeredShares, 0, "harvest should register shares in YieldResolver");
        assertEq(
            registeredShares,
            resolverSharesAfter - resolverSharesBefore,
            "registered shares should match newly minted fee shares"
        );

        // ── Step 13: Verify PPS is flat for depositors (Decision 19) ──
        uint256 userAssetsAfterHarvest = IOctantVault(vault).convertToAssets(userSharesBefore);
        // With 100% fee, user PPS stays ~1.0. Allow tiny rounding variance.
        assertApproxEqRel(
            userAssetsAfterHarvest,
            userAssetsBefore,
            0.01e18, // 1% tolerance for rounding
            "depositor PPS should be flat (100% fee to resolver)"
        );

        // ── Step 14: Configure split destinations ──
        address cookieJar = address(0xC001);
        address treasury = address(0x7EA5);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.setMinYieldThreshold(0); // no threshold for test

        // ── Step 15: splitYield — permissionless ──
        uint256 cookieJarBefore = IERC20(yieldAsset).balanceOf(cookieJar);
        uint256 treasuryBefore = IERC20(yieldAsset).balanceOf(treasury);
        uint256 escrowedBefore = yieldSplitter.getEscrowedFractions(garden, yieldAsset);

        yieldSplitter.splitYield(garden, yieldAsset, vault);

        // ── Step 16: Verify 3-way distribution ──
        uint256 cookieJarReceived = IERC20(yieldAsset).balanceOf(cookieJar) - cookieJarBefore;
        uint256 treasuryReceived = IERC20(yieldAsset).balanceOf(treasury) - treasuryBefore;
        uint256 escrowedReceived = yieldSplitter.getEscrowedFractions(garden, yieldAsset) - escrowedBefore;
        uint256 totalDistributed = cookieJarReceived + treasuryReceived + escrowedReceived;

        assertGt(totalDistributed, 0, "splitYield should distribute non-zero yield");

        // Verify approximate ratios (48.65% / 48.65% / 2.7%)
        uint256 expectedCookieJar = (totalDistributed * 4865) / 10_000;
        uint256 expectedFractions = (totalDistributed * 4865) / 10_000;
        uint256 expectedJuicebox = totalDistributed - expectedCookieJar - expectedFractions;

        assertApproxEqRel(cookieJarReceived, expectedCookieJar, 0.05e18, "cookie jar should get ~48.65%");
        assertApproxEqRel(escrowedReceived, expectedFractions, 0.05e18, "fractions should get ~48.65% (escrowed)");
        assertApproxEqRel(treasuryReceived, expectedJuicebox, 0.05e18, "treasury should get ~2.7% JB route");

        // ── Step 17: Verify shares fully consumed ──
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "all garden shares should be redeemed");
        assertEq(yieldSplitter.totalRegisteredShares(vault), 0, "total registered shares should be zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Second Harvest Cycle — no underflow, yields compound
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that a second harvest after splitYield works correctly.
    ///         This catches underflow bugs in locked shares and ensures the
    ///         process_report mechanism is repeatable.
    function test_e2e_secondHarvestCycle_compoundsCorrectly() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (address garden, address vault) =
            _createGardenWithAaveVault("Cycle Vaults", "Cycle DAI", "ggaCYC", "Second Harvest Garden");
        yieldSplitter.setMinYieldThreshold(0);

        // First cycle: deposit → warp → harvest → split
        _depositYieldAssetIntoVault(vault, 2 ether);
        _assertYieldDepositAccounted(vault, 2 ether, "first cycle deposit should remain fully accounted");
        _warpForHarvestWindow();
        _harvestRegistersShares(garden, vault);

        uint256 firstShares = yieldSplitter.gardenShares(garden, vault);
        assertGt(firstShares, 0, "first harvest should produce shares");

        address cookieJar = address(0xC010);
        address treasury = address(0x7EB0);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.splitYield(garden, yieldAsset, vault);

        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "first split should clear shares");

        // Second cycle: warp again → harvest again → split again
        _warpForHarvestWindow();
        _harvestRegistersShares(garden, vault);

        uint256 secondShares = yieldSplitter.gardenShares(garden, vault);
        assertGt(secondShares, 0, "second harvest should produce new shares");

        uint256 cookieJarBefore = IERC20(yieldAsset).balanceOf(cookieJar);
        yieldSplitter.splitYield(garden, yieldAsset, vault);

        uint256 cookieJarAfter = IERC20(yieldAsset).balanceOf(cookieJar);
        assertGt(cookieJarAfter, cookieJarBefore, "second split should distribute more yield to cookie jar");
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "second split should clear all shares");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Conviction-Weighted Fraction Routing (Gardens Pool / NFT Voting)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests that a live HypercertSignalPool (CVStrategy) can drive the
    ///         fractions branch. With no active Hypercert orders registered yet,
    ///         the real marketplace adapter rejects purchases and YieldResolver
    ///         escrows those funds for later retry.
    function test_e2e_convictionWeightedFractionRouting() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        uint256 proposalCount = ICVStrategy(REAL_CV_POOL).proposalCounter();
        assertGt(proposalCount, 0, "real Gardens V2 pool should have proposals");

        // Setup: garden + vault + yield
        (address garden, address vault) =
            _createGardenWithAaveVault("CV Vaults", "CV DAI", "ggaCV", "Conviction Fractions Garden");

        _depositYieldAssetIntoVault(vault, 5 ether);
        _assertYieldDepositAccounted(vault, 5 ether, "conviction routing deposit should remain fully accounted");
        yieldSplitter.setMinYieldThreshold(0);
        _warpForHarvestWindow();
        _harvestRegistersShares(garden, vault);

        assertGt(yieldSplitter.gardenShares(garden, vault), 0, "harvest should register shares");

        yieldSplitter.setGardenHypercertPool(garden, REAL_CV_POOL);
        yieldSplitter.setHypercertMarketplace(address(marketplaceAdapter));

        // Configure other destinations
        address cookieJar = address(0xC020);
        address treasury = address(0x7EC0);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, treasury);

        // splitYield should now route fractions via conviction weights
        yieldSplitter.splitYield(garden, yieldAsset, vault);

        // Cookie jar and treasury should still receive their portions
        assertGt(IERC20(yieldAsset).balanceOf(cookieJar), 0, "cookie jar should receive yield");
        assertGt(IERC20(yieldAsset).balanceOf(treasury), 0, "treasury should receive yield via JB route");
        assertGt(
            yieldSplitter.getEscrowedFractions(garden, yieldAsset), 0, "fractions should escrow until live orders exist"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Multi-Deposit Auto-Allocate — deposits after wiring route to Aave
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that subsequent deposits (not just the first) auto-route to Aave.
    ///         Each deposit should increase the strategy's aToken balance.
    function test_e2e_multipleDeposits_allAutoAllocateToAave() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (, address vault) = _createGardenWithAaveVault("Multi Vaults", "Multi DAI", "ggaMUL", "Multi Deposit Garden");

        // First deposit
        _depositYieldAssetIntoVault(vault, 0.5 ether);
        _assertYieldDepositAccounted(vault, 0.5 ether, "first deposit should remain fully accounted");

        address user2 = makeAddr("user2");
        _depositYieldAssetIntoVaultAs(vault, user2, 0.75 ether);

        _assertYieldDepositAccounted(vault, 1.25 ether, "second deposit should remain fully accounted");

        // Third deposit
        _depositYieldAssetIntoVault(vault, 0.25 ether);

        // Total should approximate sum of deposits
        uint256 totalDeposited = 0.5 ether + 0.75 ether + 0.25 ether;
        _assertYieldDepositAccounted(vault, totalDeposited, "all deposits should remain fully accounted");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Emergency Pause → Resume — garden-scoped isolation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies emergency pause is garden-scoped: pausing Garden A's strategy
    ///         doesn't affect Garden B. Also tests resumeVault re-wires everything.
    function test_e2e_emergencyPauseResumeWithIsolation() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        _configureAaveVaultSupportForAsset(yieldAsset, yieldAToken, "Pause Vaults", "Pause DAI", "ggaPAU");

        // Create two gardens with vaults
        (address gardenA,) = _setupGardenWithRolesAndAction("Pause Garden A");
        address vaultA = octantModule.getVaultForAsset(gardenA, yieldAsset);
        assertTrue(vaultA != address(0), "garden A vault should exist");
        address strategyA = octantModule.vaultStrategies(vaultA);

        (address gardenB,) = _setupGardenWithRolesAndAction("Pause Garden B");
        address vaultB = octantModule.getVaultForAsset(gardenB, yieldAsset);
        assertTrue(vaultB != address(0), "garden B vault should exist");
        address strategyB = octantModule.vaultStrategies(vaultB);

        // Deposit into both
        _depositYieldAssetIntoVault(vaultA, 1 ether);
        _assertYieldDepositAccounted(vaultA, 1 ether, "Garden A deposit should remain fully accounted");
        _depositYieldAssetIntoVault(vaultB, 1 ether);
        _assertYieldDepositAccounted(vaultB, 1 ether, "Garden B deposit should remain fully accounted");

        // Emergency pause Garden A — should NOT affect Garden B
        octantModule.emergencyPause(gardenA, yieldAsset);
        assertTrue(AaveV3ERC4626(strategyA).depositsPaused(), "Garden A strategy should be paused");
        assertFalse(AaveV3ERC4626(strategyB).depositsPaused(), "Garden B strategy should NOT be paused");

        // Garden B deposits should still work
        _depositYieldAssetIntoVault(vaultB, 0.5 ether);
        _assertYieldDepositAccounted(vaultB, 1.5 ether, "Garden B should keep accepting deposits");

        // Resume Garden A with a new strategy
        AaveV3ERC4626 newStrategyA = new AaveV3ERC4626(
            yieldAsset,
            "Resumed DAI Strategy",
            "ggaRES",
            address(AaveV3ERC4626(strategyA).aavePool()),
            address(AaveV3ERC4626(strategyA).aToken()),
            address(AaveV3ERC4626(strategyA).dataProvider()),
            address(octantModule)
        );

        octantModule.resumeVault(gardenA, yieldAsset, address(newStrategyA));

        // Verify resume re-wired everything
        address resumedStrategy = octantModule.vaultStrategies(vaultA);
        assertEq(resumedStrategy, address(newStrategyA), "vaultStrategies should point to new strategy");
        assertTrue(IOctantVault(vaultA).autoAllocate(), "auto-allocate should be re-enabled after resume");
        assertEq(IOctantVault(vaultA).accountant(), address(yieldSplitter), "accountant should be re-set after resume");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: enableAutoAllocate Repair — fixes broken vaults with full wiring
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies the backfill path: an existing vault with no strategy gets
    ///         fully repaired, and then the complete yield pipeline works.
    function test_e2e_enableAutoAllocate_fullYieldPipelineAfterRepair() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        // Create a "broken" vault (strategy attachment fails)
        address garden = _mintTestGarden("Repair E2E Garden", 0x0F);
        octantModule.setOctantFactory(_deployVaultFactory("Broken Vaults"));
        octantModule.setSupportedAsset(yieldAsset, address(0xBEEF)); // broken template
        address vault = octantModule.createVaultForAsset(garden, yieldAsset);

        assertEq(octantModule.vaultStrategies(vault), address(0), "vault should start without strategy");

        // Repair with enableAutoAllocate
        octantModule.setSupportedAsset(
            yieldAsset, _deployAaveTemplateForAsset(yieldAsset, yieldAToken, "Repair DAI", "ggaREP")
        );
        octantModule.enableAutoAllocate(garden, yieldAsset);

        // Verify full wiring after repair
        address strategy = octantModule.vaultStrategies(vault);
        assertTrue(strategy != address(0), "repair should attach strategy");
        assertTrue(IOctantVault(vault).autoAllocate(), "repair should enable auto-allocate");
        assertEq(IOctantVault(vault).accountant(), address(yieldSplitter), "repair should set accountant");

        // Now run the full pipeline on the repaired vault
        _depositYieldAssetIntoVault(vault, 1 ether);
        _assertYieldDepositAccounted(vault, 1 ether, "repaired vault deposit should remain fully accounted");

        yieldSplitter.setMinYieldThreshold(0);
        _warpForHarvestWindow();
        _harvestRegistersShares(garden, vault);

        assertGt(yieldSplitter.gardenShares(garden, vault), 0, "harvest should register shares on repaired vault");

        address cookieJar = address(0xC030);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, address(0x7ED0));
        yieldSplitter.splitYield(garden, yieldAsset, vault);

        assertGt(IERC20(yieldAsset).balanceOf(cookieJar), 0, "full pipeline should work after repair");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Multi-Garden Isolation — vault shares don't leak across gardens
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Two gardens with vaults: harvesting and splitting one garden should
    ///         never affect the other's shares or yield.
    function test_e2e_multiGardenIsolation_noShareLeakage() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        yieldSplitter.setMinYieldThreshold(0);

        (address gardenA, address vaultA) =
            _createGardenWithAaveVault("Isolation Vaults", "Isolation DAI", "ggaISO", "Isolation Garden A");
        _depositYieldAssetIntoVault(vaultA, 3 ether);
        _assertYieldDepositAccounted(vaultA, 3 ether, "Garden A isolation deposit should remain fully accounted");

        (address gardenB, address vaultB) =
            _createGardenWithAaveVault("Isolation Vaults B", "Isolation DAI B", "ggaISB", "Isolation Garden B");
        _depositYieldAssetIntoVault(vaultB, 1 ether);
        _assertYieldDepositAccounted(vaultB, 1 ether, "Garden B isolation deposit should remain fully accounted");

        // Warp and harvest both
        _warpForHarvestWindow();
        _harvestRegistersShares(gardenA, vaultA);
        _harvestRegistersShares(gardenB, vaultB);

        uint256 sharesA = yieldSplitter.gardenShares(gardenA, vaultA);
        uint256 sharesB = yieldSplitter.gardenShares(gardenB, vaultB);
        assertGt(sharesA, 0, "garden A should have shares");
        assertGt(sharesB, 0, "garden B should have shares");
        // Garden A deposited 3x more, so should have ~3x more shares
        assertGt(sharesA, sharesB, "garden A should have more shares (deposited more)");

        // Split only garden A — garden B should be unaffected
        yieldSplitter.setCookieJar(gardenA, address(0xC040));
        yieldSplitter.setGardenTreasury(gardenA, address(0x7EE0));
        yieldSplitter.splitYield(gardenA, yieldAsset, vaultA);

        assertEq(yieldSplitter.gardenShares(gardenA, vaultA), 0, "garden A shares should be consumed");
        assertEq(yieldSplitter.gardenShares(gardenB, vaultB), sharesB, "garden B shares should be untouched");

        // Split garden B — should work independently
        yieldSplitter.setCookieJar(gardenB, address(0xC041));
        yieldSplitter.setGardenTreasury(gardenB, address(0x7EE1));
        yieldSplitter.splitYield(gardenB, yieldAsset, vaultB);

        assertEq(yieldSplitter.gardenShares(gardenB, vaultB), 0, "garden B shares should be consumed independently");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Vault Resolver Registration — setGardenVault called during wiring
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that vault creation registers the vault in YieldResolver's
    ///         gardenVaults mapping, which is required for splitYield validation.
    function test_e2e_vaultCreation_registersInResolver() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (address garden, address vault) =
            _createGardenWithAaveVault("Reg Vaults", "Reg DAI", "ggaREG", "Registration Garden");

        // YieldResolver should know about this vault
        assertEq(
            yieldSplitter.gardenVaults(garden, yieldAsset), vault, "resolver should register garden vault during creation"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Real Gardens V2 Pool — conviction routing against live contracts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Real deployed Gardens V2 CVStrategy pool on Arbitrum (diamond proxy).
    ///         Has 4 active proposals with real conviction scores.
    ///         Source: github.com/1Hive/gardens-v2 config/networks.json
    address internal constant REAL_CV_POOL = 0x19a0f3D7734dCa40F1847C44EF717Ef3ef5C50a5;

    /// @notice Full happy path using a real Gardens V2 CVStrategy for conviction routing.
    ///         Proves that our ICVStrategy interface is compatible with the real diamond
    ///         proxy, and that unresolved live order execution safely escrows fractions.
    function test_e2e_realGardensPool_convictionRoutingWithLiveContracts() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        // ── Step 1: Verify real pool is alive and has proposals ──
        uint256 proposalCount = ICVStrategy(REAL_CV_POOL).proposalCounter();
        assertGt(proposalCount, 0, "real Gardens V2 pool should have proposals");

        // ── Step 2: Read conviction weights from real pool ──
        uint256 activeCount;
        uint256 totalConviction;
        for (uint256 i = 1; i <= proposalCount; i++) {
            (,,,,, uint8 propStatus,,,,,,) = ICVStrategy(REAL_CV_POOL).getProposal(i);
            if (propStatus != 1) continue; // Skip non-Active

            uint256 conviction = ICVStrategy(REAL_CV_POOL).calculateProposalConviction(i);
            if (conviction > 0) {
                activeCount++;
                totalConviction += conviction;
            }
        }
        assertGt(activeCount, 0, "real pool should have active proposals with conviction");
        assertGt(totalConviction, 0, "real pool should have non-zero total conviction");

        // ── Step 3: Set up vault + yield pipeline ──
        (address garden, address vault) =
            _createGardenWithAaveVault("Real Gardens Vaults", "RG DAI", "ggaRG", "Real Gardens E2E Garden");

        _depositYieldAssetIntoVault(vault, 50 ether);
        _assertYieldDepositAccounted(vault, 50 ether, "real Gardens pool deposit should remain fully accounted");
        yieldSplitter.setMinYieldThreshold(0);
        yieldSplitter.setMinAllocationAmount(1); // 1 wei — avoid dust threshold filtering in test
        _warpForHarvestWindow();
        _harvestRegistersShares(garden, vault);

        uint256 registeredShares = yieldSplitter.gardenShares(garden, vault);
        assertGt(registeredShares, 0, "harvest should register shares");

        // ── Step 4: Wire the real Gardens pool + real marketplace adapter ──
        yieldSplitter.setGardenHypercertPool(garden, REAL_CV_POOL);
        yieldSplitter.setHypercertMarketplace(address(marketplaceAdapter));

        address cookieJar = address(0xC050);
        address treasury = address(0x7EF0);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, treasury);

        // ── Step 5: Split yield — conviction weights read from real Gardens ──
        yieldSplitter.splitYield(garden, yieldAsset, vault);

        // ── Step 6: Verify live conviction reads occurred and unresolved orders escrow funds ──
        uint256 cookieJarReceived = IERC20(yieldAsset).balanceOf(cookieJar);
        uint256 treasuryReceived = IERC20(yieldAsset).balanceOf(treasury);
        uint256 escrowed = yieldSplitter.getEscrowedFractions(garden, yieldAsset);

        uint256 totalDistributed = cookieJarReceived + treasuryReceived + escrowed;
        assertGt(totalDistributed, 0, "yield should be distributed");
        assertGt(activeCount, 0, "live pool should contribute active conviction proposals");
        assertGt(escrowed, 0, "fractions should escrow until live orders exist");
        assertGt(cookieJarReceived, 0, "cookie jar should receive yield");
        assertGt(treasuryReceived, 0, "treasury should receive yield");

        // Verify shares fully consumed
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "all shares should be redeemed");
    }
}
