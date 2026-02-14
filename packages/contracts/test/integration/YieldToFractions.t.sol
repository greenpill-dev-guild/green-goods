// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { YieldSplitter } from "../../src/yield/YieldSplitter.sol";
import {
    MockCookieJar,
    MockHypercertMarketplace,
    MockJBMultiTerminalForYield,
    MockOctantVaultForYield
} from "../../src/mocks/MockYieldDeps.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

/// @title MockDAI for integration testing
contract MockDAI is ERC20 {
    constructor() ERC20("DAI Stablecoin", "DAI") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockWETHForIntegration
contract MockWETHForIntegration is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title YieldToFractionsTest
/// @notice Integration tests for the full yield split flow:
///         deposit → harvest → split → verify jar + fractions + JB
contract YieldToFractionsTest is Test {
    YieldSplitter public splitter;
    MockDAI public dai;
    MockWETHForIntegration public weth;
    MockOctantVaultForYield public daiVault;
    MockOctantVaultForYield public wethVault;
    MockCookieJar public cookieJar;
    MockHypercertMarketplace public marketplace;
    MockJBMultiTerminalForYield public jbTerminal;
    MockHatsModule public hatsModule;

    address public owner = address(0x1);
    address public operator = address(0x2);
    address public garden = address(0x100);
    address public treasury = address(0x200);

    uint256 public constant JB_PROJECT_ID = 1;
    uint256 public constant MIN_THRESHOLD = 7e18;

    function setUp() public {
        // Deploy tokens
        dai = new MockDAI();
        weth = new MockWETHForIntegration();

        // Deploy vaults
        daiVault = new MockOctantVaultForYield(address(dai));
        wethVault = new MockOctantVaultForYield(address(weth));

        // Deploy mocks
        cookieJar = new MockCookieJar();
        marketplace = new MockHypercertMarketplace();
        jbTerminal = new MockJBMultiTerminalForYield();
        hatsModule = new MockHatsModule();

        // Fund vaults with underlying
        dai.mint(address(daiVault), 1_000_000e18);
        weth.mint(address(wethVault), 1_000_000e18);

        // Deploy YieldSplitter
        YieldSplitter impl = new YieldSplitter();
        bytes memory initData =
            abi.encodeWithSelector(YieldSplitter.initialize.selector, owner, address(0), address(hatsModule), MIN_THRESHOLD);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        splitter = YieldSplitter(address(proxy));

        // Configure
        vm.startPrank(owner);
        splitter.setHypercertMarketplace(address(marketplace));
        splitter.setJBMultiTerminal(address(jbTerminal));
        splitter.setJuiceboxProjectId(JB_PROJECT_ID);
        splitter.setCookieJar(garden, address(cookieJar));
        splitter.setGardenTreasury(garden, treasury);
        splitter.setGardenVault(garden, address(dai), address(daiVault));
        splitter.setGardenVault(garden, address(weth), address(wethVault));
        vm.stopPrank();

        // Set operator
        hatsModule.setOperator(garden, operator, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Full Flow: Deposit → Harvest → Split → Verify
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Helper: Mint vault shares and register them for the garden
    function _mintAndRegisterShares(MockOctantVaultForYield vault, uint256 amount) internal {
        vault.mintShares(address(splitter), amount);
        vm.prank(owner);
        splitter.registerShares(garden, address(vault), amount);
    }

    function test_fullFlow_deposit_harvest_split() public {
        uint256 yieldAmount = 100e18;

        // Simulate harvest: yield shares minted to splitter (donation address)
        _mintAndRegisterShares(daiVault, yieldAmount);

        // Anyone triggers split
        splitter.splitYield(garden, address(dai), address(daiVault));

        // Verify Cookie Jar received ~33%
        uint256 expectedCookieJar = (yieldAmount * 3334) / 10_000;
        assertEq(dai.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie Jar should receive ~33%");

        // Verify JB received ~33%
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive 1 payment");
        (,, uint256 jbAmount,) = jbTerminal.payCalls(0);
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - ((yieldAmount * 3333) / 10_000);
        assertEq(jbAmount, expectedJuicebox, "JB amount should be ~33%");

        // Fractions escrow to pendingYield (~33%) — prevents geometric decay
        uint256 expectedFractions = (yieldAmount * 3333) / 10_000;
        assertEq(
            splitter.getPendingYield(garden, address(dai)), expectedFractions, "Fractions should escrow to pendingYield"
        );
        assertEq(daiVault.balanceOf(address(splitter)), 0, "Should NOT recompound into vault");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multi-Asset: WETH + DAI Split Independently
    // ═══════════════════════════════════════════════════════════════════════════

    function test_multiAsset_wethAndDai_splitIndependently() public {
        uint256 daiYield = 50e18;
        uint256 wethYield = 30e18;

        // Simulate DAI yield
        _mintAndRegisterShares(daiVault, daiYield);

        // Simulate WETH yield
        _mintAndRegisterShares(wethVault, wethYield);

        // Split DAI
        splitter.splitYield(garden, address(dai), address(daiVault));

        // Split WETH
        splitter.splitYield(garden, address(weth), address(wethVault));

        // Both should have been split
        assertTrue(dai.balanceOf(address(cookieJar)) > 0, "Cookie Jar should have DAI");
        assertTrue(weth.balanceOf(address(cookieJar)) > 0, "Cookie Jar should have WETH");
        assertEq(jbTerminal.getPayCallCount(), 2, "JB should receive 2 payments (DAI + WETH)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // No Hypercerts: Recompound
    // ═══════════════════════════════════════════════════════════════════════════

    function test_noHypercerts_escrowToPendingYield() public {
        // Set 100% to fractions
        vm.prank(owner);
        splitter.setSplitRatio(garden, 0, 10_000, 0);

        uint256 yieldAmount = 20e18;
        _mintAndRegisterShares(daiVault, yieldAmount);

        splitter.splitYield(garden, address(dai), address(daiVault));

        // All should escrow to pendingYield (prevents geometric decay)
        assertEq(splitter.getPendingYield(garden, address(dai)), yieldAmount, "Should fully escrow to pendingYield");
        assertEq(daiVault.balanceOf(address(splitter)), 0, "Should NOT recompound into vault");
        assertEq(dai.balanceOf(address(cookieJar)), 0, "Cookie Jar should be empty");
        assertEq(jbTerminal.getPayCallCount(), 0, "JB should receive nothing");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Threshold Accumulation → Merge → Split
    // ═══════════════════════════════════════════════════════════════════════════

    function test_thresholdAccumulation_then_mergeAndSplit() public {
        // First yield: $3 — below $7 threshold
        _mintAndRegisterShares(daiVault, 3e18);
        splitter.splitYield(garden, address(dai), address(daiVault));
        assertEq(splitter.getPendingYield(garden, address(dai)), 3e18, "First yield pending");

        // Second yield: $2 → total $5, still below
        _mintAndRegisterShares(daiVault, 2e18);
        splitter.splitYield(garden, address(dai), address(daiVault));
        assertEq(splitter.getPendingYield(garden, address(dai)), 5e18, "Second yield still pending");

        // Third yield: $3 → total $8, above threshold → SPLIT
        _mintAndRegisterShares(daiVault, 3e18);
        splitter.splitYield(garden, address(dai), address(daiVault));

        // Total split: $8 — pendingYield now contains only the escrowed fractions portion
        uint256 totalSplit = 8e18;
        uint256 expectedFractionsPending = (totalSplit * 3333) / 10_000;
        assertEq(
            splitter.getPendingYield(garden, address(dai)),
            expectedFractionsPending,
            "Pending should contain escrowed fractions portion"
        );

        uint256 expectedCookieJar = (totalSplit * 3334) / 10_000;
        assertEq(dai.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie Jar from merged yield");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Custom Split + Full Verification
    // ═══════════════════════════════════════════════════════════════════════════

    function test_customSplit_60_20_20_fullVerification() public {
        vm.prank(operator);
        splitter.setSplitRatio(garden, 6000, 2000, 2000);

        uint256 yieldAmount = 100e18;
        _mintAndRegisterShares(daiVault, yieldAmount);

        splitter.splitYield(garden, address(dai), address(daiVault));

        // Cookie Jar: 60%
        assertEq(dai.balanceOf(address(cookieJar)), 60e18, "Cookie Jar = 60%");

        // Fractions: 20% → escrowed in pendingYield
        assertEq(splitter.getPendingYield(garden, address(dai)), 20e18, "Fractions = 20% escrowed in pendingYield");
        assertEq(daiVault.balanceOf(address(splitter)), 0, "Should NOT recompound into vault");

        // JB: 20%
        (,, uint256 jbAmount,) = jbTerminal.payCalls(0);
        assertEq(jbAmount, 20e18, "JB = 20%");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Permissionless Trigger
    // ═══════════════════════════════════════════════════════════════════════════

    function test_anyoneCanTriggerSplit() public {
        _mintAndRegisterShares(daiVault, 100e18);

        // Random address triggers
        vm.prank(address(0xDEAD));
        splitter.splitYield(garden, address(dai), address(daiVault));

        assertTrue(dai.balanceOf(address(cookieJar)) > 0, "Split should succeed");
    }
}
