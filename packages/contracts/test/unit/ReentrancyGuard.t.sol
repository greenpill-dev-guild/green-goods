// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import { MockOctantFactory, MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockAavePool, MockAToken, MockPoolDataProvider } from "../../src/mocks/AavePool.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { ReentrantStrategy } from "../../src/mocks/ReentrantStrategy.sol";

/// @notice Garden mock with name() for vault metadata
contract MockGardenForReentrancy is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

/// @notice Test harness that exposes vaultStrategies setter for reentrancy testing
contract ReentrancyModuleHarness is OctantModule {
    function setVaultStrategyForTest(address vault, address strategy) external {
        vaultStrategies[vault] = strategy;
    }
}

/// @title ReentrancyGuardTest
/// @notice Verifies that OctantModule's nonReentrant modifier blocks reentrancy attacks
/// @dev Authorized one-shot callbacks distinguish guard rejection from role failure or recursive out-of-gas.
contract ReentrancyGuardTest is Test {
    ReentrancyModuleHarness internal module;
    MockOctantFactory internal factory;
    MockGardenForReentrancy internal garden;
    ReentrantStrategy internal maliciousStrategy;

    address internal constant GARDEN_TOKEN = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant GARDEN_OWNER = address(0xA3);
    address internal constant DONATION = address(0xA7);

    address internal WETH;

    event HarvestTriggered(address indexed garden, address indexed asset, address indexed caller);
    event EmergencyPaused(address indexed garden, address indexed asset, address indexed caller);
    event DonationAddressUpdated(address indexed garden, address indexed oldAddress, address indexed newAddress);
    event VaultResumed(address indexed garden, address indexed asset, address indexed newStrategy);

    function setUp() public {
        factory = new MockOctantFactory();
        maliciousStrategy = new ReentrantStrategy();

        ReentrancyModuleHarness implementation = new ReentrancyModuleHarness();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = ReentrancyModuleHarness(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);

        // Deploy real ERC20 and AaveV3ERC4626 template strategy so _deployStrategyForVault succeeds
        MockERC20 wethAsset = new MockERC20();
        WETH = address(wethAsset);
        MockAToken aToken = new MockAToken();
        MockAavePool pool = new MockAavePool(address(aToken));
        MockPoolDataProvider dataProvider = new MockPoolDataProvider(address(aToken));
        AaveV3ERC4626 templateStrategy = new AaveV3ERC4626(
            WETH, "GG Aave WETH", "ggaWETH", address(pool), address(aToken), address(dataProvider), address(module)
        );
        module.setSupportedAsset(WETH, address(templateStrategy));

        garden = new MockGardenForReentrancy("Reentrancy Test Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);
        garden.setOperator(address(maliciousStrategy), true);
        garden.setOwner(address(maliciousStrategy), true);

        // Mint vault for garden (deploys a real garden-scoped strategy)
        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Reentrancy Test Garden");

        // Overwrite the vault strategy with the malicious ReentrantStrategy for reentrancy testing
        address vault = module.getVaultForAsset(address(garden), WETH);
        module.setVaultStrategyForTest(vault, address(maliciousStrategy));

        // Set donation address (required for harvest)
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION);

        // Configure malicious strategy to target our module
        maliciousStrategy.configure(address(module), address(garden), WETH, ReentrantStrategy.AttackVector.None);
    }

    function testOctant_harvestCompletesNormally() public {
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        assertEq(maliciousStrategy.reports(), 1);
    }

    function testOctant_emergencyPauseCompletesNormally() public {
        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);
        assertTrue(maliciousStrategy.depositsPaused());
    }

    function testOctant_donationUpdateCompletesNormally() public {
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(0xBEEF));
        assertEq(maliciousStrategy.donationAddress(), address(0xBEEF));
        assertEq(module.gardenDonationAddresses(address(garden)), address(0xBEEF));
    }

    function testOctant_harvestRejectsRecursiveReportAndCompletes() public {
        _configureAttack(ReentrantStrategy.AttackVector.ReenterHarvest);
        vm.expectEmit(true, true, true, true, address(module));
        emit HarvestTriggered(address(garden), WETH, OPERATOR);
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        _assertGuardRejected();
        assertEq(maliciousStrategy.reports(), 1);
        assertEq(module.gardenDonationAddresses(address(garden)), DONATION);
    }

    function testOctant_pauseRejectsRecursiveShutdownAndCompletes() public {
        _configureAttack(ReentrantStrategy.AttackVector.ReenterEmergencyPause);
        vm.expectEmit(true, true, true, true, address(module));
        emit EmergencyPaused(address(garden), WETH, GARDEN_OWNER);
        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);
        _assertGuardRejected();
        assertTrue(maliciousStrategy.depositsPaused());
        assertEq(module.gardenDonationAddresses(address(garden)), DONATION);
    }

    function testOctant_donationRejectsRecursiveUpdateAndCompletes() public {
        _configureAttack(ReentrantStrategy.AttackVector.ReenterSetDonationAddress);
        vm.expectEmit(true, true, true, true, address(module));
        emit DonationAddressUpdated(address(garden), DONATION, address(0xCAFE));
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(0xCAFE));
        _assertGuardRejected();
        assertEq(module.gardenDonationAddresses(address(garden)), address(0xCAFE));
        assertEq(maliciousStrategy.donationAddress(), address(0xCAFE));
    }

    function testOctant_harvestRejectsPauseAndCompletesReport() public {
        _configureAttack(ReentrantStrategy.AttackVector.ReenterEmergencyPause);
        vm.expectEmit(true, true, true, true, address(module));
        emit HarvestTriggered(address(garden), WETH, OPERATOR);
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
        _assertGuardRejected();
        assertEq(maliciousStrategy.reports(), 1);
        assertFalse(maliciousStrategy.depositsPaused());
    }

    function testOctant_resumeRejectsDonationCallbackAndActivatesStrategy() public {
        _configureAttack(ReentrantStrategy.AttackVector.ReenterSetDonationAddress);
        vm.expectEmit(true, true, true, true, address(module));
        emit VaultResumed(address(garden), WETH, address(maliciousStrategy));
        vm.prank(GARDEN_OWNER);
        module.resumeVault(address(garden), WETH, address(maliciousStrategy));
        _assertGuardRejected();
        address vault = module.getVaultForAsset(address(garden), WETH);
        assertEq(module.vaultStrategies(vault), address(maliciousStrategy));
        assertEq(maliciousStrategy.vault(), vault);
        assertTrue(MockOctantVault(vault).activeStrategies(address(maliciousStrategy)));
        assertEq(module.gardenDonationAddresses(address(garden)), DONATION);
        assertEq(maliciousStrategy.donationAddress(), DONATION);
    }

    function testOctant_donationRejectsResumeCallbackAndCompletes() public {
        _configureAttack(ReentrantStrategy.AttackVector.ReenterResumeVault);
        vm.expectEmit(true, true, true, true, address(module));
        emit DonationAddressUpdated(address(garden), DONATION, address(0xCAFE));
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(0xCAFE));
        _assertGuardRejected();
        assertEq(maliciousStrategy.vault(), address(0));
        assertEq(module.gardenDonationAddresses(address(garden)), address(0xCAFE));
        assertEq(maliciousStrategy.donationAddress(), address(0xCAFE));
    }

    function _configureAttack(ReentrantStrategy.AttackVector vector) internal {
        maliciousStrategy.configure(address(module), address(garden), WETH, vector);
    }

    function _assertGuardRejected() internal {
        assertTrue(maliciousStrategy.attempted());
        assertFalse(maliciousStrategy.callbackSucceeded());
        assertEq(
            maliciousStrategy.callbackResult(), abi.encodeWithSignature("Error(string)", "ReentrancyGuard: reentrant call")
        );
    }
}
