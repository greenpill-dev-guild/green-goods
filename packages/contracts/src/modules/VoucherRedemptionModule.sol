// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers } from "../interfaces/ICommitmentServiceOffers.sol";
import { VoucherRedemptionCodec as Codec } from "../libraries/VoucherRedemptionCodec.sol";
import { VoucherEndpoint } from "./VoucherEndpoint.sol";

/// @notice Coordinates voucher escrow against the existing accepted service commitment.
/// @dev Holder service approvals, financial allocation and core fulfillment are separate facts.
contract VoucherRedemptionModule is VoucherEndpoint {
    uint256 public constant COMMAND_GAS_LIMIT = 2_000_000;
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
    error IncorrectRedemptionFee(uint256 required, uint256 provided);

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
        if (commitmentPooling.serviceOfferProtocolVersion() != 1) revert InvalidServiceAuthorization();
    }

    function prepareRedemption(uint256 commitmentId) external whenVoucherActive nonReentrant returns (bytes32 id) {
        if (block.chainid != LOCAL_CHAIN_ID) revert InvalidEndpoint();
        if (redemptionOfCommitment[commitmentId] != bytes32(0)) revert RedemptionAlreadyPrepared();
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted =
            commitmentPooling.getAcceptedServiceTerms(commitmentId);
        if (msg.sender != accepted.buyer) revert SourceBuyerOnly();
        ICommitmentPoolingModule.Commitment memory commitment =
            ICommitmentPoolingModule(address(commitmentPooling)).getCommitment(commitmentId);
        _validateAccepted(accepted, commitment);
        Codec.Authorization memory authorization = _authorization(commitmentId, accepted);
        id = Codec.redemptionId(authorization);
        bytes32 payloadHash = Codec.hash(authorization);
        redemptionOfCommitment[commitmentId] = id;
        _commands[id] = Codec.encodeAuthorization(authorization);
        Redemption storage record = _redemptions[id];
        record.commitmentId = commitmentId;
        record.payloadHash = payloadHash;
        record.state = RedemptionState.Prepared;
        emit RedemptionPrepared(id, commitmentId, payloadHash);
    }

    function quoteDispatch(bytes32 id) public view returns (uint256) {
        _known(id);
        return _quote(_commands[id], COMMAND_GAS_LIMIT);
    }

    /// @notice Every retry resends the same accepted snapshot and is funded by its caller.
    function dispatch(bytes32 id) external payable whenVoucherActive nonReentrant returns (bytes32 messageId) {
        Redemption storage record = _known(id);
        if (msg.sender != Codec.decodeAuthorization(_commands[id]).buyer) revert SourceBuyerOnly();
        if (record.state == RedemptionState.Closed) revert EscrowAlreadyClosed();
        uint256 fee = quoteDispatch(id);
        if (msg.value != fee) revert IncorrectRedemptionFee(fee, msg.value);
        if (record.latestResult.resultSequence == 0) record.state = RedemptionState.Pending;
        messageId = _send(_commands[id], COMMAND_GAS_LIMIT);
        record.lastMessageId = messageId;
        emit RedemptionDispatched(id, messageId);
    }

    function getRedemption(bytes32 id) external view returns (Redemption memory) {
        return _redemptions[id];
    }

    function getCommand(bytes32 id) external view returns (bytes memory) {
        return _commands[id];
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        _authenticate(message);
        bytes32 dataHash = keccak256(message.data);
        bytes32 previousHash = acknowledgmentMessages[message.messageId];
        if (previousHash != bytes32(0)) {
            if (previousHash != dataHash) revert ConflictingRedemptionTransport();
            return;
        }
        Codec.Result memory result = Codec.decodeResult(message.data);
        Redemption storage record = _known(result.redemptionId);
        if (record.lastMessageId == bytes32(0)) revert UnknownRedemption();
        Codec.Authorization memory authorization = Codec.decodeAuthorization(_commands[result.redemptionId]);
        Codec.validateResult(result, authorization);
        bytes32 resultHash = keccak256(abi.encode(result));
        if (result.resultSequence == record.latestResult.resultSequence && resultHash != record.resultHash) {
            revert ConflictingRedemptionResult();
        }
        acknowledgmentMessages[message.messageId] = dataHash;
        if (result.resultSequence <= record.latestResult.resultSequence) return;
        if (record.state == RedemptionState.Closed) revert ConflictingRedemptionResult();
        Codec.validateProgress(record.latestResult, result);
        record.latestResult = result;
        record.resultHash = resultHash;
        record.state = result.releasedUnits + result.returnedUnits == authorization.totalVoucherUnits
            ? RedemptionState.Closed
            : RedemptionState.Active;
        emit RedemptionResultRecorded(
            result.redemptionId,
            result.resultSequence,
            record.state,
            result.escrowedUnits,
            result.holderApprovedServiceUnits,
            result.holderApprovedVoucherUnits,
            result.mutualReturnUnits,
            result.releasedUnits,
            result.returnedUnits,
            result.actionSucceeded,
            result.failureHash
        );
    }

    function _validateAccepted(
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted,
        ICommitmentPoolingModule.Commitment memory commitment
    )
        private
        view
    {
        bool active = commitment.state == ICommitmentPoolingModule.CommitmentState.Accepted
            || commitment.state == ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation
            || commitment.state == ICommitmentPoolingModule.CommitmentState.Fulfilled;
        if (
            !active || accepted.offer.terms.route != ICommitmentServiceOffers.ServicePaymentRoute.Voucher
                || accepted.offer.revision == 0 || accepted.offer.termsHash == bytes32(0)
                || accepted.consent.termsRevision != accepted.offer.revision
                || accepted.consent.termsHash != accepted.offer.termsHash || accepted.consent.claimHash == bytes32(0)
                || accepted.buyer == address(0) || accepted.serviceRecipient != accepted.buyer
                || accepted.consent.voucherHolder == address(0) || accepted.consent.buyerGarden == address(0)
                || accepted.consent.buyerGarden != commitment.payerGarden || accepted.providerGarden == address(0)
                || accepted.providerGarden != commitment.providerGarden || commitment.counterparty != accepted.buyer
                || commitment.direction != ICommitmentPoolingModule.CommitmentDirection.Offer
                || commitment.claimType != ICommitmentPoolingModule.ClaimType.Individual
                || commitment.claimMode != ICommitmentPoolingModule.ClaimMode.ApprovalGated
                || commitment.consideration.rail != ICommitmentPoolingModule.ConsiderationRail.None
                || commitment.consideration.amount != 0 || commitment.consideration.token != address(0)
                || commitment.consideration.source != address(0) || accepted.gdPrice != 0
                || accepted.offer.terms.voucherChainId != remoteChainId || accepted.offer.terms.voucherIssuer == address(0)
                || accepted.offer.terms.voucherToken == address(0) || accepted.offer.terms.voucherUnits == 0
                || accepted.offer.terms.voucherUnits == type(uint256).max || accepted.serviceUnits == 0
                || accepted.serviceUnits != commitment.targetUnits
                || accepted.unitLabelHash != keccak256(bytes(commitment.unitLabel))
                || accepted.offer.terms.serviceTermsRef == bytes32(0) || accepted.offer.terms.remedyTermsRef == bytes32(0)
        ) {
            revert InvalidServiceAuthorization();
        }
    }

    function _authorization(
        uint256 commitmentId,
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted
    )
        private
        view
        returns (Codec.Authorization memory authorization)
    {
        authorization.version = Codec.VERSION;
        authorization.sourceChainId = LOCAL_CHAIN_ID;
        authorization.sourceModule = address(this);
        authorization.commitmentId = commitmentId;
        authorization.revision = accepted.offer.revision;
        authorization.acceptedClaimHash = accepted.consent.claimHash;
        authorization.termsHash = accepted.offer.termsHash;
        authorization.buyer = accepted.buyer;
        authorization.holder = accepted.consent.voucherHolder;
        authorization.buyerGarden = accepted.consent.buyerGarden;
        authorization.providerGarden = accepted.providerGarden;
        authorization.destinationChainId = remoteChainId;
        authorization.destinationEscrow = remotePeer;
        authorization.issuer = accepted.offer.terms.voucherIssuer;
        authorization.token = accepted.offer.terms.voucherToken;
        authorization.totalVoucherUnits = accepted.offer.terms.voucherUnits;
        authorization.totalServiceUnits = accepted.serviceUnits;
        authorization.serviceUnitLabelHash = accepted.unitLabelHash;
        authorization.serviceTermsRef = accepted.offer.terms.serviceTermsRef;
        authorization.remedyTermsRef = accepted.offer.terms.remedyTermsRef;
        authorization.remedyPolicy = Codec.MUTUAL_CONSENT;
    }

    function _known(bytes32 id) private view returns (Redemption storage record) {
        record = _redemptions[id];
        if (record.payloadHash == bytes32(0)) revert UnknownRedemption();
    }
}
