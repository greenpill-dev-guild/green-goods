// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { StewardSafeReceiver } from "../../src/accounts/StewardSafeReceiver.sol";
import { IHatsSignerGateV2, IStewardSafe } from "../../src/interfaces/IHatsSignerGateV2.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { MockHats } from "../../src/mocks/Hats.sol";
import { StewardRolePublisher } from "../../src/accounts/StewardRolePublisher.sol";
import { StewardRouterFixture } from "../helpers/StewardRoleFixtures.sol";

interface IStewardSafeTransactions {
    function nonce() external view returns (uint256);
    function getTransactionHash(
        address,
        uint256,
        bytes memory,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address,
        uint256
    )
        external
        view
        returns (bytes32);
    function execTransaction(
        address,
        uint256,
        bytes memory,
        uint8,
        uint256,
        uint256,
        uint256,
        address,
        address,
        bytes memory
    )
        external
        payable
        returns (bool);
}

interface IRevertingVm {
    function mockCallRevert(address callee, bytes calldata data, bytes calldata reason) external;
    function getNonce(address account) external returns (uint64);
}

/// @dev Actual published Hats/HSG/Safe binaries; fictional roles, router and CCIP delivery.
///      No DON finality, actual signer control or live release is established by this fork.
contract GnosisStewardSafeForkTest is Test {
    StewardSafeReceiver private receiver;
    IHatsSignerGateV2 private gate;
    IStewardSafe private safe;
    address private constant ROUTER = address(0x11111);
    address private constant PUBLISHER = address(0x22222);
    address private constant GARDEN = address(0x33333);
    uint256 private constant A = 0xA11CE;
    uint256 private constant B = 0xB0B;
    uint256 private constant C = 0xCA11;

    function setUp() public {
        string memory rpc = "https://rpc.gnosischain.com";
        try vm.envString("GNOSIS_RPC_URL") returns (string memory configured) {
            rpc = configured;
        } catch { }
        vm.createSelectFork(rpc, 48_897_095);
        assertEq(block.chainid, 100);
        assertEq(block.number, 48_897_095);
        vm.etch(ROUTER, hex"00");
        (bool ok, bytes memory result) =
            address(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137).staticcall(abi.encodeWithSignature("lastTopHatId()"));
        require(ok, "top Hat counter");
        uint256 nextTopHat = (abi.decode(result, (uint256)) + 1) << 224;
        receiver = new StewardSafeReceiver(ROUTER, PUBLISHER, GARDEN, nextTopHat, 19);
        gate = receiver.gate();
        safe = receiver.safe();
        vm.deal(address(safe), 10 ether);
    }

    function testGnosisStewardSafe_fixedTwoWorksWithTwoThreeAndFiveStewards() public {
        _update(vm.addr(A), 1, true);
        _update(vm.addr(B), 1, true);
        assertEq(safe.getThreshold(), 2);
        assertTrue(_spend(A, B, address(0x44444), ""));
        assertEq(address(0x44444).balance, 1);
        _update(vm.addr(C), 1, true);
        _update(vm.addr(4), 1, true);
        _update(vm.addr(5), 1, true);
        assertEq(safe.getThreshold(), 2);
        assertEq(gate.validSignerCount(), 5);
        assertTrue(_spend(B, C, address(0x44444), ""));
        assertEq(address(0x44444).balance, 2);
    }

    function testGnosisStewardSafe_oneSignerCannotSpendAndZeroRosterRecoversThroughSourceGrants() public {
        _update(vm.addr(A), 1, true);
        assertEq(safe.getThreshold(), 1);
        _spendReverts(A, 0, address(0x44444), "", bytes4(keccak256("ThresholdTooLow()")));
        _update(vm.addr(A), 2, false);
        assertEq(gate.validSignerCount(), 0);
        assertEq(safe.getOwners()[0], address(gate));
        _update(vm.addr(B), 1, true);
        _update(vm.addr(C), 1, true);
        assertEq(safe.getThreshold(), 2);
        assertTrue(_spend(B, C, address(0x44444), ""));
    }

    function testGnosisStewardSafe_revocationSurvivesFailedOwnerCleanupAndImmediatelyInvalidatesOldSignatures() public {
        _update(vm.addr(A), 1, true);
        _update(vm.addr(B), 1, true);
        _update(vm.addr(C), 1, true);
        IRevertingVm(address(vm))
            .mockCallRevert(address(gate), abi.encodeCall(gate.removeSigner, (vm.addr(A))), "cleanup unavailable");
        _update(vm.addr(A), 2, false);
        assertTrue(safe.isOwner(vm.addr(A)), "cleanup deferred");
        assertFalse(gate.isValidSigner(vm.addr(A)), "explicit eligibility already revoked");
        _spendReverts(A, B, address(0x44444), "", bytes4(keccak256("InsufficientValidSignatures()")));
        assertTrue(_spend(B, C, address(0x44444), ""));
        vm.clearMockedCalls();
        receiver.reconcile(vm.addr(A));
        assertFalse(safe.isOwner(vm.addr(A)));
        _update(vm.addr(A), 3, true);
        receiver.reconcile(vm.addr(A));
        assertTrue(gate.isValidSigner(vm.addr(A)));
        assertTrue(safe.isOwner(vm.addr(A)));
    }

    function testGnosisStewardSafe_reorderedDuplicatesAndConflictsCannotResurrectRevokedSteward() public {
        _update(vm.addr(A), 2, false);
        _update(vm.addr(A), 1, true);
        _update(vm.addr(A), 2, false);
        assertFalse(gate.isValidSigner(vm.addr(A)));
        vm.expectRevert(StewardSafeReceiver.ConflictingRevision.selector);
        _update(vm.addr(A), 2, true);
        (uint64 revision, bool eligible) = receiver.states(vm.addr(A));
        assertEq(revision, 2);
        assertFalse(eligible);
    }

    function testGnosisStewardSafe_rejectsWrongRouterSenderSelectorDomainGardenAndAttachedTokens() public {
        Client.Any2EVMMessage memory message = _message(vm.addr(A), 1, true);
        vm.expectRevert();
        receiver.ccipReceive(message);
        message.sender = abi.encode(address(0xBAD));
        _reject(message);
        message = _message(vm.addr(A), 1, true);
        message.sourceChainSelector++;
        _reject(message);
        message = _message(vm.addr(A), 1, true);
        message.data = abi.encode(bytes32(0), uint256(42_161), uint256(100), GARDEN, vm.addr(A), uint64(1), true);
        _reject(message);
        message.data =
            abi.encode(receiver.DOMAIN(), uint256(42_161), uint256(100), address(0xBAD), vm.addr(A), uint64(1), true);
        _reject(message);
        message = _message(vm.addr(A), 1, true);
        message.destTokenAmounts = new Client.EVMTokenAmount[](1);
        _reject(message);
        (uint64 revision,) = receiver.states(vm.addr(A));
        assertEq(revision, 0);
    }

    function testGnosisStewardSafe_lockedGateHasSoleModuleAndSafeCannotReplaceGuardOrThreshold() public {
        assertTrue(gate.locked());
        IHatsSignerGateV2.ThresholdConfig memory config = gate.thresholdConfig();
        assertEq(config.thresholdType, 0);
        assertEq(config.min, 2);
        assertEq(config.target, 2);
        (address[] memory modules, address next) = safe.getModulesPaginated(address(1), 2);
        assertEq(modules.length, 1);
        assertEq(modules[0], address(gate));
        assertEq(next, address(1));
        vm.expectRevert(bytes4(keccak256("Locked()")));
        gate.disableDelegatecallTarget(address(0xBAD));
        _update(vm.addr(A), 1, true);
        _update(vm.addr(B), 1, true);
        _spendReverts(
            A,
            B,
            address(safe),
            abi.encodeWithSignature("setGuard(address)", address(0)),
            bytes4(keccak256("CannotCallSafe()"))
        );
        _spendReverts(
            A,
            B,
            address(safe),
            abi.encodeWithSignature("changeThreshold(uint256)", 1),
            bytes4(keccak256("CannotCallSafe()"))
        );
        assertFalse(IHats(receiver.HATS()).isAdminOfHat(address(safe), receiver.signerHat()));
        (bool eligible, bool standing) = receiver.getWearerStatus(address(0xBAD), receiver.signerHat());
        assertFalse(eligible);
        assertTrue(standing);
    }

    function testFuzz_GnosisStewardSafe_unknownWearerAlwaysReturnsExplicitDenial(address account, uint256 hat) public {
        (bool eligible, bool standing) = receiver.getWearerStatus(account, hat);
        assertFalse(eligible);
        assertTrue(standing);
    }

    function testGnosisStewardSafe_unapprovedCallerCannotUseGateModuleExecution() public {
        (bool ok,) = address(gate)
            .call(
                abi.encodeWithSignature(
                    "execTransactionFromModule(address,uint256,bytes,uint8)", address(0x44444), 1 ether, bytes(""), uint8(0)
                )
            );
        assertFalse(ok);
        assertEq(address(safe).balance, 10 ether);
    }

    function testGnosisStewardSafe_fundedSourceRoleLifecycleAutomaticallyUpdatesTheRealDestinationSafe() public {
        // Actual source module/publisher with fictional Arbitrum Hats and mocked CCIP delivery.
        vm.chainId(42_161);
        MockHats sourceHats = new MockHats();
        for (uint256 i = 1; i <= 6; ++i) {
            sourceHats.setHatActive(i, true);
        }
        HatsModule impl = new HatsModule();
        HatsModule module = HatsModule(
            address(
                new ERC1967Proxy(address(impl), abi.encodeCall(HatsModule.initialize, (address(this), address(sourceHats))))
            )
        );
        module.configureGarden(GARDEN, 1, 2, 3, 4, 5, 6);
        StewardRouterFixture sourceRouter = new StewardRouterFixture();
        uint64 nonce = IRevertingVm(address(vm)).getNonce(address(this));
        require(nonce > 0 && nonce < 126, "fixture CREATE nonce");
        address predictedReceiver =
            address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", address(this), uint8(nonce + 1))))));
        StewardRolePublisher source =
            new StewardRolePublisher(address(sourceRouter), address(module), GARDEN, 2, predictedReceiver);
        vm.chainId(100);
        (bool ok, bytes memory counter) = receiver.HATS().staticcall(abi.encodeWithSignature("lastTopHatId()"));
        require(ok, "top Hat counter");
        receiver = new StewardSafeReceiver(ROUTER, address(source), GARDEN, (abi.decode(counter, (uint256)) + 1) << 224, 20);
        assertEq(address(receiver), predictedReceiver);
        gate = receiver.gate();
        safe = receiver.safe();
        vm.deal(address(safe), 10 ether);
        vm.chainId(42_161);
        module.setStewardObserver(GARDEN, address(source));
        vm.deal(address(source), 100);
        vm.prank(GARDEN);
        module.grantRole(GARDEN, vm.addr(A), IHatsModule.GardenRole.Steward);
        bytes memory oldGrant = sourceRouter.lastData();
        _deliverSource(source, sourceRouter.lastData());
        vm.chainId(42_161);
        vm.prank(GARDEN);
        module.grantRole(GARDEN, vm.addr(B), IHatsModule.GardenRole.Steward);
        _deliverSource(source, sourceRouter.lastData());
        vm.chainId(42_161);
        vm.prank(GARDEN);
        module.grantRole(GARDEN, vm.addr(C), IHatsModule.GardenRole.Steward);
        _deliverSource(source, sourceRouter.lastData());
        assertEq(gate.validSignerCount(), 3);
        assertEq(safe.getThreshold(), 2);
        vm.chainId(42_161);
        vm.prank(GARDEN);
        module.revokeRole(GARDEN, vm.addr(A), IHatsModule.GardenRole.Steward);
        _deliverSource(source, sourceRouter.lastData());
        _deliverSource(source, oldGrant);
        assertFalse(gate.isValidSigner(vm.addr(A)));
        assertFalse(safe.isOwner(vm.addr(A)));
        assertEq(gate.validSignerCount(), 2);
        assertTrue(_spend(B, C, address(0x44444), ""));
        assertEq(sourceRouter.sends(), 4);
        assertEq(address(source).balance, 60);
        assertEq(sourceRouter.lastReceiver(), abi.encode(address(receiver)));
    }

    function _deliverSource(StewardRolePublisher source, bytes memory data) private {
        vm.chainId(100);
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage(
            bytes32(0), 4_949_039_107_694_359_620, abi.encode(address(source)), data, new Client.EVMTokenAmount[](0)
        );
        vm.prank(ROUTER);
        receiver.ccipReceive(message);
    }

    function _update(address account, uint64 revision, bool eligible) private {
        vm.prank(ROUTER);
        receiver.ccipReceive(_message(account, revision, eligible));
    }

    function _reject(Client.Any2EVMMessage memory message) private {
        vm.prank(ROUTER);
        vm.expectRevert(StewardSafeReceiver.InvalidMessage.selector);
        receiver.ccipReceive(message);
    }

    function _message(address account, uint64 revision, bool eligible) private view returns (Client.Any2EVMMessage memory) {
        return Client.Any2EVMMessage(
            bytes32(uint256(revision)),
            4_949_039_107_694_359_620,
            abi.encode(PUBLISHER),
            abi.encode(
                keccak256("GREEN_GOODS_STEWARD_SAFE_V1"), uint256(42_161), uint256(100), GARDEN, account, revision, eligible
            ),
            new Client.EVMTokenAmount[](0)
        );
    }

    function _spend(uint256 first, uint256 second, address to, bytes memory data) private returns (bool) {
        return _exec(first, second, to, data, bytes4(0));
    }

    function _spendReverts(uint256 first, uint256 second, address to, bytes memory data, bytes4 reason) private {
        _exec(first, second, to, data, reason);
    }

    function _exec(uint256 first, uint256 second, address to, bytes memory data, bytes4 reason) private returns (bool) {
        IStewardSafeTransactions txSafe = IStewardSafeTransactions(address(safe));
        bytes32 hash = txSafe.getTransactionHash(to, 1, data, 0, 0, 0, 0, address(0), address(0), txSafe.nonce());
        if (second != 0 && vm.addr(first) > vm.addr(second)) (first, second) = (second, first);
        bytes memory sigs = _signature(first, hash);
        if (second != 0) sigs = bytes.concat(sigs, _signature(second, hash));
        if (reason != bytes4(0)) vm.expectRevert(reason);
        return txSafe.execTransaction(to, 1, data, 0, 0, 0, 0, address(0), address(0), sigs);
    }

    function _signature(uint256 key, bytes32 hash) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, hash);
        return abi.encodePacked(r, s, v);
    }
}
