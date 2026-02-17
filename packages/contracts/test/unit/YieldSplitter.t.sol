// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { HypercertMarketplaceAdapter } from "../../src/markets/HypercertMarketplaceAdapter.sol";
import { OrderStructs } from "../../src/interfaces/IHypercertExchange.sol";
import { MockHypercertExchange } from "../../src/mocks/HypercertExchange.sol";
import {
    MockCookieJar,
    MockCVStrategy,
    MockHypercertMarketplace,
    MockJBMultiTerminalForYield,
    MockOctantVaultForYield
} from "../../src/mocks/YieldDeps.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

/// @title MockWETH for testing
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title YieldResolverTest
/// @notice Unit tests for YieldResolver contract
contract YieldResolverTest is Test {
    YieldResolver public yieldSplitter;
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

        // Deploy YieldResolver behind proxy
        YieldResolver impl = new YieldResolver();
        bytes memory initData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, owner, octantModule, address(hatsModule), MIN_YIELD_THRESHOLD
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        yieldSplitter = YieldResolver(address(proxy));

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
        YieldResolver impl = new YieldResolver();
        bytes memory initData =
            abi.encodeWithSelector(YieldResolver.initialize.selector, address(0), octantModule, address(hatsModule), 0);
        vm.expectRevert(YieldResolver.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Default Split Config
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getSplitConfig_returnsDefaultsWhenNotSet() public {
        YieldResolver.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 4865, "Default cookie jar BPS should be 4865");
        assertEq(config.fractionsBps, 4865, "Default fractions BPS should be 4865");
        assertEq(config.juiceboxBps, 270, "Default juicebox BPS should be 270");
        assertEq(config.cookieJarBps + config.fractionsBps + config.juiceboxBps, 10_000, "Should sum to 10000");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Set Split Ratio
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setSplitRatio_byOperator() public {
        vm.prank(operator);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 2000);

        YieldResolver.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 5000, "Cookie jar should be 50%");
        assertEq(config.fractionsBps, 3000, "Fractions should be 30%");
        assertEq(config.juiceboxBps, 2000, "Juicebox should be 20%");
    }

    function test_setSplitRatio_byOwner() public {
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 10_000, 0, 0);

        YieldResolver.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 10_000, "Cookie jar should be 100%");
    }

    function test_setSplitRatio_revertsIfNotSumTo10000() public {
        vm.prank(owner);
        vm.expectRevert(YieldResolver.InvalidSplitRatio.selector);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 1000);
    }

    function test_setSplitRatio_revertsForUnauthorized() public {
        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSelector(YieldResolver.UnauthorizedCaller.selector, address(0x999)));
        yieldSplitter.setSplitRatio(garden, 4865, 4865, 270);
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

        // Should have split — pendingYield should be 0, fractions escrowed separately
        assertEq(yieldSplitter.getPendingYield(garden, address(weth)), 0, "Pending should be 0 after split");
        uint256 expectedFractionsEscrowed = (amount * 4865) / 10_000;
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            expectedFractionsEscrowed,
            "Escrowed fractions should contain fractions portion"
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

        // Should merge and split — pendingYield cleared, fractions escrowed separately
        uint256 totalYield = first + second; // 9e18
        uint256 expectedFractionsEscrowed = (totalYield * 4865) / 10_000;
        assertEq(yieldSplitter.getPendingYield(garden, address(weth)), 0, "Pending should be 0 after merge+split");
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            expectedFractionsEscrowed,
            "Escrowed fractions should contain fractions portion after merge+split"
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

        // Default: ~48.65/48.65/2.7
        // cookieJar: 10000 * 4865 / 10000 = 4865
        // fractions: 10000 * 4865 / 10000 = 4865
        // juicebox: 10000 - 4865 - 4865 = 270

        // Cookie jar should have received ~48.65%
        assertEq(weth.balanceOf(address(cookieJar)), 4865, "Cookie jar should receive ~48.65%");
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

        // Fractions should escrow separately (not recompound into vault)
        // This prevents geometric decay across split cycles
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            amount,
            "Fractions portion should be escrowed in escrowedFractions"
        );
        assertEq(vault.balanceOf(address(yieldSplitter)), 0, "Should NOT have recompounded shares");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_revertsWithZeroGarden() public {
        vm.expectRevert(YieldResolver.ZeroAddress.selector);
        yieldSplitter.splitYield(address(0), address(weth), address(vault));
    }

    function test_splitYield_revertsWithNoShares() public {
        vm.expectRevert(abi.encodeWithSelector(YieldResolver.NoVaultShares.selector, garden, address(weth)));
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
        assertEq(yieldSplitter.DEFAULT_COOKIE_JAR_BPS(), 4865, "Default cookie jar BPS should be 4865");
        assertEq(yieldSplitter.DEFAULT_FRACTIONS_BPS(), 4865, "Default fractions BPS should be 4865");
        assertEq(yieldSplitter.DEFAULT_JUICEBOX_BPS(), 270, "Default juicebox BPS should be 270");
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
        assertEq(weth.balanceOf(address(yieldSplitter)), 0, "YieldResolver should have 0 balance");
    }

    function test_rescueTokens_emitsEvent() public {
        uint256 amount = 1000;
        weth.mint(address(yieldSplitter), amount);

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.TokensRescued(address(weth), address(0x400), amount);

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
        vm.expectRevert(YieldResolver.ZeroAddress.selector);
        yieldSplitter.rescueTokens(address(0), address(0x400), 1000);
    }

    function test_rescueTokens_revertsWithZeroRecipient() public {
        vm.prank(owner);
        vm.expectRevert(YieldResolver.ZeroAddress.selector);
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
        emit YieldResolver.SplitRatioUpdated(garden, 5000, 3000, 2000);

        vm.prank(operator);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 2000);
    }

    function test_setMinYieldThreshold_emitsMinYieldThresholdUpdated() public {
        vm.expectEmit(false, false, false, true);
        emit YieldResolver.MinYieldThresholdUpdated(MIN_YIELD_THRESHOLD, 100e18);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(100e18);
    }

    function test_splitYield_emitsYieldSplitOnSuccess() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        // Default split: 4865/4865/270 on 10000
        // cookieJar = 10000 * 4865 / 10000 = 4865
        // fractions = 10000 * 4865 / 10000 = 4865
        // juicebox  = 10000 - 4865 - 4865  = 270
        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldSplit(garden, address(weth), 4865, 4865, 270, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    function test_splitYield_emitsYieldAccumulatedBelowThreshold() public {
        uint256 smallAmount = 5e18; // $5 < $7 threshold
        _fundVaultAndMintShares(smallAmount);

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldAccumulated(garden, address(weth), smallAmount, smallAmount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Invalid Vault
    // ═══════════════════════════════════════════════════════════════════════════

    function test_splitYield_revertsWithInvalidVault() public {
        address wrongVault = address(0x999);

        vm.expectRevert(
            abi.encodeWithSelector(YieldResolver.InvalidVault.selector, garden, address(weth), address(vault), wrongVault)
        );
        yieldSplitter.splitYield(garden, address(weth), wrongVault);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Set Garden Vault
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardenVault_onlyOwnerOrOctantModule() public {
        // Unauthorized caller should be rejected
        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSelector(YieldResolver.UnauthorizedCaller.selector, address(0x999)));
        yieldSplitter.setGardenVault(garden, address(weth), address(0x42));

        // OctantModule should be allowed
        vm.prank(octantModule);
        yieldSplitter.setGardenVault(garden, address(weth), address(0x42));
        assertEq(yieldSplitter.gardenVaults(garden, address(weth)), address(0x42));
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
        uint256 expectedCookieJarA = (amountA * 4865) / 10_000;
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJarA, "Garden A cookie jar should receive yield");

        // Garden B: cookie jar should be untouched
        assertEq(weth.balanceOf(address(cookieJarB)), 0, "Garden B cookie jar should NOT receive yield from A");

        // Garden B: vault shares should be untouched (per-garden tracking, not vault.balanceOf)
        assertEq(yieldSplitter.gardenShares(gardenB, address(vaultB)), amountB, "Garden B vault shares should be intact");

        // Now split garden B
        yieldSplitter.splitYield(gardenB, address(weth), address(vaultB));

        // Garden B: cookie jar should now have received its share
        uint256 expectedCookieJarB = (amountB * 4865) / 10_000;
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
        uint256 expectedFractionsEscrowB = (largeB * 4865) / 10_000;
        assertEq(
            yieldSplitter.getEscrowedFractions(gardenB, address(weth)),
            expectedFractionsEscrowB,
            "Garden B escrowed fractions should contain fractions portion"
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
            abi.encodeWithSelector(YieldResolver.InvalidVault.selector, garden, address(weth), newVault, address(vault))
        );
        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BPS Rounding — Dust & Edge Cases
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Test BPS split with 1 wei yield
    /// With default split (4865/4865/270) and totalYield=1:
    ///   cookieJar = 1 * 4865 / 10000 = 0
    ///   fractions = 1 * 4865 / 10000 = 0
    ///   juicebox  = 1 - 0 - 0 = 1
    /// All dust goes to juicebox (remainder recipient)
    function test_splitYield_dustAmount_1wei() public {
        uint256 amount = 1;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        // Expected: cookieJar=0, fractions=0, juicebox=1 (remainder)
        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldSplit(garden, address(weth), 0, 0, 1, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar gets nothing (rounding down to 0)
        assertEq(weth.balanceOf(address(cookieJar)), 0, "Cookie jar should get 0 for 1 wei");

        // JB terminal receives the remainder (1 wei)
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive 1 payment");
        (,, uint256 payAmount,) = jbTerminal.payCalls(0);
        assertEq(payAmount, 1, "JB should receive 1 wei remainder");
    }

    /// @notice Test BPS split with 3 wei yield
    /// With default split (4865/4865/270) and totalYield=3:
    ///   cookieJar = 3 * 4865 / 10000 = 1 (14595 / 10000 = 1)
    ///   fractions = 3 * 4865 / 10000 = 1 (14595 / 10000 = 1)
    ///   juicebox  = 3 - 1 - 1 = 1
    function test_splitYield_dustAmount_3wei() public {
        uint256 amount = 3;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        uint256 expectedCookieJar = (amount * 4865) / 10_000; // = 1
        uint256 expectedFractions = (amount * 4865) / 10_000; // = 1
        uint256 expectedJuicebox = amount - expectedCookieJar - expectedFractions; // = 2

        // Verify the three amounts sum to totalYield
        assertEq(expectedCookieJar + expectedFractions + expectedJuicebox, amount, "Split must sum to totalYield");

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldSplit(garden, address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar gets 1 wei
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie jar should get 1 wei for 3 wei total");
    }

    /// @notice Test BPS split with 9999 wei yield (just below BPS denominator)
    /// Verify no rounding errors accumulate:
    ///   cookieJar = 9999 * 4865 / 10000 = 48645135 / 10000 = 4864
    ///   fractions = 9999 * 4865 / 10000 = 48645135 / 10000 = 4864
    ///   juicebox  = 9999 - 4864 - 4864 = 271
    function test_splitYield_dustAmount_9999wei() public {
        uint256 amount = 9999;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        uint256 expectedCookieJar = (amount * 4865) / 10_000;
        uint256 expectedFractions = (amount * 4865) / 10_000;
        uint256 expectedJuicebox = amount - expectedCookieJar - expectedFractions;

        // Key assertion: no wei lost or created
        assertEq(expectedCookieJar + expectedFractions + expectedJuicebox, amount, "Split must sum to totalYield (9999)");

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldSplit(garden, address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Cookie jar balance verification
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie jar should match expected for 9999 wei");
    }

    /// @notice Test BPS split with 10000 wei (exact BPS denominator)
    /// Clean division: 10000 * 4865 / 10000 = 4865
    ///                 10000 * 4865 / 10000 = 4865
    ///                 10000 - 4865 - 4865  = 270
    /// Total: 4865 + 4865 + 270 = 10000
    function test_splitYield_exactBpsDenominator() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        // Exact division case
        uint256 expectedCookieJar = 4865;
        uint256 expectedFractions = 4865;
        uint256 expectedJuicebox = 270;

        // Verify exact sum
        assertEq(expectedCookieJar + expectedFractions + expectedJuicebox, amount, "Exact BPS split must sum to 10000");

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldSplit(garden, address(weth), expectedCookieJar, expectedFractions, expectedJuicebox, amount);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Verify cookie jar received exact 4865
        assertEq(weth.balanceOf(address(cookieJar)), 4865, "Cookie jar should receive exactly 4865");

        // Verify JB terminal received exact 270
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive one payment");
        (,, uint256 payAmount,) = jbTerminal.payCalls(0);
        assertEq(payAmount, 270, "JB should receive exactly 270");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Non-1:1 Share Pricing (CRIT-5→M coverage)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify splitYield correctly uses redeemed asset value (not share count) when price > 1:1
    /// @dev Simulates 10% yield accrual: 100 shares → 110 assets. The split must operate on
    ///      the 110 assets returned by redeem(), NOT the 100 shares burned.
    function test_splitYield_nonOneToOneSharePrice_aboveOne() public {
        uint256 shares = 100e18;

        // Set exchange rate to 110% (10% yield accrual)
        vault.setExchangeRate(110, 100);

        // Fund vault with enough WETH for the higher redemption value
        uint256 expectedAssets = (shares * 110) / 100; // 110e18
        weth.mint(address(vault), expectedAssets);
        vault.mintShares(address(yieldSplitter), shares);

        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), shares);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Verify amounts based on 110e18 assets (not 100e18 shares)
        uint256 expectedCookieJar = (expectedAssets * 4865) / 10_000;
        assertEq(
            weth.balanceOf(address(cookieJar)),
            expectedCookieJar,
            "Cookie jar should receive ~48.65% of redeemed ASSETS (110e18), not shares (100e18)"
        );

        // Verify shares are fully consumed
        assertEq(yieldSplitter.gardenShares(garden, address(vault)), 0, "All shares should be consumed");

        // Verify total distributed equals total redeemed assets
        uint256 escrowedFractions = yieldSplitter.getEscrowedFractions(garden, address(weth));
        uint256 jbAmount = 0;
        if (jbTerminal.getPayCallCount() > 0) {
            (,, jbAmount,) = jbTerminal.payCalls(0);
        }
        assertEq(
            weth.balanceOf(address(cookieJar)) + escrowedFractions + jbAmount,
            expectedAssets,
            "Total distributed must equal redeemed assets (110e18)"
        );
    }

    /// @notice Verify splitYield with share price slightly below 1:1 (within maxLoss=1bps)
    /// @dev 10000 shares at 99.99% rate → 9999 assets. Within 1bps tolerance.
    function test_splitYield_nonOneToOneSharePrice_slightlyBelowOne() public {
        uint256 shares = 10_000;

        // Set exchange rate to 99.99% (0.01% loss — within 1bps maxLoss)
        vault.setExchangeRate(9999, 10_000);

        uint256 expectedAssets = (shares * 9999) / 10_000; // 9999
        weth.mint(address(vault), expectedAssets);
        vault.mintShares(address(yieldSplitter), shares);

        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), shares);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Should successfully redeem at discounted rate
        uint256 expectedCookieJar = (expectedAssets * 4865) / 10_000;
        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Should split based on discounted redemption value");
    }

    /// @notice Verify rounding dust from non-1:1 redemption is absorbed by remainder calculation
    /// @dev 100 shares at 103/100 rate = 103 assets. BPS split produces rounding dust
    ///      that the juicebox remainder calculation absorbs (no lost wei).
    function test_splitYield_roundingDustAbsorbedByRemainder() public {
        uint256 shares = 100;

        // Rate 103/100: 100 shares → 103 assets
        vault.setExchangeRate(103, 100);

        uint256 expectedAssets = (shares * 103) / 100; // 103
        weth.mint(address(vault), expectedAssets);
        vault.mintShares(address(yieldSplitter), shares);

        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), shares);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Verify total distributed equals total redeemed (zero wei loss)
        uint256 cookieJarBal = weth.balanceOf(address(cookieJar));
        uint256 escrowedFractions = yieldSplitter.getEscrowedFractions(garden, address(weth));
        uint256 jbAmount = 0;
        if (jbTerminal.getPayCallCount() > 0) {
            (,, jbAmount,) = jbTerminal.payCalls(0);
        }

        assertEq(
            cookieJarBal + escrowedFractions + jbAmount,
            expectedAssets,
            "Total distributed must equal total redeemed (zero wei loss)"
        );
    }

    /// @notice Verify splitYield redeems only currently-withdrawable shares when vault liquidity is capped
    function test_splitYield_respectsMaxWithdraw_partialRedemption() public {
        uint256 shares = 100e18;
        uint256 maxWithdrawAssets = 40e18;

        weth.mint(address(vault), shares);
        vault.mintShares(address(yieldSplitter), shares);

        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), shares);

        vault.setMaxWithdrawOverride(maxWithdrawAssets);

        vm.prank(owner);
        yieldSplitter.setMinYieldThreshold(0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(
            yieldSplitter.gardenShares(garden, address(vault)),
            shares - maxWithdrawAssets,
            "Unredeemable shares should remain registered"
        );
        assertEq(
            yieldSplitter.totalRegisteredShares(address(vault)),
            shares - maxWithdrawAssets,
            "Aggregate registered shares should decrement by redeemed amount"
        );

        uint256 expectedCookieJar = (maxWithdrawAssets * 4865) / 10_000;
        uint256 expectedFractions = (maxWithdrawAssets * 4865) / 10_000;
        uint256 expectedJuicebox = maxWithdrawAssets - expectedCookieJar - expectedFractions;

        assertEq(weth.balanceOf(address(cookieJar)), expectedCookieJar, "Cookie Jar should only receive split of redeemed assets");
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            expectedFractions,
            "Fractions escrow should only receive split of redeemed assets"
        );

        (,, uint256 payAmount,) = jbTerminal.payCalls(0);
        assertEq(payAmount, expectedJuicebox, "Juicebox should receive remainder of redeemed assets");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Cross-Garden Share Validation (Aggregate Tracking)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerShares_crossGardenValidation() public {
        // Two gardens sharing the same vault
        address gardenB = address(0x101);

        vm.startPrank(owner);
        yieldSplitter.setGardenVault(gardenB, address(weth), address(vault));
        yieldSplitter.setCookieJar(gardenB, address(new MockCookieJar()));
        yieldSplitter.setGardenTreasury(gardenB, address(0x201));
        vm.stopPrank();

        // Mint 100 vault shares to the splitter
        uint256 totalShares = 100;
        weth.mint(address(vault), totalShares);
        vault.mintShares(address(yieldSplitter), totalShares);

        // Garden A registers 60 shares
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), 60);

        // Garden B registers 40 shares (total = 100, which equals balance)
        vm.prank(octantModule);
        yieldSplitter.registerShares(gardenB, address(vault), 40);

        // Verify both registered
        assertEq(yieldSplitter.gardenShares(garden, address(vault)), 60, "Garden A should have 60 shares");
        assertEq(yieldSplitter.gardenShares(gardenB, address(vault)), 40, "Garden B should have 40 shares");
        assertEq(yieldSplitter.totalRegisteredShares(address(vault)), 100, "Aggregate should be 100");
    }

    function test_registerShares_aggregateExceedsBalance() public {
        // Two gardens sharing the same vault
        address gardenB = address(0x101);

        vm.startPrank(owner);
        yieldSplitter.setGardenVault(gardenB, address(weth), address(vault));
        vm.stopPrank();

        // Mint 100 vault shares to the splitter
        uint256 totalShares = 100;
        weth.mint(address(vault), totalShares);
        vault.mintShares(address(yieldSplitter), totalShares);

        // Garden A registers 60 shares
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), 60);

        // Garden B tries to register 50 shares (total 110 > 100 balance) — should revert
        vm.prank(octantModule);
        vm.expectRevert(abi.encodeWithSelector(YieldResolver.NoVaultShares.selector, gardenB, address(vault)));
        yieldSplitter.registerShares(gardenB, address(vault), 50);
    }
}

/// @title YieldResolverHarness
/// @notice Test harness exposing internal functions for unit testing
contract YieldResolverHarness is YieldResolver {
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

    function exposed_routeToCookieJar(address garden, address asset, uint256 amount) external {
        _routeToCookieJar(garden, asset, amount);
    }

    function exposed_routeToJuicebox(address garden, address asset, uint256 amount) external {
        _routeToJuicebox(garden, asset, amount);
    }
}

/// @title YieldResolverFailureTest
/// @notice Tests for failure paths, allowance cleanup, and marketplace purchase
contract YieldResolverFailureTest is Test {
    YieldResolverHarness public harness;
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
        YieldResolverHarness impl = new YieldResolverHarness();
        bytes memory initData =
            abi.encodeWithSelector(YieldResolver.initialize.selector, owner, octantModule, address(hatsModule), 0);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        harness = YieldResolverHarness(address(proxy));

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
    // FAULT INJECTION: buyFraction Failure → Escrow + Allowance Cleanup (Yield.sol:683-692)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice FAULT INJECTION: buyFraction reverts → funds escrowed, allowance reset to 0
    /// @dev Tests the catch block at Yield.sol:686-692. When the marketplace rejects
    ///      the purchase, the allowance must be reset (prevent dangling approval) and
    ///      the amount escrowed into escrowedFractions (not lost, not sent elsewhere).
    function test_purchaseFraction_failure_escrowed_allowanceZeroed() public {
        uint256 amount = 5000;
        _fundHarness(amount);

        // Configure marketplace to revert
        marketplace.setShouldRevert(true);

        harness.exposed_purchaseFraction(garden, address(weth), 42, amount);

        // Allowance must be cleared (Yield.sol:688)
        uint256 allowance = weth.allowance(address(harness), address(marketplace));
        assertEq(allowance, 0, "Allowance should be reset to 0 after buyFraction failure");

        // Funds must be escrowed (Yield.sol:690)
        uint256 escrowed = harness.getEscrowedFractions(garden, address(weth));
        assertEq(escrowed, amount, "Failed purchase amount should be escrowed in escrowedFractions");

        // Funds should still be in the contract (not lost)
        assertEq(weth.balanceOf(address(harness)), amount, "WETH should remain in contract");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FAULT INJECTION: JB Pay Failure → Treasury Fallback (Yield.sol:715-735)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice FAULT INJECTION: JB pay reverts, treasury receives fallback transfer
    /// @dev Tests the catch block at Yield.sol:725-735. When Juicebox payment fails,
    ///      the allowance is reset AND the amount falls back to gardenTreasuries[garden].
    function test_routeToJuicebox_failure_fallbackToTreasury() public {
        uint256 amount = 3000;
        _fundHarness(amount);

        jbTerminal.setShouldRevert(true);

        harness.exposed_routeToJuicebox(garden, address(weth), amount);

        // Allowance must be cleared (Yield.sol:727)
        uint256 allowance = weth.allowance(address(harness), address(jbTerminal));
        assertEq(allowance, 0, "JB allowance should be reset to 0 after pay() failure");

        // Treasury receives the fallback (Yield.sol:731)
        assertEq(weth.balanceOf(treasury), amount, "Treasury should receive funds as JB fallback");

        // Contract should have no remaining balance
        assertEq(weth.balanceOf(address(harness)), 0, "Contract should have 0 balance after treasury fallback");
    }

    /// @notice FAULT INJECTION: JB pay reverts AND no treasury → YieldStranded event
    /// @dev Tests the deepest fallback at Yield.sol:733. When both Juicebox and treasury
    ///      are unavailable, tokens remain stranded in the contract and YieldStranded is emitted.
    function test_routeToJuicebox_failure_noTreasury_emitsYieldStranded() public {
        uint256 amount = 2000;
        _fundHarness(amount);

        jbTerminal.setShouldRevert(true);

        // Remove treasury — forces the stranded path
        vm.prank(owner);
        harness.setGardenTreasury(garden, address(0));

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.YieldStranded(garden, address(weth), amount, "juicebox");

        harness.exposed_routeToJuicebox(garden, address(weth), amount);

        // Funds stranded in contract (Yield.sol:733 — no transfer, only event)
        assertEq(weth.balanceOf(address(harness)), amount, "Funds should remain stranded in contract");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // _purchaseFraction — Event Emission
    // ═══════════════════════════════════════════════════════════════════════════

    function test_purchaseFraction_emitsFractionPurchased() public {
        uint256 amount = 1000;
        _fundHarness(amount);

        vm.expectEmit(true, true, false, true);
        emit YieldResolver.FractionPurchased(garden, 42, amount, 1, treasury);

        harness.exposed_purchaseFraction(garden, address(weth), 42, amount);
    }
}

/// @title YieldResolverConvictionTest
/// @notice Tests for conviction-weighted fraction purchasing via CVStrategy
contract YieldResolverConvictionTest is Test {
    YieldResolver public yieldSplitter;
    MockWETH public weth;
    MockOctantVaultForYield public vault;
    MockCookieJar public cookieJar;
    MockHypercertMarketplace public marketplace;
    MockJBMultiTerminalForYield public jbTerminal;
    MockHatsModule public hatsModule;
    MockCVStrategy public cvStrategy;

    address public owner = address(0x1);
    address public octantModule = address(0x2);
    address public garden = address(0x100);
    address public treasury = address(0x200);

    function setUp() public {
        // Deploy mocks
        weth = new MockWETH();
        vault = new MockOctantVaultForYield(address(weth));
        cookieJar = new MockCookieJar();
        marketplace = new MockHypercertMarketplace();
        jbTerminal = new MockJBMultiTerminalForYield();
        hatsModule = new MockHatsModule();
        cvStrategy = new MockCVStrategy();

        // Deploy YieldResolver behind proxy
        YieldResolver impl = new YieldResolver();
        bytes memory initData = abi.encodeWithSelector(
            YieldResolver.initialize.selector,
            owner,
            octantModule,
            address(hatsModule),
            0 // zero threshold for easier testing
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        yieldSplitter = YieldResolver(address(proxy));

        // Configure the yield splitter
        vm.startPrank(owner);
        yieldSplitter.setCookieJar(garden, address(cookieJar));
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.setGardenVault(garden, address(weth), address(vault));
        yieldSplitter.setHypercertMarketplace(address(marketplace));
        yieldSplitter.setJBMultiTerminal(address(jbTerminal));
        yieldSplitter.setJuiceboxProjectId(1);
        // Set 100% to fractions for cleaner conviction testing
        yieldSplitter.setSplitRatio(garden, 0, 10_000, 0);
        // Wire the CVStrategy pool
        yieldSplitter.setGardenHypercertPool(garden, address(cvStrategy));
        // Allow small test amounts (default 1e15 is too high for unit test values)
        yieldSplitter.setMinAllocationAmount(0);
        vm.stopPrank();
    }

    /// @notice Helper: Fund vault and mint shares to the yield splitter
    function _fundVaultAndMintShares(uint256 amount) internal {
        weth.mint(address(vault), amount);
        vault.mintShares(address(yieldSplitter), amount);
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — Proportional Distribution
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_withConviction_distributesProportionally() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Add 3 proposals with different conviction weights: 50%, 30%, 20%
        cvStrategy.addProposal(100, 5000); // proposal 1: conviction = 5000
        cvStrategy.addProposal(60, 3000); // proposal 2: conviction = 3000
        cvStrategy.addProposal(40, 2000); // proposal 3: conviction = 2000

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Marketplace should have received 3 purchases
        assertEq(marketplace.getPurchaseCount(), 3, "Should have 3 fraction purchases");

        // Verify proportional amounts: total conviction = 10000
        // Proposal 1: 5000/10000 * 10000 = 5000
        // Proposal 2: 3000/10000 * 10000 = 3000
        // Proposal 3: 2000/10000 * 10000 = 2000
        (, uint256 amount1,,) = marketplace.purchases(0);
        (, uint256 amount2,,) = marketplace.purchases(1);
        (, uint256 amount3,,) = marketplace.purchases(2);
        assertEq(amount1, 5000, "Proposal 1 should get 50%");
        assertEq(amount2, 3000, "Proposal 2 should get 30%");
        assertEq(amount3, 2000, "Proposal 3 should get 20%");

        // Verify hypercert IDs match proposal IDs (1-indexed)
        (uint256 hcId1,,,) = marketplace.purchases(0);
        (uint256 hcId2,,,) = marketplace.purchases(1);
        (uint256 hcId3,,,) = marketplace.purchases(2);
        assertEq(hcId1, 1, "First purchase should be proposal 1");
        assertEq(hcId2, 2, "Second purchase should be proposal 2");
        assertEq(hcId3, 3, "Third purchase should be proposal 3");

        // No dust escrowed (clean division)
        assertEq(yieldSplitter.getEscrowedFractions(garden, address(weth)), 0, "No dust should be escrowed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — Escrow Fallbacks
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_noPool_escrows() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Remove pool
        vm.prank(owner);
        yieldSplitter.setGardenHypercertPool(garden, address(0));

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Should escrow entire amount
        assertEq(yieldSplitter.getEscrowedFractions(garden, address(weth)), amount, "Should escrow when no pool configured");
        assertEq(marketplace.getPurchaseCount(), 0, "No purchases should be made");
    }

    function test_routeToFractions_noMarketplace_escrows() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Remove marketplace
        vm.prank(owner);
        yieldSplitter.setHypercertMarketplace(address(0));

        cvStrategy.addProposal(100, 5000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(yieldSplitter.getEscrowedFractions(garden, address(weth)), amount, "Should escrow when no marketplace");
    }

    function test_routeToFractions_noProposals_escrows() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Pool has 0 proposals (proposalCounter == 0)

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(yieldSplitter.getEscrowedFractions(garden, address(weth)), amount, "Should escrow when no proposals");
    }

    function test_routeToFractions_zeroConviction_escrows() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Add proposals with zero conviction
        cvStrategy.addProposal(100, 0);
        cvStrategy.addProposal(200, 0);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)), amount, "Should escrow when all conviction is 0"
        );
        assertEq(marketplace.getPurchaseCount(), 0, "No purchases when zero conviction");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — Inactive Proposals
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_inactiveProposals_skipped() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        // Add 3 proposals, but make proposal 2 Cancelled (status=3)
        cvStrategy.addProposal(100, 5000);
        cvStrategy.addProposal(60, 3000);
        cvStrategy.addProposal(40, 2000);
        cvStrategy.setProposalStatus(2, 3); // Cancelled

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Only proposals 1 and 3 should receive allocations
        // Total conviction = 5000 + 2000 = 7000
        // Proposal 1: 5000/7000 * 10000 = 7142
        // Proposal 3: 2000/7000 * 10000 = 2857
        // Dust: 10000 - 7142 - 2857 = 1
        assertEq(marketplace.getPurchaseCount(), 2, "Only 2 active proposals should get purchases");

        (, uint256 amount1,,) = marketplace.purchases(0);
        (, uint256 amount3,,) = marketplace.purchases(1);
        assertEq(amount1, 7142, "Proposal 1 should get 5000/7000 of 10000");
        assertEq(amount3, 2857, "Proposal 3 should get 2000/7000 of 10000");

        // Verify 1 wei of rounding dust is escrowed
        uint256 expectedDust = amount - amount1 - amount3;
        assertEq(expectedDust, 1, "Rounding dust should be 1 wei");
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)), expectedDust, "Rounding dust should be escrowed"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — Pool Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_poolReverts_escrows() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        cvStrategy.addProposal(100, 5000);
        cvStrategy.setShouldRevert(true);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(yieldSplitter.getEscrowedFractions(garden, address(weth)), amount, "Should escrow when pool reverts");
        assertEq(marketplace.getPurchaseCount(), 0, "No purchases when pool reverts");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — Purchase Fails (Existing _purchaseFraction Behavior)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_purchaseFails_escrowed() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        cvStrategy.addProposal(100, 10_000); // Single proposal gets 100%
        marketplace.setShouldRevert(true); // Marketplace will reject purchases

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // _purchaseFraction catch block escrows on failure
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            amount,
            "Failed purchases should be escrowed by _purchaseFraction"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setGardenHypercertPool — Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardenHypercertPool_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        yieldSplitter.setGardenHypercertPool(garden, address(0x42));
    }

    function test_setGardenHypercertPool_setsPool() public {
        address newPool = address(0x42);
        vm.prank(owner);
        yieldSplitter.setGardenHypercertPool(garden, newPool);
        assertEq(yieldSplitter.gardenHypercertPools(garden), newPool, "Pool should be set");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — Rounding Dust
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_roundingDust_escrowed() public {
        uint256 amount = 10;
        _fundVaultAndMintShares(amount);

        // 3 proposals with equal conviction: 10 / 3 = 3 each, 1 dust
        cvStrategy.addProposal(100, 1000);
        cvStrategy.addProposal(100, 1000);
        cvStrategy.addProposal(100, 1000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        assertEq(marketplace.getPurchaseCount(), 3, "All 3 proposals should get purchases");

        (, uint256 a1,,) = marketplace.purchases(0);
        (, uint256 a2,,) = marketplace.purchases(1);
        (, uint256 a3,,) = marketplace.purchases(2);
        assertEq(a1, 3, "Each proposal gets 3");
        assertEq(a2, 3, "Each proposal gets 3");
        assertEq(a3, 3, "Each proposal gets 3");

        // 1 wei dust should be escrowed
        assertEq(yieldSplitter.getEscrowedFractions(garden, address(weth)), 1, "1 wei rounding dust should be escrowed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Routing — ConvictionRouted Event
    // ═══════════════════════════════════════════════════════════════════════════

    function test_routeToFractions_emitsConvictionRouted() public {
        uint256 amount = 10_000;
        _fundVaultAndMintShares(amount);

        cvStrategy.addProposal(100, 5000);
        cvStrategy.addProposal(60, 3000);

        // Expect ConvictionRouted event: 2 active proposals, total conviction = 8000
        vm.expectEmit(true, true, false, true);
        emit YieldResolver.ConvictionRouted(garden, address(weth), 2, 8000);

        yieldSplitter.splitYield(garden, address(weth), address(vault));
    }
}

/// @title YieldResolverWithExchangeTest
/// @notice Integration test: YieldResolver → HypercertMarketplaceAdapter → MockHypercertExchange
/// @dev Verifies the full yield split flow through the real adapter to a mock exchange,
///      ensuring executeTakerBid is called with correct taker parameters.
contract YieldResolverWithExchangeTest is Test {
    YieldResolver public yieldSplitter;
    HypercertMarketplaceAdapter public adapter;
    MockHypercertExchange public mockExchange;
    MockWETH public weth;
    MockOctantVaultForYield public vault;
    MockCookieJar public cookieJar;
    MockJBMultiTerminalForYield public jbTerminal;
    MockHatsModule public hatsModule;
    MockCVStrategy public cvStrategy;

    address public owner = address(0x1);
    address public octantModule = address(0x2);
    address public garden = address(0x100);
    address public treasury = address(0x200);
    address public seller = address(0x300);
    address public mockMinter = address(0x400);

    uint256 public constant PRICE_PER_UNIT = 1e13; // ~$0.00001

    function setUp() public {
        // Deploy mocks
        weth = new MockWETH();
        vault = new MockOctantVaultForYield(address(weth));
        cookieJar = new MockCookieJar();
        jbTerminal = new MockJBMultiTerminalForYield();
        hatsModule = new MockHatsModule();
        cvStrategy = new MockCVStrategy();
        mockExchange = new MockHypercertExchange();

        // Deploy real adapter behind proxy
        HypercertMarketplaceAdapter adapterImpl = new HypercertMarketplaceAdapter();
        bytes memory adapterInitData = abi.encodeWithSelector(
            HypercertMarketplaceAdapter.initialize.selector, owner, address(mockExchange), mockMinter
        );
        ERC1967Proxy adapterProxy = new ERC1967Proxy(address(adapterImpl), adapterInitData);
        adapter = HypercertMarketplaceAdapter(address(adapterProxy));

        // Deploy YieldResolver behind proxy
        YieldResolver impl = new YieldResolver();
        bytes memory initData =
            abi.encodeWithSelector(YieldResolver.initialize.selector, owner, octantModule, address(hatsModule), 0);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        yieldSplitter = YieldResolver(address(proxy));

        // Configure yield splitter to use real adapter
        vm.startPrank(owner);
        yieldSplitter.setCookieJar(garden, address(cookieJar));
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.setGardenVault(garden, address(weth), address(vault));
        yieldSplitter.setHypercertMarketplace(address(adapter));
        yieldSplitter.setJBMultiTerminal(address(jbTerminal));
        yieldSplitter.setJuiceboxProjectId(1);
        yieldSplitter.setSplitRatio(garden, 0, 10_000, 0); // 100% to fractions
        yieldSplitter.setGardenHypercertPool(garden, address(cvStrategy));
        yieldSplitter.setMinAllocationAmount(0);
        vm.stopPrank();

        // Register a maker order in the adapter
        _registerTestOrder();
    }

    /// @notice Helper: Create and register a test maker ask order
    function _registerTestOrder() internal {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        OrderStructs.Maker memory makerAsk = OrderStructs.Maker({
            quoteType: OrderStructs.QuoteType.MakerAsk,
            globalNonce: 0,
            subsetNonce: 0,
            orderNonce: 0,
            strategyId: 0,
            collectionType: OrderStructs.CollectionType.Hypercert,
            collection: mockMinter,
            currency: address(weth),
            signer: seller,
            startTime: block.timestamp,
            endTime: block.timestamp + 90 days,
            price: PRICE_PER_UNIT,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: abi.encode(uint256(1), type(uint256).max, uint256(0), true)
        });

        bytes memory signature = "mock-signature";

        // hypercertId = 1 (matches the proposal ID we'll add to cvStrategy)
        adapter.registerOrder(makerAsk, signature, 1);
    }

    /// @notice Helper: Fund vault and mint shares to the yield splitter
    function _fundVaultAndMintShares(uint256 amount) internal {
        weth.mint(address(vault), amount);
        vault.mintShares(address(yieldSplitter), amount);
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Integration: Yield → Adapter → Exchange
    // ═══════════════════════════════════════════════════════════════════════════

    function test_endToEnd_yieldSplitViaExchange() public {
        uint256 yieldAmount = 1e18; // 1 WETH yield
        _fundVaultAndMintShares(yieldAmount);

        // Add a single proposal with conviction pointing to hypercertId=1
        cvStrategy.addProposal(100, 10_000);

        // Execute the full flow
        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Verify the exchange received the executeTakerBid call
        assertEq(mockExchange.getExecutionCount(), 1, "Exchange should have 1 execution");

        // Verify taker parameters
        (
            address recipient,
            uint256 unitAmount,
            uint256 pricePerUnit,
            address executionSeller,
            address currency,
            uint256 totalPayment
        ) = mockExchange.executions(0);

        assertEq(recipient, treasury, "Taker recipient should be garden treasury");
        assertEq(pricePerUnit, PRICE_PER_UNIT, "Price per unit should match order");
        assertEq(executionSeller, seller, "Seller should match order signer");
        assertEq(currency, address(weth), "Currency should be WETH");

        // Calculate expected units: 1e18 / 1e13 = 1e5 = 100,000 units
        uint256 expectedUnits = yieldAmount / PRICE_PER_UNIT;
        assertEq(unitAmount, expectedUnits, "Should purchase correct number of units");
        assertEq(totalPayment, expectedUnits * PRICE_PER_UNIT, "Payment should equal units * price");

        // Verify 0 escrowed fractions (successful purchase)
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            0,
            "No fractions should be escrowed after successful purchase"
        );

        // Verify seller received payment (mock exchange transfers to seller)
        assertEq(weth.balanceOf(seller), totalPayment, "Seller should receive payment");
    }

    function test_endToEnd_exchangeReverts_escrowed() public {
        uint256 yieldAmount = 1e18;
        _fundVaultAndMintShares(yieldAmount);

        cvStrategy.addProposal(100, 10_000);
        mockExchange.setShouldRevert(true);

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Exchange reverted → adapter reverted → _purchaseFraction catch block escrowed
        assertEq(mockExchange.getExecutionCount(), 0, "Exchange should have 0 executions");
        assertEq(
            yieldSplitter.getEscrowedFractions(garden, address(weth)),
            yieldAmount,
            "Full amount should be escrowed when exchange reverts"
        );
    }

    function test_endToEnd_multipleProposals_proportionalPurchases() public {
        // Register a second order for hypercertId=2
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 2;
        uint256[] memory amounts_arr = new uint256[](1);
        amounts_arr[0] = 1;

        OrderStructs.Maker memory makerAsk2 = OrderStructs.Maker({
            quoteType: OrderStructs.QuoteType.MakerAsk,
            globalNonce: 0,
            subsetNonce: 0,
            orderNonce: 1,
            strategyId: 0,
            collectionType: OrderStructs.CollectionType.Hypercert,
            collection: mockMinter,
            currency: address(weth),
            signer: seller,
            startTime: block.timestamp,
            endTime: block.timestamp + 90 days,
            price: PRICE_PER_UNIT,
            itemIds: itemIds,
            amounts: amounts_arr,
            additionalParameters: abi.encode(uint256(1), type(uint256).max, uint256(0), true)
        });
        adapter.registerOrder(makerAsk2, "mock-sig-2", 2);

        // Fund and set up 2 proposals: 60% and 40% conviction
        uint256 yieldAmount = 1e18;
        _fundVaultAndMintShares(yieldAmount);

        cvStrategy.addProposal(100, 6000); // proposal 1: 60%
        cvStrategy.addProposal(100, 4000); // proposal 2: 40%

        yieldSplitter.splitYield(garden, address(weth), address(vault));

        // Both proposals should trigger exchange executions
        assertEq(mockExchange.getExecutionCount(), 2, "Should have 2 exchange executions");

        // Verify proportional allocation
        (, uint256 units1,,,,) = mockExchange.executions(0);
        (, uint256 units2,,,,) = mockExchange.executions(1);

        uint256 totalUnits = yieldAmount / PRICE_PER_UNIT; // 100,000
        uint256 expectedUnits1 = (6000 * yieldAmount / 10_000) / PRICE_PER_UNIT; // 60% = 60,000
        uint256 expectedUnits2 = (4000 * yieldAmount / 10_000) / PRICE_PER_UNIT; // 40% = 40,000

        assertEq(units1, expectedUnits1, "Proposal 1 should get 60% of units");
        assertEq(units2, expectedUnits2, "Proposal 2 should get 40% of units");
        assertEq(units1 + units2, totalUnits, "Total units should sum to expected");
    }
}
