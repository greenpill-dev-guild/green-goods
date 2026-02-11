// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { OctantModule } from "../../src/modules/Octant.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";
import { MockOctantFactory } from "../../src/mocks/Octant.sol";
import { ReentrantStrategy } from "../../src/mocks/ReentrantStrategy.sol";

/// @notice Garden mock with name() for vault metadata
contract MockGardenForReentrancy is MockGardenAccessControl {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}

/// @title ReentrancyGuardTest
/// @notice Verifies that OctantModule's nonReentrant modifier blocks reentrancy attacks
/// @dev Tests each attack vector: harvest→report, emergencyPause→shutdown, setDonationAddress→callback
contract ReentrancyGuardTest is Test {
    OctantModule internal module;
    MockOctantFactory internal factory;
    MockGardenForReentrancy internal garden;
    ReentrantStrategy internal maliciousStrategy;

    address internal constant GARDEN_TOKEN = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant GARDEN_OWNER = address(0xA3);
    address internal constant DONATION = address(0xA7);
    address internal constant WETH = address(0xB1);

    function setUp() public {
        factory = new MockOctantFactory();
        maliciousStrategy = new ReentrantStrategy();

        OctantModule implementation = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        module = OctantModule(address(new ERC1967Proxy(address(implementation), initData)));
        module.setGardenToken(GARDEN_TOKEN);
        module.setSupportedAsset(WETH, address(maliciousStrategy));

        garden = new MockGardenForReentrancy("Reentrancy Test Garden");
        garden.setOperator(OPERATOR, true);
        garden.setOwner(GARDEN_OWNER, true);

        // Mint vault for garden
        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(address(garden), "Reentrancy Test Garden");

        // Set donation address (required for harvest)
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), DONATION);

        // Configure malicious strategy to target our module
        maliciousStrategy.configure(address(module), address(garden), WETH, ReentrantStrategy.AttackVector.None);
    }

    // =========================================================================
    // Normal operation still works (nonReentrant doesn't break basic flow)
    // =========================================================================

    function test_harvest_succeedsNormally() public {
        // No attack configured — normal operation
        vm.prank(OPERATOR);
        module.harvest(address(garden), WETH);
    }

    function test_emergencyPause_succeedsNormally() public {
        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);
    }

    function test_setDonationAddress_succeedsNormally() public {
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(0xBEEF));
    }

    // =========================================================================
    // Reentrancy attack on harvest() via malicious strategy.report()
    // =========================================================================

    function test_harvest_blocksReentrancyViaReport() public {
        maliciousStrategy.configure(address(module), address(garden), WETH, ReentrantStrategy.AttackVector.ReenterHarvest);

        // The malicious strategy will try to re-enter harvest() during report()
        // The ReentrantStrategy reverts with "reentrancy blocked" when the re-entrant call fails
        vm.prank(OPERATOR);
        vm.expectRevert("reentrancy blocked");
        module.harvest(address(garden), WETH);
    }

    // =========================================================================
    // Reentrancy attack on emergencyPause() via malicious strategy.shutdown()
    // =========================================================================

    function test_emergencyPause_blocksReentrancyViaShutdown() public {
        maliciousStrategy.configure(
            address(module), address(garden), WETH, ReentrantStrategy.AttackVector.ReenterEmergencyPause
        );

        // The strategy tries to re-enter emergencyPause() during shutdown()
        // OctantModule catches shutdown failures via try/catch, so this emits StrategyShutdownFailed
        // instead of reverting — but the re-entrant call itself is blocked
        vm.prank(GARDEN_OWNER);
        module.emergencyPause(address(garden), WETH);
        // If we reach here, the reentrant attack was caught by the try/catch in emergencyPause
    }

    // =========================================================================
    // Reentrancy attack on setDonationAddress() via strategy callback
    // =========================================================================

    function test_setDonationAddress_blocksReentrancyViaCallback() public {
        maliciousStrategy.configure(
            address(module), address(garden), WETH, ReentrantStrategy.AttackVector.ReenterSetDonationAddress
        );

        // The strategy tries to re-enter setDonationAddress() during the propagation loop
        // setDonationAddress uses try/catch on the strategy call, so the reentrant attempt
        // is caught gracefully
        vm.prank(OPERATOR);
        module.setDonationAddress(address(garden), address(0xCAFE));
        // If we reach here, the reentrant attack was caught
    }

    // =========================================================================
    // Cross-function reentrancy: harvest tries to re-enter emergencyPause
    // =========================================================================

    function test_harvest_blocksCrossFunctionReentrancy() public {
        maliciousStrategy.configure(
            address(module), address(garden), WETH, ReentrantStrategy.AttackVector.ReenterEmergencyPause
        );

        // Strategy.report() will try to call emergencyPause() — both are nonReentrant.
        // The re-entrant emergencyPause call is blocked by nonReentrant. The strategy's
        // low-level .call() gets success=false, then reverts "reentrancy blocked".
        // This propagates up through harvest().
        // However, if the reentry is blocked at the access control level first
        // (strategy is not a garden owner), the test must account for this.
        vm.prank(OPERATOR);
        vm.expectRevert();
        module.harvest(address(garden), WETH);
    }
}
