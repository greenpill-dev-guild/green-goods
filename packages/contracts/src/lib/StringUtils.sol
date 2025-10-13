// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title StringUtils
/// @notice Library for string manipulation utilities
/// @dev Extracted from GardenAccount to reduce contract size
library StringUtils {
    /// @notice Escapes double quotes in JSON strings
    /// @param str The string to escape
    /// @return The escaped string with backslashes before quotes
    function escapeJSON(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        uint256 quoteCount = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "'") quoteCount++;
        }

        if (quoteCount == 0) return str;

        bytes memory escaped = new bytes(b.length + quoteCount);
        uint256 j = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "'") {
                escaped[j++] = "\\";
            }
            escaped[j++] = b[i];
        }

        return string(escaped);
    }

    /// @notice Converts uint256 to string
    /// @param _i The unsigned integer to convert
    /// @return The string representation of the number
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";

        uint256 temp = _i;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (_i != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_i % 10)));
            _i /= 10;
        }

        return string(buffer);
    }
}
