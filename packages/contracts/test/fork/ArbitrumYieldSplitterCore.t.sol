// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { ForkTestBase } from "./helpers/ForkTestBase.sol";

contract MockVaultForYieldCoreTest {
    IERC20 public immutable asset_;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    constructor(address assetAddress) {
        asset_ = IERC20(assetAddress);
    }

    function asset() external view returns (address) {
        return address(asset_);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        asset_.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        balanceOf[receiver] += shares;
        totalSupply += shares;
    }

    function redeem(
        uint256 shares,
        address receiver,
        address shareOwner,
        uint256,
        address[] calldata
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

    function mintShares(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

/// @notice Runnable Arbitrum fork gate for YieldResolver split behavior.
contract ArbitrumYieldResolverCoreForkTest is ForkTestBase {
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant JB_MULTI_TERMINAL = 0x82129d4109625F94582bDdF6101a8Cd1a27919f5;

    MockVaultForYieldCoreTest internal mockVault;
    address internal testGarden;
    address internal testCookieJar;
    address internal testTreasury;

    function setUp() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        testCookieJar = makeAddr("yieldCoreCookieJar");
        testTreasury = makeAddr("yieldCoreTreasury");

        testGarden = _mintTestGarden("Yield Core Garden", 0x0F);
        _grantGardenRole(testGarden, forkOperator, IHatsModule.GardenRole.Operator);

        mockVault = new MockVaultForYieldCoreTest(WETH);
        yieldSplitter.setCookieJar(testGarden, testCookieJar);
        yieldSplitter.setGardenTreasury(testGarden, testTreasury);
        yieldSplitter.setGardenVault(testGarden, WETH, address(mockVault));
        yieldSplitter.setMinYieldThreshold(0);
    }

    function _fundVaultAndMintShares(uint256 amount) internal {
        deal(WETH, address(mockVault), amount);
        mockVault.mintShares(address(yieldSplitter), amount);
        vm.prank(address(octantModule));
        yieldSplitter.registerShares(testGarden, address(mockVault), amount);
    }

    function _fundVaultForGarden(address garden, uint256 amount) internal {
        deal(WETH, address(mockVault), IERC20(WETH).balanceOf(address(mockVault)) + amount);
        mockVault.mintShares(address(yieldSplitter), amount);
        vm.prank(address(octantModule));
        yieldSplitter.registerShares(garden, address(mockVault), amount);
    }

    function test_forkDeploy_initializesWithRealWETH() public {
        assertGt(WETH.code.length, 0, "WETH should be deployed on Arbitrum");
        assertEq(yieldSplitter.octantModule(), address(octantModule), "octant module should be set");
    }

    function test_forkSplitYield_threeWaySplitWithRealWETH() public {
        uint256 yieldAmount = 1 ether;
        _fundVaultAndMintShares(yieldAmount);

        uint256 cookieJarBefore = IERC20(WETH).balanceOf(testCookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;

        assertEq(IERC20(WETH).balanceOf(testCookieJar) - cookieJarBefore, expectedCookieJar, "cookie jar split");
        assertEq(IERC20(WETH).balanceOf(testTreasury) - treasuryBefore, expectedJuicebox, "treasury fallback split");
        assertEq(yieldSplitter.getEscrowedFractions(testGarden, WETH), expectedFractions, "fractions escrow");
    }

    function test_forkSplitYield_jbTerminalGracefulDegradation() public {
        if (JB_MULTI_TERMINAL.code.length == 0) return;

        yieldSplitter.setJBMultiTerminal(JB_MULTI_TERMINAL);
        yieldSplitter.setJuiceboxProjectId(999_999);

        uint256 yieldAmount = 0.1 ether;
        _fundVaultAndMintShares(yieldAmount);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;

        assertEq(IERC20(WETH).balanceOf(testTreasury) - treasuryBefore, expectedJuicebox, "JB fallback to treasury");
    }

    function test_forkSplitYield_escrowedFractionsWithdrawWithRealWETH() public {
        uint256 yieldAmount = 0.2 ether;
        _fundVaultAndMintShares(yieldAmount);

        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));

        uint256 escrowed = yieldSplitter.getEscrowedFractions(testGarden, WETH);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(testTreasury);

        yieldSplitter.withdrawEscrowedFractions(testGarden, WETH, escrowed, testTreasury);

        assertEq(IERC20(WETH).balanceOf(testTreasury) - treasuryBefore, escrowed, "treasury should receive escrow");
        assertEq(yieldSplitter.getEscrowedFractions(testGarden, WETH), 0, "escrow should be cleared");
    }

    function test_forkSplitYield_multiGardenIsolationWithRealWETH() public {
        address garden2 = _mintTestGarden("Second Yield Core Garden", 0x0F);
        address cookieJar2 = makeAddr("yieldCoreCookieJar2");
        address treasury2 = makeAddr("yieldCoreTreasury2");

        yieldSplitter.setCookieJar(garden2, cookieJar2);
        yieldSplitter.setGardenTreasury(garden2, treasury2);
        yieldSplitter.setGardenVault(garden2, WETH, address(mockVault));

        uint256 amount1 = 1 ether;
        uint256 amount2 = 0.5 ether;
        _fundVaultAndMintShares(amount1);
        _fundVaultForGarden(garden2, amount2);

        uint256 cookieJar1Before = IERC20(WETH).balanceOf(testCookieJar);
        yieldSplitter.splitYield(testGarden, WETH, address(mockVault));
        uint256 cookieJar2Before = IERC20(WETH).balanceOf(cookieJar2);
        yieldSplitter.splitYield(garden2, WETH, address(mockVault));

        assertEq(IERC20(WETH).balanceOf(testCookieJar) - cookieJar1Before, (amount1 * 4865) / 10_000, "garden1 share");
        assertEq(IERC20(WETH).balanceOf(cookieJar2) - cookieJar2Before, (amount2 * 4865) / 10_000, "garden2 share");
    }
}
