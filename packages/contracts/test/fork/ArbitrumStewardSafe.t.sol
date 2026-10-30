// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { StewardSafePublisher } from "../../src/accounts/StewardSafePublisher.sol";
import { StewardRolePublisher } from "../../src/accounts/StewardRolePublisher.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IHatsSignerGateV2, IStewardSafe } from "../../src/interfaces/IHatsSignerGateV2.sol";
import { IStewardSafeTransactions } from "./GnosisStewardSafe.t.sol";

/// @dev Real Arbitrum HatsModule, Hats, HSG, Safe and router; all mutations and funds are fork-only.
contract ArbitrumStewardSafeForkTest is Test {
    address private constant GARDEN = 0xF7b892886998DAe960D64a9db488336684F137A0;
    address private constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address private constant OWNER = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address private constant ROUTER = 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8;
    uint256 private constant A = 0xA11CE;
    uint256 private constant B = 0xB0B;
    uint256 private constant C = 0xCA11;
    uint256 private constant D = 0xD0D;
    HatsModule private module = HatsModule(0x5b943088ecdDBF8E4ae387348A88A654aC5F7266);
    StewardSafePublisher private publisher;
    IHatsSignerGateV2 private gate;
    IStewardSafe private safe;

    function setUp() public {
        string memory rpc = "https://arb1.arbitrum.io/rpc";
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory configuredRpc) {
            rpc = configuredRpc;
        } catch { }
        // Public Arbitrum endpoints prune old state; an explicit archive block is optional.
        try vm.envUint("STEWARD_ARBITRUM_FORK_BLOCK") returns (uint256 pinnedBlock) {
            vm.createSelectFork(rpc, pinnedBlock);
        } catch {
            vm.createSelectFork(rpc);
        }
        emit log_named_uint("Arbitrum EVM block.number (L1)", block.number);
        (, uint256 hat,,,,,, bool configured) = module.getGardenHatIds(GARDEN);
        assertTrue(configured);
        (bool ok, bytes memory counter) = HATS.staticcall(abi.encodeWithSignature("lastTopHatId()"));
        require(ok, "Hats counter");
        publisher = new StewardSafePublisher(
            ROUTER,
            address(module),
            GARDEN,
            hat,
            address(0x77777),
            "Fixture Garden",
            (abi.decode(counter, (uint256)) + 1) << 224,
            37
        );
        gate = publisher.gate();
        safe = publisher.safe();
        vm.prank(OWNER);
        module.setStewardObserver(GARDEN, address(publisher));
        vm.deal(address(publisher), 1 ether);
        vm.deal(address(safe), 1 ether);
    }

    function testArbitrumStewardSafe_deploysLockedWithoutAnyInitialSigner() public {
        assertTrue(gate.locked());
        assertEq(gate.validSignerCount(), 0);
        assertEq(safe.getOwners()[0], address(gate));
        IHatsSignerGateV2.ThresholdConfig memory threshold = gate.thresholdConfig();
        assertEq(threshold.min, 1);
        assertEq(threshold.target, 2);
        (address[] memory modules,) = safe.getModulesPaginated(address(1), 2);
        assertEq(modules.length, 1);
        assertEq(modules[0], address(gate));
    }

    function testArbitrumStewardSafe_realRoleHooksReconcileAndDispatchWithinTheExistingGasBudget() public {
        _role(A, true);
        assertTrue(safe.isOwner(vm.addr(A)));
        assertEq(publisher.dispatchedRevision(vm.addr(A)), 1);
        _role(B, true);
        assertTrue(safe.isOwner(vm.addr(B)));
        assertEq(safe.getThreshold(), 2);
        _role(C, true);
        _role(D, true);
        assertEq(gate.validSignerCount(), 4);
        assertEq(publisher.dispatchedRevision(vm.addr(D)), 1);
        assertTrue(_spend(A, B));
        _role(C, false);
        _role(D, false);
        assertEq(publisher.dispatchedRevision(vm.addr(D)), 2);
        _role(A, false);
        assertFalse(safe.isOwner(vm.addr(A)));
        assertFalse(gate.isValidSigner(vm.addr(A)));
        assertEq(publisher.dispatchedRevision(vm.addr(A)), 2);
        assertEq(safe.getThreshold(), 1);
        assertTrue(_spend(B, 0));
        _role(B, false);
        assertEq(gate.validSignerCount(), 0);
        _role(A, true);
        assertTrue(safe.isOwner(vm.addr(A)));
        assertTrue(_spend(A, 0));
    }

    function testArbitrumStewardSafe_failedCleanupCannotPreserveSignaturesOrPreventRemoteRevocation() public {
        _role(A, true);
        _role(B, true);
        // Build a genuine large owner list without subsidizing unrelated mirror messages.
        // Its cold Safe storage reads exceed the native callback's bounded cleanup budget.
        vm.prank(OWNER);
        module.setStewardObserver(GARDEN, address(0));
        for (uint256 key = 10_000; key < 10_160; ++key) {
            _role(key, true);
            publisher.reconcileSource(vm.addr(key));
        }
        assertEq(safe.getOwners().length, 162);
        vm.prank(OWNER);
        module.setStewardObserver(GARDEN, address(publisher));
        _role(A, false);
        assertTrue(safe.isOwner(vm.addr(A)));
        assertFalse(gate.isValidSigner(vm.addr(A)));
        assertEq(publisher.dispatchedRevision(vm.addr(A)), 2);
        _exec(A, B, bytes4(keccak256("InsufficientValidSignatures()")));
        publisher.reconcileSource(vm.addr(A));
        assertFalse(safe.isOwner(vm.addr(A)));
    }

    function testArbitrumStewardSafe_transportFailureDoesNotBlockSourceOwnersAndCanRetry() public {
        // A real router quote exceeds the finite fuel balance; no router response is mocked.
        vm.deal(address(publisher), 1);
        _role(A, true);
        assertTrue(safe.isOwner(vm.addr(A)));
        assertEq(publisher.dispatchedRevision(vm.addr(A)), 0);
        (uint64 revision, bool eligible) = publisher.states(vm.addr(A));
        assertEq(revision, 1);
        assertTrue(eligible);
        vm.deal(address(publisher), 1 ether);
        publisher.syncSteward(vm.addr(A));
        assertEq(publisher.dispatchedRevision(vm.addr(A)), 1);
        assertEq(gate.validSignerCount(), 1);
    }

    function testArbitrumStewardSafe_unavailableOrRemappedAuthorityExplicitlyDeniesSignatures() public {
        _role(A, true);
        // Exercise the genuine owner-controlled dependency and garden-configuration setters.
        vm.prank(OWNER);
        module.setHatsContract(address(0xDEAD));
        assertFalse(gate.isValidSigner(vm.addr(A)));
        (bool eligible, bool standing) = publisher.getWearerStatus(vm.addr(A), publisher.signerHat());
        assertFalse(eligible);
        assertTrue(standing);
        vm.prank(OWNER);
        module.setHatsContract(HATS);
        (uint256 ownerHat,, uint256 evaluatorHat, uint256 gardenerHat, uint256 funderHat, uint256 communityHat,,) =
            module.getGardenHatIds(GARDEN);
        vm.prank(OWNER);
        module.configureGarden(GARDEN, ownerHat, 99, evaluatorHat, gardenerHat, funderHat, communityHat);
        assertFalse(gate.isValidSigner(vm.addr(A)));
        publisher.syncSteward(vm.addr(A));
        assertFalse(safe.isOwner(vm.addr(A)));
    }

    function testArbitrumStewardSafe_rejectedCallbacksAndLockedConfigCannotGrantUnrelatedOwners() public {
        vm.expectRevert(StewardRolePublisher.OnlySelf.selector);
        publisher.reconcileSourceFromSync(vm.addr(A));
        publisher.reconcileSource(vm.addr(A));
        assertFalse(safe.isOwner(vm.addr(A)));
        uint256 signerHat = publisher.signerHat();
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("NotSignerHatWearer(address)")), vm.addr(A)));
        gate.claimSignerFor(signerHat, vm.addr(A));
        _role(A, true);
        vm.prank(vm.addr(A));
        vm.expectRevert(bytes4(keccak256("Locked()")));
        gate.setThresholdConfig(IHatsSignerGateV2.ThresholdConfig(0, 1, 1));
    }

    function _role(uint256 key, bool grant) private {
        vm.prank(OWNER);
        if (grant) module.grantRole(GARDEN, vm.addr(key), IHatsModule.GardenRole.Steward);
        else module.revokeRole(GARDEN, vm.addr(key), IHatsModule.GardenRole.Steward);
    }

    function _spend(uint256 first, uint256 second) private returns (bool) {
        return _exec(first, second, bytes4(0));
    }

    function _exec(uint256 first, uint256 second, bytes4 reason) private returns (bool) {
        IStewardSafeTransactions txSafe = IStewardSafeTransactions(address(safe));
        address to = address(0x44444);
        bytes32 hash = txSafe.getTransactionHash(to, 1, "", 0, 0, 0, 0, address(0), address(0), txSafe.nonce());
        if (second != 0 && vm.addr(first) > vm.addr(second)) (first, second) = (second, first);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(first, hash);
        bytes memory signatures = abi.encodePacked(r, s, v);
        if (second != 0) {
            (v, r, s) = vm.sign(second, hash);
            signatures = bytes.concat(signatures, abi.encodePacked(r, s, v));
        }
        if (reason != bytes4(0)) vm.expectRevert(reason);
        return txSafe.execTransaction(to, 1, "", 0, 0, 0, 0, address(0), address(0), signatures);
    }
}
