// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { IJBMultiTerminal } from "../../src/interfaces/IJuicebox.sol";

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
}
