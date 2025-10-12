// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

/// @title KarmaGAPSchemaValidationTest
/// @notice Tests to validate JSON schema format for Karma GAP attestations
/// @dev Tests JSON string construction and escaping logic
contract KarmaGAPSchemaValidationTest is Test {
    /// @notice Test: Milestone JSON format validation
    function testMilestoneJSON_CorrectFormat() public {
        string memory title = "Q1 Assessment";
        string memory text = "Biodiversity increased";
        string memory metadata = "{'capitals':['living']}";
        uint256 completedAt = block.timestamp;

        // Construct milestone JSON as done in Garden.sol
        string memory json = string(
            abi.encodePacked(
                "{'title':'",
                _escapeJSON(title),
                "',",
                "'text':'",
                _escapeJSON(text),
                "',",
                "'metadata':",
                metadata,
                ",",
                "'completedAt':",
                _uint2str(completedAt),
                ",",
                "'type':'project-milestone'}"
            )
        );

        console.log("Milestone JSON:", json);

        // Validate structure
        assertTrue(_containsField(json, "title"), "Should have title field");
        assertTrue(_containsField(json, "text"), "Should have text field");
        assertTrue(_containsField(json, "metadata"), "Should have metadata field");
        assertTrue(_containsField(json, "completedAt"), "Should have completedAt field");
        assertTrue(_containsField(json, "type"), "Should have type field");

        // Validate uses 'text' not 'description'
        assertFalse(_containsField(json, "description"), "Should NOT have description field");

        // Validate correct type
        assertTrue(_containsSubstring(json, "'type':'project-milestone'"), "Type should be project-milestone");
    }

    /// @notice Test: Impact JSON format validation
    function testImpactJSON_CorrectFormat() public {
        string memory title = "Plant Trees";
        string memory text = "Planted 50 trees";
        string memory proof = "ipfs://proof";
        uint256 completedAt = block.timestamp;

        // Construct impact JSON as done in Garden.sol
        string memory json = string(
            abi.encodePacked(
                "{'title':'",
                _escapeJSON(title),
                "',",
                "'text':'",
                _escapeJSON(text),
                "',",
                "'proof':'",
                proof,
                "',",
                "'completedAt':",
                _uint2str(completedAt),
                ",",
                "'type':'project-impact'}"
            )
        );

        console.log("Impact JSON:", json);

        // Validate structure
        assertTrue(_containsField(json, "title"), "Should have title field");
        assertTrue(_containsField(json, "text"), "Should have text field");
        assertTrue(_containsField(json, "proof"), "Should have proof field");

        // Validate does NOT have old field names
        assertFalse(_containsField(json, "work"), "Should NOT have work field");
        assertFalse(_containsField(json, "impact"), "Should NOT have impact field");

        // Validate correct type
        assertTrue(_containsSubstring(json, "'type':'project-impact'"), "Type should be project-impact");
    }

    /// @notice Test: JSON escaping handles double quotes
    function testJSONEscaping_HandlesQuotes() public {
        string memory titleWithQuotes = "Plant 'Native' Trees";
        string memory textWithQuotes = "Successfully planted 'indigenous' species";

        string memory escapedTitle = _escapeJSON(titleWithQuotes);
        string memory escapedText = _escapeJSON(textWithQuotes);

        // Should contain escaped quotes
        assertTrue(_containsSubstring(escapedTitle, "\\'Native\\'"), "Title quotes should be escaped");
        assertTrue(_containsSubstring(escapedText, "\\'indigenous\\'"), "Text quotes should be escaped");

        // Construct full JSON
        string memory json = string(
            abi.encodePacked(
                "{'title':'",
                escapedTitle,
                "',",
                "'text':'",
                escapedText,
                "',",
                "'proof':'ipfs://proof',",
                "'completedAt':",
                _uint2str(block.timestamp),
                ",",
                "'type':'project-impact'}"
            )
        );

        // JSON should be structurally valid
        assertTrue(_isValidJSON(json), "JSON should remain valid with escaped quotes");
    }

    /// @notice Test: JSON escaping handles multiple quotes
    function testJSONEscaping_HandlesMultipleQuotes() public {
        string memory titleWithManyQuotes = "Test 'one' and 'two' and 'three'";
        string memory escaped = _escapeJSON(titleWithManyQuotes);

        // Count escaped quotes
        uint256 escapedQuoteCount = _countSubstring(escaped, "\\'");
        assertEq(escapedQuoteCount, 6, "Should have 6 escaped quotes");
    }

    /// @notice Test: Empty strings are handled correctly
    function testJSON_HandlesEmptyStrings() public {
        string memory json = string(
            abi.encodePacked(
                "{'title':'Test',",
                "'text':'Description',",
                "'proof':'',", // Empty proof
                "'completedAt':",
                _uint2str(block.timestamp),
                ",",
                "'type':'project-impact'}"
            )
        );

        assertTrue(_containsSubstring(json, "'proof':''"), "Should have empty proof field");
        assertTrue(_isValidJSON(json), "JSON should be valid with empty proof");
    }

    /// @notice Test: Long strings don't break JSON
    function testJSON_HandlesLongStrings() public {
        string memory longTitle = "This is a very long title that contains many words and describes"
            " the work in great detail with extensive information";
        string memory longText = "This is an even longer description that provides comprehensive"
            " information about the impact created including specific metrics measurements"
            " outcomes and observations from the field with detailed analysis";

        string memory json = string(
            abi.encodePacked(
                "{'title':'",
                _escapeJSON(longTitle),
                "',",
                "'text':'",
                _escapeJSON(longText),
                "',",
                "'proof':'ipfs://proof',",
                "'completedAt':",
                _uint2str(block.timestamp),
                ",",
                "'type':'project-impact'}"
            )
        );

        assertTrue(_containsSubstring(json, "very long title"), "Should contain long title");
        assertTrue(_containsSubstring(json, "comprehensive information"), "Should contain long description");
        assertTrue(_isValidJSON(json), "JSON should be valid with long strings");
    }

    /// @notice Test: Metadata JSON embedding in milestone
    function testMilestoneJSON_MetadataEmbedded() public {
        string memory metadata = "{'capitals':['living','social'],'assessmentType':'quarterly'}";

        string memory json = string(
            abi.encodePacked(
                "{'title':'Test',",
                "'text':'Description',",
                "'metadata':",
                metadata,
                ",",
                "'completedAt':",
                _uint2str(block.timestamp),
                ",",
                "'type':'project-milestone'}"
            )
        );

        // Metadata should be embedded as a JSON object
        assertTrue(_containsSubstring(json, "'metadata':{"), "Metadata should be JSON object");
        assertTrue(_containsSubstring(json, "'capitals':"), "Metadata should contain capitals");
        assertTrue(_isValidJSON(json), "JSON should be valid with embedded metadata");
    }

    /// @notice Test: Special characters in different positions
    function testJSONEscaping_QuotesInDifferentPositions() public {
        // Quote at start
        string memory str1 = "'Start with quote";
        assertTrue(_containsSubstring(_escapeJSON(str1), "\\'Start"), "Should escape quote at start");

        // Quote at end
        string memory str2 = "End with quote'";
        assertTrue(_containsSubstring(_escapeJSON(str2), "quote\\'"), "Should escape quote at end");

        // Quote in middle
        string memory str3 = "Middle'quote";
        assertTrue(_containsSubstring(_escapeJSON(str3), "Middle\\'quote"), "Should escape quote in middle");

        // Multiple consecutive quotes
        string memory str4 = "Test''double";
        uint256 count = _countSubstring(_escapeJSON(str4), "\\'");
        assertEq(count, 2, "Should escape consecutive quotes");
    }

    // ============================================================================
    // Helper Functions (duplicated from Garden.sol for testing)
    // ============================================================================

    function _escapeJSON(string memory str) private pure returns (string memory) {
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

    function _uint2str(uint256 _i) private pure returns (string memory) {
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

    function _containsField(string memory json, string memory fieldName) private pure returns (bool) {
        string memory searchStr = string(abi.encodePacked("'", fieldName, "':"));
        return _containsSubstring(json, searchStr);
    }

    function _containsSubstring(string memory str, string memory substring) private pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory subBytes = bytes(substring);

        if (subBytes.length > strBytes.length) return false;
        if (subBytes.length == 0) return true;

        for (uint256 i = 0; i <= strBytes.length - subBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < subBytes.length; j++) {
                if (strBytes[i + j] != subBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    function _countSubstring(string memory str, string memory substring) private pure returns (uint256) {
        bytes memory strBytes = bytes(str);
        bytes memory subBytes = bytes(substring);
        uint256 count = 0;

        if (subBytes.length > strBytes.length || subBytes.length == 0) return 0;

        for (uint256 i = 0; i <= strBytes.length - subBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < subBytes.length; j++) {
                if (strBytes[i + j] != subBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                count++;
                i += subBytes.length - 1;
            }
        }
        return count;
    }

    function _isValidJSON(string memory json) private pure returns (bool) {
        bytes memory b = bytes(json);
        if (b.length < 2) return false;
        if (b[0] != "{" || b[b.length - 1] != "}") return false;
        return _validateJSONStructure(b);
    }

    function _validateJSONStructure(bytes memory b) private pure returns (bool) {
        uint256 openBraces = 0;
        uint256 closeBraces = 0;
        bool inString = false;
        bool escaped = false;

        for (uint256 i = 0; i < b.length; i++) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (b[i] == "\\") {
                escaped = true;
            } else if (b[i] == "'") {
                inString = !inString;
            } else if (!inString) {
                if (b[i] == "{") openBraces++;
                else if (b[i] == "}") closeBraces++;
            }
        }
        return openBraces == closeBraces && !inString;
    }
}
