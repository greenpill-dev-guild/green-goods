// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title GardenSafeActionCodec
/// @notice Shared, versioned message schema for Garden-authorized Safe actions.
library GardenSafeActionCodec {
    bytes32 internal constant ACTION_DOMAIN = keccak256("GreenGoods.GardenSafeAction.v1");

    enum MessageKind {
        Proposal,
        Finalization,
        Cancellation
    }

    enum ActionStatus {
        None,
        Proposed,
        Cancelled,
        Finalized,
        Executed,
        Expired
    }

    struct SafeTransaction {
        address to;
        uint256 value;
        bytes data;
        uint8 operation;
        uint256 safeTxGas;
        uint256 baseGas;
        uint256 gasPrice;
        address gasToken;
        address refundReceiver;
        uint256 nonce;
    }

    struct Action {
        uint8 version;
        uint256 sourceEvmChainId;
        uint64 sourceChainSelector;
        address sourceRouter;
        address gardenToken;
        uint256 tokenId;
        address gardenAccount;
        uint256 destinationEvmChainId;
        uint64 destinationChainSelector;
        address destinationRouter;
        address destinationRelay;
        address destinationSafe;
        SafeTransaction safeTransaction;
        bytes32 safeTransactionHash;
        bytes32 recoverySignatureHash;
        uint256 actionNonce;
        uint64 deadline;
    }

    struct Envelope {
        MessageKind kind;
        Action action;
    }

    function actionId(Action memory action) internal pure returns (bytes32) {
        return keccak256(abi.encode(ACTION_DOMAIN, action));
    }

    function actionDigest(Action memory action) internal pure returns (bytes32) {
        return keccak256(abi.encode(action));
    }

    function encode(MessageKind kind, Action memory action) internal pure returns (bytes memory) {
        return abi.encode(Envelope({ kind: kind, action: action }));
    }

    function decode(bytes memory encoded) internal pure returns (Envelope memory) {
        return abi.decode(encoded, (Envelope));
    }
}
