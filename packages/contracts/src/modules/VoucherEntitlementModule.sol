// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentVoucherAcceptance as VoucherAcceptance } from "../interfaces/ICommitmentVoucherAcceptance.sol";
import { IEarnedVoucherAcceptancePeer } from "../interfaces/IVoucherAcceptancePeers.sol";
import { VoucherDistributionResult } from "../libraries/VoucherDistributionResult.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { VoucherMessageCodec } from "../libraries/VoucherMessageCodec.sol";
import { VoucherSourceAuthority as Authority } from "../libraries/VoucherSourceAuthority.sol";
import { VoucherRecognitionAllocation } from "../libraries/VoucherRecognitionAllocation.sol";
import { VoucherEndpoint } from "./VoucherEndpoint.sol";

/// @notice Arbitrum earned-voucher authorization and authenticated destination receipts.
/// @dev Atomic core terms binding, no custody or G$ call. Fulfilled includes every legitimate core path;
///      this module never infers that the beneficiary personally confirmed. Core events retain
///      the actual confirmation/dispute history. Core acceptance enforces exact voucher consent.
contract VoucherEntitlementModule is VoucherEndpoint {
    bytes32 public constant RECOGNITION_POLICY = keccak256("GREEN_GOODS_CANONICAL_RECOGNITION_V1");
    bytes32 private constant TERMS_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_TERMS_V1");
    uint256 public constant MAX_RECIPIENTS = 40;
    uint256 public constant COMMAND_GAS_LIMIT = 6_000_000;

    struct TermsInput {
        address issuer;
        address issuerAuthority;
        address token;
        uint256 totalUnits;
        bytes32 allocationPolicy;
        bytes32 serviceTermsRef;
        uint256 season; // existing core cycle ID, including zero for a cycle-less promise
    }

    struct Terms {
        uint64 revision;
        TermsInput agreed;
        bytes32 termsHash;
        bool issuerApproved;
        bool frozen;
    }

    enum DeliveryState {
        None,
        Prepared,
        Pending,
        Failed,
        Delivered
    }

    struct Distribution {
        uint256 commitmentId;
        bytes32 payloadHash;
        DeliveryState state;
        uint64 resultSequence;
        bytes32 resultHash;
        bytes32 failureHash;
        bytes32 lastMessageId;
    }

    ICommitmentPoolingModule public commitmentPooling;
    IHatsModule public hatsModule;
    mapping(address issuer => mapping(address token => address authority)) public issuerAuthority;
    mapping(uint256 commitmentId => Terms terms) private _terms;
    mapping(uint256 commitmentId => mapping(address participant => uint64 revision)) public consentRevision;
    mapping(uint256 commitmentId => bytes32 entitlement) public distributionOfCommitment;
    mapping(bytes32 entitlement => Distribution distribution) private _distributions;
    mapping(bytes32 entitlement => bytes payload) private _commands;
    mapping(bytes32 messageId => bytes32 dataHash) public acknowledgmentMessages;

    error NotVoucherSteward();
    error NotCommitmentPooling();
    error TermsNotPreAcceptance();
    error InvalidVoucherTerms();
    error TermsFrozen();
    error WrongTermsRevision();
    error IssuerApprovalRequired();
    error NotIssuerAuthority();
    error CreatorMustFreezeTerms();
    error VoucherConsentMissing();
    error CommitmentNotFulfilled();
    error InvalidVoucherAllocation();
    error DistributionAlreadyPrepared();
    error UnknownVoucherEntitlement();
    error VoucherAlreadyDelivered();
    error ConflictingVoucherResult();
    error ConflictingTransportMessage();

    event IssuerAuthorityConfigured(address indexed issuer, address indexed token, address indexed authority);
    event VoucherTermsRegistered(uint256 indexed commitmentId, uint64 indexed revision, bytes32 termsHash);
    event VoucherTermsApproved(uint256 indexed commitmentId, uint64 indexed revision, address indexed issuerAuthority);
    event VoucherTermsConsented(uint256 indexed commitmentId, uint64 indexed revision, address indexed participant);
    event VoucherDistributionPrepared(bytes32 indexed entitlementId, uint256 indexed commitmentId, bytes32 payloadHash);
    event VoucherDistributionDispatched(bytes32 indexed entitlementId, bytes32 indexed messageId);
    event VoucherResultRecorded(
        bytes32 indexed entitlementId, uint64 indexed resultSequence, bool success, bytes32 failureHash
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router_) VoucherEndpoint(router_) { }

    function initialize(
        address owner_,
        address guardian_,
        uint64 remoteSelector_,
        uint256 remoteChainId_,
        address remotePeer_,
        address commitmentPooling_,
        address hatsModule_
    )
        external
        initializer
    {
        if (commitmentPooling_.code.length == 0 || hatsModule_.code.length == 0) revert InvalidEndpoint();
        __VoucherEndpoint_init(owner_, guardian_, remoteSelector_, remoteChainId_, remotePeer_);
        commitmentPooling = ICommitmentPoolingModule(commitmentPooling_);
        hatsModule = IHatsModule(hatsModule_);
    }

    /// @notice Community governance binds real source identities before activation. It can change
    ///         future registrations, not the authority or payload snapshotted in an existing revision.
    /// @dev Identity/issuer approval and signer evidence remain live-release prerequisites.
    function setIssuerAuthority(address issuer, address token, address authority) external onlyOwner nonReentrant {
        if (!paused || issuer == address(0) || token == address(0)) revert InvalidVoucherTerms();
        issuerAuthority[issuer][token] = authority;
        emit IssuerAuthorityConfigured(issuer, token, authority);
    }

    function voucherAcceptanceProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function registerTerms(
        uint256 commitmentId,
        TermsInput calldata input
    )
        external
        whenVoucherActive
        nonReentrant
        returns (uint64 revision)
    {
        ICommitmentPoolingModule.Commitment memory commitment = Authority.preAcceptance(commitmentPooling, commitmentId);
        Authority.requireSteward(commitmentPooling, hatsModule, commitment.poolId);
        Terms storage terms = _terms[commitmentId];
        if (terms.frozen) revert TermsFrozen();
        if (
            input.issuer == address(0) || input.issuerAuthority == address(0) || input.token == address(0)
                || input.totalUnits == 0 || input.totalUnits == type(uint256).max || input.serviceTermsRef == bytes32(0)
                || input.allocationPolicy != RECOGNITION_POLICY || input.season != commitment.cycleId
                || issuerAuthority[input.issuer][input.token] != input.issuerAuthority
        ) revert InvalidVoucherTerms();
        revision = terms.revision + 1;
        terms.revision = revision;
        terms.agreed = input;
        terms.termsHash = keccak256(
            abi.encode(
                TERMS_DOMAIN, LOCAL_CHAIN_ID, address(this), commitmentId, revision, input, remoteChainId, remotePeer
            )
        );
        terms.issuerApproved = false;
        VoucherAcceptance(address(commitmentPooling)).bindEarnedVoucherTerms(commitmentId, revision, terms.termsHash);
        emit VoucherTermsRegistered(commitmentId, revision, terms.termsHash);
    }

    function approveTerms(uint256 commitmentId, uint64 expectedRevision) external whenVoucherActive nonReentrant {
        Authority.preAcceptance(commitmentPooling, commitmentId);
        Terms storage terms = _expectedTerms(commitmentId, expectedRevision);
        if (msg.sender != terms.agreed.issuerAuthority) revert NotIssuerAuthority();
        terms.issuerApproved = true;
        emit VoucherTermsApproved(commitmentId, expectedRevision, msg.sender);
    }

    /// @notice Creator consent freezes the issuer-approved revision before core acceptance. An
    ///         eventual counterparty then consents to that exact frozen revision. A Garden claim
    ///         requires its actual GardenAccount to call, e.g. through existing account execution;
    ///         a steward's personal consent is never relabeled as the GardenAccount's consent.
    /// @dev The pinned core guard requires this exact frozen revision before either acceptance path.
    function consentTerms(uint256 commitmentId, uint64 expectedRevision) external whenVoucherActive nonReentrant {
        ICommitmentPoolingModule.Commitment memory commitment = Authority.preAcceptance(commitmentPooling, commitmentId);
        Terms storage terms = _expectedTerms(commitmentId, expectedRevision);
        if (!terms.issuerApproved) revert IssuerApprovalRequired();
        if (!terms.frozen) {
            if (msg.sender != commitment.creator) revert CreatorMustFreezeTerms();
            terms.frozen = true;
        }
        consentRevision[commitmentId][msg.sender] = expectedRevision;
        emit VoucherTermsConsented(commitmentId, expectedRevision, msg.sender);
    }

    /// @notice Named, read-only core acceptance guard; a steward cannot substitute for a GardenAccount.
    function validateEarnedVoucherAcceptance(
        uint256 commitmentId,
        uint64 revision,
        bytes32 termsHash,
        address creator,
        address counterparty
    )
        external
        view
        whenVoucherActive
        returns (bytes4)
    {
        if (msg.sender != address(commitmentPooling)) revert NotCommitmentPooling();
        Terms storage terms = _terms[commitmentId];
        if (
            terms.revision != revision || terms.termsHash != termsHash || !terms.issuerApproved || !terms.frozen
                || creator == address(0) || counterparty == address(0) || consentRevision[commitmentId][creator] != revision
                || consentRevision[commitmentId][counterparty] != revision
        ) revert VoucherConsentMissing();
        return IEarnedVoucherAcceptancePeer.validateEarnedVoucherAcceptance.selector;
    }

    function prepareDistribution(
        uint256 commitmentId,
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries,
        bytes32 suppliedRecognitionHash
    )
        external
        whenVoucherActive
        nonReentrant
        returns (bytes32 entitlement)
    {
        ICommitmentPoolingModule.Commitment memory commitment = commitmentPooling.getCommitment(commitmentId);
        Authority.requireSteward(commitmentPooling, hatsModule, commitment.poolId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Fulfilled) revert CommitmentNotFulfilled();
        Terms storage terms = _terms[commitmentId];
        VoucherAcceptance.EarnedVoucherBinding memory binding =
            VoucherAcceptance(address(commitmentPooling)).getEarnedVoucherBinding(commitmentId);
        if (
            binding.module != address(this) || binding.acceptedRevision != terms.revision
                || binding.acceptedTermsHash != terms.termsHash || binding.acceptedCounterparty != commitment.counterparty
                || !terms.frozen || !terms.issuerApproved || terms.revision == 0
                || consentRevision[commitmentId][commitment.creator] != terms.revision
                || commitment.counterparty == address(0)
                || consentRevision[commitmentId][commitment.counterparty] != terms.revision
        ) revert VoucherConsentMissing();
        if (distributionOfCommitment[commitmentId] != bytes32(0)) revert DistributionAlreadyPrepared();
        if (entries.length == 0 || entries.length > MAX_RECIPIENTS) revert InvalidVoucherAllocation();
        bytes32 recognitionHash =
            commitmentPooling.validateRecognitionSnapshot(commitmentId, entries, suppliedRecognitionHash);
        VoucherMessageCodec.Command memory command = _makeCommand(commitmentId, terms, entries, recognitionHash);
        entitlement = VoucherMessageCodec.entitlementId(command);
        bytes32 payloadHash = VoucherMessageCodec.hash(command);
        distributionOfCommitment[commitmentId] = entitlement;
        _commands[entitlement] = VoucherMessageCodec.encodeCommand(command);
        // Entitlement identity is unique per commitment/revision and preparation is one-shot.
        Distribution storage distribution = _distributions[entitlement];
        distribution.commitmentId = commitmentId;
        distribution.payloadHash = payloadHash;
        distribution.state = DeliveryState.Prepared;
        emit VoucherDistributionPrepared(entitlement, commitmentId, payloadHash);
    }

    /// @notice Dispatch and transport retries send identical authorized bytes and identity. A late
    ///         acknowledgment never authorizes cancellation, replacement value or another reward.
    function dispatch(bytes32 entitlement) external payable whenVoucherActive nonReentrant returns (bytes32 messageId) {
        Distribution storage distribution = _knownDistribution(entitlement);
        Authority.requireSteward(
            commitmentPooling, hatsModule, commitmentPooling.getCommitment(distribution.commitmentId).poolId
        );
        if (distribution.state == DeliveryState.Delivered) revert VoucherAlreadyDelivered();
        distribution.state = DeliveryState.Pending;
        messageId = _send(_commands[entitlement], COMMAND_GAS_LIMIT);
        distribution.lastMessageId = messageId;
        emit VoucherDistributionDispatched(entitlement, messageId);
    }

    function getTerms(uint256 commitmentId) external view returns (Terms memory) {
        return _terms[commitmentId];
    }

    function getDistribution(bytes32 entitlement) external view returns (Distribution memory) {
        return _distributions[entitlement];
    }

    function getCommand(bytes32 entitlement) external view returns (bytes memory) {
        return _commands[entitlement];
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        _authenticate(message);
        bytes32 messageHash = keccak256(message.data);
        bytes32 priorMessageHash = acknowledgmentMessages[message.messageId];
        if (priorMessageHash != bytes32(0)) {
            if (priorMessageHash != messageHash) revert ConflictingTransportMessage();
            return;
        }
        VoucherMessageCodec.Ack memory result = VoucherMessageCodec.decodeAck(message.data);
        Distribution storage distribution = _knownDistribution(result.entitlementId);
        if (distribution.lastMessageId == bytes32(0)) revert UnknownVoucherEntitlement();
        bytes32 resultHash = VoucherDistributionResult.validate(
            result,
            distribution.payloadHash,
            distribution.resultSequence,
            distribution.resultHash,
            distribution.state == DeliveryState.Delivered
        );
        acknowledgmentMessages[message.messageId] = messageHash;
        if (result.resultSequence <= distribution.resultSequence || distribution.state == DeliveryState.Delivered) return;
        distribution.resultSequence = result.resultSequence;
        distribution.resultHash = resultHash;
        distribution.failureHash = result.failureHash;
        distribution.state = result.success ? DeliveryState.Delivered : DeliveryState.Failed;
        emit VoucherResultRecorded(result.entitlementId, result.resultSequence, result.success, result.failureHash);
    }

    function _makeCommand(
        uint256 commitmentId,
        Terms storage terms,
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries,
        bytes32 recognitionHash
    )
        private
        view
        returns (VoucherMessageCodec.Command memory command)
    {
        (command.recipients, command.amounts) = VoucherRecognitionAllocation.allocate(entries, terms.agreed.totalUnits);
        command.version = VoucherMessageCodec.VERSION;
        command.sourceChainId = LOCAL_CHAIN_ID;
        command.sourceModule = address(this);
        command.commitmentId = commitmentId;
        command.revision = terms.revision;
        command.issuer = terms.agreed.issuer;
        command.issuerAuthority = terms.agreed.issuerAuthority;
        command.destinationChainId = remoteChainId;
        command.destinationAdapter = remotePeer;
        command.token = terms.agreed.token;
        command.totalUnits = terms.agreed.totalUnits;
        command.termsHash = terms.termsHash;
        command.recognitionHash = recognitionHash;
        command.policyContext =
            keccak256(abi.encode(terms.agreed.allocationPolicy, terms.agreed.serviceTermsRef, terms.agreed.season));
    }

    function _expectedTerms(uint256 commitmentId, uint64 expectedRevision) private view returns (Terms storage terms) {
        terms = _terms[commitmentId];
        if (expectedRevision == 0 || terms.revision != expectedRevision) revert WrongTermsRevision();
    }

    function _knownDistribution(bytes32 entitlement) private view returns (Distribution storage distribution) {
        distribution = _distributions[entitlement];
        if (distribution.state == DeliveryState.None) revert UnknownVoucherEntitlement();
    }

    // Nine slots above plus the reserved gap; dependencies and peer configuration have no setters.
    uint256[41] private __gap;
}
