// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

/// @title GAPTestHelper
/// @notice Helper functions for testing Karma GAP integration
/// @dev Provides UID validation, JSON building, and mock data generation
library GAPTestHelper {
    // ═══════════════════════════════════════════════════════════════════════════
    // UID Validation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Validates that a GAP project UID is valid (non-zero)
    /// @param projectUID The GAP project UID to validate
    /// @return True if valid, false otherwise
    function isValidProjectUID(bytes32 projectUID) internal pure returns (bool) {
        return projectUID != bytes32(0);
    }

    /// @notice Validates that a GAP milestone UID is valid (non-zero)
    /// @param milestoneUID The GAP milestone UID to validate
    /// @return True if valid, false otherwise
    function isValidMilestoneUID(bytes32 milestoneUID) internal pure returns (bool) {
        return milestoneUID != bytes32(0);
    }

    /// @notice Validates that a GAP impact UID is valid (non-zero)
    /// @param impactUID The GAP impact UID to validate
    /// @return True if valid, false otherwise
    function isValidImpactUID(bytes32 impactUID) internal pure returns (bool) {
        return impactUID != bytes32(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // JSON Building - Project Details
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Builds JSON for GAP project details attestation
    /// @param title Project title (garden name)
    /// @param description Project description
    /// @param location Location of impact
    /// @param imageURL Image URL (banner)
    /// @param slug URL-friendly slug
    /// @return JSON string for project details
    function buildProjectDetailsJSON(
        string memory title,
        string memory description,
        string memory location,
        string memory imageURL,
        string memory slug
    )
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked(
                '{"title":"',
                escapeJSON(title),
                '","description":"',
                escapeJSON(description),
                '","locationOfImpact":"',
                escapeJSON(location),
                '","imageURL":"',
                escapeJSON(imageURL),
                '","slug":"',
                escapeJSON(slug),
                '","type":"project-details"}'
            )
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // JSON Building - Impact (Work Approval)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Builds JSON for GAP impact attestation
    /// @param title Impact title (work title)
    /// @param text Impact description (approval feedback)
    /// @param startDate ISO date string
    /// @param endDate ISO date string
    /// @param deliverableName Deliverable name
    /// @param proofIPFS IPFS CID for proof
    /// @param linkURL Link to work in Green Goods
    /// @return JSON string for impact
    function buildImpactJSON(
        string memory title,
        string memory text,
        string memory startDate,
        string memory endDate,
        string memory deliverableName,
        string memory proofIPFS,
        string memory linkURL
    )
        internal
        pure
        returns (string memory)
    {
        bytes memory part1 = abi.encodePacked(
            '{"title":"',
            escapeJSON(title),
            '","text":"',
            escapeJSON(text),
            '","startDate":"',
            startDate,
            '","endDate":"',
            endDate
        );

        bytes memory part2 = abi.encodePacked(
            '","deliverables":[{"name":"',
            escapeJSON(deliverableName),
            '","proof":"ipfs://',
            proofIPFS,
            '","description":"',
            escapeJSON(text),
            '"}]'
        );

        bytes memory part3 = abi.encodePacked(
            ',"links":[{"type":"other","url":"', linkURL, '","label":"View in Green Goods"}],"type":"project-update"}'
        );

        return string(abi.encodePacked(part1, part2, part3));
    }

    /// @notice Builds simplified impact JSON without deliverables
    /// @param title Impact title
    /// @param text Impact description
    /// @return JSON string for simple impact
    function buildSimpleImpactJSON(string memory title, string memory text) internal pure returns (string memory) {
        return string(
            abi.encodePacked('{"title":"', escapeJSON(title), '","text":"', escapeJSON(text), '","type":"project-update"}')
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // JSON Building - Milestone (Assessment)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Builds JSON for GAP milestone attestation
    /// @param title Milestone title (assessment title)
    /// @param text Milestone description
    /// @param metaJSON Additional metadata (capitals, metrics)
    /// @return JSON string for milestone
    function buildMilestoneJSON(
        string memory title,
        string memory text,
        string memory metaJSON
    )
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked(
                '{"title":"',
                escapeJSON(title),
                '","text":"',
                escapeJSON(text),
                '","type":"project-milestone","data":',
                metaJSON,
                "}"
            )
        );
    }

    /// @notice Builds simplified milestone JSON without metadata
    /// @param title Milestone title
    /// @param text Milestone description
    /// @return JSON string for simple milestone
    function buildSimpleMilestoneJSON(string memory title, string memory text) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '{"title":"', escapeJSON(title), '","text":"', escapeJSON(text), '","type":"project-milestone"}'
            )
        );
    }

    /// @notice Builds capital scores JSON for assessments
    /// @param natural Natural capital score (0-100)
    /// @param social Social capital score
    /// @param financial Financial capital score
    /// @param living Living capital score
    /// @param intellectual Intellectual capital score
    /// @param experiential Experiential capital score
    /// @param spiritual Spiritual capital score
    /// @param cultural Cultural capital score
    /// @return JSON string for capital scores
    function buildCapitalsJSON(
        uint8 natural,
        uint8 social,
        uint8 financial,
        uint8 living,
        uint8 intellectual,
        uint8 experiential,
        uint8 spiritual,
        uint8 cultural
    )
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked(
                '{"natural":',
                uint2str(natural),
                ',"social":',
                uint2str(social),
                ',"financial":',
                uint2str(financial),
                ',"living":',
                uint2str(living),
                ',"intellectual":',
                uint2str(intellectual),
                ',"experiential":',
                uint2str(experiential),
                ',"spiritual":',
                uint2str(spiritual),
                ',"cultural":',
                uint2str(cultural),
                "}"
            )
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // JSON Validation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Checks if JSON string contains expected field
    /// @param json The JSON string to check
    /// @param field The field name to look for (e.g., "title")
    /// @return True if field is present
    function hasField(string memory json, string memory field) internal pure returns (bool) {
        bytes memory jsonBytes = bytes(json);
        bytes memory fieldBytes = bytes(string(abi.encodePacked('"', field, '":')));

        if (jsonBytes.length < fieldBytes.length) return false;

        for (uint256 i = 0; i <= jsonBytes.length - fieldBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < fieldBytes.length; j++) {
                if (jsonBytes[i + j] != fieldBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    /// @notice Checks if JSON has correct type field
    /// @param json The JSON string to check
    /// @param expectedType Expected type value (e.g., "project-update")
    /// @return True if type matches
    function hasType(string memory json, string memory expectedType) internal pure returns (bool) {
        string memory typeField = string(abi.encodePacked('"type":"', expectedType, '"'));
        return contains(json, typeField);
    }

    /// @notice Checks if string contains substring
    /// @param source Source string
    /// @param search Substring to find
    /// @return True if found
    function contains(string memory source, string memory search) internal pure returns (bool) {
        bytes memory sourceBytes = bytes(source);
        bytes memory searchBytes = bytes(search);

        if (searchBytes.length > sourceBytes.length) return false;

        for (uint256 i = 0; i <= sourceBytes.length - searchBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < searchBytes.length; j++) {
                if (sourceBytes[i + j] != searchBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // String Utilities
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Escapes special JSON characters in a string
    /// @param input The input string
    /// @return The escaped string
    function escapeJSON(string memory input) internal pure returns (string memory) {
        bytes memory inputBytes = bytes(input);
        uint256 extraChars = 0;

        // Count characters that need escaping
        for (uint256 i = 0; i < inputBytes.length; i++) {
            bytes1 char = inputBytes[i];
            if (char == '"' || char == "\\" || char == "\n" || char == "\r" || char == "\t") {
                extraChars++;
            }
        }

        if (extraChars == 0) return input;

        bytes memory output = new bytes(inputBytes.length + extraChars);
        uint256 outputIndex = 0;

        for (uint256 i = 0; i < inputBytes.length; i++) {
            bytes1 char = inputBytes[i];
            if (char == '"') {
                output[outputIndex++] = "\\";
                output[outputIndex++] = '"';
            } else if (char == "\\") {
                output[outputIndex++] = "\\";
                output[outputIndex++] = "\\";
            } else if (char == "\n") {
                output[outputIndex++] = "\\";
                output[outputIndex++] = "n";
            } else if (char == "\r") {
                output[outputIndex++] = "\\";
                output[outputIndex++] = "r";
            } else if (char == "\t") {
                output[outputIndex++] = "\\";
                output[outputIndex++] = "t";
            } else {
                output[outputIndex++] = char;
            }
        }

        return string(output);
    }

    /// @notice Converts uint to string
    /// @param value The uint value
    /// @return The string representation
    function uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }

    /// @notice Converts bytes32 to hex string
    /// @param data The bytes32 value
    /// @return Hex string with 0x prefix
    function bytes32ToHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(data[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(abi.encodePacked("0x", str));
    }

    /// @notice Generates URL-friendly slug from title
    /// @param title The title to slugify
    /// @return URL-friendly slug
    function generateSlug(string memory title) internal pure returns (string memory) {
        bytes memory titleBytes = bytes(title);
        bytes memory slug = new bytes(titleBytes.length);
        uint256 slugLength = 0;

        for (uint256 i = 0; i < titleBytes.length; i++) {
            bytes1 char = titleBytes[i];

            // Convert uppercase to lowercase
            if (char >= 0x41 && char <= 0x5A) {
                slug[slugLength++] = bytes1(uint8(char) + 32);
            }
            // Keep lowercase letters and numbers
            else if ((char >= 0x61 && char <= 0x7A) || (char >= 0x30 && char <= 0x39)) {
                slug[slugLength++] = char;
            }
            // Convert spaces and special chars to hyphens
            else if (char == 0x20 || char == 0x2D || char == 0x5F) {
                // Avoid double hyphens
                if (slugLength > 0 && slug[slugLength - 1] != 0x2D) {
                    slug[slugLength++] = 0x2D; // hyphen
                }
            }
            // Skip other characters
        }

        // Remove trailing hyphen
        if (slugLength > 0 && slug[slugLength - 1] == 0x2D) {
            slugLength--;
        }

        // Create properly sized result
        bytes memory result = new bytes(slugLength);
        for (uint256 i = 0; i < slugLength; i++) {
            result[i] = slug[i];
        }

        return string(result);
    }

    /// @notice Converts timestamp to ISO 8601 date string
    /// @param timestamp Unix timestamp
    /// @return ISO date string (e.g., "2024-01-15T12:00:00.000Z")
    function timestampToISO(uint256 timestamp) internal pure returns (string memory) {
        // Simplified: returns a fixed format for testing
        // In production, use a proper date library
        (uint256 year, uint256 month, uint256 day) = _daysToDate(timestamp / 86_400);
        uint256 hour = (timestamp % 86_400) / 3600;
        uint256 minute = (timestamp % 3600) / 60;
        uint256 second = timestamp % 60;

        return string(
            abi.encodePacked(
                _padZero(year, 4),
                "-",
                _padZero(month, 2),
                "-",
                _padZero(day, 2),
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Mock Data Generation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Generates mock project data for testing
    /// @param name Project name
    /// @param description Project description
    /// @param location Project location
    /// @return Encoded project data
    function mockProjectData(
        string memory name,
        string memory description,
        string memory location
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(name, description, location);
    }

    /// @notice Generates mock milestone data for testing
    /// @param title Milestone title
    /// @param description Milestone description
    /// @param startDate Start date
    /// @param endDate End date
    /// @return Encoded milestone data
    function mockMilestoneData(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(title, description, startDate, endDate);
    }

    /// @notice Generates mock impact data for testing
    /// @param title Impact title
    /// @param description Impact description
    /// @param metrics Impact metrics JSON
    /// @return Encoded impact data
    function mockImpactData(
        string memory title,
        string memory description,
        string memory metrics
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(title, description, metrics);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Pads number with leading zeros
    function _padZero(uint256 value, uint256 length) private pure returns (string memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = length; i > 0; i--) {
            result[i - 1] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(result);
    }

    /// @dev Converts days since epoch to date components
    /// @dev Based on https://howardhinnant.github.io/date_algorithms.html
    function _daysToDate(uint256 _days) private pure returns (uint256 year, uint256 month, uint256 day) {
        int256 L = int256(_days) + 68_569 + 2_440_588;
        int256 N = (4 * L) / 146_097;
        L = L - (146_097 * N + 3) / 4;
        int256 _year = (4000 * (L + 1)) / 1_461_001;
        L = L - (1461 * _year) / 4 + 31;
        int256 _month = (80 * L) / 2447;
        int256 _day = L - (2447 * _month) / 80;
        L = _month / 11;
        _month = _month + 2 - 12 * L;
        _year = 100 * (N - 49) + _year + L;

        year = uint256(_year);
        month = uint256(_month);
        day = uint256(_day);
    }
}
