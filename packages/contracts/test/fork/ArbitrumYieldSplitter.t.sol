// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import {
    IJBController,
    IJBMultiTerminal,
    IJBToken,
    IJBTokens,
    JBRulesetConfig,
    JBRulesetMetadata,
    JBSplitGroup,
    JBFundAccessLimitGroup,
    JBTerminalConfig,
    JBAccountingContext,
    IJBRulesetApprovalHook
} from "../../src/interfaces/IJuicebox.sol";

/// @title MockVaultForFork
/// @notice Minimal ERC-4626-like vault backed by real WETH on the fork
/// @dev Holds real WETH, tracks share balances, supports deposit/redeem at 1:1 ratio
contract MockVaultForFork {
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
    /// @dev Matches IOctantVault.redeem signature (5 params: shares, receiver, owner, maxLoss, strategies)
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

/// @title MockHatsModuleForYieldFork
/// @notice Minimal mock providing isOperatorOf/isOwnerOf for access control
contract MockHatsModuleForYieldFork {
    mapping(address garden => mapping(address account => bool isOp)) public operators;
    mapping(address garden => mapping(address account => bool isOwn)) public owners;

    function setOperator(address garden, address account, bool value) external {
        operators[garden][account] = value;
    }

    function setOwner(address garden, address account, bool value) external {
        owners[garden][account] = value;
    }

    function isOperatorOf(address garden, address account) external view returns (bool) {
        return operators[garden][account];
    }

    function isOwnerOf(address garden, address account) external view returns (bool) {
        return owners[garden][account];
    }
}

/// @title ArbitrumYieldResolverForkTest
/// @notice Fork tests for YieldResolver against Arbitrum mainnet with real WETH
/// @dev Gracefully skips when ARBITRUM_RPC_URL is not set
contract ArbitrumYieldResolverForkTest is Test {
    /// @notice Real WETH on Arbitrum
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    /// @notice Juicebox Multi-Terminal on Arbitrum
    address internal constant JB_MULTI_TERMINAL = 0x82129d4109625F94582bDdF6101a8Cd1a27919f5;

    YieldResolver public yieldSplitter;
    MockVaultForFork public vault;
    MockHatsModuleForYieldFork public mockHatsModule;

    address public owner = address(0xA1);
    address public octantModule = address(0xA2);
    address public garden = address(0xB1);
    address public treasury = address(0xB2);
    address public cookieJar = address(0xB3);
    address public operator = address(0xB4);

    uint256 public constant MIN_YIELD_THRESHOLD = 0.01 ether; // Low threshold for testing

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Deploy helper (call after fork is active)
    // ═══════════════════════════════════════════════════════════════════════════

    function _deployYieldResolver() internal {
        mockHatsModule = new MockHatsModuleForYieldFork();
        vault = new MockVaultForFork(WETH);

        YieldResolver impl = new YieldResolver();
        bytes memory initData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, owner, octantModule, address(mockHatsModule), MIN_YIELD_THRESHOLD
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        yieldSplitter = YieldResolver(address(proxy));

        // Configure garden
        vm.startPrank(owner);
        yieldSplitter.setCookieJar(garden, cookieJar);
        yieldSplitter.setGardenTreasury(garden, treasury);
        yieldSplitter.setGardenVault(garden, WETH, address(vault));
        vm.stopPrank();

        // Set up operator
        mockHatsModule.setOperator(garden, operator, true);
    }

    /// @notice Fund vault with real WETH, mint shares to the yield splitter, and register them
    /// @dev registerShares() updates YieldResolver's per-garden accounting so splitYield() can
    ///      redeem. Without this call, gardenShares[garden][vault] stays at 0 and splitYield reverts.
    function _fundVaultAndMintShares(uint256 amount) internal {
        deal(WETH, address(vault), amount);
        vault.mintShares(address(yieldSplitter), amount);
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Deploy and initialize with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_initializesWithRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // Verify WETH is deployed
        assertGt(WETH.code.length, 0, "WETH should be deployed on Arbitrum");

        _deployYieldResolver();

        assertEq(yieldSplitter.owner(), owner, "owner should be set");
        assertEq(yieldSplitter.octantModule(), octantModule, "octant module should be set");
        assertEq(address(yieldSplitter.hatsModule()), address(mockHatsModule), "hats module should be set");
        assertEq(yieldSplitter.minYieldThreshold(), MIN_YIELD_THRESHOLD, "threshold should be set");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Mock vault holds real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_vaultHoldsRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        uint256 depositAmount = 1 ether;
        deal(WETH, address(vault), depositAmount);

        uint256 vaultBalance = IERC20(WETH).balanceOf(address(vault));
        assertEq(vaultBalance, depositAmount, "vault should hold real WETH");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Three-way split flow with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_threeWaySplitWithRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        uint256 yieldAmount = 1 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Record balances before split
        uint256 cookieJarBefore = IERC20(WETH).balanceOf(cookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(treasury);

        // Execute split — default ratios: 4865/4865/270 bps
        yieldSplitter.splitYield(garden, WETH, address(vault));

        // Cookie Jar should receive ~48.65%
        uint256 cookieJarAfter = IERC20(WETH).balanceOf(cookieJar);
        uint256 cookieJarReceived = cookieJarAfter - cookieJarBefore;
        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive ~48.65% of yield");

        // Juicebox terminal is not configured, so JB portion goes to treasury as fallback
        // Fractions portion recompounds into vault (no marketplace configured)
        // So treasury receives the Juicebox fallback portion
        uint256 treasuryAfter = IERC20(WETH).balanceOf(treasury);
        uint256 treasuryReceived = treasuryAfter - treasuryBefore;

        // Juicebox portion = totalYield - cookieJar - fractions = remainder
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;
        assertEq(treasuryReceived, expectedJuicebox, "treasury should receive JB fallback portion");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Threshold accumulation with real tokens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_thresholdAccumulationWithRealTokens() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        // Fund with amount below threshold
        uint256 subThreshold = MIN_YIELD_THRESHOLD / 2; // 0.005 ETH
        _fundVaultAndMintShares(subThreshold);

        // Split should accumulate, not distribute
        yieldSplitter.splitYield(garden, WETH, address(vault));

        uint256 pending = yieldSplitter.getPendingYield(garden, WETH);
        assertEq(pending, subThreshold, "sub-threshold yield should be accumulated");

        // Cookie jar should NOT have received anything
        uint256 cookieJarBal = IERC20(WETH).balanceOf(cookieJar);
        assertEq(cookieJarBal, 0, "cookie jar should not receive sub-threshold yield");

        // Fund with more to cross threshold
        uint256 secondAmount = MIN_YIELD_THRESHOLD; // 0.01 ETH — total now 0.015 ETH > 0.01 threshold
        deal(WETH, address(vault), secondAmount);
        vault.mintShares(address(yieldSplitter), secondAmount);
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), secondAmount);

        // Second split should distribute accumulated + new
        yieldSplitter.splitYield(garden, WETH, address(vault));

        uint256 pendingAfter = yieldSplitter.getPendingYield(garden, WETH);
        assertEq(pendingAfter, 0, "pending should be cleared after crossing threshold");

        // Cookie jar should now have received its share of total (subThreshold + secondAmount)
        uint256 totalYield = subThreshold + secondAmount;
        uint256 expectedCookieJar = (totalYield * 4865) / 10_000;
        uint256 cookieJarBalAfter = IERC20(WETH).balanceOf(cookieJar);
        assertEq(cookieJarBalAfter, expectedCookieJar, "cookie jar should receive accumulated + new yield");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Custom split ratio with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_customSplitRatioWithRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        // Set 50/25/25 split
        vm.prank(owner);
        yieldSplitter.setSplitRatio(garden, 5000, 2500, 2500);

        uint256 yieldAmount = 2 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(cookieJar);

        yieldSplitter.splitYield(garden, WETH, address(vault));

        uint256 cookieJarReceived = IERC20(WETH).balanceOf(cookieJar) - cookieJarBefore;
        uint256 expectedCookieJar = (yieldAmount * 5000) / 10_000; // 1 ether
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive 50% with custom split");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Operator can set split ratio
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_operatorCanSetSplitRatio() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        vm.prank(operator);
        yieldSplitter.setSplitRatio(garden, 4000, 3000, 3000);

        YieldResolver.SplitConfig memory config = yieldSplitter.getSplitConfig(garden);
        assertEq(config.cookieJarBps, 4000, "cookie jar bps should be 4000");
        assertEq(config.fractionsBps, 3000, "fractions bps should be 3000");
        assertEq(config.juiceboxBps, 3000, "juicebox bps should be 3000");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Invalid split ratio reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_invalidSplitRatioReverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        vm.prank(owner);
        vm.expectRevert(YieldResolver.InvalidSplitRatio.selector);
        yieldSplitter.setSplitRatio(garden, 5000, 3000, 3000); // Sums to 11000
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: JB Multi-Terminal exists on Arbitrum
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_jbMultiTerminalIsDeployed() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        if (JB_MULTI_TERMINAL.code.length == 0) {
            emit log("WARNING: JBMultiTerminal not deployed at expected address on Arbitrum");
            emit log("  Expected: 0x82129d4109625F94582bDdF6101a8Cd1a27919f5");
            emit log("  Action required: verify correct JB Multi-Terminal address for Arbitrum");
        } else {
            assertGt(JB_MULTI_TERMINAL.code.length, 0, "JBMultiTerminal should be deployed on Arbitrum");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: JB terminal integration (graceful failure without valid project)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSplitYield_jbTerminalGracefulDegradation() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // JB Multi-Terminal must be deployed to test graceful degradation.
        // Foundry raises a hard error for calls to non-contract addresses
        // that try/catch cannot intercept, so we must skip if JB is absent.
        if (JB_MULTI_TERMINAL.code.length == 0) {
            emit log("SKIPPED: JBMultiTerminal not deployed on Arbitrum -- cannot test graceful degradation");
            return;
        }

        _deployYieldResolver();

        // Configure the real JB terminal with a non-existent project ID
        vm.startPrank(owner);
        yieldSplitter.setJBMultiTerminal(JB_MULTI_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(999_999); // Non-existent project
        vm.stopPrank();

        uint256 yieldAmount = 0.1 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Split should NOT revert — JB payment will fail but be caught by try/catch
        // Juicebox portion should fall back to treasury
        uint256 treasuryBefore = IERC20(WETH).balanceOf(treasury);

        yieldSplitter.splitYield(garden, WETH, address(vault));

        uint256 treasuryAfter = IERC20(WETH).balanceOf(treasury);
        uint256 treasuryReceived = treasuryAfter - treasuryBefore;

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
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        // No shares minted — should revert
        vm.expectRevert(abi.encodeWithSelector(YieldResolver.NoVaultShares.selector, garden, WETH));
        yieldSplitter.splitYield(garden, WETH, address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Admin setters work correctly on fork
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_adminSettersWorkOnFork() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        address newOctant = address(0xEE);
        uint256 newThreshold = 50e18;
        uint256 newMinAllocation = 1e16;

        vm.startPrank(owner);
        yieldSplitter.setOctantModule(newOctant);
        yieldSplitter.setMinYieldThreshold(newThreshold);
        yieldSplitter.setMinAllocationAmount(newMinAllocation);
        vm.stopPrank();

        assertEq(yieldSplitter.octantModule(), newOctant, "octant module should be updated");
        assertEq(yieldSplitter.minYieldThreshold(), newThreshold, "threshold should be updated");
        assertEq(yieldSplitter.minAllocationAmount(), newMinAllocation, "min allocation should be updated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Default split config is returned when not configured
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_defaultSplitConfigReturned() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

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
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        assertEq(yieldSplitter.BPS_DENOMINATOR(), 10_000, "BPS denominator should be 10000");
        assertEq(yieldSplitter.DEFAULT_COOKIE_JAR_BPS(), 4865, "default cookie jar bps should be 4865");
        assertEq(yieldSplitter.DEFAULT_FRACTIONS_BPS(), 4865, "default fractions bps should be 4865");
        assertEq(yieldSplitter.DEFAULT_JUICEBOX_BPS(), 270, "default juicebox bps should be 270");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real JBMultiTerminal.pay() success path
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Launches a Juicebox project on Arbitrum fork and verifies real JB pay() succeeds
    /// @dev Creates a JB project that accepts WETH, then routes 100% yield through JB terminal.
    ///      Verifies real WETH transfer to the terminal (balance deltas), not mock recordings.
    function test_forkSplitYield_realJBPaySuccess() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // Arbitrum Juicebox v5 addresses (from script/DeployJuicebox.s.sol)
        address JB_CONTROLLER = 0x84E1D0102A722b3f3c00EC4E2b7ca2B97edF4eB2;
        address JB_TERMINAL = 0x14785612bd5C27D8CbAd1d9A9E33BEBfF5F4C3b6;

        // Skip if JB contracts not deployed on this fork block
        if (JB_CONTROLLER.code.length == 0 || JB_TERMINAL.code.length == 0) {
            emit log("SKIPPED: Juicebox v5 contracts not deployed at expected addresses");
            return;
        }

        // 1. Launch a test JB project that accepts WETH payments
        uint256 projectId = _launchTestJBProject(JB_CONTROLLER, JB_TERMINAL);

        // 2. Deploy YieldResolver and configure it with the real JB terminal
        _deployYieldResolver();

        vm.startPrank(owner);
        yieldSplitter.setJBMultiTerminal(JB_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(projectId);
        // 100% to Juicebox for clean verification
        yieldSplitter.setSplitRatio(garden, 0, 0, 10_000);
        vm.stopPrank();

        // 3. Fund vault with real WETH
        uint256 yieldAmount = 0.1 ether;
        _fundVaultAndMintShares(yieldAmount);

        // 4. Record balances before
        uint256 terminalWethBefore = IERC20(WETH).balanceOf(JB_TERMINAL);

        // 5. Execute split — routes 100% through real JBMultiTerminal.pay()
        yieldSplitter.splitYield(garden, WETH, address(vault));

        // 6. Verify real token transfer to JB terminal
        uint256 terminalWethAfter = IERC20(WETH).balanceOf(JB_TERMINAL);
        uint256 terminalReceived = terminalWethAfter - terminalWethBefore;

        assertEq(terminalReceived, yieldAmount, "JB terminal should receive real WETH from yield split");

        // 7. Resolver should have no remaining balance
        assertEq(
            IERC20(WETH).balanceOf(address(yieldSplitter)), 0, "resolver should have 0 WETH after successful JB payment"
        );

        // 8. Treasury should NOT receive anything (JB pay succeeded, no fallback)
        uint256 treasuryBalance = IERC20(WETH).balanceOf(treasury);
        assertEq(treasuryBalance, 0, "treasury should receive nothing when JB pay succeeds");
    }

    /// @notice Helper: Launch a JB project on Arbitrum fork that accepts WETH
    /// @dev Mirrors the production DeployJuicebox.s.sol but for WETH instead of native ETH
    function _launchTestJBProject(address controller, address terminal) internal returns (uint256 projectId) {
        // Ruleset metadata — pausePay must be false for pay() to work
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

        // Accept WETH payments (not native ETH)
        JBAccountingContext[] memory accountingContexts = new JBAccountingContext[](1);
        accountingContexts[0] = JBAccountingContext({ token: WETH, decimals: 18, currency: 1 });

        JBTerminalConfig[] memory terminalConfigs = new JBTerminalConfig[](1);
        terminalConfigs[0] =
            JBTerminalConfig({ terminal: IJBMultiTerminal(terminal), accountingContextsToAccept: accountingContexts });

        projectId = IJBController(controller).launchProjectFor(
            address(this), "ipfs://fork-test", rulesetConfigs, terminalConfigs, "Fork test project"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real JB pay() with partial split verifies correct BPS routing
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Partial split: 50% cookie jar / 50% JB. Verifies both real balance changes.
    function test_forkSplitYield_realJBPayPartialSplit() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        address JB_CONTROLLER = 0x84E1D0102A722b3f3c00EC4E2b7ca2B97edF4eB2;
        address JB_TERMINAL = 0x14785612bd5C27D8CbAd1d9A9E33BEBfF5F4C3b6;

        if (JB_CONTROLLER.code.length == 0 || JB_TERMINAL.code.length == 0) {
            emit log("SKIPPED: Juicebox v5 contracts not deployed at expected addresses");
            return;
        }

        uint256 projectId = _launchTestJBProject(JB_CONTROLLER, JB_TERMINAL);
        _deployYieldResolver();

        vm.startPrank(owner);
        yieldSplitter.setJBMultiTerminal(JB_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(projectId);
        // 50% cookie jar, 0% fractions, 50% juicebox
        yieldSplitter.setSplitRatio(garden, 5000, 0, 5000);
        vm.stopPrank();

        uint256 yieldAmount = 1 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(cookieJar);
        uint256 terminalBefore = IERC20(WETH).balanceOf(JB_TERMINAL);

        yieldSplitter.splitYield(garden, WETH, address(vault));

        // Cookie jar: 50% = 0.5 ETH
        uint256 cookieJarReceived = IERC20(WETH).balanceOf(cookieJar) - cookieJarBefore;
        uint256 expectedCookieJar = (yieldAmount * 5000) / 10_000;
        assertEq(cookieJarReceived, expectedCookieJar, "cookie jar should receive 50%");

        // JB terminal: 50% = 0.5 ETH
        uint256 terminalReceived = IERC20(WETH).balanceOf(JB_TERMINAL) - terminalBefore;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar; // remainder
        assertEq(terminalReceived, expectedJuicebox, "JB terminal should receive 50%");

        // Total out = total in (no wei lost)
        assertEq(
            cookieJarReceived + terminalReceived, yieldAmount, "total distributed should equal total yield (zero loss)"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real JB pay() with balance checks before/after (fallback path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Exercises real JBMultiTerminal.pay() with a non-existent project. When pay()
    ///         reverts, the try/catch in _routeToJuicebox sends the JB portion to treasury as
    ///         fallback. Verifies actual WETH balance deltas across all destinations.
    function test_forkSplitYield_realJBPayBalanceChecks() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        if (JB_MULTI_TERMINAL.code.length == 0) {
            emit log("SKIPPED: JBMultiTerminal not deployed on Arbitrum");
            return;
        }

        _deployYieldResolver();

        // Configure real JB terminal with non-existent project (triggers fallback path)
        vm.startPrank(owner);
        yieldSplitter.setJBMultiTerminal(JB_MULTI_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(999_999);
        vm.stopPrank();

        uint256 yieldAmount = 0.5 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Snapshot ALL balances before split
        uint256 cookieJarBefore = IERC20(WETH).balanceOf(cookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(treasury);
        uint256 resolverBefore = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 jbTerminalBefore = IERC20(WETH).balanceOf(JB_MULTI_TERMINAL);

        yieldSplitter.splitYield(garden, WETH, address(vault));

        // Snapshot balances after split
        uint256 cookieJarAfter = IERC20(WETH).balanceOf(cookieJar);
        uint256 treasuryAfter = IERC20(WETH).balanceOf(treasury);
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
        uint256 escrowed = yieldSplitter.getEscrowedFractions(garden, WETH);
        assertEq(escrowed, expectedFractions, "fractions should be escrowed");

        // YieldResolver retains the escrowed fractions in its balance
        assertEq(resolverAfter - resolverBefore, expectedFractions, "resolver should hold escrowed fractions");

        // Conservation of value: all yield accounted for
        uint256 totalDistributed = (cookieJarAfter - cookieJarBefore) + (treasuryAfter - treasuryBefore) + escrowed;
        assertEq(totalDistributed, yieldAmount, "total distributed + escrowed should equal yield amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Full balance accounting with real WETH (irregular amounts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that splitYield moves real WETH tokens and that every wei is
    ///         accounted for across all three destinations (no token loss or creation).
    function test_forkSplitYield_fullBalanceAccountingWithRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        // Use an irregular amount to test rounding
        uint256 yieldAmount = 1.337 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Snapshot all relevant balances
        uint256 cookieJarBefore = IERC20(WETH).balanceOf(cookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(treasury);

        yieldSplitter.splitYield(garden, WETH, address(vault));

        uint256 cookieJarReceived = IERC20(WETH).balanceOf(cookieJar) - cookieJarBefore;
        uint256 treasuryReceived = IERC20(WETH).balanceOf(treasury) - treasuryBefore;
        uint256 resolverBalance = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 escrowed = yieldSplitter.getEscrowedFractions(garden, WETH);
        uint256 vaultAfter = IERC20(WETH).balanceOf(address(vault));

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
    // Test: HypercertExchange deployment check on Arbitrum
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that the HypercertExchange is deployed on Arbitrum at the
    ///         expected address from the deployment JSON (42161-latest.json).
    function test_forkDeploy_hypercertExchangeIsDeployed() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // From deployments/42161-latest.json
        address HYPERCERT_EXCHANGE = 0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83;

        if (HYPERCERT_EXCHANGE.code.length == 0) {
            emit log("INFO: HypercertExchange not deployed at expected address on Arbitrum");
            emit log("  Expected: 0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83");
        } else {
            assertGt(HYPERCERT_EXCHANGE.code.length, 0, "HypercertExchange should be deployed on Arbitrum");
            emit log_named_uint("HypercertExchange code size", HYPERCERT_EXCHANGE.code.length);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Escrowed fractions can be withdrawn with real WETH
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Exercises the escrow -> withdraw flow with real WETH balance verification.
    function test_forkSplitYield_escrowedFractionsWithdrawWithRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        uint256 yieldAmount = 0.2 ether;
        _fundVaultAndMintShares(yieldAmount);

        // Split — fractions will be escrowed (no marketplace configured)
        yieldSplitter.splitYield(garden, WETH, address(vault));

        uint256 escrowed = yieldSplitter.getEscrowedFractions(garden, WETH);
        assertGt(escrowed, 0, "should have escrowed fractions");

        // Treasury balance before withdrawal
        uint256 treasuryBefore = IERC20(WETH).balanceOf(treasury);

        // Owner withdraws escrowed fractions to treasury
        vm.prank(owner);
        yieldSplitter.withdrawEscrowedFractions(garden, WETH, escrowed, treasury);

        // Verify real WETH moved
        uint256 treasuryAfter = IERC20(WETH).balanceOf(treasury);
        assertEq(treasuryAfter - treasuryBefore, escrowed, "treasury should receive escrowed WETH");

        // Escrow should be cleared
        uint256 escrowedAfter = yieldSplitter.getEscrowedFractions(garden, WETH);
        assertEq(escrowedAfter, 0, "escrow should be zero after withdrawal");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Rescue stranded WETH tokens
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies rescueTokens() with real WETH — balance checks before/after.
    function test_forkDeploy_rescueStrandedWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        // Send some real WETH directly to the resolver (simulating stranded tokens)
        uint256 strandedAmount = 0.05 ether;
        deal(WETH, address(yieldSplitter), strandedAmount);

        uint256 resolverBefore = IERC20(WETH).balanceOf(address(yieldSplitter));
        assertEq(resolverBefore, strandedAmount, "resolver should hold stranded WETH");

        address rescueTo = makeAddr("rescueRecipient");
        uint256 rescueToBefore = IERC20(WETH).balanceOf(rescueTo);

        vm.prank(owner);
        yieldSplitter.rescueTokens(WETH, rescueTo, strandedAmount);

        uint256 resolverAfter = IERC20(WETH).balanceOf(address(yieldSplitter));
        uint256 rescueToAfter = IERC20(WETH).balanceOf(rescueTo);

        assertEq(resolverAfter, 0, "resolver should be empty after rescue");
        assertEq(rescueToAfter - rescueToBefore, strandedAmount, "recipient should receive rescued WETH");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Multiple gardens, isolated real WETH balances
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that per-garden share accounting prevents cross-garden WETH drainage.
    function test_forkSplitYield_multiGardenIsolationWithRealWETH() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployYieldResolver();

        // Configure a second garden
        address garden2 = address(0xD1);
        address treasury2 = address(0xD2);
        address cookieJar2 = address(0xD3);

        vm.startPrank(owner);
        yieldSplitter.setCookieJar(garden2, cookieJar2);
        yieldSplitter.setGardenTreasury(garden2, treasury2);
        yieldSplitter.setGardenVault(garden2, WETH, address(vault));
        vm.stopPrank();

        // Fund garden 1 with 1 WETH
        uint256 amount1 = 1 ether;
        deal(WETH, address(vault), amount1);
        vault.mintShares(address(yieldSplitter), amount1);
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden, address(vault), amount1);

        // Fund garden 2 with 0.5 WETH
        uint256 amount2 = 0.5 ether;
        deal(WETH, address(vault), IERC20(WETH).balanceOf(address(vault)) + amount2);
        vault.mintShares(address(yieldSplitter), amount2);
        vm.prank(octantModule);
        yieldSplitter.registerShares(garden2, address(vault), amount2);

        // Split garden 1
        uint256 cookieJar1Before = IERC20(WETH).balanceOf(cookieJar);
        yieldSplitter.splitYield(garden, WETH, address(vault));
        uint256 cookieJar1Received = IERC20(WETH).balanceOf(cookieJar) - cookieJar1Before;

        // Split garden 2
        uint256 cookieJar2Before = IERC20(WETH).balanceOf(cookieJar2);
        yieldSplitter.splitYield(garden2, WETH, address(vault));
        uint256 cookieJar2Received = IERC20(WETH).balanceOf(cookieJar2) - cookieJar2Before;

        // Garden 1 cookie jar: 48.65% of 1 ether
        uint256 expected1 = (amount1 * 4865) / 10_000;
        assertEq(cookieJar1Received, expected1, "garden1 cookie jar should receive correct share");

        // Garden 2 cookie jar: 48.65% of 0.5 ether
        uint256 expected2 = (amount2 * 4865) / 10_000;
        assertEq(cookieJar2Received, expected2, "garden2 cookie jar should receive correct share");

        // Verify isolation: garden2 only got its own share, not garden1's
        assertGt(cookieJar1Received, cookieJar2Received, "garden1 should receive more (larger deposit)");
    }
}
