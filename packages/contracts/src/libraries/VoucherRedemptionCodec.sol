// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Typed service-escrow authorization and results, independent of earned-voucher messages.
library VoucherRedemptionCodec {
    uint8 internal constant VERSION = 1;
    uint8 internal constant MUTUAL_CONSENT = 1;
    bytes32 internal constant AUTHORIZATION_KIND = keccak256("GREEN_GOODS_VOUCHER_SERVICE_AUTHORIZATION_V1");
    bytes32 internal constant RESULT_KIND = keccak256("GREEN_GOODS_VOUCHER_SERVICE_RESULT_V1");
    bytes32 internal constant REDEMPTION_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_REDEMPTION_V1");
    bytes32 internal constant ACTION_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_SERVICE_ACTION_V1");

    enum ActionKind {
        None,
        Present,
        Release,
        Return
    }

    struct Authorization {
        uint8 version;
        uint256 sourceChainId;
        address sourceModule;
        uint256 commitmentId;
        uint64 revision;
        bytes32 acceptedClaimHash;
        bytes32 termsHash;
        address buyer;
        address holder;
        address buyerGarden;
        address providerGarden;
        uint256 destinationChainId;
        address destinationEscrow;
        address issuer;
        address token;
        uint256 totalVoucherUnits;
        uint256 totalServiceUnits;
        bytes32 serviceUnitLabelHash;
        bytes32 serviceTermsRef;
        bytes32 remedyTermsRef;
        uint8 remedyPolicy;
    }

    struct Result {
        uint8 version;
        bytes32 redemptionId;
        bytes32 payloadHash;
        uint64 resultSequence;
        bool issuerApproved;
        uint256 issuerReturnCeiling;
        uint256 escrowedUnits;
        uint256 holderApprovedServiceUnits;
        uint256 holderApprovedVoucherUnits;
        uint256 mutualReturnUnits;
        uint256 releasedUnits;
        uint256 returnedUnits;
        uint64 actionNonce;
        bytes32 actionHash;
        ActionKind actionKind;
        uint256 actionVoucherUnits;
        uint256 actionServiceUnits;
        bool actionSucceeded;
        bytes32 failureHash;
    }

    error UnsupportedRedemptionMessage();
    error InvalidRedemptionResult();

    function redemptionId(Authorization memory authorization) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                REDEMPTION_DOMAIN,
                authorization.sourceChainId,
                authorization.sourceModule,
                authorization.commitmentId,
                authorization.revision,
                authorization.acceptedClaimHash
            )
        );
    }

    function hash(Authorization memory authorization) internal pure returns (bytes32) {
        return keccak256(abi.encode(authorization));
    }

    function actionHash(
        bytes32 redemption,
        bytes32 payloadHash,
        uint64 nonce,
        ActionKind kind,
        uint256 voucherUnits,
        uint256 serviceUnits,
        uint256 cumulativeServiceUnits,
        uint256 cumulativeVoucherUnits,
        uint256 cumulativeReturnUnits
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                ACTION_DOMAIN,
                redemption,
                payloadHash,
                nonce,
                kind,
                voucherUnits,
                serviceUnits,
                cumulativeServiceUnits,
                cumulativeVoucherUnits,
                cumulativeReturnUnits
            )
        );
    }

    function encodeAuthorization(Authorization memory authorization) internal pure returns (bytes memory) {
        return abi.encode(AUTHORIZATION_KIND, authorization);
    }

    function decodeAuthorization(bytes memory data) internal pure returns (Authorization memory authorization) {
        if (data.length != 704) revert UnsupportedRedemptionMessage();
        bytes32 kind;
        (kind, authorization) = abi.decode(data, (bytes32, Authorization));
        if (kind != AUTHORIZATION_KIND || authorization.version != VERSION) revert UnsupportedRedemptionMessage();
    }

    function encodeResult(Result memory result) internal pure returns (bytes memory) {
        return abi.encode(RESULT_KIND, result);
    }

    function decodeResult(bytes memory data) internal pure returns (Result memory result) {
        if (data.length != 640) revert UnsupportedRedemptionMessage();
        bytes32 kind;
        (kind, result) = abi.decode(data, (bytes32, Result));
        if (kind != RESULT_KIND || result.version != VERSION) revert UnsupportedRedemptionMessage();
    }

    /// @dev Authenticated wire ledger validation does not infer external service delivery.
    function validateResult(Result memory result, Authorization memory authorization) internal pure {
        if (
            result.redemptionId != redemptionId(authorization) || result.payloadHash != hash(authorization)
                || result.resultSequence == 0 || result.issuerReturnCeiling > authorization.totalVoucherUnits
                || result.holderApprovedServiceUnits > authorization.totalServiceUnits
                || (result.escrowedUnits != 0 && result.escrowedUnits != authorization.totalVoucherUnits)
                || result.releasedUnits > result.holderApprovedVoucherUnits
                || result.returnedUnits > result.mutualReturnUnits || result.mutualReturnUnits > result.issuerReturnCeiling
                || result.mutualReturnUnits > result.escrowedUnits
                || result.holderApprovedVoucherUnits > result.escrowedUnits - result.mutualReturnUnits
                || (result.actionSucceeded != (result.failureHash == bytes32(0)))
                || (!result.issuerApproved && result.issuerReturnCeiling != 0)
        ) revert InvalidRedemptionResult();
        if (result.actionKind == ActionKind.None) {
            if (
                result.actionNonce != 0 || result.actionHash != bytes32(0) || result.actionVoucherUnits != 0
                    || result.actionServiceUnits != 0 || !result.actionSucceeded || result.escrowedUnits != 0
                    || result.holderApprovedServiceUnits != 0
            ) revert InvalidRedemptionResult();
            return;
        }
        if (
            !result.issuerApproved || result.actionNonce == 0 || result.actionVoucherUnits == 0
                || result.actionHash
                    != actionHash(
                        result.redemptionId,
                        result.payloadHash,
                        result.actionNonce,
                        result.actionKind,
                        result.actionVoucherUnits,
                        result.actionServiceUnits,
                        result.holderApprovedServiceUnits,
                        result.holderApprovedVoucherUnits,
                        result.mutualReturnUnits
                    )
        ) {
            revert InvalidRedemptionResult();
        }
        validateActionOutcome(result, authorization);
    }

    function validateActionOutcome(Result memory result, Authorization memory authorization) private pure {
        uint256 unresolved = result.actionSucceeded ? 0 : result.actionVoucherUnits;
        if (result.actionKind == ActionKind.Present) {
            if (
                result.actionVoucherUnits != authorization.totalVoucherUnits || result.actionServiceUnits != 0
                    || result.holderApprovedServiceUnits != 0 || result.holderApprovedVoucherUnits != 0
                    || result.mutualReturnUnits != 0
                    || result.escrowedUnits != (result.actionSucceeded ? authorization.totalVoucherUnits : 0)
            ) {
                revert InvalidRedemptionResult();
            }
        } else if (result.actionKind == ActionKind.Release) {
            if (
                result.escrowedUnits != authorization.totalVoucherUnits || result.holderApprovedServiceUnits == 0
                    || result.actionVoucherUnits > result.holderApprovedVoucherUnits
                    || result.actionServiceUnits > result.holderApprovedServiceUnits
                    || result.mutualReturnUnits != result.returnedUnits
                    || result.holderApprovedVoucherUnits - result.releasedUnits != unresolved
            ) revert InvalidRedemptionResult();
        } else if (
            result.escrowedUnits != authorization.totalVoucherUnits || result.actionServiceUnits != 0
                || result.actionVoucherUnits > result.mutualReturnUnits
                || result.holderApprovedVoucherUnits != result.releasedUnits
                || result.mutualReturnUnits - result.returnedUnits != unresolved
        ) {
            revert InvalidRedemptionResult();
        }
    }

    function validateProgress(Result memory previous, Result memory next) internal pure {
        if (
            next.escrowedUnits < previous.escrowedUnits
                || next.holderApprovedServiceUnits < previous.holderApprovedServiceUnits
                || next.holderApprovedVoucherUnits < previous.holderApprovedVoucherUnits
                || next.mutualReturnUnits < previous.mutualReturnUnits || next.releasedUnits < previous.releasedUnits
                || next.returnedUnits < previous.returnedUnits || next.issuerReturnCeiling < previous.issuerReturnCeiling
                || (previous.issuerApproved && !next.issuerApproved) || next.actionNonce < previous.actionNonce
                || (next.actionNonce == previous.actionNonce
                    && (next.actionHash != previous.actionHash || (previous.actionSucceeded && !next.actionSucceeded)))
        ) revert InvalidRedemptionResult();
    }
}
