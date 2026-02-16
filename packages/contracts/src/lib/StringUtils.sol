// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title StringUtils
/// @notice Library for string manipulation utilities
/// @dev Extracted from GardenAccount to reduce contract size
library StringUtils {
    /// @notice Escapes special characters in JSON strings per RFC 8259
    /// @dev Escapes: backslash, double quote, newline, carriage return, tab,
    ///      and all control characters (U+0000 through U+001F) as \uXXXX.
    ///      Backslashes are escaped FIRST to prevent double-escaping.
    /// @param str The string to escape
    /// @return The escaped string safe for embedding in JSON values
    function escapeJSON(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        uint256 extraBytes = 0;

        // Pass 1: count extra bytes needed
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 ch = b[i];
            if (ch == "\\" || ch == "\"" || ch == "\n" || ch == "\r" || ch == "\t") {
                extraBytes += 1; // each becomes 2 chars (e.g., \ → \\)
            } else if (uint8(ch) < 0x20) {
                extraBytes += 5; // control char → \uXXXX (6 chars total, 1 already counted)
            }
        }

        if (extraBytes == 0) return str;

        // Pass 2: build escaped string
        bytes memory escaped = new bytes(b.length + extraBytes);
        uint256 j = 0;

        for (uint256 i = 0; i < b.length; i++) {
            bytes1 ch = b[i];
            if (ch == "\\") {
                escaped[j++] = "\\";
                escaped[j++] = "\\";
            } else if (ch == "\"") {
                escaped[j++] = "\\";
                escaped[j++] = "\"";
            } else if (ch == "\n") {
                escaped[j++] = "\\";
                escaped[j++] = "n";
            } else if (ch == "\r") {
                escaped[j++] = "\\";
                escaped[j++] = "r";
            } else if (ch == "\t") {
                escaped[j++] = "\\";
                escaped[j++] = "t";
            } else if (uint8(ch) < 0x20) {
                // Other control characters → \u00XX
                escaped[j++] = "\\";
                escaped[j++] = "u";
                escaped[j++] = "0";
                escaped[j++] = "0";
                escaped[j++] = _hexChar(uint8(ch) >> 4);
                escaped[j++] = _hexChar(uint8(ch) & 0x0f);
            } else {
                escaped[j++] = ch;
            }
        }

        return string(escaped);
    }

    /// @notice Returns the hex character for a nibble (0-15)
    function _hexChar(uint8 nibble) private pure returns (bytes1) {
        return nibble < 10 ? bytes1(nibble + 0x30) : bytes1(nibble + 0x57);
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
        uint256 z = timestamp / 86_400 + 719_468;
        uint256 era = (z >= 0 ? z : z - 146_096) / 146_097;
        uint256 doe = z - era * 146_097;
        uint256 yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) {
            y += 1;
        }

        // Calculate time components
        uint256 secondsInDay = timestamp % 86_400;
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

    /// @notice Converts bytes32 to hex string (without 0x prefix)
    /// @param _bytes The bytes32 value to convert
    /// @return The hex string representation (64 characters)
    function bytes32ToHexString(bytes32 _bytes) internal pure returns (string memory) {
        bytes memory hexString = new bytes(64);
        bytes memory hexAlphabet = "0123456789abcdef";
        for (uint256 i = 0; i < 32; i++) {
            hexString[i * 2] = hexAlphabet[uint8(_bytes[i] >> 4)];
            hexString[i * 2 + 1] = hexAlphabet[uint8(_bytes[i] & 0x0f)];
        }
        return string(hexString);
    }

    /// @notice Converts address to hex string (without 0x prefix)
    /// @param account The address to convert
    /// @return The hex string representation (40 characters)
    function addressToHexString(address account) internal pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes memory hexString = new bytes(40);
        bytes memory hexAlphabet = "0123456789abcdef";

        for (uint256 i = 0; i < 20; i++) {
            hexString[i * 2] = hexAlphabet[uint8(value[i] >> 4)];
            hexString[i * 2 + 1] = hexAlphabet[uint8(value[i] & 0x0f)];
        }

        return string(hexString);
    }
}
