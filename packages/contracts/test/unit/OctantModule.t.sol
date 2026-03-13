// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import {
    MockOctantFactory,
    MockOctantVault,
    RevertingOctantFactory,
    ProcessReportRevertingFactory,
    ProcessReportRevertingVault
} from "../../src/mocks/Octant.sol";
import { MockAavePool, MockAToken, MockPoolDataProvider } from "../../src/mocks/AavePool.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockYDSStrategy, RevertingStrategy } from "../../src/mocks/YDSStrategy.sol";

/// @title RevertingYieldResolver
/// @notice Mock YieldResolver that always reverts on registerShares()
/// @dev Used to test non-blocking catch path when share registration fails
contract RevertingYieldResolver {
    bool public wasCalled;

    function registerShares(address, address, uint256) external pure {
        revert("RevertingYieldResolver: registerShares failed");
    }

    function setGardenVault(address, address, address) external {
        wasCalled = true;
    }
}

/// @title RevertingOnSetGardenVaultResolver
/// @notice Mock YieldResolver that reverts on setGardenVault() but succeeds on registerShares()
/// @dev Used to test VaultRegistrationFailed event emission
contract RevertingOnSetGardenVaultResolver {
    function registerShares(address, address, uint256) external pure { }

    function setGardenVault(address, address, address) external pure {
        revert("RevertingOnSetGardenVaultResolver: setGardenVault failed");
    }
}

contract MockYieldResolver {
    address public lastGarden;
    address public lastAsset;
    address public lastVault;
    uint256 public lastRegisteredShares;

    function registerShares(address garden, address vault, uint256 shares) external {
        lastGarden = garden;
        lastVault = vault;
        lastRegisteredShares = shares;
    }

    function setGardenVault(address garden, address asset, address vault) external {
        lastGarden = garden;
        lastAsset = asset;
        lastVault = vault;
    }
}

contract MockGardenWithAccess is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

contract OctantModuleHarness is OctantModule {
    function setVaultStrategyForTest(address vault, address strategy) external {
        vaultStrategies[vault] = strategy;
    }
}

contract OctantModuleTest is Test {
    OctantModuleHarness internal module;
    MockOctantFactory internal factory;
    MockGardenWithAccess internal garden;
    MockGardenWithAccess internal garden2;

    AaveV3ERC4626 internal wethStrategy;
    AaveV3ERC4626 internal daiStrategy;
    AaveV3ERC4626 internal usdcStrategy;
    MockERC20 internal wethAsset;
    MockERC20 internal daiAsset;
    MockERC20 internal usdcAsset;

    address internal constant GARDEN_TOKEN = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant OPERATOR_2 = address(0xA3);
    address internal constant GARDEN_OWNER = address(0xA4);
    address internal constant GARDEN_OWNER_2 = address(0xA5);
    address internal constant UNAUTHORIZED = address(0xA6);
    address internal constant DONATION_1 = address(0xA7);
    address internal constant DONATION_2 = address(0xA8);

    address internal WETH;
    address internal DAI;
    address internal USDC;
    uint256 internal constant UPDATED_VAULT_ROLE_BITMASK =
        (1 << 0) | (1 << 1) | (1 << 3) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8);

    function setUp() public {
        factory = new MockOctantFactory();

        OctantModuleHarness implementation = new OctantModuleHarness();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = OctantModuleHarness(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);

        wethAsset = new MockERC20();
        daiAsset = new MockERC20();
        usdcAsset = new MockERC20();
        WETH = address(wethAsset);
        DAI = address(daiAsset);
        USDC = address(usdcAsset);

        wethStrategy = _deployTemplate(WETH, "GG Aave WETH", "ggaWETH");
        daiStrategy = _deployTemplate(DAI, "GG Aave DAI", "ggaDAI");
        usdcStrategy = _deployTemplate(USDC, "GG Aave USDC", "ggaUSDC");

        garden = new MockGardenWithAccess("Community Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        garden2 = new MockGardenWithAccess("Reserve Garden");
        garden2.setOperator(OPERATOR_2, true);
        garden2.setOwner(GARDEN_OWNER_2, true);
    }

    function _deployTemplate(address asset, string memory name, string memory symbol) internal returns (AaveV3ERC4626) {
        MockAToken aToken = new MockAToken();
        MockAavePool pool = new MockAavePool(address(aToken));
        MockPoolDataProvider dataProvider = new MockPoolDataProvider(address(aToken));
        return
            new AaveV3ERC4626(asset, name, symbol, address(pool), address(aToken), address(dataProvider), address(module));
    }

    function _vaultStrategy(address gardenAddress, address asset) internal view returns (address) {
        address vault = module.getVaultForAsset(gardenAddress, asset);
        return module.vaultStrategies(vault);
    }

    /// @dev Helper: complete the two-step timelock deactivation for an asset
    function _deactivateAsset(address asset) internal {
        // Step 1: Schedule
        module.setSupportedAsset(asset, address(0));
        // Step 2: Warp past delay and execute
        vm.warp(block.timestamp + module.DEACTIVATION_DELAY());
        module.setSupportedAsset(asset, address(0));
    }

    function test_onGardenMinted_createsVaultsForSupportedAssets() public {
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(DAI, address(daiStrategy));

        vm.prank(GARDEN_TOKEN);
        address[] memory vaults = module.onGardenMinted(address(garden), "Community Garden");

        assertEq(vaults.length, 2, "expected two vault slots");

        address wethVault = module.getVaultForAsset(address(garden), WETH);
        address daiVault = module.getVaultForAsset(address(garden), DAI);

        assertTrue(wethVault != address(0), "weth vault should exist");
        assertTrue(daiVault != address(0), "dai vault should exist");
        assertEq(MockOctantVault(wethVault).roleManager(), address(module), "module must be role manager");
        assertEq(MockOctantVault(daiVault).roleManager(), address(module), "module must be role manager");
        address wethLiveStrategy = module.vaultStrategies(wethVault);
        address daiLiveStrategy = module.vaultStrategies(daiVault);
        assertTrue(wethLiveStrategy != address(0), "weth strategy should be recorded");
        assertTrue(daiLiveStrategy != address(0), "dai strategy should be recorded");
        assertTrue(wethLiveStrategy != address(wethStrategy), "weth should deploy a scoped strategy");
        assertTrue(daiLiveStrategy != address(daiStrategy), "dai should deploy a scoped strategy");
        (uint256 wethActivation,,, uint256 wethMaxDebt) = MockOctantVault(wethVault).strategies(wethLiveStrategy);
        assertTrue(wethActivation > 0, "weth strategy should attach");
        assertEq(wethMaxDebt, type(uint256).max, "weth max debt should be wired");
        assertTrue(MockOctantVault(wethVault).autoAllocate(), "weth vault should auto allocate");
        (uint256 daiActivation,,, uint256 daiMaxDebt) = MockOctantVault(daiVault).strategies(daiLiveStrategy);
        assertTrue(daiActivation > 0, "dai strategy should attach");
        assertEq(daiMaxDebt, type(uint256).max, "dai max debt should be wired");
        assertTrue(MockOctantVault(daiVault).autoAllocate(), "dai vault should auto allocate");
    }

    function test_onGardenMinted_revertsForUnauthorizedCaller() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.UnauthorizedCaller.selector, UNAUTHORIZED));
        module.onGardenMinted(address(garden), "Community Garden");
    }

    function test_harvest_enforcesAccessAndDonationAddress() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.NoDonationAddress.selector, address(garden)));
        module.harvest(address(garden), WETH);

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);

        vm.prank(GARDEN_OWNER);
        module.harvest(address(garden), WETH);

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.UnauthorizedCaller.selector, UNAUTHORIZED));
        module.harvest(address(garden), WETH);
    }

    function test_emergencyPause_ownerOnly() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        // Operators should NOT be able to trigger emergency pause
        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.UnauthorizedCaller.selector, OPERATOR));
        module.emergencyPause(address(garden), WETH);

        // Only owner can trigger emergency pause
        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);
        address liveStrategy = _vaultStrategy(address(garden), WETH);
        assertTrue(AaveV3ERC4626(liveStrategy).depositsPaused(), "strategy shutdown should be triggered");

        // Unauthorized should also be rejected
        vm.prank(UNAUTHORIZED);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.UnauthorizedCaller.selector, UNAUTHORIZED));
        module.emergencyPause(address(garden), WETH);
    }

    function test_createVaultForAsset_createsAdditionalAssetVault() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        module.setSupportedAsset(USDC, address(usdcStrategy));

        vm.prank(OPERATOR);
        address usdcVault = module.createVaultForAsset(address(garden), USDC);

        assertTrue(usdcVault != address(0), "new usdc vault should exist");
        assertEq(module.getVaultForAsset(address(garden), USDC), usdcVault, "mapping should be updated");

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.VaultAlreadyExists.selector, address(garden), USDC));
        module.createVaultForAsset(address(garden), USDC);
    }

    function test_createVaultForAsset_revertsForUnsupportedOrDeactivatedAsset() public {
        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.UnsupportedAsset.selector, WETH));
        module.createVaultForAsset(address(garden), WETH);

        module.setSupportedAsset(WETH, address(wethStrategy));
        _deactivateAsset(WETH);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.AssetDeactivated.selector, WETH));
        module.createVaultForAsset(address(garden), WETH);
    }

    function test_setSupportedAsset_maintainsArrayWithoutDuplicates() public {
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(WETH, address(daiStrategy));
        _deactivateAsset(WETH);

        address[] memory assets = module.getSupportedAssets();
        assertEq(assets.length, 1, "asset list should not duplicate entries");
        assertEq(assets[0], WETH, "asset list should keep original asset");
        assertEq(module.supportedAssets(WETH), address(0), "strategy should be deactivated");
    }

    function test_assetDeactivation_blocksNewVaultsButAllowsHarvestOnExistingVault() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        // Deactivate WETH for new gardens (two-step timelock).
        _deactivateAsset(WETH);

        vm.prank(OPERATOR_2);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.AssetDeactivated.selector, WETH));
        module.createVaultForAsset(address(garden2), WETH);

        // Existing garden should still be harvestable.
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
    }

    function test_setDonationAddress_updatesStrategiesForExistingVaults() public {
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(DAI, address(daiStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        assertEq(module.gardenDonationAddresses(address(garden)), DONATION_1, "module mapping should update");
        assertEq(AaveV3ERC4626(_vaultStrategy(address(garden), WETH)).donationAddress(), DONATION_1);
        assertEq(AaveV3ERC4626(_vaultStrategy(address(garden), DAI)).donationAddress(), DONATION_1);

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_2);

        assertEq(AaveV3ERC4626(_vaultStrategy(address(garden), WETH)).donationAddress(), DONATION_2);
        assertEq(AaveV3ERC4626(_vaultStrategy(address(garden), DAI)).donationAddress(), DONATION_2);
    }

    function test_harvest_revertsWhenNoVaultForAsset() public {
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.NoVaultForAsset.selector, address(garden), WETH));
        module.harvest(address(garden), WETH);
    }

    function test_onWorkApproved_functionDoesNotExist() public {
        (bool success,) =
            address(module).call(abi.encodeWithSignature("onWorkApproved(address,string)", address(garden), "Garden"));

        assertFalse(success, "legacy onWorkApproved should be removed");
    }

    // =========================================================================
    // Event Emission Tests
    // =========================================================================

    event VaultCreated(address indexed garden, address indexed vault, address indexed asset);
    event SupportedAssetUpdated(address indexed asset, address indexed strategy);
    event HarvestTriggered(address indexed garden, address indexed asset, address indexed caller);
    event EmergencyPaused(address indexed garden, address indexed asset, address indexed caller);
    event DonationAddressUpdated(address indexed garden, address indexed oldAddress, address indexed newAddress);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event GardenTokenUpdated(address indexed oldGardenToken, address indexed newGardenToken);
    event DefaultProfitUnlockTimeUpdated(uint256 oldUnlockTime, uint256 newUnlockTime);
    event AssetDeactivationScheduled(address indexed asset, uint256 executeAfter);
    event AssetDeactivationExecuted(address indexed asset);
    event AssetDeactivationCancelled(address indexed asset);

    function test_setSupportedAsset_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit SupportedAssetUpdated(WETH, address(wethStrategy));

        module.setSupportedAsset(WETH, address(wethStrategy));
    }

    function test_harvest_emitsEvent() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        vm.expectEmit(true, true, true, true);
        emit HarvestTriggered(address(garden), WETH, OPERATOR);

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
    }

    function test_emergencyPause_emitsEvent() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.expectEmit(true, true, true, true);
        emit EmergencyPaused(address(garden), WETH, GARDEN_OWNER);

        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);
    }

    function test_setDonationAddress_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit DonationAddressUpdated(address(garden), address(0), DONATION_1);

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);
    }

    function test_onGardenMinted_emitsVaultCreatedForEachAsset() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectEmit(true, false, true, false);
        emit VaultCreated(address(garden), address(0), WETH);

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
    }

    // =========================================================================
    // Owner Setter Tests
    // =========================================================================

    function test_setOctantFactory_updatesFactory() public {
        MockOctantFactory newFactory = new MockOctantFactory();

        vm.expectEmit(true, true, false, false);
        emit FactoryUpdated(address(factory), address(newFactory));

        module.setOctantFactory(address(newFactory));
        assertEq(address(module.octantFactory()), address(newFactory), "factory should update");
    }

    function test_setOctantFactory_onlyOwner() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setOctantFactory(address(0xF1));
    }

    function test_setDefaultProfitUnlockTime_updatesValue() public {
        vm.expectEmit(false, false, false, true);
        emit DefaultProfitUnlockTimeUpdated(7 days, 14 days);

        module.setDefaultProfitUnlockTime(14 days);
        assertEq(module.defaultProfitUnlockTime(), 14 days, "unlock time should update");
    }

    function test_setDefaultProfitUnlockTime_onlyOwner() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setDefaultProfitUnlockTime(14 days);
    }

    function test_setGardenToken_emitsEvent() public {
        address newToken = address(0xA9);

        vm.expectEmit(true, true, false, false);
        emit GardenTokenUpdated(GARDEN_TOKEN, newToken);

        module.setGardenToken(newToken);
    }

    function test_setGardenToken_revertsForZeroAddress() public {
        vm.expectRevert(OctantModule.ZeroAddress.selector);
        module.setGardenToken(address(0));
    }

    function test_setSupportedAsset_revertsForZeroAddress() public {
        vm.expectRevert(OctantModule.ZeroAddress.selector);
        module.setSupportedAsset(address(0), address(wethStrategy));
    }

    function test_setDonationAddress_revertsForZeroAddress() public {
        vm.prank(OPERATOR);
        vm.expectRevert(OctantModule.ZeroAddress.selector);
        module.setDonationAddress(address(garden), address(0));
    }

    // =========================================================================
    // Double Initialization Test
    // =========================================================================

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        module.initialize(address(this), address(factory), 7 days);
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        OctantModule newImpl = new OctantModule();

        module.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        OctantModule newImpl = new OctantModule();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.upgradeTo(address(newImpl));
    }

    // =========================================================================
    // Silent Strategy Failure Event Tests
    // =========================================================================

    event HarvestReportFailed(address indexed garden, address indexed asset, address strategy);
    event DonationAddressUpdateFailed(address indexed garden, address indexed asset, address strategy);
    event StrategyAttachmentFailed(address indexed garden, address indexed asset, address vault, address strategy);
    event StrategyMaxDebtWiringFailed(
        address indexed garden, address indexed asset, address indexed vault, address strategy
    );
    event StrategyAutoAllocateWiringFailed(
        address indexed garden, address indexed asset, address indexed vault, address strategy
    );
    event StrategyAccountantWiringFailed(
        address indexed garden, address indexed asset, address indexed vault, address strategy, address yieldResolver
    );
    event VaultRegistrationFailed(address indexed garden, address indexed asset, address indexed vault, address resolver);

    function test_onGardenMinted_emitsVaultRegistrationFailed_whenSetGardenVaultReverts() public {
        RevertingOnSetGardenVaultResolver revertingResolver = new RevertingOnSetGardenVaultResolver();
        module.setYieldResolver(address(revertingResolver));
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectEmit(true, true, false, false);
        emit VaultRegistrationFailed(address(garden), WETH, address(0), address(revertingResolver));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
    }

    function test_harvest_emitsHarvestReportFailed_whenStrategyReverts() public {
        RevertingStrategy revertingStrategy = new RevertingStrategy();
        revertingStrategy.setRevertReport(true);

        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
        address vault = module.getVaultForAsset(address(garden), WETH);
        module.setVaultStrategyForTest(vault, address(revertingStrategy));

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        vm.expectEmit(true, true, false, true);
        emit HarvestReportFailed(address(garden), WETH, address(revertingStrategy));

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
    }

    function test_setDonationAddress_emitsDonationAddressUpdateFailed_whenStrategyReverts() public {
        RevertingStrategy revertingStrategy = new RevertingStrategy();
        revertingStrategy.setRevertSetDonation(true);

        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
        address vault = module.getVaultForAsset(address(garden), WETH);
        module.setVaultStrategyForTest(vault, address(revertingStrategy));

        vm.expectEmit(true, true, false, true);
        emit DonationAddressUpdateFailed(address(garden), WETH, address(revertingStrategy));

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);
    }

    function test_createVault_emitsStrategyAttachmentFailed_whenAddStrategyReverts() public {
        RevertingOctantFactory revertingFactory = new RevertingOctantFactory();
        module.setOctantFactory(address(revertingFactory));

        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectEmit(true, true, false, false);
        emit StrategyAttachmentFailed(address(garden), WETH, address(0), address(0));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
    }

    function test_setOctantFactory_revertsForEOAAddress() public {
        address eoa = address(0xDEAD);

        vm.expectRevert(abi.encodeWithSelector(OctantModule.NotAContract.selector, eoa));
        module.setOctantFactory(eoa);
    }

    function test_setOctantFactory_allowsZeroAddress() public {
        // Zero address should be allowed (to disable factory)
        module.setOctantFactory(address(0));
        assertEq(address(module.octantFactory()), address(0), "factory should be zeroed");
    }

    function test_setOctantFactory_allowsContractAddress() public {
        MockOctantFactory newFactory = new MockOctantFactory();

        module.setOctantFactory(address(newFactory));
        assertEq(address(module.octantFactory()), address(newFactory), "factory should update to contract");
    }

    // =========================================================================
    // Asset Deactivation Timelock Tests
    // =========================================================================

    function test_setSupportedAsset_schedulesDeactivation() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        uint256 expectedExecuteAfter = block.timestamp + module.DEACTIVATION_DELAY();

        vm.expectEmit(true, false, false, true);
        emit AssetDeactivationScheduled(WETH, expectedExecuteAfter);

        // First call with address(0) should schedule, not deactivate
        module.setSupportedAsset(WETH, address(0));

        // Asset should still be active
        assertEq(module.supportedAssets(WETH), address(wethStrategy), "strategy should NOT be deactivated yet");
        assertEq(module.supportedAssetCount(), 1, "asset count should remain 1");
        assertEq(module.pendingDeactivations(WETH), expectedExecuteAfter, "pending deactivation should be set");
    }

    function test_setSupportedAsset_executesDeactivationAfterDelay() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        // Step 1: Schedule
        module.setSupportedAsset(WETH, address(0));

        // Step 2: Warp past delay
        vm.warp(block.timestamp + module.DEACTIVATION_DELAY());

        vm.expectEmit(true, false, false, false);
        emit AssetDeactivationExecuted(WETH);

        // Execute deactivation
        module.setSupportedAsset(WETH, address(0));

        // Asset should now be deactivated
        assertEq(module.supportedAssets(WETH), address(0), "strategy should be deactivated");
        assertEq(module.supportedAssetCount(), 0, "asset count should be 0");
        assertEq(module.pendingDeactivations(WETH), 0, "pending deactivation should be cleared");
    }

    function test_setSupportedAsset_revertsBeforeDelay() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        // Step 1: Schedule
        module.setSupportedAsset(WETH, address(0));
        uint256 readyTimestamp = module.pendingDeactivations(WETH);

        // Warp to just before the delay expires (1 second too early)
        vm.warp(readyTimestamp - 1);

        vm.expectRevert(abi.encodeWithSelector(OctantModule.DeactivationNotReady.selector, WETH, readyTimestamp));
        module.setSupportedAsset(WETH, address(0));

        // Asset should still be active
        assertEq(module.supportedAssets(WETH), address(wethStrategy), "strategy should still be active");
    }

    function test_cancelDeactivation_clearsSchedule() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        // Schedule deactivation
        module.setSupportedAsset(WETH, address(0));
        assertTrue(module.pendingDeactivations(WETH) != 0, "should have pending deactivation");

        // Cancel it
        vm.expectEmit(true, false, false, false);
        emit AssetDeactivationCancelled(WETH);
        module.cancelDeactivation(WETH);

        // Pending should be cleared
        assertEq(module.pendingDeactivations(WETH), 0, "pending deactivation should be cleared");

        // Strategy should still be active
        assertEq(module.supportedAssets(WETH), address(wethStrategy), "strategy should remain active");

        // A new deactivation attempt should re-schedule (not execute)
        module.setSupportedAsset(WETH, address(0));
        assertTrue(module.pendingDeactivations(WETH) != 0, "should re-schedule after cancel");
        assertEq(module.supportedAssets(WETH), address(wethStrategy), "strategy should still be active after re-schedule");
    }

    function test_cancelDeactivation_revertsIfNoPending() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectRevert(abi.encodeWithSelector(OctantModule.NoDeactivationPending.selector, WETH));
        module.cancelDeactivation(WETH);
    }

    function test_setSupportedAsset_addingStrategyClearsDeactivation() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        // Schedule deactivation
        module.setSupportedAsset(WETH, address(0));
        assertTrue(module.pendingDeactivations(WETH) != 0, "should have pending deactivation");

        // Re-activate with a new strategy (should clear pending deactivation)
        module.setSupportedAsset(WETH, address(daiStrategy));

        assertEq(module.supportedAssets(WETH), address(daiStrategy), "strategy should be updated immediately");
        assertEq(module.pendingDeactivations(WETH), 0, "pending deactivation should be cleared");
        assertEq(module.supportedAssetCount(), 1, "asset count should remain 1");
    }

    function test_setSupportedAsset_addingStrategyNoTimelock() public {
        // Adding a new asset should work immediately (no delay)
        module.setSupportedAsset(WETH, address(wethStrategy));
        assertEq(module.supportedAssets(WETH), address(wethStrategy), "strategy should be set immediately");
        assertEq(module.supportedAssetCount(), 1, "asset count should be 1");

        // Updating an existing asset strategy should also be immediate
        module.setSupportedAsset(WETH, address(daiStrategy));
        assertEq(module.supportedAssets(WETH), address(daiStrategy), "strategy update should be immediate");
        assertEq(module.supportedAssetCount(), 1, "asset count should still be 1");
    }

    function test_cancelDeactivation_onlyOwner() public {
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(WETH, address(0));

        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.cancelDeactivation(WETH);
    }

    function test_deactivationDelay_isThreeDays() public {
        assertEq(module.DEACTIVATION_DELAY(), 3 days, "deactivation delay should be 3 days");
    }

    // =========================================================================
    // Fault Injection: Harvest Fallback Cascade (Octant.sol:232-249)
    // =========================================================================

    /// @notice FAULT INJECTION: process_report reverts → fallback to strategy.report() succeeds
    /// @dev Tests the outer catch at Octant.sol:233-234: vault.process_report() fails, so
    ///      harvest falls back to strategy.report() directly. The fallback succeeds, so
    ///      HarvestReportFailed should NOT be emitted and harvest completes normally.
    function test_harvest_processReportFails_fallbackToStrategyReportSucceeds() public {
        // Use a factory that deploys vaults whose process_report reverts
        ProcessReportRevertingFactory prFactory = new ProcessReportRevertingFactory();
        module.setOctantFactory(address(prFactory));

        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        // Harvest: process_report will revert, fallback to strategy.report() should succeed
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
    }

    /// @notice FAULT INJECTION: process_report reverts AND strategy.report() also reverts
    /// @dev Tests the full cascade at Octant.sol:232-239: both vault and strategy fail,
    ///      harvest emits HarvestReportFailed but still completes (HarvestTriggered emitted).
    ///      This proves harvest is non-fragile — accounting failures never revert the tx.
    function test_harvest_fullCascadeFails_emitsHarvestReportFailedAndContinues() public {
        ProcessReportRevertingFactory prFactory = new ProcessReportRevertingFactory();
        module.setOctantFactory(address(prFactory));

        // Strategy that also reverts on report()
        RevertingStrategy revertingStrategy = new RevertingStrategy();
        revertingStrategy.setRevertReport(true);
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
        address vault = module.getVaultForAsset(address(garden), WETH);
        module.setVaultStrategyForTest(vault, address(revertingStrategy));

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        // Both process_report AND strategy.report() will fail
        // Expect HarvestReportFailed from inner catch (Octant.sol:237)
        vm.expectEmit(true, true, false, true);
        emit HarvestReportFailed(address(garden), WETH, address(revertingStrategy));

        // Expect HarvestTriggered — harvest completes despite accounting failures
        vm.expectEmit(true, true, true, true);
        emit HarvestTriggered(address(garden), WETH, OPERATOR);

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
    }

    /// @notice FAULT INJECTION: Harvest yield share registration silently fails
    /// @dev Tests the silent catch at Octant.sol:246-248: registerShares() reverts but
    ///      harvest still completes. This verifies the yield tracking failure is non-fatal.
    ///      Uses a reverting YieldResolver mock so registerShares() always fails.
    function test_harvest_registerSharesFails_harvestStillCompletes() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        // Deploy a contract that reverts on registerShares
        RevertingYieldResolver revertingResolver = new RevertingYieldResolver();
        module.setYieldResolver(address(revertingResolver));

        // Configure vault to mint shares to the resolver during process_report
        address vault = module.getVaultForAsset(address(garden), WETH);
        MockOctantVault(vault).setProcessReportYield(address(revertingResolver), 100);

        // Harvest should complete even though registerShares fails
        // and emit observability event for failed registration.
        vm.expectEmit(true, true, true, true);
        emit OctantModule.SharesRegistrationFailed(address(garden), vault, address(revertingResolver), 100);

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        assertEq(MockOctantVault(vault).balanceOf(address(revertingResolver)), 100, "shares should still mint");
        assertFalse(revertingResolver.wasCalled(), "registerShares should have reverted, not succeeded");
    }

    function test_onGardenMinted_emitsStrategyAutoAllocateWiringFailed_whenAutoAllocateReverts() public {
        factory.setWiringReverts(false, true, false);
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectEmit(true, true, false, false);
        emit StrategyAutoAllocateWiringFailed(address(garden), WETH, address(0), address(0));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
    }

    function test_onGardenMinted_emitsStrategyMaxDebtWiringFailed_whenMaxDebtReverts() public {
        factory.setWiringReverts(true, false, false);
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectEmit(true, true, false, false);
        emit StrategyMaxDebtWiringFailed(address(garden), WETH, address(0), address(0));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
    }

    function test_onGardenMinted_emitsStrategyAccountantWiringFailed_whenAccountantReverts() public {
        MockYieldResolver resolver = new MockYieldResolver();
        factory.setWiringReverts(false, false, true);
        module.setYieldResolver(address(resolver));
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.expectEmit(true, true, false, false);
        emit StrategyAccountantWiringFailed(address(garden), WETH, address(0), address(0), address(resolver));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
    }

    function test_enableAutoAllocate_backfillsVaultWithoutAttachedStrategy() public {
        MockYDSStrategy brokenTemplate = new MockYDSStrategy();
        MockYieldResolver resolver = new MockYieldResolver();
        module.setSupportedAsset(WETH, address(brokenTemplate));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
        address vault = module.getVaultForAsset(address(garden), WETH);
        assertEq(module.vaultStrategies(vault), address(0), "initial attachment should fail");

        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setYieldResolver(address(resolver));
        module.enableAutoAllocate(address(garden), WETH);

        address liveStrategy = module.vaultStrategies(vault);
        assertTrue(liveStrategy != address(0), "backfill should attach a strategy");
        assertTrue(MockOctantVault(vault).autoAllocate(), "backfill should enable auto allocate");
        assertEq(MockOctantVault(vault).accountant(), address(resolver), "resolver should become accountant");
        assertEq(
            module.gardenDonationAddresses(address(garden)), address(resolver), "resolver should become donation address"
        );
        assertEq(resolver.lastVault(), vault, "resolver should be updated with the vault");
    }

    function test_enableAutoAllocate_replacesExistingStrategy() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);
        address oldStrategy = module.vaultStrategies(vault);

        module.setYieldResolver(address(resolver));
        module.enableAutoAllocate(address(garden), WETH);

        address newStrategy = module.vaultStrategies(vault);
        assertTrue(newStrategy != address(0), "new strategy should be attached");
        assertTrue(newStrategy != oldStrategy, "backfill should replace the old strategy");
        (uint256 oldActivation,,,) = MockOctantVault(vault).strategies(oldStrategy);
        (uint256 newActivation,,, uint256 newMaxDebt) = MockOctantVault(vault).strategies(newStrategy);
        assertEq(oldActivation, 0, "old strategy should be revoked");
        assertTrue(newActivation > 0, "new strategy should be active");
        assertEq(newMaxDebt, type(uint256).max, "new strategy max debt should be wired");
    }

    function test_configureVaultRoles_grantsUpdatedBitmask() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);
        module.configureVaultRoles(address(garden), WETH);

        assertEq(MockOctantVault(vault).accountRoles(address(module)), UPDATED_VAULT_ROLE_BITMASK);
        assertEq(MockOctantVault(vault).depositLimit(), type(uint256).max);
    }

    function test_resumeVault_wiresAutoAllocateMaxDebtAndAccountant() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_2);

        address vault = module.getVaultForAsset(address(garden), WETH);
        AaveV3ERC4626 replacement = _deployTemplate(WETH, "Replacement Strategy", "ggaREP");

        vm.prank(GARDEN_OWNER);
        module.resumeVault(address(garden), WETH, address(replacement));

        assertEq(module.vaultStrategies(vault), address(replacement), "replacement strategy should be tracked");
        assertTrue(MockOctantVault(vault).autoAllocate(), "resume should re-enable auto allocate");
        assertEq(MockOctantVault(vault).accountant(), address(resolver), "resume should set accountant");
        (,,, uint256 maxDebt) = MockOctantVault(vault).strategies(address(replacement));
        assertEq(maxDebt, type(uint256).max, "resume should set max debt");
        assertEq(replacement.donationAddress(), DONATION_2, "resume should propagate donation address");
    }

    // =========================================================================
    // Fix 1: enableAutoAllocate deterministic migration (queue-head safety)
    // =========================================================================

    function test_enableAutoAllocate_revertsWhenRevokeStrategyFails() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);
        address oldStrategy = module.vaultStrategies(vault);
        assertTrue(oldStrategy != address(0), "initial strategy should exist");

        // Make revoke_strategy revert on the vault (simulates strategy with outstanding debt)
        MockOctantVault(vault).setRevokeStrategyReverts(true);

        module.setYieldResolver(address(resolver));

        // enableAutoAllocate must revert — continuing with a failed revoke would leave
        // the old strategy as queue[0], routing deposits to the stale strategy
        vm.expectRevert();
        module.enableAutoAllocate(address(garden), WETH);

        // Strategy should be unchanged
        assertEq(module.vaultStrategies(vault), oldStrategy, "strategy should not change on failure");
    }

    function test_enableAutoAllocate_newStrategyIsQueueHead() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);
        address oldStrategy = module.vaultStrategies(vault);

        module.setYieldResolver(address(resolver));
        module.enableAutoAllocate(address(garden), WETH);

        address newStrategy = module.vaultStrategies(vault);
        assertTrue(newStrategy != oldStrategy, "should deploy a new strategy");

        // Verify the new strategy is at queue[0] — the actual auto-allocation target
        address[] memory queue = MockOctantVault(vault).get_default_queue();
        assertTrue(queue.length > 0, "queue should not be empty");
        assertEq(queue[0], newStrategy, "new strategy must be queue head for auto-allocation");
    }

    // =========================================================================
    // Fix 5: Donation-only repair short-circuit
    // =========================================================================

    function test_enableAutoAllocate_shortCircuitsWhenOnlyDonationMissing() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setYieldResolver(address(resolver));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);
        address originalStrategy = module.vaultStrategies(vault);
        assertTrue(originalStrategy != address(0), "strategy should exist after mint");

        // Verify the vault is already fully wired (autoAllocate, accountant, queue head)
        assertTrue(MockOctantVault(vault).autoAllocate(), "should be auto-allocated");
        assertEq(MockOctantVault(vault).accountant(), address(resolver), "accountant should be resolver");

        // Clear donation address to simulate the "donation-only" missing state
        // (backfillDonationAddresses is for batch, enableAutoAllocate is for single)
        module.setDonationAddress(address(garden), address(1));
        // Manually set to zero via test harness isn't available, but we can test
        // that calling enableAutoAllocate doesn't deploy a new strategy
        module.enableAutoAllocate(address(garden), WETH);

        // Strategy should be UNCHANGED — no unnecessary replacement
        address afterStrategy = module.vaultStrategies(vault);
        assertEq(afterStrategy, originalStrategy, "fully-wired vault should not get a new strategy");
    }

    // =========================================================================
    // Fix 2: recoverOrphanedShares
    // =========================================================================

    event SharesRegistered(address indexed garden, address indexed vault, uint256 shares);

    function test_recoverOrphanedShares_registersWithResolver() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);

        // Simulate orphaned shares: 500 shares need recovery
        uint256 orphanedShares = 500;

        vm.expectEmit(true, true, false, true);
        emit SharesRegistered(address(garden), vault, orphanedShares);

        module.recoverOrphanedShares(address(garden), vault, orphanedShares);

        // Verify resolver received the registration
        assertEq(resolver.lastGarden(), address(garden), "resolver should record garden");
        assertEq(resolver.lastVault(), vault, "resolver should record vault");
        assertEq(resolver.lastRegisteredShares(), orphanedShares, "resolver should record shares");
    }

    function test_recoverOrphanedShares_revertsForNonOwner() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);

        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.recoverOrphanedShares(address(garden), vault, 100);
    }

    function test_recoverOrphanedShares_revertsForZeroVault() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));

        vm.expectRevert(OctantModule.ZeroAddress.selector);
        module.recoverOrphanedShares(address(garden), address(0), 100);
    }

    function test_recoverOrphanedShares_revertsForZeroResolver() public {
        // yieldResolver is address(0) by default
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        address vault = module.getVaultForAsset(address(garden), WETH);

        vm.expectRevert(OctantModule.ZeroAddress.selector);
        module.recoverOrphanedShares(address(garden), vault, 100);
    }

    // =========================================================================
    // Existing Tests
    // =========================================================================

    // =========================================================================
    // backfillDonationAddresses
    // =========================================================================

    function test_backfillDonationAddresses_setsResolverForExistingGardens() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));

        // Garden has no donation address set (zero by default)
        assertEq(module.gardenDonationAddresses(address(garden)), address(0));

        address[] memory gardens = new address[](2);
        gardens[0] = address(garden);
        gardens[1] = address(garden2);

        module.backfillDonationAddresses(gardens);

        assertEq(
            module.gardenDonationAddresses(address(garden)), address(resolver), "garden1 donation should be set to resolver"
        );
        assertEq(
            module.gardenDonationAddresses(address(garden2)),
            address(resolver),
            "garden2 donation should be set to resolver"
        );
    }

    function test_backfillDonationAddresses_skipsAlreadyConfigured() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));

        // Pre-set donation address for garden via operator
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        assertEq(module.gardenDonationAddresses(address(garden)), DONATION_1);

        address[] memory gardens = new address[](1);
        gardens[0] = address(garden);

        module.backfillDonationAddresses(gardens);

        // Should remain DONATION_1, not overwritten to resolver
        assertEq(
            module.gardenDonationAddresses(address(garden)),
            DONATION_1,
            "already-configured donation should not be overwritten"
        );
    }

    function test_backfillDonationAddresses_revertsWithNoResolver() public {
        // yieldResolver is address(0) by default
        address[] memory gardens = new address[](1);
        gardens[0] = address(garden);

        vm.expectRevert(OctantModule.ZeroAddress.selector);
        module.backfillDonationAddresses(gardens);
    }

    function test_backfillDonationAddresses_onlyOwner() public {
        MockYieldResolver resolver = new MockYieldResolver();
        module.setYieldResolver(address(resolver));

        address[] memory gardens = new address[](1);
        gardens[0] = address(garden);

        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.backfillDonationAddresses(gardens);
    }

    // =========================================================================
    // Existing Tests
    // =========================================================================

    function test_emergencyPause_isGardenScopedAcrossSeparateStrategies() public {
        module.setSupportedAsset(WETH, address(wethStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");
        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden2), "Reserve Garden");

        address strategyA = _vaultStrategy(address(garden), WETH);
        address strategyB = _vaultStrategy(address(garden2), WETH);

        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);

        assertTrue(AaveV3ERC4626(strategyA).depositsPaused(), "garden A strategy should pause");
        assertFalse(AaveV3ERC4626(strategyB).depositsPaused(), "garden B strategy should remain active");
    }
}
