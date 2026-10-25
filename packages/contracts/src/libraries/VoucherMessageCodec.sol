// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Version-one message-only voucher authorization. Retries preserve the economic payload.
library VoucherMessageCodec {
    uint8 internal constant VERSION = 1;
    bytes32 internal constant COMMAND_KIND = keccak256("GREEN_GOODS_VOUCHER_DISTRIBUTION_V1");
    bytes32 internal constant ACK_KIND = keccak256("GREEN_GOODS_VOUCHER_ACK_V1");
    bytes32 internal constant ENTITLEMENT_DOMAIN = keccak256("GREEN_GOODS_VOUCHER_ENTITLEMENT_V1");

    error UnsupportedVoucherMessage();

    struct Command {
        uint8 version;
        uint256 sourceChainId;
        address sourceModule;
        uint256 commitmentId;
        uint64 revision;
        address issuer;
        address issuerAuthority;
        uint256 destinationChainId;
        address destinationAdapter;
        address token;
        uint256 totalUnits;
        bytes32 termsHash;
        bytes32 recognitionHash;
        bytes32 policyContext;
        address[] recipients;
        uint256[] amounts;
    }

    struct Ack {
        uint8 version;
        bytes32 entitlementId;
        bytes32 payloadHash;
        uint64 resultSequence;
        bool success;
        bytes32 failureHash;
    }

    function entitlementId(Command memory command) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ENTITLEMENT_DOMAIN, command.sourceChainId, command.sourceModule, command.commitmentId, command.revision
            )
        );
    }

    function hash(Command memory command) internal pure returns (bytes32) {
        return keccak256(abi.encode(command));
    }

    function encodeCommand(Command memory command) internal pure returns (bytes memory) {
        return abi.encode(COMMAND_KIND, command);
    }

    function decodeCommand(bytes memory data) internal pure returns (Command memory command) {
        bytes32 kind;
        (kind, command) = abi.decode(data, (bytes32, Command));
        if (kind != COMMAND_KIND || command.version != VERSION) revert UnsupportedVoucherMessage();
    }

    function encodeAck(Ack memory acknowledgment) internal pure returns (bytes memory) {
        return abi.encode(ACK_KIND, acknowledgment);
    }

    function decodeAck(bytes memory data) internal pure returns (Ack memory acknowledgment) {
        bytes32 kind;
        (kind, acknowledgment) = abi.decode(data, (bytes32, Ack));
        if (kind != ACK_KIND || acknowledgment.version != VERSION) revert UnsupportedVoucherMessage();
    }
}
