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
            if (b[i] == "\"") quoteCount++;
        }

        if (quoteCount == 0) return str;

        bytes memory escaped = new bytes(b.length + quoteCount);
        uint256 j = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "\"") {
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

    /// @notice Generates a URL-safe slug from a string
    /// @param str The string to convert to slug
    /// @return The slug (lowercase, hyphens for spaces, alphanumeric only)
    function generateSlug(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(strBytes.length);
        uint256 resultLen = 0;

        for (uint256 i = 0; i < strBytes.length; i++) {
            bytes1 char = strBytes[i];

            // Convert uppercase A-Z to lowercase a-z
            if (char >= 0x41 && char <= 0x5A) {
                result[resultLen++] = bytes1(uint8(char) + 32);
            }
            // Keep lowercase a-z
            else if (char >= 0x61 && char <= 0x7A) {
                result[resultLen++] = char;
            }
            // Keep numbers 0-9
            else if (char >= 0x30 && char <= 0x39) {
                result[resultLen++] = char;
            }
            // Convert space to hyphen
            else if (char == 0x20) {
                // Avoid double hyphens
                if (resultLen > 0 && result[resultLen - 1] != 0x2D) {
                    result[resultLen++] = 0x2D; // hyphen
                }
            }
            // Skip all other characters (special chars, punctuation)
        }

        // Trim trailing hyphen if exists
        if (resultLen > 0 && result[resultLen - 1] == 0x2D) {
            resultLen--;
        }

        // Copy to correctly sized bytes array
        bytes memory finalResult = new bytes(resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            finalResult[i] = result[i];
        }

        return string(finalResult);
    }

    /// @notice Converts Unix timestamp to ISO 8601 string (YYYY-MM-DDTHH:MM:SS.000Z)
    /// @param timestamp Unix timestamp (seconds since epoch)
    /// @return ISO 8601 formatted date string in UTC with milliseconds
    function timestampToISO(uint256 timestamp) internal pure returns (string memory) {
        // Calculate date components using Neri-Schneider algorithm
        uint256 z = timestamp / 86400 + 719468;
        uint256 era = (z >= 0 ? z : z - 146096) / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) {
            y += 1;
        }

        // Calculate time components
        uint256 secondsInDay = timestamp % 86400;
        uint256 hour = secondsInDay / 3600;
        uint256 minute = (secondsInDay % 3600) / 60;
        uint256 second = secondsInDay % 60;

        // Format: YYYY-MM-DDTHH:MM:SS.000Z (milliseconds always .000 since Unix timestamp is seconds)
        return string(
            abi.encodePacked(
                _padZero(y, 4),
                "-",
                _padZero(m, 2),
                "-",
                _padZero(d, 2),
                "T",
                _padZero(hour, 2),
                ":",
                _padZero(minute, 2),
                ":",
                _padZero(second, 2),
                ".000Z"
            )
        );
    }

    /// @notice Pads number with leading zeros
    /// @param num Number to pad
    /// @param length Desired string length
    /// @return Zero-padded string
    function _padZero(uint256 num, uint256 length) private pure returns (string memory) {
        bytes memory buffer = new bytes(length);
        for (uint256 i = length; i > 0; i--) {
            buffer[i - 1] = bytes1(uint8(48 + (num % 10)));
            num /= 10;
        }
        return string(buffer);
    }
}
