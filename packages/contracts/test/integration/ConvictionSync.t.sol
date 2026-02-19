// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { ICVSyncPowerFacet } from "../../src/interfaces/ICVSyncPowerFacet.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

/// @notice Mock strategy that successfully handles syncPower calls
contract MockStrategy is ICVSyncPowerFacet {
    address[] public syncedMembers;

    function syncPower(address member) external override {
        syncedMembers.push(member);
    }

    function batchSyncPower(address[] calldata members) external override {
        for (uint256 i = 0; i < members.length; i++) {
            syncedMembers.push(members[i]);
        }
    }

    function syncedCount() external view returns (uint256) {
        return syncedMembers.length;
    }
}

/// @notice Mock strategy that always reverts on syncPower
contract RevertingStrategy is ICVSyncPowerFacet {
    function syncPower(address) external pure override {
        revert("strategy unavailable");
    }

    function batchSyncPower(address[] calldata) external pure override {
        revert("strategy unavailable");
    }
}

/// @notice Mock strategy that reverts without a reason string (raw revert)
contract RawRevertingStrategy is ICVSyncPowerFacet {
    function syncPower(address) external pure override {
        // solhint-disable-next-line reason-string
        revert();
    }

    function batchSyncPower(address[] calldata) external pure override {
        // solhint-disable-next-line reason-string
        revert();
    }
}

/// @notice Mock strategy that attempts reentrancy by calling revokeRole from syncPower
contract ReentrantStrategy is ICVSyncPowerFacet {
    HatsModule public target;
    address public targetGarden;
    address public targetAccount;
    IHatsModule.GardenRole public targetRole;
    bool public reentrancyAttempted;

    function setReentrancyTarget(
        address _target,
        address _garden,
        address _account,
        IHatsModule.GardenRole _role
    )
        external
    {
        target = HatsModule(_target);
        targetGarden = _garden;
        targetAccount = _account;
        targetRole = _role;
    }

    function syncPower(address) external override {
        reentrancyAttempted = true;
        // Attempt reentrant call back into revokeRole
        target.revokeRole(targetGarden, targetAccount, targetRole);
    }

    function batchSyncPower(address[] calldata) external override { }
}

/// @notice Mock strategy that attempts reentrancy with sufficient gas to reach the nonReentrant guard
/// @dev Unlike ReentrantStrategy (which is starved by the 100k gas stipend), this contract
///      catches the revert to prove that nonReentrant independently blocks reentry.
contract ReentrantStrategyWithGas is ICVSyncPowerFacet {
    HatsModule public target;
    address public targetGarden;
    address public targetAccount;
    IHatsModule.GardenRole public targetRole;
    bool public reentrancyAttempted;
    bool public reentrancyReverted;

    function setReentrancyTarget(
        address _target,
        address _garden,
        address _account,
        IHatsModule.GardenRole _role
    )
        external
    {
        target = HatsModule(_target);
        targetGarden = _garden;
        targetAccount = _account;
        targetRole = _role;
    }

    function syncPower(address) external override {
        reentrancyAttempted = true;
        // Attempt reentrant call -- the nonReentrant guard should block this
        try target.revokeRole(targetGarden, targetAccount, targetRole) {
            // If this succeeds, reentrancy guard is broken
        } catch {
            // Expected: nonReentrant should revert the reentrant call
            reentrancyReverted = true;
        }
    }

    function batchSyncPower(address[] calldata) external override { }
}

/// @notice Mock strategy that consumes ~70-80k gas via storage writes without reverting
/// @dev Used to test that revocation completes successfully even with a gas-hungry strategy
///      that comes close to the SYNC_POWER_GAS_STIPEND (100k) limit. We use 2 cold SSTORE
///      writes (~20k each) plus a dynamic array push (~22k cold) plus computation to stay
///      under 100k total.
contract GasGuzzlerStrategy is ICVSyncPowerFacet {
    uint256 public lastMember;
    address[] public syncedMembers;

    function syncPower(address member) external override {
        // 2 cold SSTORE writes + array push = ~62k gas, plus overhead stays under 100k
        lastMember = uint256(uint160(member));
        syncedMembers.push(member);
    }

    function batchSyncPower(address[] calldata) external override { }

    function syncedCount() external view returns (uint256) {
        return syncedMembers.length;
    }
}

/// @notice A valid contract that does NOT implement ICVSyncPowerFacet
/// @dev Used to test behavior when a non-compliant contract is registered as a strategy
contract NonCompliantContract {
    uint256 public value;

    function setValue(uint256 _value) external {
        value = _value;
    }
}

/// @title ConvictionSyncTest
/// @notice Tests for conviction power sync triggered by HatsModule role revocation
contract ConvictionSyncTest is Test {
    HatsModule public adapter;
    MockHats public mockHats;
    MockStrategy public strategy1;
    MockStrategy public strategy2;
    RevertingStrategy public revertingStrategy;
    RawRevertingStrategy public rawRevertingStrategy;

    address public owner;
    address public garden1;
    address public user1;
    address public user2;

    // Hat IDs for garden1
    uint256 constant GARDEN1_OWNER_HAT = 1;
    uint256 constant GARDEN1_OPERATOR_HAT = 2;
    uint256 constant GARDEN1_EVALUATOR_HAT = 3;
    uint256 constant GARDEN1_GARDENER_HAT = 4;
    uint256 constant GARDEN1_FUNDER_HAT = 5;
    uint256 constant GARDEN1_COMMUNITY_HAT = 6;

    // Events (must redeclare for vm.expectEmit)
    event ConvictionStrategiesUpdated(address indexed garden, address[] strategies);
    event ConvictionSyncTriggered(address indexed garden, address indexed account, address indexed strategy);
    event ConvictionSyncFailed(address indexed garden, address indexed account, address indexed strategy, string reason);
    event RoleRevoked(address indexed garden, address indexed account, IHatsModule.GardenRole role);

    function setUp() public {
        owner = address(this);
        garden1 = address(0x1000);
        user1 = address(0x3000);
        user2 = address(0x4000);

        // Deploy mock Hats
        mockHats = new MockHats();

        // Deploy adapter with proxy
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, owner, address(mockHats));
        address proxyAddr = address(new ERC1967Proxy(address(impl), initData));
        adapter = HatsModule(proxyAddr);

        // Deploy mock strategies
        strategy1 = new MockStrategy();
        strategy2 = new MockStrategy();
        revertingStrategy = new RevertingStrategy();
        rawRevertingStrategy = new RawRevertingStrategy();

        // Activate hats
        mockHats.setHatActive(GARDEN1_OWNER_HAT, true);
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_EVALUATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN1_FUNDER_HAT, true);
        mockHats.setHatActive(GARDEN1_COMMUNITY_HAT, true);

        // Configure garden1
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        // Owner wears the owner hat (for authorization)
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Strategy Configuration Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setConvictionStrategies_updatesAndEmitsEvent() public {
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategy1);
        strategies[1] = address(strategy2);

        vm.expectEmit(true, false, false, true);
        emit ConvictionStrategiesUpdated(garden1, strategies);

        adapter.setConvictionStrategies(garden1, strategies);

        address[] memory stored = adapter.getConvictionStrategies(garden1);
        assertEq(stored.length, 2, "Should store 2 strategies");
        assertEq(stored[0], address(strategy1), "First strategy should match");
        assertEq(stored[1], address(strategy2), "Second strategy should match");
    }

    function test_setConvictionStrategies_replacesExisting() public {
        // Set initial strategies
        address[] memory initial = new address[](2);
        initial[0] = address(strategy1);
        initial[1] = address(strategy2);
        adapter.setConvictionStrategies(garden1, initial);

        // Replace with single strategy
        address[] memory updated = new address[](1);
        updated[0] = address(strategy2);
        adapter.setConvictionStrategies(garden1, updated);

        address[] memory stored = adapter.getConvictionStrategies(garden1);
        assertEq(stored.length, 1, "Should store 1 strategy");
        assertEq(stored[0], address(strategy2), "Strategy should match");
    }

    function test_setConvictionStrategies_canClearStrategies() public {
        // Set strategies
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);
        adapter.setConvictionStrategies(garden1, strategies);

        // Clear with empty array
        address[] memory empty = new address[](0);
        adapter.setConvictionStrategies(garden1, empty);

        address[] memory stored = adapter.getConvictionStrategies(garden1);
        assertEq(stored.length, 0, "Should have no strategies");
    }

    function test_setConvictionStrategies_revertsForUnauthorized() public {
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, user1, garden1));
        adapter.setConvictionStrategies(garden1, strategies);
    }

    function test_setConvictionStrategies_allowsOperator() public {
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, user1, true);

        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);

        vm.prank(user1);
        adapter.setConvictionStrategies(garden1, strategies);

        address[] memory stored = adapter.getConvictionStrategies(garden1);
        assertEq(stored.length, 1, "Operator should be able to set strategies");
    }

    function test_setConvictionStrategies_allowsGardenSelf() public {
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);

        vm.prank(garden1);
        adapter.setConvictionStrategies(garden1, strategies);

        address[] memory stored = adapter.getConvictionStrategies(garden1);
        assertEq(stored.length, 1, "Garden should be able to set its own strategies");
    }

    function test_getConvictionStrategies_returnsEmptyForUnconfigured() public {
        address unconfiguredGarden = address(0x9999);
        address[] memory stored = adapter.getConvictionStrategies(unconfiguredGarden);
        assertEq(stored.length, 0, "Unconfigured garden should return empty strategies");
    }

    function test_setConvictionStrategies_revertsForTooMany() public {
        uint256 max = adapter.MAX_CONVICTION_STRATEGIES();
        address[] memory strategies = new address[](max + 1);
        for (uint256 i = 0; i < max + 1; i++) {
            // Deploy a real contract for each slot to pass address validation
            strategies[i] = address(new MockStrategy());
        }

        vm.expectRevert(abi.encodeWithSelector(HatsModule.TooManyStrategies.selector, max + 1, max));
        adapter.setConvictionStrategies(garden1, strategies);
    }

    function test_setConvictionStrategies_allowsExactlyMax() public {
        uint256 max = adapter.MAX_CONVICTION_STRATEGIES();
        address[] memory strategies = new address[](max);
        for (uint256 i = 0; i < max; i++) {
            strategies[i] = address(new MockStrategy());
        }

        adapter.setConvictionStrategies(garden1, strategies);
        address[] memory stored = adapter.getConvictionStrategies(garden1);
        assertEq(stored.length, max, "Should accept exactly MAX strategies");
    }

    function test_setConvictionStrategies_revertsForZeroAddress() public {
        address[] memory strategies = new address[](1);
        strategies[0] = address(0);

        vm.expectRevert(abi.encodeWithSelector(HatsModule.InvalidStrategyAddress.selector, address(0)));
        adapter.setConvictionStrategies(garden1, strategies);
    }

    function test_setConvictionStrategies_revertsForEOA() public {
        address[] memory strategies = new address[](1);
        strategies[0] = address(0x1234); // EOA — no code

        vm.expectRevert(abi.encodeWithSelector(HatsModule.InvalidStrategyAddress.selector, address(0x1234)));
        adapter.setConvictionStrategies(garden1, strategies);
    }

    function test_setConvictionStrategies_revertsForUnconfiguredGarden() public {
        address unconfigured = address(0x9999);
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);

        vm.expectRevert(abi.encodeWithSelector(HatsModule.GardenNotConfigured.selector, unconfigured));
        adapter.setConvictionStrategies(unconfigured, strategies);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Revocation Triggers Sync Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revokeRole_triggersSyncForEachStrategy() public {
        // Configure 2 strategies
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategy1);
        strategies[1] = address(strategy2);
        adapter.setConvictionStrategies(garden1, strategies);

        // Grant gardener role to user1
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Expect sync events for both strategies
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user1, address(strategy1));
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user1, address(strategy2));

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Verify strategies actually received the call
        assertEq(strategy1.syncedCount(), 1, "Strategy1 should have 1 sync call");
        assertEq(strategy2.syncedCount(), 1, "Strategy2 should have 1 sync call");
        assertEq(strategy1.syncedMembers(0), user1, "Strategy1 should sync user1");
        assertEq(strategy2.syncedMembers(0), user1, "Strategy2 should sync user1");
    }

    function test_revokeRole_completesWhenStrategyReverts() public {
        // Configure a reverting strategy
        address[] memory strategies = new address[](1);
        strategies[0] = address(revertingStrategy);
        adapter.setConvictionStrategies(garden1, strategies);

        // Grant gardener role to user1
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Should emit failure event, NOT revert
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncFailed(garden1, user1, address(revertingStrategy), "strategy unavailable");

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Role should still be revoked despite sync failure
        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked despite sync failure");
    }

    function test_revokeRole_emitsEmptyReasonForRawRevert() public {
        // Configure a raw-reverting strategy (no reason string)
        address[] memory strategies = new address[](1);
        strategies[0] = address(rawRevertingStrategy);
        adapter.setConvictionStrategies(garden1, strategies);

        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Should emit failure event with empty reason
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncFailed(garden1, user1, address(rawRevertingStrategy), "");

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked despite raw revert");
    }

    function test_revokeRole_mixedStrategies_partialSyncSuccess() public {
        // Configure a working strategy + a reverting one
        address[] memory strategies = new address[](2);
        strategies[0] = address(strategy1);
        strategies[1] = address(revertingStrategy);
        adapter.setConvictionStrategies(garden1, strategies);

        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Expect success for strategy1, failure for reverting
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user1, address(strategy1));
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncFailed(garden1, user1, address(revertingStrategy), "strategy unavailable");

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Working strategy should have received the call
        assertEq(strategy1.syncedCount(), 1, "Working strategy should have been called");
        // Role should still be revoked
        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked");
    }

    function test_revokeRole_noStrategies_noSyncEvents() public {
        // No strategies configured (default)
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        vm.recordLogs();
        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Verify no ConvictionSyncTriggered or ConvictionSyncFailed events
        bytes32 triggeredSig = keccak256("ConvictionSyncTriggered(address,address,address)");
        bytes32 failedSig = keccak256("ConvictionSyncFailed(address,address,address,string)");

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0) {
                assertTrue(
                    logs[i].topics[0] != triggeredSig && logs[i].topics[0] != failedSig,
                    "Should not emit any conviction sync events when no strategies configured"
                );
            }
        }

        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should still be revoked");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Grant Triggers Sync (post-mint so strategies see updated hat state)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_grantRole_doesTriggerSync() public {
        // Configure strategies
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);
        adapter.setConvictionStrategies(garden1, strategies);

        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Strategy SHOULD have been called — _grantRole calls _syncConvictionPower
        assertEq(strategy1.syncedCount(), 1, "Strategy should be called on grant");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Batch Revocation Triggers Sync
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revokeRoles_triggersSyncForEachAccount() public {
        // Configure strategy
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);
        adapter.setConvictionStrategies(garden1, strategies);

        // Grant roles to 2 users
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);
        mockHats.setWearer(GARDEN1_EVALUATOR_HAT, user2, true);

        address[] memory accounts = new address[](2);
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](2);
        accounts[0] = user1;
        accounts[1] = user2;
        roles[0] = IHatsModule.GardenRole.Gardener;
        roles[1] = IHatsModule.GardenRole.Evaluator;

        // Expect sync for each account
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user1, address(strategy1));
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user2, address(strategy1));

        adapter.revokeRoles(garden1, accounts, roles);

        assertEq(strategy1.syncedCount(), 2, "Strategy should have 2 sync calls");
        assertEq(strategy1.syncedMembers(0), user1, "First sync should be user1");
        assertEq(strategy1.syncedMembers(1), user2, "Second sync should be user2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Operator Revocation Also Triggers Sync
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revokeOperator_triggersSyncOnce() public {
        // Configure strategy
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy1);
        adapter.setConvictionStrategies(garden1, strategies);

        // Grant operator to user1 (which cascades to evaluator + gardener)
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Operator);

        // Reset strategy sync count by deploying fresh
        strategy1 = new MockStrategy();
        strategies[0] = address(strategy1);
        adapter.setConvictionStrategies(garden1, strategies);

        // Revoke operator — should trigger sync for user1
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user1, address(strategy1));

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Operator);

        // Sync should have been called exactly once (only for the operator revocation, not sub-roles)
        assertEq(strategy1.syncedCount(), 1, "Operator revocation should trigger exactly 1 sync");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // C2: nonReentrant Guard Independence Test
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revokeRole_nonReentrantGuardBlocksReentry_independentOfGas() public {
        // Deploy a reentrant strategy that catches the revert to prove that
        // nonReentrant independently blocks reentry -- not just the gas stipend OOG.
        ReentrantStrategyWithGas reentrant = new ReentrantStrategyWithGas();
        reentrant.setReentrancyTarget(address(adapter), garden1, user1, IHatsModule.GardenRole.Gardener);

        address[] memory strategies = new address[](1);
        strategies[0] = address(reentrant);
        adapter.setConvictionStrategies(garden1, strategies);

        // Grant gardener to user1
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Call revokeRole with high gas so the strategy has plenty of gas
        // to reach the nonReentrant check (far more than the normal 100k stipend).
        // The gas stipend in production limits this to 100k, but this test
        // proves that even if gas were unlimited, nonReentrant would still protect.
        adapter.revokeRole{ gas: 5_000_000 }(garden1, user1, IHatsModule.GardenRole.Gardener);

        // The strategy attempted reentry -- the flag proves syncPower was entered
        assertTrue(reentrant.reentrancyAttempted(), "Strategy should have attempted reentry");
        // The reentrant call was caught by nonReentrant (not just gas OOG)
        assertTrue(reentrant.reentrancyReverted(), "nonReentrant guard should revert the reentrant call");
        // The outer revokeRole still succeeded
        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked despite reentry attempt");
    }

    function test_revokeRole_gasStipendBlocksReentrantExecution() public {
        // This test complements the above by proving the gas stipend OOG defense.
        // ReentrantStrategy does NOT catch reverts, so if the gas stipend prevents
        // execution entirely, reentrancyAttempted will NOT be persisted.
        ReentrantStrategy reentrant = new ReentrantStrategy();
        reentrant.setReentrancyTarget(address(adapter), garden1, user1, IHatsModule.GardenRole.Gardener);

        address[] memory strategies = new address[](1);
        strategies[0] = address(reentrant);
        adapter.setConvictionStrategies(garden1, strategies);

        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // The reentrant callback fails because SYNC_POWER_GAS_STIPEND (100k) is
        // insufficient for the reentrant call. The try/catch gracefully handles the OOG.
        vm.expectEmit(true, true, true, false);
        emit ConvictionSyncFailed(garden1, user1, address(reentrant), "");

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Gas stipend prevented the reentrant call from fully executing
        assertFalse(reentrant.reentrancyAttempted(), "Gas stipend should prevent reentrant execution");
        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked despite reentrancy attempt");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // C5: Gas-Hungry Strategy Test
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revokeRole_gasGuzzlerStrategy_completesSuccessfully() public {
        // Deploy a strategy that consumes significant gas via storage writes
        // but does NOT revert. This tests that the 100k gas stipend is sufficient
        // for legitimate heavy strategies, and that revocation completes normally.
        GasGuzzlerStrategy guzzler = new GasGuzzlerStrategy();

        address[] memory strategies = new address[](1);
        strategies[0] = address(guzzler);
        adapter.setConvictionStrategies(garden1, strategies);

        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Expect success event (not failure)
        vm.expectEmit(true, true, true, true);
        emit ConvictionSyncTriggered(garden1, user1, address(guzzler));

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Verify the gas guzzler completed successfully
        assertEq(guzzler.syncedCount(), 1, "Gas guzzler should have completed sync");
        // Verify the role was revoked
        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked");
    }

    function test_revokeRole_multipleGasGuzzlers_allComplete() public {
        // Test with multiple gas-hungry strategies to ensure the loop handles
        // cumulative gas consumption correctly
        GasGuzzlerStrategy guzzler1 = new GasGuzzlerStrategy();
        GasGuzzlerStrategy guzzler2 = new GasGuzzlerStrategy();
        GasGuzzlerStrategy guzzler3 = new GasGuzzlerStrategy();

        address[] memory strategies = new address[](3);
        strategies[0] = address(guzzler1);
        strategies[1] = address(guzzler2);
        strategies[2] = address(guzzler3);
        adapter.setConvictionStrategies(garden1, strategies);

        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // All 3 gas guzzlers should complete
        assertEq(guzzler1.syncedCount(), 1, "Guzzler1 should complete");
        assertEq(guzzler2.syncedCount(), 1, "Guzzler2 should complete");
        assertEq(guzzler3.syncedCount(), 1, "Guzzler3 should complete");
        assertFalse(adapter.isGardenerOf(garden1, user1), "Role should be revoked");
    }
}
