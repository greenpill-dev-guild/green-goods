// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { MockCookieJar, MockJBMultiTerminalForYield, MockOctantVaultForYield } from "../../src/mocks/YieldDeps.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

/// @title MockWETH — ERC20 for integration tests
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockDAI — Second ERC20 for multi-asset jar tests
contract MockDAI is ERC20 {
    constructor() ERC20("Dai Stablecoin", "DAI") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockCookieJarModule — Tracks per-garden, per-asset jar addresses
/// @dev Mimics the real CookieJarModule.getGardenJar() interface
contract MockCookieJarModule {
    mapping(address garden => mapping(address asset => address jar)) public jars;

    function setJar(address garden, address asset, address jar) external {
        jars[garden][asset] = jar;
    }

    function getGardenJar(address garden, address asset) external view returns (address) {
        return jars[garden][asset];
    }
}

/// @title CookieJarYieldIntegrationTest
/// @notice Integration tests for the CookieJar + YieldResolver flow.
///         Verifies that yield splits correctly route to per-asset Cookie Jars,
///         fall back to treasury when no jar exists, and accumulate across splits.
/// @dev Uses mocks only — NO fork required.
contract CookieJarYieldIntegrationTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    YieldResolver internal yieldResolver;
    MockHatsModule internal hatsModule;
    MockCookieJar internal wethJar;
    MockCookieJar internal daiJar;
    MockJBMultiTerminalForYield internal jbTerminal;
    MockCookieJarModule internal cookieJarModule;
    MockWETH internal weth;
    MockDAI internal dai;

    address internal constant OWNER = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant GARDEN = address(0xA3);
    address internal constant TREASURY = address(0xA4);
    address internal constant OCTANT_MODULE = address(0xA5);

    uint256 internal constant JB_PROJECT_ID = 42;
    uint256 internal constant MIN_THRESHOLD = 7e18;

    function setUp() public {
        // Deploy tokens
        weth = new MockWETH();
        dai = new MockDAI();

        // Deploy mocks
        hatsModule = new MockHatsModule();
        wethJar = new MockCookieJar();
        daiJar = new MockCookieJar();
        jbTerminal = new MockJBMultiTerminalForYield();
        cookieJarModule = new MockCookieJarModule();

        // Configure per-asset jars
        cookieJarModule.setJar(GARDEN, address(weth), address(wethJar));
        cookieJarModule.setJar(GARDEN, address(dai), address(daiJar));

        // Deploy YieldResolver via proxy
        YieldResolver impl = new YieldResolver();
        bytes memory initData = abi.encodeWithSelector(
            YieldResolver.initialize.selector, OWNER, OCTANT_MODULE, address(hatsModule), MIN_THRESHOLD
        );
        yieldResolver = YieldResolver(address(new ERC1967Proxy(address(impl), initData)));

        // Configure YieldResolver
        vm.startPrank(OWNER);
        yieldResolver.setCookieJarModule(address(cookieJarModule));
        yieldResolver.setJBMultiTerminal(address(jbTerminal));
        yieldResolver.setJuiceboxProjectId(JB_PROJECT_ID);
        yieldResolver.setGardenTreasury(GARDEN, TREASURY);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper: Set up vault + shares + split for a given asset
    // ═══════════════════════════════════════════════════════════════════════════

    function _setupAndSplit(address asset, uint256 yieldAmount) internal returns (MockOctantVaultForYield vault) {
        vault = new MockOctantVaultForYield(asset);

        // Fund vault with underlying asset and mint shares to resolver
        if (asset == address(weth)) {
            weth.mint(address(vault), yieldAmount);
        } else {
            dai.mint(address(vault), yieldAmount);
        }
        vault.mintShares(address(yieldResolver), yieldAmount);

        // Register vault and shares
        vm.startPrank(OWNER);
        yieldResolver.setGardenVault(GARDEN, asset, address(vault));
        yieldResolver.registerShares(GARDEN, address(vault), yieldAmount);
        vm.stopPrank();

        // Trigger split (permissionless)
        yieldResolver.splitYield(GARDEN, asset, address(vault));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Mint creates jar and wires vault
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice After split, Cookie Jar receives ~48.65% of yield via CookieJarModule lookup
    function test_mintCreatesJarAndWiresVault() public {
        uint256 yieldAmount = 100 ether;
        _setupAndSplit(address(weth), yieldAmount);

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;

        // Verify WETH jar received the CookieJar portion
        assertEq(weth.balanceOf(address(wethJar)), expectedCookieJar, "WETH jar should receive ~48.65% of yield");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Split routes to garden jar
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Yield split sends correct percentage to CookieJar
    function test_splitRoutesToGardenJar() public {
        uint256 yieldAmount = 50 ether;
        _setupAndSplit(address(weth), yieldAmount);

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;
        uint256 expectedFractions = (yieldAmount * 4865) / 10_000;
        uint256 expectedJuicebox = yieldAmount - expectedCookieJar - expectedFractions;

        // Verify three-way split distribution
        assertEq(weth.balanceOf(address(wethJar)), expectedCookieJar, "CookieJar amount");
        assertEq(yieldResolver.getEscrowedFractions(GARDEN, address(weth)), expectedFractions, "Escrowed fractions amount");
        assertEq(jbTerminal.getPayCallCount(), 1, "JB should receive 1 payment");
        (,, uint256 jbAmount,) = jbTerminal.payCalls(0);
        assertEq(jbAmount, expectedJuicebox, "JB amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Multi-asset jars receive correct split
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice WETH and DAI jars both receive their correct CookieJar portions
    function test_multiAssetJarsReceiveCorrectSplit() public {
        uint256 wethYield = 100 ether;
        uint256 daiYield = 200 ether;

        _setupAndSplit(address(weth), wethYield);
        _setupAndSplit(address(dai), daiYield);

        uint256 expectedWethJar = (wethYield * 4865) / 10_000;
        uint256 expectedDaiJar = (daiYield * 4865) / 10_000;

        assertEq(weth.balanceOf(address(wethJar)), expectedWethJar, "WETH jar should receive correct amount");
        assertEq(dai.balanceOf(address(daiJar)), expectedDaiJar, "DAI jar should receive correct amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: No jar for asset falls to treasury
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When no CookieJar exists for an asset, CookieJar portion goes to treasury
    function test_noJarForAssetFallsToTreasury() public {
        uint256 yieldAmount = 100 ether;

        // Remove the WETH jar mapping — CookieJarModule returns address(0) for WETH
        cookieJarModule.setJar(GARDEN, address(weth), address(0));
        // Also clear the legacy mapping
        vm.prank(OWNER);
        yieldResolver.setCookieJar(GARDEN, address(0));

        MockOctantVaultForYield vault = new MockOctantVaultForYield(address(weth));
        weth.mint(address(vault), yieldAmount);
        vault.mintShares(address(yieldResolver), yieldAmount);

        vm.startPrank(OWNER);
        yieldResolver.setGardenVault(GARDEN, address(weth), address(vault));
        yieldResolver.registerShares(GARDEN, address(vault), yieldAmount);
        vm.stopPrank();

        uint256 treasuryBefore = weth.balanceOf(TREASURY);

        yieldResolver.splitYield(GARDEN, address(weth), address(vault));

        uint256 expectedCookieJar = (yieldAmount * 4865) / 10_000;

        // Treasury should receive the CookieJar portion as fallback
        assertEq(
            weth.balanceOf(TREASURY) - treasuryBefore,
            expectedCookieJar,
            "Treasury should receive CookieJar portion as fallback"
        );

        // WETH jar should remain at 0
        assertEq(weth.balanceOf(address(wethJar)), 0, "WETH jar should be empty");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Jar balance accumulates across multiple splits
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Three consecutive splits accumulate in the Cookie Jar
    function test_jarBalanceAccumulatesAcrossMultipleSplits() public {
        uint256 yieldPerCycle = 100 ether;
        uint256 cycles = 3;
        uint256 expectedPerCycle = (yieldPerCycle * 4865) / 10_000;

        for (uint256 i = 0; i < cycles; i++) {
            MockOctantVaultForYield vault = new MockOctantVaultForYield(address(weth));
            weth.mint(address(vault), yieldPerCycle);
            vault.mintShares(address(yieldResolver), yieldPerCycle);

            vm.startPrank(OWNER);
            yieldResolver.setGardenVault(GARDEN, address(weth), address(vault));
            yieldResolver.registerShares(GARDEN, address(vault), yieldPerCycle);
            vm.stopPrank();

            yieldResolver.splitYield(GARDEN, address(weth), address(vault));
        }

        // Cookie Jar should have accumulated across all cycles
        assertEq(
            weth.balanceOf(address(wethJar)), expectedPerCycle * cycles, "Cookie Jar should accumulate across 3 splits"
        );

        // Escrowed fractions should also accumulate
        uint256 expectedFractions = (yieldPerCycle * 4865) / 10_000;
        assertEq(
            yieldResolver.getEscrowedFractions(GARDEN, address(weth)),
            expectedFractions * cycles,
            "Escrowed fractions should accumulate across 3 splits"
        );
    }
}
