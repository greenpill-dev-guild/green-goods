// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import { MockOctantFactory, MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockYDSStrategy } from "../../src/mocks/MockYDSStrategy.sol";

contract MockGardenWithAccess is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

contract OctantModuleTest is Test {
    OctantModule internal module;
    MockOctantFactory internal factory;
    MockGardenWithAccess internal garden;
    MockGardenWithAccess internal garden2;

    MockYDSStrategy internal wethStrategy;
    MockYDSStrategy internal daiStrategy;
    MockYDSStrategy internal usdcStrategy;

    address internal constant GARDEN_TOKEN = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant OPERATOR_2 = address(0xA3);
    address internal constant GARDEN_OWNER = address(0xA4);
    address internal constant GARDEN_OWNER_2 = address(0xA5);
    address internal constant UNAUTHORIZED = address(0xA6);
    address internal constant DONATION_1 = address(0xA7);
    address internal constant DONATION_2 = address(0xA8);

    address internal constant WETH = address(0xB1);
    address internal constant DAI = address(0xB2);
    address internal constant USDC = address(0xB3);

    function setUp() public {
        factory = new MockOctantFactory();
        wethStrategy = new MockYDSStrategy();
        daiStrategy = new MockYDSStrategy();
        usdcStrategy = new MockYDSStrategy();

        OctantModule implementation = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = OctantModule(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);

        garden = new MockGardenWithAccess("Community Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        garden2 = new MockGardenWithAccess("Reserve Garden");
        garden2.setOperator(OPERATOR_2, true);
        garden2.setOwner(GARDEN_OWNER_2, true);
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
        assertEq(MockOctantVault(wethVault).strategy(), address(wethStrategy), "weth strategy should attach");
        assertEq(MockOctantVault(daiVault).strategy(), address(daiStrategy), "dai strategy should attach");
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
        assertEq(wethStrategy.reportCount(), 1, "operator harvest should report");

        vm.prank(GARDEN_OWNER);
        module.harvest(address(garden), WETH);
        assertEq(wethStrategy.reportCount(), 2, "owner harvest should report");

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
        assertTrue(wethStrategy.shutdownTriggered(), "strategy shutdown should be triggered");

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
        module.setSupportedAsset(WETH, address(0));

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.AssetDeactivated.selector, WETH));
        module.createVaultForAsset(address(garden), WETH);
    }

    function test_setSupportedAsset_maintainsArrayWithoutDuplicates() public {
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(WETH, address(daiStrategy));
        module.setSupportedAsset(WETH, address(0));

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

        // Deactivate WETH for new gardens.
        module.setSupportedAsset(WETH, address(0));

        vm.prank(OPERATOR_2);
        vm.expectRevert(abi.encodeWithSelector(OctantModule.AssetDeactivated.selector, WETH));
        module.createVaultForAsset(address(garden2), WETH);

        // Existing garden should still be harvestable.
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        assertEq(wethStrategy.reportCount(), 1, "existing vault should still report");
    }

    function test_setDonationAddress_updatesStrategiesForExistingVaults() public {
        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(DAI, address(daiStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Community Garden");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_1);

        assertEq(module.gardenDonationAddresses(address(garden)), DONATION_1, "module mapping should update");
        assertEq(wethStrategy.donationAddress(), DONATION_1, "weth strategy should receive donation update");
        assertEq(daiStrategy.donationAddress(), DONATION_1, "dai strategy should receive donation update");

        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION_2);

        assertEq(wethStrategy.donationAddress(), DONATION_2, "weth donation should update");
        assertEq(daiStrategy.donationAddress(), DONATION_2, "dai donation should update");
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
        address newFactory = address(0xF1);

        vm.expectEmit(true, true, false, false);
        emit FactoryUpdated(address(factory), newFactory);

        module.setOctantFactory(newFactory);
        assertEq(address(module.octantFactory()), newFactory, "factory should update");
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
}
