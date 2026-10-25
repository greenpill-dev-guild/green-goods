// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentServiceOffers } from "../interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherRedemptionCodec as Codec } from "../libraries/VoucherRedemptionCodec.sol";
import { VoucherServiceCodec as Service } from "../libraries/VoucherServiceCodec.sol";
import { VoucherServiceSourceStorage as Store } from "../lib/VoucherService/VoucherServiceSourceStorage.sol";
import { VoucherServiceConsentLib as Consent } from "../lib/VoucherService/VoucherServiceConsentLib.sol";
import { VoucherServiceResultLib as Results } from "../lib/VoucherService/VoucherServiceResultLib.sol";
import { VoucherServiceOutboxLib as Outbox } from "../lib/VoucherService/VoucherServiceOutboxLib.sol";
import { VoucherEndpoint } from "./VoucherEndpoint.sol";

/// @notice Pending-consent setup, authenticated escrow proof and permanent activation/abort choice.
contract VoucherRedemptionModule is VoucherEndpoint {
    uint256 public constant COMMAND_GAS_LIMIT = 2_000_000;
    // Frozen v1 layout: old local state is readable, never implicitly migrated or executable.
    enum RedemptionState {
        None,
        Prepared,
        Pending,
        Active,
        Closed
    }

    struct Redemption {
        uint256 commitmentId;
        bytes32 payloadHash;
        bytes32 lastMessageId;
        bytes32 resultHash;
        RedemptionState state;
        Codec.Result latestResult;
    }
    ICommitmentServiceOffers public commitmentPooling;
    mapping(uint256 commitmentId => bytes32 redemptionId) public redemptionOfCommitment;
    mapping(bytes32 redemptionId => Redemption record) private _redemptions;
    mapping(bytes32 redemptionId => bytes authorization) private _commands;
    mapping(bytes32 messageId => bytes32 dataHash) public acknowledgmentMessages;
    uint256[45] private __gap;

    error InvalidServiceAuthorization();
    error SourceBuyerOnly();
    error RedemptionAlreadyPrepared();
    error UnknownRedemption();
    error EscrowAlreadyClosed();
    error ConflictingRedemptionResult();
    error ConflictingRedemptionTransport();
    // Retain the result validator's public error ABI after fixed-library extraction.
    error InvalidVoucherServiceResult();
    error IncorrectRedemptionFee(uint256 required, uint256 provided);
    error VoucherSetupRequired();
    error VoucherSetupNotReady();
    error VoucherSetupAlreadyAccepted();
    error VoucherSetupAborted();
    error SetupAbortNotAuthorized();
    error CoreOnly();

    event RedemptionPrepared(bytes32 indexed redemptionId, uint256 indexed commitmentId, bytes32 indexed payloadHash);
    event RedemptionDispatched(bytes32 indexed redemptionId, bytes32 indexed messageId);
    event RedemptionResultRecorded(
        bytes32 indexed redemptionId,
        uint64 indexed sequence,
        RedemptionState state,
        uint256 escrowedUnits,
        uint256 holderApprovedServiceUnits,
        uint256 holderApprovedVoucherUnits,
        uint256 mutualReturnUnits,
        uint256 releasedUnits,
        uint256 returnedUnits,
        bool actionSucceeded,
        bytes32 failureHash
    );
    event VoucherSetupPrepared(
        bytes32 indexed setupId,
        uint256 indexed commitmentId,
        bytes32 indexed authorizationHash,
        Service.SetupAuthorization authorization
    );
    event VoucherSetupDecisionSelected(
        bytes32 indexed setupId, bytes32 indexed decisionId, Service.SetupDecisionCommand command
    );
    event VoucherSetupDispatched(bytes32 indexed setupId, bytes32 indexed messageId, uint8 kind);
    event VoucherSetupResultRecorded(bytes32 indexed setupId, uint64 indexed sequence, Service.SetupResult result);
    event VoucherFinalResultRecorded(bytes32 indexed setupId, uint64 indexed sequence, Service.FinalResultV2 result);
    event VoucherHolderAbortRequested(bytes32 indexed setupId, address indexed holder, bool alreadyAccepted);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router_) VoucherEndpoint(router_) { }

    function initialize(
        address owner_,
        address guardian_,
        uint64 destinationSelector_,
        uint256 destinationChainId_,
        address destinationEscrow_,
        address commitmentPooling_
    )
        external
        initializer
    {
        if (commitmentPooling_.code.length == 0) revert InvalidEndpoint();
        __VoucherEndpoint_init(owner_, guardian_, destinationSelector_, destinationChainId_, destinationEscrow_);
        commitmentPooling = ICommitmentServiceOffers(commitmentPooling_);
        if (
            commitmentPooling.serviceOfferProtocolVersion() != 1
                || Acceptance(commitmentPooling_).voucherAcceptanceProtocolVersion() != 1
        ) revert InvalidServiceAuthorization();
    }

    function voucherAcceptanceProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function prepareVoucherSetup(
        uint256 commitmentId,
        uint64 expectedRevision,
        bytes32 expectedTermsHash,
        bytes32 expectedClaimHash,
        uint64 expectedRequestNonce,
        uint64 acceptanceDeadline
    )
        external
        whenVoucherActive
        nonReentrant
        returns (bytes32 id)
    {
        if (block.chainid != LOCAL_CHAIN_ID) revert InvalidEndpoint();
        if (
            Acceptance(address(commitmentPooling)).voucherServiceSetupModule() != address(this)
                || acceptanceDeadline < block.timestamp
        ) revert InvalidServiceAuthorization();
        Service.SetupAuthorization memory a = Consent.authorization(
            address(commitmentPooling),
            msg.sender,
            commitmentId,
            acceptanceDeadline,
            LOCAL_CHAIN_ID,
            remoteChainId,
            remotePeer
        );
        Consent.validateIdentity(a);
        if (
            a.termsRevision != expectedRevision || a.termsHash != expectedTermsHash || a.claimHash != expectedClaimHash
                || a.requestNonce != expectedRequestNonce || !Consent.matchesPending(a)
        ) revert InvalidServiceAuthorization();
        id = Service.setupId(a);
        Store.State storage s = Store.state();
        bytes32 previous = s.setupOfClaim[commitmentId][a.claimHash];
        bytes32 authorizationHash = Service.hash(a);
        if (previous != bytes32(0)) {
            if (previous != id || s.setups[id].authorizationHash != authorizationHash) revert RedemptionAlreadyPrepared();
            return id;
        }
        s.setupOfClaim[commitmentId][a.claimHash] = id;
        s.setups[id].authorizationHash = authorizationHash;
        s.authorizations[id] = Service.encodeAuthorization(a);
        emit VoucherSetupPrepared(id, commitmentId, authorizationHash, a);
    }

    /// @dev STATICCALL only: current Offered+pending views remain intact until this returns.
    function validateVoucherServiceAcceptance(
        uint256 commitmentId,
        address buyer,
        uint64 revision,
        bytes32 termsHash,
        bytes32 claimHash,
        uint64 requestNonce,
        address holder
    )
        external
        view
        returns (bytes32 id, bytes32 authorizationHash, bytes32 depositReceiptHash)
    {
        if (msg.sender != address(commitmentPooling)) revert CoreOnly();
        if (paused) revert VoucherPaused();
        id = Store.state().setupOfClaim[commitmentId][claimHash];
        Service.SetupAuthorization memory a = Outbox.authorization(id, LOCAL_CHAIN_ID);
        Store.SourceSetup storage record = Store.state().setups[id];
        if (
            a.buyer != buyer || a.termsRevision != revision || a.termsHash != termsHash || a.claimHash != claimHash
                || a.requestNonce != requestNonce || a.holder != holder || block.timestamp > a.acceptanceDeadline
                || record.decision != Service.SetupDecision.None || !Consent.matchesPending(a)
                || record.depositedUnits != a.voucherUnits || record.setupRefundedUnits != 0
                || !Store.state().latestSetupResults[id].issuerApproved
                || record.latestDestinationPhase != Service.SetupPhase.Deposited
                || record.depositReceiptHash != Service.depositReceiptHash(a)
        ) revert VoucherSetupNotReady();
        return (id, record.authorizationHash, record.depositReceiptHash);
    }

    /// @notice Exact accepted-ever receipt wins even after deadline/lifecycle changes.
    function finalizeActivation(bytes32 id, bytes32 expectedAuthorizationHash) external nonReentrant returns (bytes32) {
        return _activate(Outbox.boundAuthorization(id, expectedAuthorizationHash, LOCAL_CHAIN_ID));
    }

    /// @notice Source expiry selects an Abort certificate; Gnosis never infers local expiry.
    function abortSetup(bytes32 id, bytes32 expectedAuthorizationHash) external nonReentrant returns (bytes32) {
        Service.SetupAuthorization memory a = Outbox.boundAuthorization(id, expectedAuthorizationHash, LOCAL_CHAIN_ID);
        Service.AbortReason reason;
        if (msg.sender == a.buyer) reason = Service.AbortReason.BuyerRequest;
        else if (block.timestamp > a.acceptanceDeadline) reason = Service.AbortReason.Deadline;
        else if (!Consent.matchesPending(a)) reason = Service.AbortReason.ClaimInvalid;
        else revert SetupAbortNotAuthorized();
        return _recordDecision(Outbox.abort(a, reason));
    }

    /// @param kind 0 = immutable Authorization; 1 = selected immutable Activate/Abort Decision.
    function quoteSetupCommand(bytes32 id, uint8 kind) public view returns (uint256) {
        return _quote(Outbox.setupCommand(id, kind, LOCAL_CHAIN_ID), COMMAND_GAS_LIMIT);
    }

    function dispatchSetupCommand(bytes32 id, uint8 kind) external payable nonReentrant returns (bytes32 messageId) {
        bytes memory command = Outbox.setupCommand(id, kind, LOCAL_CHAIN_ID);
        Store.SourceSetup storage record = Store.state().setups[id];
        if (paused && (kind == 0 || record.decision != Service.SetupDecision.Abort)) revert VoucherPaused();
        uint256 fee = _quote(command, COMMAND_GAS_LIMIT);
        if (msg.value != fee) revert IncorrectRedemptionFee(fee, msg.value);
        messageId = _send(command, COMMAND_GAS_LIMIT);
        if (kind == 0) record.lastPrepareMessageId = messageId;
        else record.lastDecisionMessageId = messageId;
        emit VoucherSetupDispatched(id, messageId, kind);
    }

    function getSetup(bytes32 id) external view returns (Store.SourceSetup memory) {
        return Store.state().setups[id];
    }

    function getSetupAuthorization(bytes32 id) external view returns (Service.SetupAuthorization memory) {
        return Outbox.authorization(id, LOCAL_CHAIN_ID);
    }

    function setupOfClaim(uint256 commitmentId, bytes32 claimHash) external view returns (bytes32) {
        return Store.state().setupOfClaim[commitmentId][claimHash];
    }

    function getSetupResult(bytes32 id) external view returns (Service.SetupResult memory) {
        return Store.state().latestSetupResults[id];
    }

    function getFinalResult(bytes32 id) external view returns (Service.FinalResultV2 memory) {
        return Store.state().latestFinalResults[id];
    }

    function getSetupCommand(bytes32 id, uint8 kind) external view returns (bytes memory) {
        return Outbox.setupCommand(id, kind, LOCAL_CHAIN_ID);
    }

    // Retain v1 selectors/layouts without retaining accepted-first execution.
    function prepareRedemption(uint256) external pure returns (bytes32) {
        revert VoucherSetupRequired();
    }

    function quoteDispatch(bytes32) public pure returns (uint256) {
        revert VoucherSetupRequired();
    }

    function dispatch(bytes32) external payable returns (bytes32) {
        revert VoucherSetupRequired();
    }

    function getRedemption(bytes32 id) external view returns (Redemption memory) {
        return _redemptions[id];
    }

    function getCommand(bytes32 id) external view returns (bytes memory) {
        return _commands[id];
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        _authenticate(message);
        Store.State storage s = Store.state();
        bytes32 payloadHash = keccak256(message.data);
        bytes32 previous = s.receivedTransportPayload[message.messageId];
        if (previous != bytes32(0)) {
            if (previous != payloadHash) revert ConflictingRedemptionTransport();
            return;
        }
        bytes32 kind = Service.messageKind(message.data);
        if (kind == Service.SETUP_RESULT_KIND) _recordSetup(Service.decodeSetupResult(message.data));
        else if (kind == Service.FINAL_RESULT_KIND) _recordFinal(Service.decodeFinalResult(message.data));
        else if (kind == Service.HOLDER_ABORT_KIND) _holderAbort(Service.decodeHolderAbortRequest(message.data));
        else revert Service.UnsupportedVoucherServiceMessage();
        s.receivedTransportPayload[message.messageId] = payloadHash;
    }

    function _recordSetup(Service.SetupResult memory r) private {
        Service.SetupAuthorization memory a = Outbox.authorization(r.setupId, LOCAL_CHAIN_ID);
        Store.State storage s = Store.state();
        Store.SourceSetup storage record = s.setups[r.setupId];
        bytes32 resultHash = keccak256(abi.encode(r));
        bytes32 prior = s.setupSequenceHashes[r.setupId][r.resultSequence];
        if (prior != bytes32(0) && prior != resultHash) revert ConflictingRedemptionResult();
        if (r.decision == Service.SetupDecision.Activate) _activate(a);
        Results.validateSetup(r, a, record.decision, record.decisionId);
        s.setupSequenceHashes[r.setupId][r.resultSequence] = resultHash;
        if (r.resultSequence <= record.latestResultSequence) return;
        Results.setupProgress(s.latestSetupResults[r.setupId], r);
        record.latestResultHash = resultHash;
        record.latestResultSequence = r.resultSequence;
        record.latestDestinationPhase = r.phase;
        record.depositReceiptHash = r.depositReceiptHash;
        record.depositedUnits = r.depositedUnits;
        record.setupRefundedUnits = r.setupRefundedUnits;
        s.latestSetupResults[r.setupId] = r;
        emit VoucherSetupResultRecorded(r.setupId, r.resultSequence, r);
    }

    function _recordFinal(Service.FinalResultV2 memory r) private {
        Service.SetupAuthorization memory a = Outbox.authorization(r.setupId, LOCAL_CHAIN_ID);
        Store.State storage s = Store.state();
        bytes32 resultHash = keccak256(abi.encode(r));
        bytes32 prior = s.finalSequenceHashes[r.setupId][r.sequence];
        if (prior != bytes32(0) && prior != resultHash) revert ConflictingRedemptionResult();
        Results.validateFinal(r, a, _activate(a));
        s.finalSequenceHashes[r.setupId][r.sequence] = resultHash;
        if (r.sequence <= s.latestFinalResults[r.setupId].sequence) return;
        Results.finalProgress(s.latestFinalResults[r.setupId], r);
        s.latestFinalResults[r.setupId] = r;
        emit VoucherFinalResultRecorded(r.setupId, r.sequence, r);
    }

    function _holderAbort(Service.HolderAbortRequest memory request) private {
        Service.SetupAuthorization memory a =
            Outbox.boundAuthorization(request.setupId, request.authorizationHash, LOCAL_CHAIN_ID);
        if (request.holder != a.holder) revert InvalidServiceAuthorization();
        (, bool accepted) = Consent.acceptedReceipt(a);
        emit VoucherHolderAbortRequested(request.setupId, request.holder, accepted);
        if (!accepted) _recordDecision(Outbox.abort(a, Service.AbortReason.HolderRequest));
    }

    function _activate(Service.SetupAuthorization memory a) private returns (bytes32) {
        return _recordDecision(Outbox.activate(a, redemptionOfCommitment));
    }

    function _recordDecision(Outbox.Selection memory selection) private returns (bytes32) {
        if (selection.changed) {
            emit VoucherSetupDecisionSelected(selection.setupId, selection.decisionId, selection.command);
        }
        return selection.decisionId;
    }
}
