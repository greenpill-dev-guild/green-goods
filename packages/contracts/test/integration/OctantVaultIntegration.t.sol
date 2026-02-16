// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import { MockOctantFactory, MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockYDSStrategy } from "../../src/mocks/YDSStrategy.sol";

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

    MockYDSStrategy internal wethStrategy;
    MockYDSStrategy internal daiStrategy;

    address internal constant GARDEN_TOKEN = address(0xD1);
    address internal constant OPERATOR = address(0xD2);
    address internal constant GARDEN_OWNER = address(0xD3);
    address internal constant DONATION_ADDRESS = address(0xD4);
    address internal constant USER = address(0xD5);

    address internal constant WETH = address(0xE1);
    address internal constant DAI = address(0xE2);

    function setUp() public {
        factory = new MockOctantFactory();
        wethStrategy = new MockYDSStrategy();
        daiStrategy = new MockYDSStrategy();

        OctantModule implementation = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = OctantModule(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);

        garden = new MockIntegratedGarden("Integration Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        module.setSupportedAsset(WETH, address(wethStrategy));
        module.setSupportedAsset(DAI, address(daiStrategy));

        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Integration Garden");
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
        assertEq(wethStrategy.donationAddress(), DONATION_ADDRESS, "strategy should receive donation address");

        wethStrategy.simulateYield(25 ether);

        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        assertEq(wethStrategy.reportCount(), 1, "harvest should trigger report");

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
        MockOctantVault wethVault = MockOctantVault(module.getVaultForAsset(address(garden), WETH));

        vm.prank(USER);
        wethVault.deposit(30 ether, USER);

        vm.expectEmit(true, true, true, true);
        emit EmergencyPaused(address(garden), WETH, GARDEN_OWNER);

        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);

        assertEq(wethVault.balanceOf(USER), 30 ether, "shares should remain with user");
        assertTrue(wethStrategy.shutdownTriggered(), "strategy shutdown should be signaled");
    }
}
