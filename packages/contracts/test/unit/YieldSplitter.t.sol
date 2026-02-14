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

/// @title MockWETH for testing
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title YieldSplitterTest
/// @notice Unit tests for YieldSplitter contract
contract YieldSplitterTest is Test {
    YieldSplitter public yieldSplitter;
    MockWETH public weth;
    MockOctantVaultForYield public vault;
    MockCookieJar public cookieJar;
    MockHypercertMarketplace public marketplace;
    MockJBMultiTerminalForYield public jbTerminal;
    MockHatsModule public hatsModule;

    address public owner = address(0x1);
    address public octantModule = address(0x2);
    address public garden = address(0x100);
    address public treasury = address(0x200);
    address public operator = address(0x300);

    uint256 public constant MIN_YIELD_THRESHOLD = 7e18; // $7 in 18 decimals

    function setUp() public {
        // Deploy mocks
        weth = new MockWETH();
        vault = new MockOctantVaultForYield(address(weth));
        cookieJar = new MockCookieJar();
        marketplace = new MockHypercertMarketplace();
        jbTerminal = new MockJBMultiTerminalForYield();
        hatsModule = new MockHatsModule();

        // Deploy YieldSplitter behind proxy
        YieldSplitter impl = new YieldSplitter();
        bytes memory initData = abi.encodeWithSelector(
            YieldSplitter.initialize.selector, owner, octantModule, address(hatsModule), MIN_YIELD_THRESHOLD
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        yieldSplitter = YieldSplitter(address(proxy));

        // Configure the yield splitter
        vm.startPrank(owner);
        yieldSplitter.setCookieJar(garden, address(cookieJar));
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.setGardenVault(garden, address(weth), address(vault));
        yieldSplitter.setHypercertMarketplace(address(marketplace));
        yieldSplitter.setJBMultiTerminal(address(jbTerminal));
        yieldSplitter.setJuiceboxProjectId(1);
        vm.stopPrank();

        // Set up operator role
        hatsModule.setOperator(garden, operator, true);
    }

    /// @notice Helper: Fund vault and mint shares to the yield splitter
    function _fundVaultAndMintShares(uint256 amount) internal {
        weth.mint(address(vault), amount); // Fund vault with WETH for redemptions
        vault.mintShares(address(yieldSplitter), amount); // Give splitter shares to redeem
        // Register shares so the per-garden accounting tracks them
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsOwner() public {
        assertEq(yieldSplitter.owner(), owner, "Owner should be set");
    }

    function test_initialize_setsOctantModule() public {
        assertEq(yieldSplitter.octantModule(), octantModule, "OctantModule should be set");
    }

    function test_initialize_setsMinYieldThreshold() public {
        assertEq(yieldSplitter.minYieldThreshold(), MIN_YIELD_THRESHOLD, "Min yield threshold should be set");
    }

    function test_initialize_revertsWithZeroOwner() public {
        YieldSplitter impl = new YieldSplitter();
        bytes memory initData =
            abi.encodeWithSelector(YieldSplitter.initialize.selector, address(0), octantModule, address(hatsModule), 0);
        vm.expectRevert(YieldSplitter.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Default Split Config
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getSplitConfig_returnsDefaultsWhenNotSet() public {
        YieldSplitter.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 3334, "Default cookie jar BPS should be 3334");
        assertEq(config.fractionsBps, 3333, "Default fractions BPS should be 3333");
        assertEq(config.juiceboxBps, 3333, "Default juicebox BPS should be 3333");
        assertEq(config.cookieJarBps + config.fractionsBps + config.juiceboxBps, 10_000, "Should sum to 10000");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Set Split Ratio
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setSplitRatio_byOperator() public {
        vm.prank(operator);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 2000);

        YieldSplitter.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 5000, "Cookie jar should be 50%");
        assertEq(config.fractionsBps, 3000, "Fractions should be 30%");
        assertEq(config.juiceboxBps, 2000, "Juicebox should be 20%");
    }

    function test_setSplitRatio_byOwner() public {
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 10_000, 0, 0);

        YieldSplitter.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 10_000, "Cookie jar should be 100%");
    }

    function test_setSplitRatio_revertsIfNotSumTo10000() public {
        vm.prank(owner);
        vm.expectRevert(YieldSplitter.InvalidSplitRatio.selector);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 1000);
    }

    function test_setSplitRatio_revertsForUnauthorized() public {
        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSelector(YieldSplitter.UnauthorizedCaller.selector, address(0x999)));
        yieldSplitter.setSplitRatio(garden, 3334, 3333, 3333);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Split Yield — Minimum Threshold
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_accumulatesWhenBelowThreshold() public {
        uint256 smallAmount = 5e18; // $5 < $7 threshold
        _fundVaultAndMintShares(smallAmount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Should accumulate, not split
        assertEq(yieldSplitter.getPendingYield(garden, address(weth)), smallAmount, "Should accumulate pending yield");
    }

    function test_splitYield_splitsWhenAboveThreshold() public {
        uint256 amount = 10e18; // $10 > $7 threshold
        _fundVaultAndMintShares(amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Should have split — pendingYield contains only the escrowed fractions portion
        uint256 expectedFractionsPending = (amount * 3333) / 10_000;
        assertEq(
            yieldSplitter.getPendingYield(garden, address(weth)),
            expectedFractionsPending,
            "Pending should contain escrowed fractions portion"
        );
    }

    function test_splitYield_mergesPendingWhenCrossingThreshold() public {
        // First split: below threshold
        uint256 first = 4e18;
        _fundVaultAndMintShares(first);
        yieldSplitter.splitYield(garden, address(weth), address(vault));
        assertEq(yieldSplitter.getPendingYield(garden, address(weth)), first, "First yield should be pending");

        // Second split: 4 + 5 = 9 > 7 threshold
        uint256 second = 5e18;
        _fundVaultAndMintShares(second);
        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Should merge and split — pendingYield now contains only the escrowed fractions portion
        uint256 totalYield = first + second; // 9e18
        uint256 expectedFractionsPending = (totalYield * 3333) / 10_000;
        assertEq(
            yieldSplitter.getPendingYield(garden, address(weth)),
            expectedFractionsPending,
            "Pending should contain escrowed fractions portion after merge+split"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Split Yield — Three-Way Distribution
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_defaultDistribution() public {
        uint256 amount = 10_000; // Exact for clean BPS math
        _fundVaultAndMintShares(amount);

        // Set threshold to 0 for this test
        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Default: ~33/33/33
        // cookieJar: 10000 * 3334 / 10000 = 3334
        // fractions: 10000 * 3333 / 10000 = 3333
        // juicebox: 10000 - 3334 - 3333 = 3333

        // Cookie jar should have received ~33%
        assertEq(weth.balanceOf(address(cookieJar)), 3334, "Cookie jar should receive ~33%");
    }

    function test_splitYield_customRatio50_30_20() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        vm.prank(operator);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 2000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // 50% to cookie jar = 5000
        assertEq(weth.balanceOf(address(cookieJar)), 5000, "Cookie jar should receive 50%");

        // 20% to JB terminal = 2000
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive one payment");
    }

    function test_splitYield_100percentToCookieJar() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 10_000, 0, 0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(weth.balanceOf(address(cookieJar)), 10_000, "Cookie jar should receive 100%");
        assertEq(jbTerminal.getPayCallCount(), 0, "JB should receive nothing");
    }

    function test_splitYield_100percentToJuicebox() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 0, 0, 10_000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(weth.balanceOf(address(cookieJar)), 0, "Cookie jar should receive nothing");
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive one payment");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Split Yield — Cookie Jar Routing
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_cookieJarReceivesERC20() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 10_000, 0, 0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar should hold the WETH
        assertEq(weth.balanceOf(address(cookieJar)), amount, "Cookie jar should hold WETH");
    }

    function test_splitYield_noCookieJar_fallsBackToTreasury() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Remove cookie jar
        vm.prank(owner);
        yieldSplitter.setCookieJar(garden, address(0));

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 10_000, 0, 0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Treasury should receive as fallback
        assertEq(weth.balanceOf(treasury), amount, "Treasury should receive as fallback");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Split Yield — Juicebox Routing
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_juiceboxReceivesPayment() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 0, 0, 10_000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(jbTerminal.getPayCallCount(), 1, "Should have 1 JB pay call");
        (uint256 projectId, address token, uint256 payAmount, address beneficiary) = jbTerminal.payCalls(0);
        assertEq(projectId, 1, "Project ID should be 1");
        assertEq(token, address(weth), "Token should be WETH");
        assertEq(payAmount, amount, "Amount should match");
        assertEq(beneficiary, garden, "Beneficiary should be garden");
    }

    function test_splitYield_noJBTerminal_fallsBackToTreasury() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Remove JB terminal
        vm.prank(owner);
        yieldSplitter.setJBMultiTerminal(address(0));

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 0, 0, 10_000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Treasury should receive as fallback
        assertEq(weth.balanceOf(treasury), amount, "Treasury should receive as fallback");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Split Yield — Fractions Routing (Recompound)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_fractionsEscrowToPendingYield() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 0, 10_000, 0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Fractions should escrow to pendingYield (not recompound into vault)
        // This prevents geometric decay across split cycles
        assertEq(
            yieldSplitter.getPendingYield(garden, address(weth)),
            amount,
            "Fractions portion should be escrowed in pendingYield"
        );
        assertEq(vault.balanceOf(address(yieldSplitter)), 0, "Should NOT have recompounded shares");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_revertsWithZeroGarden() public {
        vm.expectRevert(YieldSplitter.ZeroAddress.selector);
        yieldSplitter.splitYield(address(0), address(weth), address(vault));
    }

    function test_splitYield_revertsWithNoShares() public {
        vm.expectRevert(abi.encodeWithSelector(YieldSplitter.NoVaultShares.selector, garden, address(weth)));
        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setMinYieldThreshold_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setMinYieldThreshold(0);
    }

    function test_setMinYieldThreshold_updatesValue() public {
        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(100e18);
        assertEq(yieldSplitter.minYieldThreshold(), 100e18, "Threshold should be updated");
    }

    function test_setHypercertMarketplace_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setHypercertMarketplace(address(0x42));
    }

    function test_setJBMultiTerminal_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setJBMultiTerminal(address(0x42));
    }

    function test_setJuiceboxProjectId_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setJuiceboxProjectId(42);
    }

    function test_setCookieJar_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setCookieJar(garden, address(0x42));
    }

    function test_setGardenTreasury_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setGardenTreasury(garden, address(0x42));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    function test_constants() public {
        assertEq(yieldSplitter.BPS_DENOMINATOR(), 10_000, "BPS denominator should be 10000");
        assertEq(yieldSplitter.DEFAULT_COOKIE_JAR_BPS(), 3334, "Default cookie jar BPS should be 3334");
        assertEq(yieldSplitter.DEFAULT_FRACTIONS_BPS(), 3333, "Default fractions BPS should be 3333");
        assertEq(yieldSplitter.DEFAULT_JUICEBOX_BPS(), 3333, "Default juicebox BPS should be 3333");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Rescue Tokens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_rescueTokens_success() public {
        uint256 amount = 5000;
        weth.mint(address(yieldSplitter), amount);
        address recipient = address(0x400);

        vm.prank(owner);
        yieldSplitter.rescueTokens(address(weth), recipient, amount);

        assertEq(weth.balanceOf(recipient), amount, "Recipient should receive rescued tokens");
        assertEq(weth.balanceOf(address(yieldSplitter)), 0, "YieldSplitter should have 0 balance");
    }

    function test_rescueTokens_emitsEvent() public {
        uint256 amount = 1000;
        weth.mint(address(yieldSplitter), amount);

        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.TokensRescued(address(weth), address(0x400), amount);

        vm.prank(owner);
        yieldSplitter.rescueTokens(address(weth), address(0x400), amount);
    }

    function test_rescueTokens_revertsForNonOwner() public {
        weth.mint(address(yieldSplitter), 1000);

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.rescueTokens(address(weth), address(0x400), 1000);
    }

    function test_rescueTokens_revertsWithZeroTokenAddress() public {
        vm.prank(owner);
        vm.expectRevert(YieldSplitter.ZeroAddress.selector);
        yieldSplitter.rescueTokens(address(0), address(0x400), 1000);
    }

    function test_rescueTokens_revertsWithZeroRecipient() public {
        vm.prank(owner);
        vm.expectRevert(YieldSplitter.ZeroAddress.selector);
        yieldSplitter.rescueTokens(address(weth), address(0), 1000);
    }

    function test_rescueTokens_revertsWithInsufficientBalance() public {
        // No tokens minted to yieldSplitter
        vm.prank(owner);
        vm.expectRevert(); // ERC20 transfer will fail
        yieldSplitter.rescueTokens(address(weth), address(0x400), 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Event Emissions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setSplitRatio_emitsSplitRatioUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit YieldSplitter.SplitRatioUpdated(garden, 5000, 3000, 2000);

        vm.prank(operator);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 2000);
    }

    function test_setMinYieldThreshold_emitsMinYieldThresholdUpdated() public {
        vm.expectEmit(false, false, false, true);
        emit YieldSplitter.MinYieldThresholdUpdated(MIN_YIELD_THRESHOLD, 100e18);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(100e18);
    }

    function test_splitYield_emitsYieldSplitOnSuccess() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        // Default split: 3334/3333/3333 on 10000
        // cookieJar = 10000 * 3334 / 10000 = 3334
        // fractions = 10000 * 3333 / 10000 = 3333
        // juicebox  = 10000 - 3334 - 3333  = 3333
        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.YieldSplit(garden, address(weth), 3334, 3333, 3333, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    function test_splitYield_emitsYieldAccumulatedBelowThreshold() public {
        uint256 smallAmount = 5e18; // $5 < $7 threshold
        _fundVaultAndMintShares(smallAmount);

        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.YieldAccumulated(garden, address(weth), smallAmount, smallAmount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Invalid Vault
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_revertsWithInvalidVault() public {
        address wrongVault = address(0x999);

        vm.expectRevert(
            abi.encodeWithSelector(YieldSplitter.InvalidVault.selector, garden, address(weth), address(vault), wrongVault)
        );
        yieldSplitter.splitYield(garden, address(weth), wrongVault);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Set Garden Vault
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardenVault_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setGardenVault(garden, address(weth), address(0x42));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multi-Garden Yield Isolation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_multiGardenIsolation() public {
        // Setup second garden with its own vault and treasury
        address gardenB = address(0x101);
        address treasuryB = address(0x201);
        MockOctantVaultForYield vaultB = new MockOctantVaultForYield(address(weth));
        MockCookieJar cookieJarB = new MockCookieJar();

        vm.startPrank(owner);
        yieldSplitter.setCookieJar(gardenB, address(cookieJarB));
        yieldSplitter.setGardenTreasury(gardenB, treasuryB);
        yieldSplitter.setGardenVault(gardenB, address(weth), address(vaultB));
        yieldSplitter.setMinYieldThreshold(0);
        vm.stopPrank();

        // Fund both gardens
        uint256 amountA = 10_000;
        uint256 amountB = 20_000;
        _fundVaultAndMintShares(amountA); // Fund garden A's vault

        weth.mint(address(vaultB), amountB);
        vaultB.mintShares(address(yieldSplitter), amountB);
        vm.prank(octantModule);
        yieldSplitter.registerShares(gardenB, address(vaultB), amountB);

        // Split only garden A
        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Garden A: cookie jar should have received its share
        uint256 expectedCookieJarA = (amountA * 3334) / 10_000;
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJarA, "Garden A cookie jar should receive yield");

        // Garden B: cookie jar should be untouched
        assertEq(weth.balanceOf(address(cookieJarB)), 0, "Garden B cookie jar should NOT receive yield from A");

        // Garden B: vault shares should be untouched (per-garden tracking, not vault.balanceOf)
        assertEq(yieldSplitter.gardenShares(gardenB, address(vaultB)), amountB, "Garden B vault shares should be intact");

        // Now split garden B
        yieldSplitter.splitYield(gardenB, address(weth), address(vaultB));

        // Garden B: cookie jar should now have received its share
        uint256 expectedCookieJarB = (amountB * 3334) / 10_000;
        assertEq(weth.balanceOf(address(cookieJarB)), expectedCookieJarB, "Garden B cookie jar should receive yield");

        // Garden A: cookie jar should NOT have changed
        assertEq(
            weth.balanceOf(address(cookieJar)), expectedCookieJarA, "Garden A cookie jar should be unchanged after B split"
        );
    }

    function test_splitYield_multiGardenPendingIsolation() public {
        // Setup second garden
        address gardenB = address(0x101);
        address treasuryB = address(0x201);
        MockOctantVaultForYield vaultB = new MockOctantVaultForYield(address(weth));
        MockCookieJar cookieJarB = new MockCookieJar();

        vm.startPrank(owner);
        yieldSplitter.setCookieJar(gardenB, address(cookieJarB));
        yieldSplitter.setGardenTreasury(gardenB, treasuryB);
        yieldSplitter.setGardenVault(gardenB, address(weth), address(vaultB));
        vm.stopPrank();

        // Fund garden A below threshold, garden B above threshold
        uint256 smallA = 3e18; // Below 7e18 threshold
        uint256 largeB = 10e18; // Above threshold

        _fundVaultAndMintShares(smallA);
        weth.mint(address(vaultB), largeB);
        vaultB.mintShares(address(yieldSplitter), largeB);
        vm.prank(octantModule);
        yieldSplitter.registerShares(gardenB, address(vaultB), largeB);

        // Split garden A — should accumulate
        yieldSplitter.splitYield(garden, address(weth), address(vault));
        assertEq(yieldSplitter.getPendingYield(garden, address(weth)), smallA, "Garden A should accumulate");
        assertEq(yieldSplitter.getPendingYield(gardenB, address(weth)), 0, "Garden B pending should be zero");

        // Split garden B — should distribute (above threshold), fractions escrowed
        yieldSplitter.splitYield(gardenB, address(weth), address(vaultB));
        uint256 expectedFractionsPendingB = (largeB * 3333) / 10_000;
        assertEq(
            yieldSplitter.getPendingYield(gardenB, address(weth)),
            expectedFractionsPendingB,
            "Garden B pending should contain escrowed fractions"
        );

        // Garden A pending should NOT have been affected by B's split
        assertEq(
            yieldSplitter.getPendingYield(garden, address(weth)),
            smallA,
            "Garden A pending should be unchanged after B split"
        );
    }

    function test_setGardenVault_updatesVault() public {
        address newVault = address(0x42);

        vm.prank(owner);
        yieldSplitter.setGardenVault(garden, address(weth), newVault);

        // Verify the vault was updated by trying to split with old vault (should revert)
        _fundVaultAndMintShares(10_000);
        vm.expectRevert(
            abi.encodeWithSelector(YieldSplitter.InvalidVault.selector, garden, address(weth), newVault, address(vault))
        );
        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BPS Rounding — Dust & Edge Cases
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Test BPS split with 1 wei yield
    /// With default split (3334/3333/3333) and totalYield=1:
    ///   cookieJar = 1 * 3334 / 10000 = 0
    ///   fractions = 1 * 3333 / 10000 = 0
    ///   juicebox  = 1 - 0 - 0 = 1
    /// All dust goes to juicebox (remainder recipient)
    function test_splitYield_dustAmount_1wei() public {
        uint256 amount = 1;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        // Expected: cookieJar=0, fractions=0, juicebox=1 (remainder)
        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.YieldSplit(garden, address(weth), 0, 0, 1, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar gets nothing (rounding down to 0)
        assertEq(weth.balanceOf(address(cookieJar)), 0, "Cookie jar should get 0 for 1 wei");

        // JB terminal receives the remainder (1 wei)
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive 1 payment");
        (,, uint256 payAmount,) = jbTerminal.payCalls(0);
        assertEq(payAmount, 1, "JB should receive 1 wei remainder");
    }

    /// @notice Test BPS split with 3 wei yield
    /// With default split (3334/3333/3333) and totalYield=3:
    ///   cookieJar = 3 * 3334 / 10000 = 1 (10002 / 10000 = 1)
    ///   fractions = 3 * 3333 / 10000 = 0 (9999 / 10000 = 0)
    ///   juicebox  = 3 - 1 - 0 = 2
    function test_splitYield_dustAmount_3wei() public {
        uint256 amount = 3;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        uint256 expectedCookieJar = (amount * 3334) / 10_000; // = 1
        uint256 expectedFractions = (amount * 3333) / 10_000; // = 0
        uint256 expectedJuicebox = amount - expectedCookieJar - expectedFractions; // = 2

        // Verify the three amounts sum to totalYield
        assertEq(expectedCookieJar + expectedFractions + expectedJuicebox, amount, "Split must sum to totalYield");

        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.YieldSplit(garden, address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar gets 1 wei
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie jar should get 1 wei for 3 wei total");
    }

    /// @notice Test BPS split with 9999 wei yield (just below BPS denominator)
    /// Verify no rounding errors accumulate:
    ///   cookieJar = 9999 * 3334 / 10000 = 33336666 / 10000 = 3333
    ///   fractions = 9999 * 3333 / 10000 = 33326667 / 10000 = 3332
    ///   juicebox  = 9999 - 3333 - 3332 = 3334
    function test_splitYield_dustAmount_9999wei() public {
        uint256 amount = 9999;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        uint256 expectedCookieJar = (amount * 3334) / 10_000;
        uint256 expectedFractions = (amount * 3333) / 10_000;
        uint256 expectedJuicebox = amount - expectedCookieJar - expectedFractions;

        // Key assertion: no wei lost or created
        assertEq(expectedCookieJar + expectedFractions + expectedJuicebox, amount, "Split must sum to totalYield (9999)");

        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.YieldSplit(garden, address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar balance verification
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie jar should match expected for 9999 wei");
    }

    /// @notice Test BPS split with 10000 wei (exact BPS denominator)
    /// Clean division: 10000 * 3334 / 10000 = 3334
    ///                 10000 * 3333 / 10000 = 3333
    ///                 10000 - 3334 - 3333  = 3333
    /// Total: 3334 + 3333 + 3333 = 10000
    function test_splitYield_exactBpsDenominator() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        // Exact division case
        uint256 expectedCookieJar = 3334;
        uint256 expectedFractions = 3333;
        uint256 expectedJuicebox = 3333;

        // Verify exact sum
        assertEq(expectedCookieJar + expectedFractions + expectedJuicebox, amount, "Exact BPS split must sum to 10000");

        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.YieldSplit(garden, address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Verify cookie jar received exact 3334
        assertEq(weth.balanceOf(address(cookieJar)), 3334, "Cookie jar should receive exactly 3334");

        // Verify JB terminal received exact 3333
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive one payment");
        (,, uint256 payAmount,) = jbTerminal.payCalls(0);
        assertEq(payAmount, 3333, "JB should receive exactly 3333");
    }
}

/// @title YieldSplitterHarness
/// @notice Test harness exposing internal functions for unit testing
contract YieldSplitterHarness is YieldSplitter {
    function exposed_purchaseFraction(
        address garden,
        address asset,
        uint256 hypercertId,
        uint256 amount
    )
        external
        returns (uint256 fractionId)
    {
        return _purchaseFraction(garden, asset, hypercertId, amount);
    }

    function exposed_recompound(address garden, address asset, uint256 amount, address vault) external {
        _recompound(garden, asset, amount, vault);
    }

    function exposed_routeToCookieJar(address garden, address asset, uint256 amount) external {
        _routeToCookieJar(garden, asset, amount);
    }

    function exposed_routeToJuicebox(address garden, address asset, uint256 amount) external {
        _routeToJuicebox(garden, asset, amount);
    }
}

/// @title YieldSplitterFailureTest
/// @notice Tests for failure paths, allowance cleanup, and marketplace purchase
contract YieldSplitterFailureTest is Test {
    YieldSplitterHarness public harness;
    MockWETH public weth;
    MockOctantVaultForYield public vault;
    MockCookieJar public cookieJar;
    MockHypercertMarketplace public marketplace;
    MockJBMultiTerminalForYield public jbTerminal;
    MockHatsModule public hatsModule;

    address public owner = address(0x1);
    address public octantModule = address(0x2);
    address public garden = address(0x100);
    address public treasury = address(0x200);

    function setUp() public {
        weth = new MockWETH();
        vault = new MockOctantVaultForYield(address(weth));
        cookieJar = new MockCookieJar();
        marketplace = new MockHypercertMarketplace();
        jbTerminal = new MockJBMultiTerminalForYield();
        hatsModule = new MockHatsModule();

        // Deploy harness behind proxy
        YieldSplitterHarness impl = new YieldSplitterHarness();
        bytes memory initData =
            abi.encodeWithSelector(YieldSplitter.initialize.selector, owner, octantModule, address(hatsModule), 0);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        harness = YieldSplitterHarness(address(proxy));

        // Configure
        vm.startPrank(owner);
        harness.setCookieJar(garden, address(cookieJar));
        harness.setGardenTreasury(garden, treasury);
        harness.setGardenVault(garden, address(weth), address(vault));
        harness.setHypercertMarketplace(address(marketplace));
        harness.setJBMultiTerminal(address(jbTerminal));
        harness.setJuiceboxProjectId(1);
        harness.setMinAllocationAmount(0); // Allow dust amounts for unit tests
        vm.stopPrank();
    }

    /// @notice Helper: Mint WETH directly to the harness for internal routing tests
    function _fundHarness(uint256 amount) internal {
        weth.mint(address(harness), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _purchaseFraction — Success Path
    // ═══════════════════════════════════════════════════════════════════════════

    function test_purchaseFraction_success() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        uint256 fractionId = harness.exposed_purchaseFraction(garden, address(weth), 42, amount);

        assertEq(fractionId, 1, "Should return fraction ID 1");
        assertEq(marketplace.getPurchaseCount(), 1, "Should have 1 purchase");

        (uint256 hcId, uint256 paidAmount, address paidAsset, address recipient) = marketplace.purchases(0);
        assertEq(hcId, 42, "Hypercert ID should be 42");
        assertEq(paidAmount, amount, "Amount should match");
        assertEq(paidAsset, address(weth), "Asset should be WETH");
        assertEq(recipient, treasury, "Recipient should be treasury");
    }

    function test_purchaseFraction_usesFallbackToGardenWhenNoTreasury() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        // Remove treasury
        vm.prank(owner);
        harness.setGardenTreasury(garden, address(0));

        harness.exposed_purchaseFraction(garden, address(weth), 42, amount);

        (,,, address recipient) = marketplace.purchases(0);
        assertEq(recipient, garden, "Should use garden as fallback recipient");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _purchaseFraction — Failure Path (Allowance Cleanup)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_purchaseFraction_clearsAllowanceOnFailure() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        // Make marketplace revert
        marketplace.setShouldRevert(true);

        harness.exposed_purchaseFraction(garden, address(weth), 42, amount);

        // Verify allowance was reset to 0 (no dangling allowance)
        uint256 allowance = weth.allowance(address(harness), address(marketplace));
        assertEq(allowance, 0, "Allowance should be cleared after failed purchase");

        // Funds should stay in harness
        assertEq(weth.balanceOf(address(harness)), amount, "Funds should remain in contract");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _recompound — Failure Path
    // ═══════════════════════════════════════════════════════════════════════════

    function test_recompound_fallsBackToTreasuryOnVaultFailure() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        // Use address(0) as vault to force failure
        address badVault = address(new MockOctantVaultForYield(address(0)));

        harness.exposed_recompound(garden, address(weth), amount, badVault);

        // Treasury should receive the funds
        assertEq(weth.balanceOf(treasury), amount, "Treasury should receive funds after recompound failure");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _routeToJuicebox — Failure Path
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToJuicebox_clearsAllowanceOnFailure() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        jbTerminal.setShouldRevert(true);

        harness.exposed_routeToJuicebox(garden, address(weth), amount);

        // Allowance should be cleared
        uint256 allowance = weth.allowance(address(harness), address(jbTerminal));
        assertEq(allowance, 0, "JB allowance should be cleared after failure");

        // Treasury should receive as fallback
        assertEq(weth.balanceOf(treasury), amount, "Treasury should receive funds after JB failure");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _routeToCookieJar — No Jar AND No Treasury
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToCookieJar_fundsStayInContractWhenNoJarAndNoTreasury() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        // Remove both jar and treasury
        vm.startPrank(owner);
        harness.setCookieJar(garden, address(0));
        harness.setGardenTreasury(garden, address(0));
        vm.stopPrank();

        harness.exposed_routeToCookieJar(garden, address(weth), amount);

        // Funds should remain in harness
        assertEq(weth.balanceOf(address(harness)), amount, "Funds should stay in contract");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _purchaseFraction — Event Emission
    // ═══════════════════════════════════════════════════════════════════════════

    function test_purchaseFraction_emitsFractionPurchased() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        vm.expectEmit(true, true, false, true);
        emit YieldSplitter.FractionPurchased(garden, 42, amount, 1, treasury);

        harness.exposed_purchaseFraction(garden, address(weth), 42, amount);
    }
}
