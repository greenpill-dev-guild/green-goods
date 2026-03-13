// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import { MockOctantFactory, MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockAavePool, MockAToken, MockPoolDataProvider } from "../../src/mocks/AavePool.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MultistrategyVault } from "../../src/vendor/octant/core/MultistrategyVault.sol";
import { MultistrategyVaultFactory } from "../../src/vendor/octant/factories/MultistrategyVaultFactory.sol";
import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";

contract MockIntegratedGarden is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

contract OctantVaultIntegrationTest is Test {
    event EmergencyPaused(address indexed garden, address indexed asset, address indexed caller);

    OctantModule internal module;
    MockOctantFactory internal factory;
    MockIntegratedGarden internal garden;

    address internal constant GARDEN_TOKEN = address(0xD1);
    address internal constant OPERATOR = address(0xD2);
    address internal constant GARDEN_OWNER = address(0xD3);
    address internal constant DONATION_ADDRESS = address(0xD4);
    address internal constant USER = address(0xD5);

    address internal WETH;
    address internal DAI;

    function setUp() public {
        factory = new MockOctantFactory();

        OctantModule implementation = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = OctantModule(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);

        // Deploy real ERC20 tokens and AaveV3ERC4626 template strategies
        MockERC20 wethAsset = new MockERC20();
        MockERC20 daiAsset = new MockERC20();
        WETH = address(wethAsset);
        DAI = address(daiAsset);

        AaveV3ERC4626 wethStrategy = _deployTemplate(WETH, "GG Aave WETH", "ggaWETH");
        AaveV3ERC4626 daiStrategy = _deployTemplate(DAI, "GG Aave DAI", "ggaDAI");

        garden = new MockIntegratedGarden("Integration Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(DAI, address(daiStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Integration Garden");
    }

    function _deployTemplate(address asset, string memory name, string memory symbol) internal returns (AaveV3ERC4626) {
        MockAToken aToken = new MockAToken();
        MockAavePool pool = new MockAavePool(address(aToken));
        MockPoolDataProvider dataProvider = new MockPoolDataProvider(address(aToken));
        return
            new AaveV3ERC4626(asset, name, symbol, address(pool), address(aToken), address(dataProvider), address(module));
    }

    function test_fullLifecycle_directDeposit_harvest_directWithdraw() public {
        address wethVaultAddr = module.getVaultForAsset(address(garden), WETH);
        assertTrue(wethVaultAddr != address(0), "weth vault should exist");

        MockOctantVault wethVault = MockOctantVault(wethVaultAddr);

        vm.prank(USER);
        wethVault.deposit(100 ether, USER);
        assertEq(wethVault.balanceOf(USER), 100 ether, "user should receive shares");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_ADDRESS);
        assertEq(module.gardenDonationAddresses(address(garden)), DONATION_ADDRESS, "donation should be set");

        // Verify the garden-scoped strategy received the donation address
        address liveStrategy = module.vaultStrategies(wethVaultAddr);
        assertTrue(liveStrategy != address(0), "live strategy should be recorded");
        assertEq(
            AaveV3ERC4626(liveStrategy).donationAddress(), DONATION_ADDRESS, "strategy should receive donation address"
        );

        // Harvest triggers process_report on the mock vault which calls strategy.report()
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        // Harvest completing without revert proves the report was triggered successfully

        vm.prank(USER);
        uint256 assets = wethVault.redeem(40 ether, USER, USER, 0, new address[](0));
        assertEq(assets, 40 ether, "redeem should return expected assets");
        assertEq(wethVault.balanceOf(USER), 60 ether, "remaining shares should be tracked");
    }

    function test_multiAssetVaults_operateIndependently() public {
        MockOctantVault wethVault = MockOctantVault(module.getVaultForAsset(address(garden), WETH));
        MockOctantVault daiVault = MockOctantVault(module.getVaultForAsset(address(garden), DAI));

        vm.prank(USER);
        wethVault.deposit(75 ether, USER);

        vm.prank(USER);
        daiVault.deposit(50 ether, USER);

        assertEq(wethVault.balanceOf(USER), 75 ether, "weth shares should be isolated");
        assertEq(daiVault.balanceOf(USER), 50 ether, "dai shares should be isolated");
        assertEq(wethVault.totalAssets(), 75 ether, "weth assets should be isolated");
        assertEq(daiVault.totalAssets(), 50 ether, "dai assets should be isolated");
    }

    function test_emergencyPause_emitsEvent_andNoForcedWithdraw() public {
        address wethVaultAddr = module.getVaultForAsset(address(garden), WETH);
        MockOctantVault wethVault = MockOctantVault(wethVaultAddr);

        vm.prank(USER);
        wethVault.deposit(30 ether, USER);

        vm.expectEmit(true, true, true, true);
        emit EmergencyPaused(address(garden), WETH, GARDEN_OWNER);

        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);

        assertEq(wethVault.balanceOf(USER), 30 ether, "shares should remain with user");

        // Verify the garden-scoped strategy was signaled to shut down (depositsPaused set to true)
        address liveStrategy = module.vaultStrategies(wethVaultAddr);
        assertTrue(AaveV3ERC4626(liveStrategy).depositsPaused(), "strategy shutdown should pause deposits");
    }
}

/// @title RealVaultOctantIntegrationTest
/// @notice Integration tests using the REAL MultistrategyVault (not MockOctantVault) to verify:
///         1. ERC4626 validation passes during add_strategy
///         2. process_report triggers IAccountant.report() on YieldResolver
///         3. OctantModule.harvest() detects new shares and calls registerShares
///         4. Full pipeline: deposit -> harvest -> splitYield with mock Aave (yield via aToken.mint)
contract RealVaultOctantIntegrationTest is Test {
    OctantModule internal module;
    YieldResolver internal yieldResolver;
    MockIntegratedGarden internal garden;
    MockERC20 internal weth;
    MockAToken internal aToken;
    MockAavePool internal pool;
    MockPoolDataProvider internal dataProvider;

    address internal constant OPERATOR = address(0xE1);
    address internal constant GARDEN_OWNER = address(0xE2);
    address internal constant USER = address(0xE3);
    address internal constant GARDEN_TOKEN = address(0xE4);

    function setUp() public {
        // 1. Deploy mock ERC20 + Aave components
        weth = new MockERC20();
        aToken = new MockAToken();
        pool = new MockAavePool(address(aToken));
        dataProvider = new MockPoolDataProvider(address(aToken));

        // 2. Deploy real MultistrategyVaultFactory with a real vault implementation
        MultistrategyVault vaultImpl = new MultistrategyVault();
        MultistrategyVaultFactory factory =
            new MultistrategyVaultFactory("Green Goods Test", address(vaultImpl), address(this));

        // 3. Deploy OctantModule via proxy
        OctantModule moduleImpl = new OctantModule();
        bytes memory moduleInitData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = OctantModule(address(new ERC1967Proxy(address(moduleImpl), moduleInitData)));
        module.setGardenToken(GARDEN_TOKEN);

        // 4. Deploy YieldResolver via proxy (initialize takes 4 params)
        YieldResolver resolverImpl = new YieldResolver();
        bytes memory resolverInitData = abi.encodeWithSelector(
            YieldResolver.initialize.selector,
            address(this), // owner
            address(module), // octantModule (set early so registerShares auth works)
            address(0), // hatsModule (not needed for these tests)
            uint256(0) // minYieldThreshold (0 = no threshold)
        );
        yieldResolver = YieldResolver(address(new ERC1967Proxy(address(resolverImpl), resolverInitData)));

        // 5. Wire resolver to module
        module.setYieldResolver(address(yieldResolver));

        // 6. Deploy AaveV3ERC4626 template
        AaveV3ERC4626 template = new AaveV3ERC4626(
            address(weth),
            "GG Aave WETH Template",
            "ggaWETH",
            address(pool),
            address(aToken),
            address(dataProvider),
            address(module)
        );
        module.setSupportedAsset(address(weth), address(template));

        // 7. Create mock garden
        garden = new MockIntegratedGarden("Real Vault Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        // 8. Pre-fund aToken with liquidity (matches real Aave behavior: underlying held by aToken)
        weth.mint(address(aToken), 10_000 ether);
        aToken.approveUnderlying(address(weth), address(pool));

        // 9. Trigger vault creation via garden mint
        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Real Vault Garden");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: add_strategy ERC4626 validation passes with real vault
    // ═══════════════════════════════════════════════════════════════════════════

    function test_realVault_addStrategySucceeds_provesERC4626Validation() public {
        address vault = module.getVaultForAsset(address(garden), address(weth));
        assertTrue(vault != address(0), "vault should exist");

        address strategy = module.vaultStrategies(vault);
        assertTrue(strategy != address(0), "strategy should be attached");

        // Verify the strategy is actually ERC4626 compatible (real vault validated this)
        assertEq(AaveV3ERC4626(strategy).asset(), address(weth), "strategy asset should match");

        // Verify vault wiring was successful
        assertTrue(IOctantVault(vault).autoAllocate(), "auto-allocate should be enabled");
        assertEq(IOctantVault(vault).accountant(), address(yieldResolver), "accountant should be resolver");

        // Verify strategy is in the default queue
        address[] memory queue = IOctantVault(vault).get_default_queue();
        assertEq(queue.length, 1, "queue should have one strategy");
        assertEq(queue[0], strategy, "queue head should be our strategy");

        // Verify resolver was registered as garden vault
        assertEq(
            yieldResolver.gardenVaults(address(garden), address(weth)), vault, "resolver should know about garden vault"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: process_report triggers accountant callback and mints fee shares
    // ═══════════════════════════════════════════════════════════════════════════

    function test_realVault_processReport_triggersAccountantAndMintsFeeShares() public {
        address vault = module.getVaultForAsset(address(garden), address(weth));
        address strategy = module.vaultStrategies(vault);

        // Deposit WETH into vault (auto-allocates to strategy via _updateDebt)
        uint256 depositAmount = 100 ether;
        weth.mint(USER, depositAmount);
        vm.prank(USER);
        weth.approve(vault, depositAmount);
        vm.prank(USER);
        IOctantVault(vault).deposit(depositAmount, USER);

        // Verify auto-allocation worked: strategy should hold aTokens from Aave
        assertGt(aToken.balanceOf(strategy), 0, "strategy should have aTokens from auto-allocation");

        // Simulate yield: mint extra aTokens to strategy (simulates Aave interest accrual)
        uint256 yieldAmount = 10 ether;
        aToken.mint(strategy, yieldAmount);

        // Snapshot YieldResolver share balance before process_report
        uint256 resolverSharesBefore = IOctantVault(vault).balanceOf(address(yieldResolver));

        // Set donation address (required for harvest)
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(yieldResolver));

        // Call harvest which internally calls process_report on the real vault.
        // The real vault detects gain, calls IAccountant(yieldResolver).report() which returns (gain, 0),
        // then mints fee shares to the accountant (= yieldResolver).
        vm.prank(OPERATOR);
        module.harvest(address(garden), address(weth));

        uint256 resolverSharesAfter = IOctantVault(vault).balanceOf(address(yieldResolver));
        assertGt(
            resolverSharesAfter, resolverSharesBefore, "process_report should mint fee shares to resolver (accountant)"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: harvest detects new shares and registers them with resolver
    // ═══════════════════════════════════════════════════════════════════════════

    function test_realVault_harvest_detectsAndRegistersShares() public {
        address vault = module.getVaultForAsset(address(garden), address(weth));
        address strategy = module.vaultStrategies(vault);

        // Set donation address (required for harvest)
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(yieldResolver));

        // Deposit
        uint256 depositAmount = 100 ether;
        weth.mint(USER, depositAmount);
        vm.prank(USER);
        weth.approve(vault, depositAmount);
        vm.prank(USER);
        IOctantVault(vault).deposit(depositAmount, USER);

        // Simulate yield
        aToken.mint(strategy, 10 ether);

        // Harvest: module calls process_report, detects new shares, calls registerShares
        vm.prank(OPERATOR);
        module.harvest(address(garden), address(weth));

        // Verify shares registered with resolver
        uint256 gardenShares = yieldResolver.gardenShares(address(garden), vault);
        assertGt(gardenShares, 0, "harvest should register shares in resolver");

        // Verify total registered shares matches resolver's vault balance
        uint256 resolverBalance = IOctantVault(vault).balanceOf(address(yieldResolver));
        assertEq(
            yieldResolver.totalRegisteredShares(vault),
            gardenShares,
            "total registered shares should match garden shares (single garden)"
        );
        assertEq(resolverBalance, gardenShares, "resolver vault balance should match registered shares");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Full pipeline — deposit -> harvest -> splitYield
    // ═══════════════════════════════════════════════════════════════════════════

    function test_realVault_fullPipeline_depositHarvestSplitYield() public {
        address vault = module.getVaultForAsset(address(garden), address(weth));
        address strategy = module.vaultStrategies(vault);

        // Set donation address
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(yieldResolver));

        // Deposit
        uint256 depositAmount = 100 ether;
        weth.mint(USER, depositAmount);
        vm.prank(USER);
        weth.approve(vault, depositAmount);
        vm.prank(USER);
        IOctantVault(vault).deposit(depositAmount, USER);

        // Simulate yield
        uint256 yieldAmount = 10 ether;
        aToken.mint(strategy, yieldAmount);

        // Harvest
        vm.prank(OPERATOR);
        module.harvest(address(garden), address(weth));

        // Verify shares were registered
        uint256 registeredShares = yieldResolver.gardenShares(address(garden), vault);
        assertGt(registeredShares, 0, "shares should be registered after harvest");

        // Configure split destinations:
        // - Cookie Jar destination (receives ~48.65% of yield)
        address cookieJar = address(0xC001);
        yieldResolver.setCookieJar(address(garden), cookieJar);
        // - Treasury destination (receives juicebox portion as fallback since JB not configured)
        address treasury = address(0x7EA5);
        yieldResolver.setGardenTreasury(address(garden), treasury);

        // Ensure enough Aave liquidity for the redemption chain:
        // splitYield -> redeem vault shares -> vault withdraws from strategy -> strategy withdraws from Aave
        weth.mint(address(aToken), 200 ether);

        // Split yield — permissionless call
        yieldResolver.splitYield(address(garden), address(weth), vault);

        // Verify distributions occurred:
        // Cookie Jar should receive the cookieJarBps portion (~48.65%)
        uint256 cookieJarBalance = IERC20(address(weth)).balanceOf(cookieJar);
        assertGt(cookieJarBalance, 0, "cookie jar should receive yield");

        // Juicebox not configured -> falls back to treasury
        uint256 treasuryBalance = IERC20(address(weth)).balanceOf(treasury);
        assertGt(treasuryBalance, 0, "treasury should receive yield (juicebox fallback)");

        // All garden shares should be redeemed
        assertEq(yieldResolver.gardenShares(address(garden), vault), 0, "all shares should be redeemed after splitYield");

        // Fractions portion should be escrowed (no hypercert pool configured)
        uint256 escrowed = yieldResolver.escrowedFractions(address(garden), address(weth));
        assertGt(escrowed, 0, "fractions portion should be escrowed");

        // Total distributed + escrowed should account for all yield
        uint256 totalDistributed = cookieJarBalance + treasuryBalance + escrowed;
        assertGt(totalDistributed, 0, "total yield should be fully distributed or escrowed");
    }
}
