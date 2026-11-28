// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ENSSlug
/// @notice The rule for the label of a `*.greengoods.eth` name: 3 to 50 characters of [a-z0-9-],
/// with no leading, trailing or doubled hyphen.
/// @dev Mirrored in ENSReceiver._isValidSlug() and shared/modules/ens/slug.ts; change all of them
/// together. The L1 receiver refuses anything else, so a name that fails here could never resolve.
library ENSSlug {
    error InvalidSlug();

    uint256 internal constant MIN_LENGTH = 3;
    uint256 internal constant MAX_LENGTH = 50;

    function validate(string calldata slug) internal pure {
        bytes calldata b = bytes(slug);
        uint256 len = b.length;
        if (len < MIN_LENGTH || len > MAX_LENGTH) revert InvalidSlug();
        if (b[0] == 0x2D || b[len - 1] == 0x2D) revert InvalidSlug();
        for (uint256 i; i < len; ++i) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39) || c == 0x2D;
            if (!valid) revert InvalidSlug();
            if (c == 0x2D && i + 1 < len && b[i + 1] == 0x2D) revert InvalidSlug();
        }
    }
}
