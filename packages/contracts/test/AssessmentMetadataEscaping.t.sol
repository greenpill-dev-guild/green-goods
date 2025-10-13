// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";

/// @title AssessmentMetadataEscapingTest
/// @notice Tests for validating assessment metadata JSON escaping logic
/// @dev Tests the _buildMilestoneMetadata and _escapeJSON functions
contract AssessmentMetadataEscapingTest is Test {
    /// @notice Test: Escaping quotes in assessment type
    function testEscapeJSON_HandlesQuotesInAssessmentType() public {
        string memory assessmentType = "Quarterly 'Q1' Assessment";
        string memory escaped = _escapeJSON(assessmentType);

        // Should contain escaped quotes
        assertTrue(_containsSubstring(escaped, "\\'Q1\\'"), "Quotes should be escaped");

        // Should not break JSON when embedded
        string memory json = string(abi.encodePacked("{'assessmentType':'", escaped, "'}"));
        assertTrue(_isValidJSON(json), "JSON should be valid");
    }

    /// @notice Test: Escaping quotes in metrics JSON
    function testEscapeJSON_HandlesQuotesInMetricsJSON() public {
        string memory metricsJSON = "{'metric':'test','value':'100'}";
        string memory escaped = _escapeJSON(metricsJSON);

        // Count escaped quotes
        uint256 quoteCount = _countSubstring(escaped, "\\'");
        assertTrue(quoteCount > 0, "Should have escaped quotes");
    }

    /// @notice Test: Multiple quotes are all escaped
    function testEscapeJSON_HandlesMultipleQuotes() public {
        string memory text = "Test 'one' and 'two' and 'three'";
        string memory escaped = _escapeJSON(text);

        // Should have 6 escaped quotes (3 pairs)
        uint256 count = _countSubstring(escaped, "\\'");
        assertEq(count, 6, "Should escape all 6 quote marks");
    }

    /// @notice Test: Empty string returns empty
    function testEscapeJSON_HandlesEmptyString() public {
        string memory empty = "";
        string memory escaped = _escapeJSON(empty);

        assertEq(bytes(escaped).length, 0, "Empty string should remain empty");
    }

    /// @notice Test: String without quotes returns unchanged
    function testEscapeJSON_NoQuotesNoChange() public {
        string memory text = "No quotes here";
        string memory escaped = _escapeJSON(text);

        assertEq(text, escaped, "String without quotes should be unchanged");
    }

    /// @notice Test: Consecutive quotes are handled
    function testEscapeJSON_ConsecutiveQuotes() public {
        string memory text = "Test''double";
        string memory escaped = _escapeJSON(text);

        uint256 count = _countSubstring(escaped, "\\'");
        assertEq(count, 2, "Should escape both consecutive quotes");
    }

    /// @notice Test: Quote at start of string
    function testEscapeJSON_QuoteAtStart() public {
        string memory text = "'Start";
        string memory escaped = _escapeJSON(text);

        assertTrue(_containsSubstring(escaped, "\\'Start"), "Should escape quote at start");
    }

    /// @notice Test: Quote at end of string
    function testEscapeJSON_QuoteAtEnd() public {
        string memory text = "End'";
        string memory escaped = _escapeJSON(text);

        assertTrue(_containsSubstring(escaped, "End\\'"), "Should escape quote at end");
    }

    /// @notice Test: Build milestone metadata with escaped fields
    function testBuildMilestoneMetadata_EscapesFields() public {
        string memory assessmentType = "Type 'with' quotes";
        string memory metricsJSON = "ipfs://metrics'test";

        // Build capitals array
        string memory capitalsJSON = "['living','social']";

        // Build metadata JSON (simulating resolver logic)
        string memory metadata = string(
            abi.encodePacked(
                "{'capitals':",
                capitalsJSON,
                ",'assessmentType':'",
                _escapeJSON(assessmentType),
                "','metricsJSON':'",
                _escapeJSON(metricsJSON),
                "'}"
            )
        );

        // Verify structure
        assertTrue(_containsSubstring(metadata, "'capitals':["), "Should have capitals array");
        assertTrue(_containsSubstring(metadata, "'assessmentType'"), "Should have assessmentType");
        assertTrue(_containsSubstring(metadata, "'metricsJSON'"), "Should have metricsJSON");
        assertTrue(_isValidJSON(metadata), "Metadata should be valid JSON");
    }

    // ============================================================================
    // Helper Functions (from Garden.sol and Assessment.sol)
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
