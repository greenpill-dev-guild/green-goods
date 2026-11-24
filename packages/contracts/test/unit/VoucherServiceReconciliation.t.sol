// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherServiceSourceTestBase } from "../helpers/VoucherServiceSourceTestBase.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherRedemptionCodec as Legacy } from "../../src/libraries/VoucherRedemptionCodec.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";

contract VoucherServiceReconciliationTest is VoucherServiceSourceTestBase {
    function testVoucherSetup_rejectsWrongRouterPeerSelectorChainAndAttachedTokens() public {
        bytes32 id = _prepare();
        Client.Any2EVMMessage memory m = _message(Codec.encodeSetupResult(_depositResult(id, 1)));
        vm.expectRevert();
        source.ccipReceive(m);
        m.sender = abi.encode(address(0xBAD));
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        router.deliver(address(source), m);
        m.sender = abi.encode(DESTINATION);
        m.sourceChainSelector = 101;
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        router.deliver(address(source), m);
        m.sourceChainSelector = 100;
        m.destTokenAmounts = new Client.EVMTokenAmount[](1);
        m.destTokenAmounts[0] = Client.EVMTokenAmount(address(0xA003), 1);
        vm.expectRevert(VoucherEndpoint.AttachedTokensForbidden.selector);
        router.deliver(address(source), m);
        m.destTokenAmounts = new Client.EVMTokenAmount[](0);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        router.deliver(address(source), m);
    }

    function testVoucherSetup_transportReplayIsIdempotentButConflictingBytesReject() public {
        bytes32 id = _prepare();
        Codec.SetupResult memory r = _depositResult(id, 1);
        Client.Any2EVMMessage memory m = _message(Codec.encodeSetupResult(r));
        router.deliver(address(source), m);
        router.deliver(address(source), m);
        assertEq(source.getSetup(id).latestResultSequence, 1);
        r.resultSequence = 2;
        m.data = Codec.encodeSetupResult(r);
        vm.expectRevert(VoucherRedemptionModule.ConflictingRedemptionTransport.selector);
        router.deliver(address(source), m);
    }

    function testVoucherSetup_historicalSequenceConflictRejectsBeforeStaleIgnore() public {
        bytes32 id = _funded();
        Codec.SetupResult memory r = _depositResult(id, 2);
        _deliver(Codec.encodeSetupResult(r));
        r.resultSequence = 1;
        r.actionSucceeded = false;
        r.failureHash = keccak256("conflicting old bytes");
        bytes memory data = Codec.encodeSetupResult(r);
        Client.Any2EVMMessage memory m = _message(data);
        vm.expectRevert(VoucherRedemptionModule.ConflictingRedemptionResult.selector);
        router.deliver(address(source), m);
        assertEq(source.getSetup(id).latestResultSequence, 2);
    }

    function testVoucherSetup_rejectsMalformedVersionLengthAndV1Intake() public {
        bytes32 id = _prepare();
        Codec.SetupResult memory r = _depositResult(id, 1);
        r.version = 1;
        _unsupported(Codec.encodeSetupResult(r));
        r.version = 2;
        _unsupported(bytes.concat(Codec.encodeSetupResult(r), hex"00"));
        _unsupported(hex"01");
        Legacy.Result memory old;
        old.version = 1;
        _unsupported(Legacy.encodeResult(old));
    }

    function testVoucherSetup_rejectsPartialDepositWrongReceiptAndUnapprovedIssuer() public {
        bytes32 id = _prepare();
        Codec.SetupResult memory r = _depositResult(id, 1);
        r.depositedUnits = 99;
        _invalidResult(r);
        r = _depositResult(id, 1);
        r.depositReceiptHash = bytes32(uint256(1));
        _invalidResult(r);
        r = _depositResult(id, 1);
        r.issuerApproved = false;
        _invalidResult(r);
    }

    function testVoucherSetup_depositedAndActiveCannotClaimFailedActions() public {
        bytes32 id = _funded();
        Codec.SetupResult memory r = _depositResult(id, 2);
        r.actionSucceeded = false;
        r.failureHash = keccak256("contradictory deposit failure");
        _invalidResult(r);
        _accept(id);
        bytes32 decision = source.finalizeActivation(id, Codec.hash(source.getSetupAuthorization(id)));
        r.phase = Codec.SetupPhase.Active;
        r.decision = Codec.SetupDecision.Activate;
        r.appliedDecisionId = decision;
        _invalidResult(r);
    }

    function testVoucherSetup_abortPhasesRequireRealLiabilityAndCoherentOutcome() public {
        bytes32 id = _prepare();
        bytes32 authorizationHash = Codec.hash(source.getSetupAuthorization(id));
        vm.prank(BUYER);
        source.abortSetup(id, authorizationHash);
        Codec.SetupResult memory r = _depositResult(id, 1);
        r.decision = Codec.SetupDecision.Abort;
        r.appliedDecisionId = source.getSetup(id).decisionId;
        r.phase = Codec.SetupPhase.AbortRefundPending;
        _invalidResult(r); // successful pending-refund is contradictory
        r.actionSucceeded = false;
        r.failureHash = keccak256("refund failed");
        r.depositedUnits = 0;
        r.depositReceiptHash = bytes32(0);
        _invalidResult(r); // no liability cannot be a failed refund
        r = _depositResult(id, 1);
        r.decision = Codec.SetupDecision.Abort;
        r.appliedDecisionId = source.getSetup(id).decisionId;
        r.phase = Codec.SetupPhase.Aborted;
        r.setupRefundedUnits = 100;
        r.actionSucceeded = false;
        r.failureHash = keccak256("contradictory completed refund");
        _invalidResult(r);
    }

    function testVoucherSetup_lostDepositAckThenAbortRefundCannotBeUndoneByLateDepositResult() public {
        bytes32 id = _prepare();
        Codec.SetupResult memory deposit = _depositResult(id, 1);
        bytes32 hash = Codec.hash(source.getSetupAuthorization(id));
        vm.prank(BUYER);
        source.abortSetup(id, hash); // source never observed the actual destination deposit
        Codec.SetupResult memory refund = _depositResult(id, 3);
        refund.phase = Codec.SetupPhase.Aborted;
        refund.decision = Codec.SetupDecision.Abort;
        refund.setupRefundedUnits = 100;
        refund.appliedDecisionId = source.getSetup(id).decisionId;
        _deliver(Codec.encodeSetupResult(refund));
        _deliver(Codec.encodeSetupResult(deposit));
        assertEq(source.getSetup(id).setupRefundedUnits, 100);
        assertEq(source.getSetup(id).latestResultSequence, 3);
        _expectGuardRevert(id, VoucherRedemptionModule.VoucherSetupNotReady.selector);
    }

    function testVoucherSetup_holderRequestIsAuthenticatedAndCannotUndoAcceptedEver() public {
        bytes32 id = _funded();
        _accept(id);
        Codec.HolderAbortRequest memory r =
            Codec.HolderAbortRequest(2, id, Codec.hash(source.getSetupAuthorization(id)), HOLDER);
        _deliver(Codec.encodeHolderAbortRequest(r));
        assertEq(uint256(source.getSetup(id).decision), uint256(Codec.SetupDecision.None));
        source.finalizeActivation(id, r.authorizationHash);
        assertEq(uint256(source.getSetup(id).decision), uint256(Codec.SetupDecision.Activate));
    }

    function testVoucherSetup_holderRequestSelectsImmutableAbortBeforeAcceptance() public {
        bytes32 id = _prepare();
        Codec.HolderAbortRequest memory r =
            Codec.HolderAbortRequest(2, id, Codec.hash(source.getSetupAuthorization(id)), HOLDER);
        _deliver(Codec.encodeHolderAbortRequest(r));
        bytes32 decision = source.getSetup(id).decisionId;
        _deliver(Codec.encodeHolderAbortRequest(r));
        assertEq(source.getSetup(id).decisionId, decision);
        (Codec.SetupAuthorization memory a, Codec.SetupDecisionCommand memory command) =
            Codec.decodeDecision(source.getSetupCommand(id, 1));
        assertEq(Codec.hash(a), r.authorizationHash);
        assertEq(uint256(command.abortReason), uint256(Codec.AbortReason.HolderRequest));
        assertEq(command.expectedDepositReceiptHash, Codec.depositReceiptHash(a));
    }

    function testVoucherSetup_finalBeforeActivationAckAndIndependentSequenceDomains() public {
        bytes32 id = _activated();
        Codec.FinalResultV2 memory finalResult = _finalResult(id, 3);
        finalResult.release = Codec.LegProgress(Codec.LegState.Succeeded, 1, bytes32(0));
        finalResult.refund = Codec.LegProgress(Codec.LegState.Succeeded, 1, bytes32(0));
        _deliver(Codec.encodeFinalResult(finalResult));
        assertEq(source.getSetup(id).latestResultSequence, 1);
        assertEq(source.getFinalResult(id).sequence, 3);
        Codec.SetupResult memory activation = _depositResult(id, 2);
        activation.phase = Codec.SetupPhase.Active;
        activation.decision = Codec.SetupDecision.Activate;
        activation.appliedDecisionId = source.getSetup(id).decisionId;
        _deliver(Codec.encodeSetupResult(activation));
        assertEq(source.getSetup(id).latestResultSequence, 2);
        assertEq(source.getFinalResult(id).sequence, 3);
        assertEq(uint256(core.getCommitment(1).state), 3, "financial closure does not fulfill core");
    }

    function testVoucherSetup_finalConflictDowngradeAndAttemptsCannotRewriteFrozenSplit() public {
        bytes32 id = _activated();
        Codec.FinalResultV2 memory r = _finalResult(id, 1);
        _deliver(Codec.encodeFinalResult(r));
        r.sequence = 2;
        r.release = Codec.LegProgress(Codec.LegState.Succeeded, 1, bytes32(0));
        _deliver(Codec.encodeFinalResult(r));
        r.sequence = 3;
        r.release = Codec.LegProgress(Codec.LegState.Failed, 2, keccak256("cannot downgrade"));
        _invalidFinal(r, Codec.InvalidVoucherServiceResult.selector);
        r = _finalResult(id, 3);
        r.allocation = Codec.FinalAllocation(4, 50, 50);
        r.decisionId = Codec.finalDecisionId(source.getSetupAuthorization(id), r.activationDecisionId, r.allocation, 60);
        _invalidFinal(r, Codec.InvalidVoucherServiceResult.selector);
        r = _finalResult(id, 1);
        r.release = Codec.LegProgress(Codec.LegState.Failed, 1, keccak256("historical conflict"));
        _invalidFinal(r, VoucherRedemptionModule.ConflictingRedemptionResult.selector);
    }

    function testVoucherSetup_finalRejectsNonConservationUnapprovedServiceAndWrongActivation() public {
        bytes32 id = _activated();
        Codec.FinalResultV2 memory r = _finalResult(id, 1);
        r.allocation.refundVoucherUnits = 59;
        _invalidFinal(r, Codec.InvalidVoucherServiceResult.selector);
        r = _finalResult(id, 1);
        r.allocation.approvedDeliveredServiceUnits = 0;
        _invalidFinal(r, Codec.InvalidVoucherServiceResult.selector);
        r = _finalResult(id, 1);
        r.activationDecisionId = bytes32(uint256(1));
        _invalidFinal(r, Codec.InvalidVoucherServiceResult.selector);
    }

    function testVoucherSetup_pausedSourceStillReconcilesDurableDepositAndFinalResults() public {
        bytes32 id = _prepare();
        source.pause();
        _deliver(Codec.encodeSetupResult(_depositResult(id, 1)));
        assertEq(source.getSetup(id).depositedUnits, 100);
        source.unpause();
        _accept(id);
        source.finalizeActivation(id, Codec.hash(source.getSetupAuthorization(id)));
        source.pause();
        _deliver(Codec.encodeFinalResult(_finalResult(id, 1)));
        assertEq(source.getFinalResult(id).sequence, 1);
    }

    function testVoucherSetup_finalResultCanMaterializeActivationBeforeItsOutboxWasFinalized() public {
        bytes32 id = _funded();
        _accept(id);
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        Codec.SetupDecisionCommand memory command = Codec.SetupDecisionCommand(
            2,
            id,
            Codec.hash(a),
            Codec.SetupDecision.Activate,
            Codec.depositReceiptHash(a),
            keccak256(abi.encode(core.getVoucherServiceAcceptance(1))),
            Codec.AbortReason.None
        );
        Codec.FinalResultV2 memory r = _finalResult(id, 1);
        r.activationDecisionId = Codec.decisionId(command);
        r.decisionId = Codec.finalDecisionId(a, r.activationDecisionId, r.allocation, 60);
        _deliver(Codec.encodeFinalResult(r));
        assertEq(source.getSetup(id).decisionId, r.activationDecisionId);
        assertEq(source.getFinalResult(id).decisionId, r.decisionId);
    }

    function testVoucherSetup_wrongHolderAndPayloadCannotSelectAbort() public {
        bytes32 id = _prepare();
        Codec.HolderAbortRequest memory r =
            Codec.HolderAbortRequest(2, id, Codec.hash(source.getSetupAuthorization(id)), address(0xBAD));
        Client.Any2EVMMessage memory m = _message(Codec.encodeHolderAbortRequest(r));
        vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
        router.deliver(address(source), m);
        r.holder = HOLDER;
        r.authorizationHash = bytes32(uint256(1));
        m = _message(Codec.encodeHolderAbortRequest(r));
        vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
        router.deliver(address(source), m);
        assertEq(uint256(source.getSetup(id).decision), uint256(Codec.SetupDecision.None));
    }

    function _unsupported(bytes memory data) private {
        Client.Any2EVMMessage memory m = _message(data);
        vm.expectRevert(Codec.UnsupportedVoucherServiceMessage.selector);
        router.deliver(address(source), m);
    }

    function _invalidFinal(Codec.FinalResultV2 memory r, bytes4 selector) private {
        Client.Any2EVMMessage memory m = _message(Codec.encodeFinalResult(r));
        vm.expectRevert(selector);
        router.deliver(address(source), m);
    }
}
