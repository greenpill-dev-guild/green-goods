// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Versioned, fixed-route wire format shared by the steward publisher and receiver.
library StewardRoleCodec {
    bytes32 internal constant DOMAIN = keccak256("GREEN_GOODS_STEWARD_SAFE_V1");
    uint256 internal constant SOURCE_CHAIN = 42_161;
    uint256 internal constant DESTINATION_CHAIN = 100;
    uint64 internal constant SOURCE_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant DESTINATION_SELECTOR = 465_200_170_687_744_372;

    struct Update {
        address garden;
        address account;
        uint64 revision;
        bool eligible;
    }
    error InvalidMessage();

    function encode(address garden, address account, uint64 revision, bool eligible) internal pure returns (bytes memory) {
        return abi.encode(DOMAIN, SOURCE_CHAIN, DESTINATION_CHAIN, garden, account, revision, eligible);
    }

    function decode(bytes memory data) internal pure returns (Update memory update) {
        if (data.length != 224) revert InvalidMessage();
        bytes32 domain;
        uint256 source;
        uint256 destination;
        (domain, source, destination, update.garden, update.account, update.revision, update.eligible) =
            abi.decode(data, (bytes32, uint256, uint256, address, address, uint64, bool));
        if (
            domain != DOMAIN || source != SOURCE_CHAIN || destination != DESTINATION_CHAIN || uint160(update.account) <= 1
                || update.revision == 0
        ) revert InvalidMessage();
    }
}
