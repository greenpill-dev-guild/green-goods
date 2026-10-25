// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Voucher setup and final settlement v2; v1 storage/wire tuples remain separate.
library VoucherServiceCodec {
    uint8 internal constant VERSION = 2;
    uint8 internal constant MUTUAL_CONSENT = 1;
    bytes32 internal constant AUTHORIZATION_KIND = keccak256("GREEN_GOODS_VOUCHER_SETUP_AUTHORIZATION_V2");
    bytes32 internal constant DECISION_KIND = keccak256("GREEN_GOODS_VOUCHER_SETUP_DECISION_V2");
    bytes32 internal constant SETUP_RESULT_KIND = keccak256("GREEN_GOODS_VOUCHER_SETUP_RESULT_V2");
    bytes32 internal constant HOLDER_ABORT_KIND = keccak256("GREEN_GOODS_VOUCHER_SETUP_HOLDER_ABORT_V2");
    bytes32 internal constant FINAL_RESULT_KIND = keccak256("GREEN_GOODS_VOUCHER_FINAL_RESULT_V2");
    bytes32 internal constant SETUP_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_SETUP_V2");
    bytes32 internal constant DEPOSIT_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_DEPOSIT_V2");
    bytes32 internal constant DECISION_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_SETUP_DECISION_V2");
    bytes32 internal constant FINAL_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_FINAL_ALLOCATION_V2");
    bytes32 internal constant LEG_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_FINAL_LEG_V2");

    enum SetupDecision {
        None,
        Activate,
        Abort
    }
    enum SetupPhase {
        None,
        Authorized,
        Deposited,
        Active,
        AbortRefundPending,
        Aborted
    }
    enum SetupAction {
        None,
        Deposit,
        AbortRefund
    }
    enum AbortReason {
        None,
        BuyerRequest,
        HolderRequest,
        ClaimInvalid,
        Deadline
    }
    enum FinalLeg {
        ReleaseToIssuer,
        RefundToHolder
    }
    enum LegState {
        NotRequired,
        Pending,
        Failed,
        Succeeded
    }

    struct SetupAuthorization {
        uint8 version;
        uint256 sourceChainId;
        address sourceModule;
        address coreModule;
        uint256 commitmentId;
        uint64 termsRevision;
        bytes32 termsHash;
        bytes32 claimHash;
        uint64 requestNonce;
        address buyer;
        address holder;
        address buyerGarden;
        address providerGarden;
        uint256 destinationChainId;
        address destinationEscrow;
        address issuer;
        address token;
        uint256 voucherUnits;
        uint256 serviceUnits;
        bytes32 unitLabelHash;
        bytes32 serviceTermsRef;
        bytes32 remedyTermsRef;
        uint64 acceptanceDeadline;
        uint8 remedyPolicy;
    }

    struct SetupDecisionCommand {
        uint8 version;
        bytes32 setupId;
        bytes32 authorizationHash;
        SetupDecision decision;
        bytes32 expectedDepositReceiptHash;
        bytes32 coreAcceptanceHash;
        AbortReason abortReason;
    }

    struct SetupResult {
        uint8 version;
        bytes32 setupId;
        bytes32 authorizationHash;
        uint64 resultSequence;
        SetupPhase phase;
        SetupDecision decision;
        bool issuerApproved;
        bytes32 depositReceiptHash;
        uint256 depositedUnits;
        uint256 setupRefundedUnits;
        bytes32 appliedDecisionId;
        bool actionSucceeded;
        bytes32 failureHash;
    }

    struct HolderAbortRequest {
        uint8 version;
        bytes32 setupId;
        bytes32 authorizationHash;
        address holder;
    }

    struct FinalAllocation {
        uint256 approvedDeliveredServiceUnits;
        uint256 releaseVoucherUnits;
        uint256 refundVoucherUnits;
    }

    struct LegProgress {
        LegState state;
        uint64 attempts;
        bytes32 failureHash;
    }

    struct FinalAllocationRecord {
        bytes32 decisionId;
        bytes32 activationDecisionId;
        uint256 issuerReturnApprovalAtFreeze;
        FinalAllocation allocation;
        LegProgress release;
        LegProgress refund;
    }

    struct FinalResultV2 {
        uint8 protocolVersion;
        bytes32 setupId;
        bytes32 payloadHash;
        uint64 sequence;
        bytes32 activationDecisionId;
        bytes32 decisionId;
        uint256 issuerReturnApprovalAtFreeze;
        FinalAllocation allocation;
        LegProgress release;
        LegProgress refund;
    }

    error UnsupportedVoucherServiceMessage();
    error InvalidVoucherServiceAuthorization();
    error InvalidVoucherServiceResult();

    function setupId(SetupAuthorization memory a) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SETUP_DOMAIN,
                a.sourceChainId,
                a.sourceModule,
                a.coreModule,
                a.commitmentId,
                a.termsRevision,
                a.claimHash,
                a.requestNonce
            )
        );
    }

    function hash(SetupAuthorization memory a) internal pure returns (bytes32) {
        return keccak256(abi.encode(a));
    }

    function depositReceiptHash(SetupAuthorization memory a) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                DEPOSIT_DOMAIN,
                a.destinationChainId,
                a.destinationEscrow,
                setupId(a),
                hash(a),
                a.holder,
                a.token,
                a.voucherUnits,
                uint64(1)
            )
        );
    }

    function decisionId(SetupDecisionCommand memory command) internal pure returns (bytes32) {
        return keccak256(abi.encode(DECISION_DOMAIN, command));
    }

    function finalDecisionId(
        SetupAuthorization memory a,
        bytes32 activationDecisionId,
        FinalAllocation memory allocation,
        uint256 issuerReturnApprovalAtFreeze
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                FINAL_DOMAIN,
                a.destinationChainId,
                a.destinationEscrow,
                setupId(a),
                hash(a),
                activationDecisionId,
                allocation,
                issuerReturnApprovalAtFreeze
            )
        );
    }

    function legId(
        SetupAuthorization memory a,
        bytes32 finalDecision,
        FinalLeg leg,
        uint256 units
    )
        internal
        pure
        returns (bytes32)
    {
        address recipient = leg == FinalLeg.ReleaseToIssuer ? a.issuer : a.holder;
        return keccak256(abi.encode(LEG_DOMAIN, finalDecision, leg, a.token, recipient, units));
    }

    function messageKind(bytes memory data) internal pure returns (bytes32 kind) {
        if (data.length < 32) revert UnsupportedVoucherServiceMessage();
        assembly ("memory-safe") { kind := mload(add(data, 32)) }
    }

    function encodeAuthorization(SetupAuthorization memory a) internal pure returns (bytes memory) {
        return abi.encode(AUTHORIZATION_KIND, a);
    }

    function decodeAuthorization(bytes memory data) internal pure returns (SetupAuthorization memory a) {
        if (data.length != 800) revert UnsupportedVoucherServiceMessage();
        bytes32 kind;
        (kind, a) = abi.decode(data, (bytes32, SetupAuthorization));
        if (kind != AUTHORIZATION_KIND || a.version != VERSION) revert UnsupportedVoucherServiceMessage();
    }

    /// @dev Full authorization permits an authenticated Abort tombstone before Authorization arrival.
    function encodeDecision(
        SetupAuthorization memory a,
        SetupDecisionCommand memory command
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(DECISION_KIND, a, command);
    }

    function decodeDecision(bytes memory data)
        internal
        pure
        returns (SetupAuthorization memory a, SetupDecisionCommand memory command)
    {
        if (data.length != 1024) revert UnsupportedVoucherServiceMessage();
        bytes32 kind;
        (kind, a, command) = abi.decode(data, (bytes32, SetupAuthorization, SetupDecisionCommand));
        if (kind != DECISION_KIND || a.version != VERSION || command.version != VERSION) {
            revert UnsupportedVoucherServiceMessage();
        }
    }

    function encodeSetupResult(SetupResult memory result) internal pure returns (bytes memory) {
        return abi.encode(SETUP_RESULT_KIND, result);
    }

    function decodeSetupResult(bytes memory data) internal pure returns (SetupResult memory result) {
        if (data.length != 448) revert UnsupportedVoucherServiceMessage();
        bytes32 kind;
        (kind, result) = abi.decode(data, (bytes32, SetupResult));
        if (kind != SETUP_RESULT_KIND || result.version != VERSION) revert UnsupportedVoucherServiceMessage();
    }

    function encodeHolderAbortRequest(HolderAbortRequest memory request) internal pure returns (bytes memory) {
        return abi.encode(HOLDER_ABORT_KIND, request);
    }

    function decodeHolderAbortRequest(bytes memory data) internal pure returns (HolderAbortRequest memory request) {
        if (data.length != 160) revert UnsupportedVoucherServiceMessage();
        bytes32 kind;
        (kind, request) = abi.decode(data, (bytes32, HolderAbortRequest));
        if (kind != HOLDER_ABORT_KIND || request.version != VERSION) revert UnsupportedVoucherServiceMessage();
    }

    function encodeFinalResult(FinalResultV2 memory result) internal pure returns (bytes memory) {
        return abi.encode(FINAL_RESULT_KIND, result);
    }

    function decodeFinalResult(bytes memory data) internal pure returns (FinalResultV2 memory result) {
        if (data.length != 544) revert UnsupportedVoucherServiceMessage();
        bytes32 kind;
        (kind, result) = abi.decode(data, (bytes32, FinalResultV2));
        if (kind != FINAL_RESULT_KIND || result.protocolVersion != VERSION) revert UnsupportedVoucherServiceMessage();
    }
}
