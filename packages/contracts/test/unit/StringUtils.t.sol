// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {StringUtils} from "../../src/lib/StringUtils.sol";

contract StringUtilsTest is Test {
    function testTimestampToISO_Epoch() public {
        // Test: Unix epoch (1970-01-01T00:00:00.000Z)
        assertEq(StringUtils.timestampToISO(0), "1970-01-01T00:00:00.000Z");
    }

    function testTimestampToISO_2024() public {
        // Test: 2024-01-01T00:00:00.000Z (1704067200)
        assertEq(StringUtils.timestampToISO(1_704_067_200), "2024-01-01T00:00:00.000Z");
    }

    function testTimestampToISO_WithTime() public {
        // Test: 2024-10-08T07:00:00.000Z (1728370800)
        assertEq(StringUtils.timestampToISO(1_728_370_800), "2024-10-08T07:00:00.000Z");
    }

    function testTimestampToISO_CurrentBlock() public {
        // Test: Current block timestamp (validates format)
        string memory result = StringUtils.timestampToISO(block.timestamp);
        // ISO format is always 24 chars: YYYY-MM-DDTHH:MM:SS.000Z
        assertEq(bytes(result).length, 24, "Length should be 24");
        // Should end with .000Z (indices 19-23)
        assertEq(bytes(result)[19], bytes1("."), "Index 19 should be .");
        assertEq(bytes(result)[20], bytes1("0"), "Index 20 should be 0");
        assertEq(bytes(result)[21], bytes1("0"), "Index 21 should be 0");
        assertEq(bytes(result)[22], bytes1("0"), "Index 22 should be 0");
        assertEq(bytes(result)[23], bytes1("Z"), "Index 23 should be Z");
    }
}
