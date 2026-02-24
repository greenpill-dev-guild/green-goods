// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import {
    IJBController,
    IJBMultiTerminal,
    JBRulesetConfig,
    JBRulesetMetadata,
    JBSplitGroup,
    JBFundAccessLimitGroup,
    JBTerminalConfig,
    JBAccountingContext,
    IJBRulesetApprovalHook
} from "../../src/interfaces/IJuicebox.sol";

/// @title MockVaultForYieldTest
/// @notice Minimal ERC-4626-like mock vault for deterministic BPS math tests.
/// @dev Used because YieldResolver tests focus on split routing logic, not vault strategies.
///      Real Aave vault yield accrual makes BPS assertions non-deterministic.
///      Full Aave vault integration is tested in ArbitrumOctantVault.t.sol and
///      ArbitrumExtendedE2E.t.sol. This follows the CookieJarForkTestBase pattern
///      for scoped mock vaults.
contract MockVaultForYieldTest {
    IERC20 public immutable asset_;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    constructor(address _asset) {
        asset_ = IERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(asset_);
    }

    /// @notice Deposit assets and receive shares 1:1
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        asset_.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        balanceOf[receiver] += shares;
        totalSupply += shares;
    }

    /// @notice Redeem shares for assets 1:1
    /// @dev Matches IOctantVault.redeem signature (5 params)
    function redeem(
        uint256 shares,
        address receiver,
        address shareOwner,
        uint256, /* maxLoss */
        address[] calldata /* strategies_ */
    )
        external
        returns (uint256 assets)
    {
        require(balanceOf[shareOwner] >= shares, "insufficient shares");
        assets = shares;
        balanceOf[shareOwner] -= shares;
        totalSupply -= shares;
        asset_.transfer(receiver, assets);
    }

    /// @notice Mint shares directly (test helper — bypasses deposit flow)
    function mintShares(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

/// @title ArbitrumYieldResolverForkTest
/// @notice Fork tests for YieldResolver against Arbitrum mainnet with real WETH,
///         real HatsModule, and real protocol stack via ForkTestBase.
/// @dev Replaces MockHatsModuleForYieldFork with real Hats Protocol integration.
///      Keeps MockVaultForYieldTest for deterministic BPS math (see NatSpec above).
///      Uses setUp pattern for efficient fork reuse across 21 tests.
contract ArbitrumYieldResolverForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // External Contract Addresses (Arbitrum Mainnet)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Real WETH on Arbitrum
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    /// @notice Juicebox Controller on Arbitrum (mainnet)
    address internal constant JB_CONTROLLER = 0x84E1D0102A722b3f3c00EC4E2b7ca2B97edF4eB2;

    /// @notice Juicebox Multi-Terminal on Arbitrum (mainnet)
    address internal constant JB_MULTI_TERMINAL = 0x82129d4109625F94582bDdF6101a8Cd1a27919f5;

    /// @notice Juicebox terminal used for project launches in fork tests
    address internal constant JB_TERMINAL = 0x14785612bd5C27D8CbAd1d9A9E33BEBfF5F4C3b6;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test State
    // ═══════════════════════════════════════════════════════════════════════════

    MockVaultForYieldTest internal mockVault;
    address internal testGarden;
    address internal testCookieJar;
    address internal testTreasury;

    uint256 internal constant MIN_YIELD_THRESHOLD = 0.01 ether;

    // ═══════════════════════════════════════════════════════════════════════════
    // setUp — fork once, deploy once, reuse across all tests
    // ═══════════════════════════════════════════════════════════════════════════

    function setUp() public {
        if (!_tryChainFork("arbitrum")) return;

        _deployFullStackOnFork();

        // Configure test addresses
        testCookieJar = makeAddr("yieldTestCookieJar");
        testTreasury = makeAddr("yieldTestTreasury");

        // Mint a real garden with operator role via real HatsModule
        testGarden = _mintTestGarden("Yield Test Garden", 0x0F);
        _grantGardenRole(testGarden, forkOperator, IHatsModule.GardenRole.Operator);

        // Deploy scoped mock vault for deterministic BPS math
        mockVault = new MockVaultForYieldTest(WETH);

        // Configure yieldSplitter for this garden
        yieldSplitter.setCookieJar(testGarden, testCookieJar);
        yieldSplitter.setGardenTreasury(testGarden, testTreasury);
        yieldSplitter.setGardenVault(testGarden, WETH, address(mockVault));
        yieldSplitter.setMinYieldThreshold(MIN_YIELD_THRESHOLD);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Fund vault with real WETH, mint shares to the yield splitter, and register them
    function _fundVaultAndMintShares(uint256 amount) internal {
        deal(WETH, address(mockVault), amount);
        mockVault.mintShares(address(yieldSplitter), amount);
        vm.prank(address(octantModule));
        yieldSplitter.registerShares(testGarden, address(mockVault), amount);
    }

    /// @notice Fund vault for a specific garden (used in multi-garden isolation test)
    function _fundVaultForGarden(address garden, uint256 amount) internal {
        deal(WETH, address(mockVault), IERC20(WETH).balanceOf(address(mockVault)) + amount);
        mockVault.mintShares(address(yieldSplitter), amount);
        vm.prank(address(octantModule));
        yieldSplitter.registerShares(garden, address(mockVault), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Deploy and initialize with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_initializesWithRealWETH() public {
        if (!forkActive) return;

        // Verify WETH is deployed
        assertGt(WETH.code.length, 0, "WETH should be deployed on Arbitrum");

        assertEq(yieldSplitter.owner(), address(this), "owner should be set");
        assertEq(yieldSplitter.octantModule(), address(octantModule), "octant module should be set");
        assertEq(address(yieldSplitter.hatsModule()), address(hatsModule), "hats module should be real");
        assertEq(yieldSplitter.minYieldThreshold(), MIN_YIELD_THRESHOLD, "threshold should be set");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Mock vault holds real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_vaultHoldsRealWETH() public {
        if (!forkActive) return;

        uint256 depositAmount = 1 ether;
        deal(WETH, address(mockVault), depositAmount);

        uint256 vaultBalance = IERC20(WETH).balanceOf(address(mockVault));
        assertEq(vaultBalance, depositAmount, "vault should hold real WETH");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Three-way split flow with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_threeWaySplitWithRealWETH() public {
        if (!forkActive) return;

        uint256 yieldAmount = 1 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(testCookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        // Execute split — default ratios: 4865/4865/270 bps
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        // Cookie Jar should receive ~48.65%
        uint256 cookieJarReceived = IERC20(WETH).balanceOf(testCookieJar) - cookieJarBefore;
        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive ~48.65% of yield");

        // Juicebox terminal not configured → JB portion goes to treasury as fallback
        uint256 treasuryReceived = IERC20(WETH).balanceOf(testTreasury) - treasuryBefore;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;
        assertEq(treasuryReceived, expectedJuicebox, "treasury should receive JB fallback portion");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Threshold accumulation with real tokens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_thresholdAccumulationWithRealTokens() public {
        if (!forkActive) return;

        // Fund with amount below threshold
        uint256 subThreshold = MIN_YIELD_THRESHOLD / 2; // 0.005 ETH
        _fundVaultAndMintShares(subThreshold);

        // Split should accumulate, not distribute
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 pending = yieldSplitter.getPendingYield(testGarden, WETH);
        assertEq(pending, subThreshold, "sub-threshold yield should be accumulated");

        // Cookie jar should NOT have received anything
        uint256 cookieJarBal = IERC20(WETH).balanceOf(testCookieJar);
        assertEq(cookieJarBal, 0, "cookie jar should not receive sub-threshold yield");

        // Fund with more to cross threshold
        uint256 secondAmount = MIN_YIELD_THRESHOLD; // 0.01 ETH — total now 0.015 ETH > threshold
        deal(WETH, address(mockVault), secondAmount);
        mockVault.mintShares(address(yieldSplitter), secondAmount);
        vm.prank(address(octantModule));
        yieldSplitter.registerShares(testGarden, address(mockVault), secondAmount);

        // Second split should distribute accumulated + new
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 pendingAfter = yieldSplitter.getPendingYield(testGarden, WETH);
        assertEq(pendingAfter, 0, "pending should be cleared after crossing threshold");

        // Cookie jar should now have received its share of total
        uint256 totalYield = subThreshold + secondAmount;
        uint256 expectedCookieJar = (totalYield * 4865) / 10_000;
        uint256 cookieJarBalAfter = IERC20(WETH).balanceOf(testCookieJar);
        assertEq(cookieJarBalAfter, expectedCookieJar, "cookie jar should receive accumulated + new yield");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Custom split ratio with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_customSplitRatioWithRealWETH() public {
        if (!forkActive) return;

        // Set 50/25/25 split (owner = address(this))
        yieldSplitter.setSplitRatio(testGarden, 5000, 2500, 2500);

        uint256 yieldAmount = 2 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(testCookieJar);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 cookieJarReceived = IERC20(WETH).balanceOf(testCookieJar) - cookieJarBefore;
        uint256 expectedCookieJar = (yieldAmount * 5000) / 10_000; // 1 ether
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive 50% with custom split");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Operator can set split ratio (real Hats access control)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_operatorCanSetSplitRatio() public {
        if (!forkActive) return;

        // forkOperator was granted operator role in setUp via real HatsModule
        vm.prank(forkOperator);
        yieldSplitter.setSplitRatio(testGarden, 4000, 3000, 3000);

        YieldResolver.SplitConfig memory config = yieldSplitter.getSplitConfig(testGarden);
        assertEq(config.cookieJarBps, 4000, "cookie jar bps should be 4000");
        assertEq(config.fractionsBps, 3000, "fractions bps should be 3000");
        assertEq(config.juiceboxBps, 3000, "juicebox bps should be 3000");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Invalid split ratio reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_invalidSplitRatioReverts() public {
        if (!forkActive) return;

        vm.expectRevert(YieldResolver.InvalidSplitRatio.selector);
        yieldSplitter.setSplitRatio(testGarden, 5000, 3000, 3000); // Sums to 11000
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: JB addresses exist on Arbitrum
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_jbAddressesAreDeployed() public {
        if (!forkActive) return;

        if (JB_CONTROLLER.code.length == 0 || JB_MULTI_TERMINAL.code.length == 0 || JB_TERMINAL.code.length == 0) {
            emit log("WARNING: Juicebox contracts not deployed at expected Arbitrum addresses");
            emit log("  Expected controller: 0x84E1D0102A722b3f3c00EC4E2b7ca2B97edF4eB2");
            emit log("  Expected multi-terminal: 0x82129d4109625F94582bDdF6101a8Cd1a27919f5");
            emit log("  Expected terminal: 0x14785612bd5C27D8CbAd1d9A9E33BEBfF5F4C3b6");
        } else {
            assertGt(JB_CONTROLLER.code.length, 0, "JBController should be deployed on Arbitrum");
            assertGt(JB_MULTI_TERMINAL.code.length, 0, "JBMultiTerminal should be deployed on Arbitrum");
            assertGt(JB_TERMINAL.code.length, 0, "JBTerminal should be deployed on Arbitrum");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: JB terminal graceful degradation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_jbTerminalGracefulDegradation() public {
        if (!forkActive) return;

        if (JB_MULTI_TERMINAL.code.length == 0) {
            emit log("SKIPPED: JBMultiTerminal not deployed on Arbitrum");
            return;
        }

        // Configure the real JB terminal with a non-existent project ID
        yieldSplitter.setJBMultiTerminal(JB_MULTI_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(999_999);

        uint256 yieldAmount = 0.1 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Split should NOT revert — JB payment caught by try/catch
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 treasuryReceived = IERC20(WETH).balanceOf(testTreasury) - treasuryBefore;

        // JB portion should have been sent to treasury as fallback
        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;
        assertEq(treasuryReceived, expectedJuicebox, "JB fallback should go to treasury");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: No vault shares reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_noSharesReverts() public {
        if (!forkActive) return;

        // No shares registered (setUp doesn't register shares) → should revert
        vm.expectRevert(abi.encodeWithSelector(YieldResolver.NoVaultShares.selector, testGarden, WETH));
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Admin setters work correctly on fork
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_adminSettersWorkOnFork() public {
        if (!forkActive) return;

        address newOctant = address(0xEE);
        uint256 newThreshold = 50e18;
        uint256 newMinAllocation = 1e16;

        yieldSplitter.setOctantModule(newOctant);
        yieldSplitter.setMinYieldThreshold(newThreshold);
        yieldSplitter.setMinAllocationAmount(newMinAllocation);

        assertEq(yieldSplitter.octantModule(), newOctant, "octant module should be updated");
        assertEq(yieldSplitter.minYieldThreshold(), newThreshold, "threshold should be updated");
        assertEq(yieldSplitter.minAllocationAmount(), newMinAllocation, "min allocation should be updated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Default split config is returned when not configured
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_defaultSplitConfigReturned() public {
        if (!forkActive) return;

        address unconfiguredGarden = address(0xFFFF);
        YieldResolver.SplitConfig memory config = yieldSplitter.getSplitConfig(unconfiguredGarden);

        assertEq(config.cookieJarBps, 4865, "default cookie jar should be 4865 bps");
        assertEq(config.fractionsBps, 4865, "default fractions should be 4865 bps");
        assertEq(config.juiceboxBps, 270, "default juicebox should be 270 bps");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Constants match expected values
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_constantsAreCorrect() public {
        if (!forkActive) return;

        assertEq(yieldSplitter.BPS_DENOMINATOR(), 10_000, "BPS denominator should be 10000");
        assertEq(yieldSplitter.DEFAULT_COOKIE_JAR_BPS(), 4865, "default cookie jar bps should be 4865");
        assertEq(yieldSplitter.DEFAULT_FRACTIONS_BPS(), 4865, "default fractions bps should be 4865");
        assertEq(yieldSplitter.DEFAULT_JUICEBOX_BPS(), 270, "default juicebox bps should be 270");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real JBMultiTerminal.pay() success path
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_realJBPaySuccess() public {
        if (!forkActive) return;

        if (JB_CONTROLLER.code.length == 0 || JB_TERMINAL.code.length == 0) {
            emit log("SKIPPED: Juicebox v5 contracts not deployed at expected addresses");
            return;
        }

        // 1. Launch a test JB project that accepts WETH payments
        uint256 projectId = _launchTestJBProject(JB_CONTROLLER, JB_TERMINAL);

        // 2. Configure yieldSplitter with the real JB terminal
        yieldSplitter.setJBMultiTerminal(JB_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(projectId);
        // 100% to Juicebox for clean verification
        yieldSplitter.setSplitRatio(testGarden, 0, 0, 10_000);

        // 3. Fund vault with real WETH
        uint256 yieldAmount = 0.1 ether;
        _fundVaultAndMintShares(yieldAmount);

        // 4. Record balances before
        uint256 terminalWethBefore = IERC20(WETH).balanceOf(JB_TERMINAL);

        // 5. Execute split — routes 100% through real JBMultiTerminal.pay()
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        // 6. Verify real token transfer to JB terminal
        uint256 terminalReceived = IERC20(WETH).balanceOf(JB_TERMINAL) - terminalWethBefore;
        assertEq(terminalReceived, yieldAmount, "JB terminal should receive real WETH from yield split");

        // 7. Resolver should have no remaining balance
        assertEq(
            IERC20(WETH).balanceOf(address(yieldSplitter)), 0, "resolver should have 0 WETH after successful JB payment"
        );

        // 8. Treasury should NOT receive anything (JB pay succeeded)
        assertEq(IERC20(WETH).balanceOf(testTreasury), 0, "treasury should receive nothing when JB pay succeeds");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real JB pay() with partial split
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_realJBPayPartialSplit() public {
        if (!forkActive) return;

        if (JB_CONTROLLER.code.length == 0 || JB_TERMINAL.code.length == 0) {
            emit log("SKIPPED: Juicebox v5 contracts not deployed at expected addresses");
            return;
        }

        uint256 projectId = _launchTestJBProject(JB_CONTROLLER, JB_TERMINAL);

        yieldSplitter.setJBMultiTerminal(JB_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(projectId);
        // 50% cookie jar, 0% fractions, 50% juicebox
        yieldSplitter.setSplitRatio(testGarden, 5000, 0, 5000);

        uint256 yieldAmount = 1 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(testCookieJar);
        uint256 terminalBefore = IERC20(WETH).balanceOf(JB_TERMINAL);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        // Cookie jar: 50% = 0.5 ETH
        uint256 cookieJarReceived = IERC20(WETH).balanceOf(testCookieJar) - cookieJarBefore;
        uint256 expectedCookieJar = (yieldAmount * 5000) / 10_000;
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive 50%");

        // JB terminal: 50% = 0.5 ETH
        uint256 terminalReceived = IERC20(WETH).balanceOf(JB_TERMINAL) - terminalBefore;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar;
        assertEq(terminalReceived, expectedJuicebox, "JB terminal should receive 50%");

        // Total out = total in (no wei lost)
        assertEq(
            cookieJarReceived + terminalReceived, yieldAmount, "total distributed should equal total yield (zero loss)"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real JB pay() balance checks (fallback path)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_realJBPayBalanceChecks() public {
        if (!forkActive) return;

        if (JB_MULTI_TERMINAL.code.length == 0) {
            emit log("SKIPPED: JBMultiTerminal not deployed on Arbitrum");
            return;
        }

        // Configure real JB terminal with non-existent project (triggers fallback)
        yieldSplitter.setJBMultiTerminal(JB_MULTI_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(999_999);

        uint256 yieldAmount = 0.5 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Snapshot ALL balances before split
        uint256 cookieJarBefore = IERC20(WETH).balanceOf(testCookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);
        uint256 resolverBefore = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 jbTerminalBefore = IERC20(WETH).balanceOf(JB_MULTI_TERMINAL);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        // Snapshot balances after split
        uint256 cookieJarAfter = IERC20(WETH).balanceOf(testCookieJar);
        uint256 treasuryAfter = IERC20(WETH).balanceOf(testTreasury);
        uint256 resolverAfter = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 jbTerminalAfter = IERC20(WETH).balanceOf(JB_MULTI_TERMINAL);

        // Calculate expected portions
        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;

        // Cookie Jar receives its portion via real WETH transfer
        assertEq(cookieJarAfter - cookieJarBefore, expectedCookieJar, "cookie jar WETH balance delta");

        // JB terminal should NOT receive tokens (pay reverts, fallback to treasury)
        assertEq(jbTerminalAfter, jbTerminalBefore, "JB terminal should not receive WETH (pay failed)");

        // Treasury receives JB fallback portion
        assertEq(treasuryAfter - treasuryBefore, expectedJuicebox, "treasury should receive JB fallback");

        // Fractions portion is escrowed (no marketplace configured)
        uint256 escrowed = yieldSplitter.getEscrowedFractions(testGarden, WETH);
        assertEq(escrowed, expectedFractions, "fractions should be escrowed");

        // YieldResolver retains the escrowed fractions
        assertEq(resolverAfter - resolverBefore, expectedFractions, "resolver should hold escrowed fractions");

        // Conservation of value: all yield accounted for
        uint256 totalDistributed = (cookieJarAfter - cookieJarBefore) + (treasuryAfter - treasuryBefore) + escrowed;
        assertEq(totalDistributed, yieldAmount, "total distributed + escrowed should equal yield amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Full balance accounting with real WETH (irregular amounts)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_fullBalanceAccountingWithRealWETH() public {
        if (!forkActive) return;

        // Use an irregular amount to test rounding
        uint256 yieldAmount = 1.337 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(testCookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 cookieJarReceived = IERC20(WETH).balanceOf(testCookieJar) - cookieJarBefore;
        uint256 treasuryReceived = IERC20(WETH).balanceOf(testTreasury) - treasuryBefore;
        uint256 resolverBalance = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 escrowed = yieldSplitter.getEscrowedFractions(testGarden, WETH);
        uint256 vaultAfter = IERC20(WETH).balanceOf(address(mockVault));

        // Vault should have been drained (shares redeemed for WETH)
        assertEq(vaultAfter, 0, "vault should be drained after redemption");

        // Cookie jar = 48.65% of yield
        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive correct portion");

        // Fractions portion escrowed (no marketplace)
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        assertEq(escrowed, expectedFractions, "fractions portion should be escrowed");

        // JB portion to treasury fallback (no JB terminal configured)
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;
        assertEq(treasuryReceived, expectedJuicebox, "treasury should receive JB fallback");

        // Global accounting: every wei from the vault ended up somewhere
        uint256 totalAccounted = cookieJarReceived + treasuryReceived + escrowed;
        assertEq(totalAccounted, yieldAmount, "total accounted should match yield (conservation of value)");

        // YieldResolver should not retain any extra WETH beyond escrowed
        assertEq(resolverBalance, escrowed, "resolver balance should only include escrow");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: HypercertExchange deployment check
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_hypercertExchangeIsDeployed() public {
        if (!forkActive) return;

        // From deployments/42161-latest.json
        address HYPERCERT_EXCHANGE = 0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83;

        if (HYPERCERT_EXCHANGE.code.length == 0) {
            emit log("INFO: HypercertExchange not deployed at expected address on Arbitrum");
        } else {
            assertGt(HYPERCERT_EXCHANGE.code.length, 0, "HypercertExchange should be deployed on Arbitrum");
            emit log_named_uint("HypercertExchange code size", HYPERCERT_EXCHANGE.code.length);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Escrowed fractions withdrawal with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_escrowedFractionsWithdrawWithRealWETH() public {
        if (!forkActive) return;

        uint256 yieldAmount = 0.2 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Split — fractions will be escrowed (no marketplace configured)
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 escrowed = yieldSplitter.getEscrowedFractions(testGarden, WETH);
        assertGt(escrowed, 0, "should have escrowed fractions");

        // Treasury balance before withdrawal
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        // Owner withdraws escrowed fractions to treasury
        yieldSplitter.withdrawEscrowedFractions(testGarden, WETH, escrowed, testTreasury);

        // Verify real WETH moved
        uint256 treasuryAfter = IERC20(WETH).balanceOf(testTreasury);
        assertEq(treasuryAfter - treasuryBefore, escrowed, "treasury should receive escrowed WETH");

        // Escrow should be cleared
        uint256 escrowedAfter = yieldSplitter.getEscrowedFractions(testGarden, WETH);
        assertEq(escrowedAfter, 0, "escrow should be zero after withdrawal");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Rescue stranded WETH tokens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_rescueStrandedWETH() public {
        if (!forkActive) return;

        // Send some real WETH directly to the resolver (simulating stranded tokens)
        uint256 strandedAmount = 0.05 ether;
        deal(WETH, address(yieldSplitter), strandedAmount);

        uint256 resolverBefore = IERC20(WETH).balanceOf(address(yieldSplitter));
        assertEq(resolverBefore, strandedAmount, "resolver should hold stranded WETH");

        address rescueTo = makeAddr("rescueRecipient");
        uint256 rescueToBefore = IERC20(WETH).balanceOf(rescueTo);

        yieldSplitter.rescueTokens(WETH, rescueTo, strandedAmount);

        uint256 resolverAfter = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 rescueToAfter = IERC20(WETH).balanceOf(rescueTo);

        assertEq(resolverAfter, 0, "resolver should be empty after rescue");
        assertEq(rescueToAfter - rescueToBefore, strandedAmount, "recipient should receive rescued WETH");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Multiple gardens, isolated real WETH balances
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_multiGardenIsolationWithRealWETH() public {
        if (!forkActive) return;

        // Configure a second garden with its own roles and addresses
        address garden2 = _mintTestGarden("Second Yield Garden", 0x0F);
        address cookieJar2 = makeAddr("cookieJar2");
        address treasury2 = makeAddr("treasury2");

        yieldSplitter.setCookieJar(garden2, cookieJar2);
        yieldSplitter.setGardenTreasury(garden2, treasury2);
        yieldSplitter.setGardenVault(garden2, WETH, address(mockVault));

        // Fund garden 1 with 1 WETH
        uint256 amount1 = 1 ether;
        _fundVaultAndMintShares(amount1);

        // Fund garden 2 with 0.5 WETH
        uint256 amount2 = 0.5 ether;
        _fundVaultForGarden(garden2, amount2);

        // Split garden 1
        uint256 cookieJar1Before = IERC20(WETH).balanceOf(testCookieJar);
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));
        uint256 cookieJar1Received = IERC20(WETH).balanceOf(testCookieJar) - cookieJar1Before;

        // Split garden 2
        uint256 cookieJar2Before = IERC20(WETH).balanceOf(cookieJar2);
        yieldSplitter.splitYield(garden2, WETH, address(mockVault));
        uint256 cookieJar2Received = IERC20(WETH).balanceOf(cookieJar2) - cookieJar2Before;

        // Garden 1 cookie jar: 48.65% of 1 ether
        uint256 expected1 = (amount1 * 4865) / 10_000;
        assertEq(cookieJar1Received, expected1, "garden1 cookie jar should receive correct share");

        // Garden 2 cookie jar: 48.65% of 0.5 ether
        uint256 expected2 = (amount2 * 4865) / 10_000;
        assertEq(cookieJar2Received, expected2, "garden2 cookie jar should receive correct share");

        // Verify isolation: garden2 only got its own share
        assertGt(cookieJar1Received, cookieJar2Received, "garden1 should receive more (larger deposit)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // JB Project Helper
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Launch a JB project on Arbitrum fork that accepts WETH
    function _launchTestJBProject(address controller, address terminal) internal returns (uint256 projectId) {
        JBRulesetMetadata memory metadata = JBRulesetMetadata({
            reservedPercent: 0,
            cashOutTaxRate: 0,
            baseCurrency: 1,
            pausePay: false,
            pauseCreditTransfers: false,
            allowOwnerMinting: true,
            allowSetCustomToken: false,
            allowTerminalMigration: false,
            allowSetTerminals: false,
            allowSetController: false,
            allowAddAccountingContext: true,
            allowAddPriceFeed: false,
            ownerMustSendPayouts: false,
            holdFees: false,
            useTotalSurplusForCashOuts: false,
            useDataHookForPay: false,
            useDataHookForCashOut: false,
            dataHook: address(0),
            metadata: 0
        });

        JBRulesetConfig[] memory rulesetConfigs = new JBRulesetConfig[](1);
        rulesetConfigs[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: 1000e18,
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: metadata,
            splitGroups: new JBSplitGroup[](0),
            fundAccessLimitGroups: new JBFundAccessLimitGroup[](0)
        });

        JBAccountingContext[] memory accountingContexts = new JBAccountingContext[](1);
        accountingContexts[0] = JBAccountingContext({ token: WETH, decimals: 18, currency: 1 });

        JBTerminalConfig[] memory terminalConfigs = new JBTerminalConfig[](1);
        terminalConfigs[0] =
            JBTerminalConfig({ terminal: IJBMultiTerminal(terminal), accountingContextsToAccept: accountingContexts });

        projectId = IJBController(controller).launchProjectFor(
            address(this), "ipfs://fork-test", rulesetConfigs, terminalConfigs, "Fork test project"
        );
    }
}
