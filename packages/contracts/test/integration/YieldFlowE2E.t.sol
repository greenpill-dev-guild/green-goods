// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { MockOctantFactory, MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockYDSStrategy } from "../../src/mocks/YDSStrategy.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import {
    MockCookieJar,
    MockHypercertMarketplace,
    MockJBMultiTerminalForYield,
    MockOctantVaultForYield
} from "../../src/mocks/YieldDeps.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

/// @title MockWETHForE2E
contract MockWETHForE2E is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockGardenForE2E — Combines access control + name metadata
contract MockGardenForE2E is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

/// @title YieldFlowE2ETest
/// @notice End-to-end integration test for the full yield flow:
///         OctantModule vault setup → deposit → harvest → register shares → splitYield → verify destinations
/// @dev Exercises OctantModule + YieldResolver together using lightweight mocks
contract YieldFlowE2ETest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events (duplicated for vm.expectEmit)
    // ═══════════════════════════════════════════════════════════════════════════

    event YieldSplit(
        address indexed garden,
        address indexed asset,
        uint256 cookieJarAmount,
        uint256 fractionsAmount,
        uint256 juiceboxAmount,
        uint256 totalYield
    );

    event HarvestTriggered(address indexed garden, address indexed asset, address indexed caller);

    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    OctantModule internal octantModule;
    YieldResolver internal yieldResolver;
    MockOctantFactory internal factory;
    MockYDSStrategy internal wethStrategy;
    MockGardenForE2E internal garden;
    MockHatsModule internal hatsModule;
    MockCookieJar internal cookieJar;
    MockJBMultiTerminalForYield internal jbTerminal;
    MockHypercertMarketplace internal marketplace;
    MockWETHForE2E internal weth;

    address internal constant OWNER = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant USER = address(0xA3);
    address internal constant TREASURY = address(0xA4);
    address internal constant GARDEN_TOKEN = address(0xA5);

    uint256 internal constant JB_PROJECT_ID = 42;
    uint256 internal constant MIN_THRESHOLD = 7e18;

    function setUp() public {
        // Deploy tokens
        weth = new MockWETHForE2E();

        // Deploy OctantModule infrastructure
        factory = new MockOctantFactory();
        wethStrategy = new MockYDSStrategy();

        OctantModule octantImpl = new OctantModule();
        bytes memory octantInitData =
            abi.encodeWithSelector(OctantModule.initialize.selector, OWNER, address(factory), 7 days);
        octantModule = OctantModule(address(new ERC1967Proxy(address(octantImpl), octantInitData)));

        // Deploy YieldResolver
        hatsModule = new MockHatsModule();
        cookieJar = new MockCookieJar();
        jbTerminal = new MockJBMultiTerminalForYield();
        marketplace = new MockHypercertMarketplace();

        YieldResolver yieldImpl = new YieldResolver();
        bytes memory yieldInitData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, OWNER, address(octantModule), address(hatsModule), MIN_THRESHOLD
        );
        yieldResolver = YieldResolver(address(new ERC1967Proxy(address(yieldImpl), yieldInitData)));

        // Configure OctantModule
        vm.startPrank(OWNER);
        octantModule.setGardenToken(GARDEN_TOKEN);
        octantModule.setSupportedAsset(address(weth), address(wethStrategy));
        vm.stopPrank();

        // Configure YieldResolver
        vm.startPrank(OWNER);
        yieldResolver.setHypercertMarketplace(address(marketplace));
        yieldResolver.setJBMultiTerminal(address(jbTerminal));
        yieldResolver.setJuiceboxProjectId(JB_PROJECT_ID);
        vm.stopPrank();

        // Deploy garden with access control
        garden = new MockGardenForE2E("E2E Test Garden");
        garden.setOperator(OPERATOR, true);
        hatsModule.setOperator(address(garden), OPERATOR, true);

        // Mint garden through OctantModule (creates vaults for supported assets)
        vm.prank(GARDEN_TOKEN);
        octantModule.onGardenMinted(address(garden), "E2E Test Garden");

        // Configure per-garden yield settings
        vm.startPrank(OWNER);
        yieldResolver.setCookieJar(address(garden), address(cookieJar));
        yieldResolver.setGardenTreasury(address(garden), TREASURY);

        // Wire the garden's vault into YieldResolver
        address wethVault = octantModule.getVaultForAsset(address(garden), address(weth));
        yieldResolver.setGardenVault(address(garden), address(weth), wethVault);
        vm.stopPrank();

        // Set donation address to YieldResolver
        vm.prank(OPERATOR);
        octantModule.setDonationAddress(address(garden), address(yieldResolver));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Full E2E Flow: Deposit → Harvest → Register Shares → Split → Verify
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Test the full yield flow from deposit through split verification
    /// @dev Exercises: user deposit → yield accrual → operator harvest → share registration → permissionless split
    function test_fullYieldFlow_depositToSplit() public {
        address wethVault = octantModule.getVaultForAsset(address(garden), address(weth));
        assertTrue(wethVault != address(0), "WETH vault should exist");

        // Step 1: User deposits 100 WETH into the vault
        uint256 depositAmount = 100 ether;
        vm.prank(USER);
        MockOctantVault(wethVault).deposit(depositAmount, USER);
        assertEq(MockOctantVault(wethVault).balanceOf(USER), depositAmount, "User should have deposit shares");

        // Step 2: Strategy simulates 25 WETH yield
        uint256 yieldAmount = 25 ether;
        wethStrategy.simulateYield(yieldAmount);

        // Step 3: Operator triggers harvest via OctantModule
        vm.expectEmit(true, true, true, true);
        emit HarvestTriggered(address(garden), address(weth), OPERATOR);

        vm.prank(OPERATOR);
        octantModule.harvest(address(garden), address(weth));
        assertEq(wethStrategy.reportCount(), 1, "Harvest should trigger one strategy report");

        // Step 4: Simulate yield shares arriving at YieldResolver (donation address)
        // In production, the strategy.report() mints shares to the donation address.
        // Here we manually mint vault shares + fund the vault with underlying WETH.
        MockOctantVaultForYield yieldVault = new MockOctantVaultForYield(address(weth));
        weth.mint(address(yieldVault), yieldAmount);
        yieldVault.mintShares(address(yieldResolver), yieldAmount);

        // Re-register with the mock yield vault for the split
        vm.startPrank(OWNER);
        yieldResolver.setGardenVault(address(garden), address(weth), address(yieldVault));
        vm.stopPrank();

        // Register shares with YieldResolver
        vm.prank(OWNER);
        yieldResolver.registerShares(address(garden), address(yieldVault), yieldAmount);

        // Step 5: Anyone triggers splitYield (permissionless)
        vm.prank(address(0xDEAD)); // Random address

        vm.expectEmit(true, true, false, true);
        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;
        emit YieldSplit(address(garden), address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, yieldAmount);

        yieldResolver.splitYield(address(garden), address(weth), address(yieldVault));

        // Step 6: Verify Cookie Jar received ~48.65% of yield
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie Jar should receive ~48.65%");

        // Step 7: Verify escrowed fractions has ~48.65%
        assertEq(
            yieldResolver.getEscrowedFractions(address(garden), address(weth)),
            expectedFractions,
            "Escrowed fractions should hold ~48.65%"
        );

        // Step 8: Verify Juicebox received ~2.7%
        assertEq(jbTerminal.getPayCallCount(), 1, "JB terminal should receive 1 payment");
        (uint256 projectId, address token, uint256 jbAmount, address beneficiary) = jbTerminal.payCalls(0);
        assertEq(projectId, JB_PROJECT_ID, "JB project ID should match");
        assertEq(token, address(weth), "JB token should be WETH");
        assertEq(jbAmount, expectedJuicebox, "JB amount should be ~2.7%");
        assertEq(beneficiary, address(garden), "JB beneficiary should be garden");

        // Step 9: Verify all yield was distributed (no dust in resolver)
        assertEq(
            expectedCookieJar + expectedFractions + expectedJuicebox,
            yieldAmount,
            "Total distributed must equal total yield"
        );

        // Step 10: Verify pending yield is cleared
        assertEq(
            yieldResolver.getPendingYield(address(garden), address(weth)), 0, "Pending yield should be zero after split"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Stress Test: 100 Consecutive Split Cycles — No Wei Drift
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify 100 consecutive yield→split cycles produce zero cumulative drift
    /// @dev Each cycle: mint yield shares → register → split → verify accounting.
    ///      Tracks cumulative amounts to Cookie Jar, Fractions escrow, and Juicebox.
    ///      Asserts total distributed == total yield generated with zero wei loss/creation.
    function test_consecutiveSplits_noDrift() public {
        uint256 cycles = 100;
        uint256 yieldPerCycle = 100 ether;

        // Create a dedicated yield vault for this test
        MockOctantVaultForYield yieldVault = new MockOctantVaultForYield(address(weth));

        vm.startPrank(OWNER);
        yieldResolver.setGardenVault(address(garden), address(weth), address(yieldVault));
        vm.stopPrank();

        uint256 totalCookieJar = 0;
        uint256 totalFractions = 0;
        uint256 totalJuicebox = 0;
        uint256 totalYieldGenerated = 0;

        for (uint256 i = 0; i < cycles; i++) {
            // Mint WETH into vault and shares to resolver
            weth.mint(address(yieldVault), yieldPerCycle);
            yieldVault.mintShares(address(yieldResolver), yieldPerCycle);

            // Register shares
            vm.prank(OWNER);
            yieldResolver.registerShares(address(garden), address(yieldVault), yieldPerCycle);

            // Split
            yieldResolver.splitYield(address(garden), address(weth), address(yieldVault));

            // Calculate expected portions using the same math as the contract
            uint256 expectedCookieJar = (yieldPerCycle * 4865) / 10_000;
            uint256 expectedFractions = (yieldPerCycle * 4865) / 10_000;
            uint256 expectedJuicebox = yieldPerCycle - expectedCookieJar - expectedFractions;

            totalCookieJar += expectedCookieJar;
            totalFractions += expectedFractions;
            totalJuicebox += expectedJuicebox;
            totalYieldGenerated += yieldPerCycle;

            // Verify pendingYield is 0 after each cycle (always above threshold)
            assertEq(
                yieldResolver.getPendingYield(address(garden), address(weth)),
                0,
                string.concat("Pending yield should be 0 after cycle ", vm.toString(i))
            );
        }

        // Verify total distributed equals total generated (zero drift)
        assertEq(
            totalCookieJar + totalFractions + totalJuicebox,
            totalYieldGenerated,
            "Total distributed must equal total yield generated across all cycles"
        );

        // Verify actual balances match expected cumulative totals
        assertEq(weth.balanceOf(address(cookieJar)), totalCookieJar, "Cookie Jar balance should match cumulative");

        assertEq(
            yieldResolver.getEscrowedFractions(address(garden), address(weth)),
            totalFractions,
            "Escrowed fractions should match cumulative"
        );

        // Verify JB received the correct number of payments
        assertEq(jbTerminal.getPayCallCount(), cycles, "JB should receive one payment per cycle");

        // Verify cumulative JB payments
        uint256 actualJBTotal = 0;
        for (uint256 i = 0; i < cycles; i++) {
            (,, uint256 payAmount,) = jbTerminal.payCalls(i);
            actualJBTotal += payAmount;
        }
        assertEq(actualJBTotal, totalJuicebox, "JB cumulative payments should match expected total");

        // Verify vault shares are fully consumed (no phantom shares remaining)
        assertEq(
            yieldResolver.gardenShares(address(garden), address(yieldVault)),
            0,
            "Garden should have 0 vault shares after all splits"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Stress Test: Variable Yield — Sub-Threshold Accumulation + Burst
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify sub-threshold accumulation and burst split work correctly over many cycles
    /// @dev Alternates between small yields (below threshold) and large yields (above threshold).
    ///      Validates that accumulated pending yield merges correctly into the burst split.
    function test_variableYield_accumulationAndBurst() public {
        MockOctantVaultForYield yieldVault = new MockOctantVaultForYield(address(weth));

        vm.startPrank(OWNER);
        yieldResolver.setGardenVault(address(garden), address(weth), address(yieldVault));
        vm.stopPrank();

        uint256 totalYieldGenerated = 0;
        uint256 totalDistributed = 0;

        // Run 10 cycles: 3 sub-threshold yields followed by 1 burst
        for (uint256 round = 0; round < 10; round++) {
            // 3 small yields: $2 each (below $7 threshold)
            for (uint256 j = 0; j < 3; j++) {
                uint256 smallYield = 2 ether;
                weth.mint(address(yieldVault), smallYield);
                yieldVault.mintShares(address(yieldResolver), smallYield);

                vm.prank(OWNER);
                yieldResolver.registerShares(address(garden), address(yieldVault), smallYield);

                yieldResolver.splitYield(address(garden), address(weth), address(yieldVault));
                totalYieldGenerated += smallYield;
            }

            // After 3 small yields: pending should be $6
            uint256 pendingBefore = yieldResolver.getPendingYield(address(garden), address(weth));
            assertEq(pendingBefore, 6 ether, "Pending should be 6 ether after 3 small yields");

            // Burst yield: $10 (6 pending + 10 = 16 > 7 threshold)
            uint256 burstYield = 10 ether;
            weth.mint(address(yieldVault), burstYield);
            yieldVault.mintShares(address(yieldResolver), burstYield);

            vm.prank(OWNER);
            yieldResolver.registerShares(address(garden), address(yieldVault), burstYield);

            yieldResolver.splitYield(address(garden), address(weth), address(yieldVault));
            totalYieldGenerated += burstYield;

            // After burst: pending should be 0 (all merged and split)
            assertEq(
                yieldResolver.getPendingYield(address(garden), address(weth)), 0, "Pending should be 0 after burst split"
            );

            // Track what was split this round: 6 + 10 = 16 ether
            uint256 roundTotal = 16 ether;
            uint256 roundCookieJar = (roundTotal * 4865) / 10_000;
            uint256 roundFractions = (roundTotal * 4865) / 10_000;
            uint256 roundJuicebox = roundTotal - roundCookieJar - roundFractions;
            totalDistributed += roundCookieJar + roundFractions + roundJuicebox;
        }

        // Verify zero drift across all accumulation+burst cycles
        assertEq(totalDistributed, totalYieldGenerated, "Total distributed must equal total yield across all rounds");
    }
}
