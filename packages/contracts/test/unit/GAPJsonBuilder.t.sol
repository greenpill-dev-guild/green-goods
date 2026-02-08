// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { GAPJsonBuilder } from "../../src/lib/GAPJsonBuilder.sol";

/// @title GAPJsonBuilderWrapper
/// @notice Wrapper to expose internal library functions for testing
/// @dev Library functions are internal, so we need a wrapper contract to call them
contract GAPJsonBuilderWrapper {
    function buildProjectDetails(
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        external
        pure
        returns (string memory)
    {
        return GAPJsonBuilder.buildProjectDetails(name, description, location, bannerImage);
    }

    function buildImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID,
        uint256 tokenId,
        uint256 timestamp,
        uint256 chainId
    )
        external
        pure
        returns (string memory)
    {
        return GAPJsonBuilder.buildImpact(workTitle, impactDescription, proofIPFS, workUID, tokenId, timestamp, chainId);
    }

    function buildMilestone(
        string calldata title,
        string calldata desc,
        string calldata meta
    )
        external
        pure
        returns (string memory)
    {
        return GAPJsonBuilder.buildMilestone(title, desc, meta);
    }
}

/// @title GAPJsonBuilderTest
/// @notice Unit tests for GAPJsonBuilder library functions
/// @dev Tests JSON structure, escaping, edge cases, and schema conformance
contract GAPJsonBuilderTest is Test {
    GAPJsonBuilderWrapper private wrapper;

    function setUp() public {
        wrapper = new GAPJsonBuilderWrapper();
    }

    // =========================================================================
    // buildProjectDetails Tests
    // =========================================================================

    function testProjectDetailsBasicStructure() public {
        string memory json = wrapper.buildProjectDetails("My Garden", "A test garden", "New York", "QmBannerHash");

        // Verify JSON structure by checking key fields
        assertTrue(_contains(json, "\"title\":\"My Garden\""), "Should contain title");
        assertTrue(_contains(json, "\"description\":\"A test garden\""), "Should contain description");
        assertTrue(_contains(json, "\"locationOfImpact\":\"New York\""), "Should contain location");
        assertTrue(_contains(json, "\"type\":\"project-details\""), "Should have correct type");
    }

    function testProjectDetailsImageURL() public {
        string memory json = wrapper.buildProjectDetails("Garden", "Desc", "Loc", "QmABC123");

        assertTrue(_contains(json, "https://w3s.link/ipfs/QmABC123"), "Should build full IPFS URL");
    }

    function testProjectDetailsEmptyBannerImage() public {
        string memory json = wrapper.buildProjectDetails("Garden", "Desc", "Loc", "");

        assertTrue(_contains(json, "\"imageURL\":\"\""), "Empty banner should produce empty imageURL");
    }

    function testProjectDetailsSlugGeneration() public {
        string memory json = wrapper.buildProjectDetails("My Cool Garden", "Desc", "Loc", "");

        assertTrue(_contains(json, "\"slug\":\"my-cool-garden\""), "Should generate correct slug");
    }

    function testProjectDetailsEscapesQuotes() public {
        string memory json = wrapper.buildProjectDetails('Garden "Alpha"', "A \"test\" garden", "Loc", "");

        // Escaped quotes should appear as \"
        assertTrue(_contains(json, 'Garden \\"Alpha\\"'), "Title quotes should be escaped");
        assertTrue(_contains(json, 'A \\"test\\" garden'), "Description quotes should be escaped");
    }

    function testProjectDetailsEmptyStrings() public {
        string memory json = wrapper.buildProjectDetails("", "", "", "");

        assertTrue(_contains(json, "\"title\":\"\""), "Should handle empty title");
        assertTrue(_contains(json, "\"description\":\"\""), "Should handle empty description");
        assertTrue(_contains(json, "\"type\":\"project-details\""), "Should still have type");
    }

    // =========================================================================
    // buildImpact Tests
    // =========================================================================

    function testImpactBasicStructure() public {
        bytes32 workUID = bytes32(uint256(42));

        string memory json =
            wrapper.buildImpact("Planted Trees", "Planted 100 trees", "QmProof", workUID, 1, 1_700_000_000, 42_161);

        assertTrue(_contains(json, "\"title\":\"Planted Trees\""), "Should contain title");
        assertTrue(_contains(json, "\"text\":\"Planted 100 trees\""), "Should contain text");
        assertTrue(_contains(json, "\"type\":\"project-update\""), "Should have correct type");
    }

    function testImpactISODateFormat() public {
        // Unix timestamp 1700000000 = 2023-11-14T22:13:20.000Z
        string memory json = wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), 1, 1_700_000_000, 42_161);

        assertTrue(_contains(json, "\"startDate\":\"2023-11-14T22:13:20.000Z\""), "Should format startDate as ISO");
        assertTrue(_contains(json, "\"endDate\":\"2023-11-14T22:13:20.000Z\""), "Should format endDate as ISO");
    }

    function testImpactDeliverables() public {
        string memory json =
            wrapper.buildImpact("Work", "Impact desc", "QmEvidenceHash", bytes32(0), 1, 1_700_000_000, 42_161);

        assertTrue(_contains(json, "\"deliverables\":[{"), "Should contain deliverables array");
        assertTrue(_contains(json, "\"name\":\"Work Evidence\""), "Should have deliverable name");
        assertTrue(_contains(json, "\"proof\":\"ipfs://QmEvidenceHash\""), "Should have IPFS proof link");
    }

    function testImpactGreenGoodsLink() public {
        bytes32 workUID = bytes32(uint256(0xABCD));

        string memory json = wrapper.buildImpact("Work", "Desc", "QmProof", workUID, 5, 1_700_000_000, 42_161);

        assertTrue(_contains(json, "https://greengoods.me/garden/42161/5/work/0x"), "Should contain Green Goods link");
        assertTrue(_contains(json, "\"label\":\"View in Green Goods\""), "Should have link label");
    }

    function testImpactDifferentChainIds() public {
        string memory jsonArb = wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), 1, 1_700_000_000, 42_161);
        string memory jsonCelo = wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), 1, 1_700_000_000, 42_220);

        assertTrue(_contains(jsonArb, "/42161/"), "Arbitrum chain ID in link");
        assertTrue(_contains(jsonCelo, "/42220/"), "Celo chain ID in link");
    }

    function testImpactEscapesUserInput() public {
        string memory json =
            wrapper.buildImpact('Work "Title"', 'Impact "Description"', "QmProof", bytes32(0), 1, 1_700_000_000, 42_161);

        assertTrue(_contains(json, 'Work \\"Title\\"'), "Title quotes escaped");
        assertTrue(_contains(json, 'Impact \\"Description\\"'), "Description quotes escaped");
    }

    // =========================================================================
    // buildMilestone Tests
    // =========================================================================

    function testMilestoneBasicStructure() public {
        string memory json = wrapper.buildMilestone("Q1 Assessment", "Completed assessment", "{}");

        assertTrue(_contains(json, "\"title\":\"Q1 Assessment\""), "Should contain title");
        assertTrue(_contains(json, "\"text\":\"Completed assessment\""), "Should contain text");
        assertTrue(_contains(json, "\"type\":\"project-milestone\""), "Should have correct type");
    }

    function testMilestoneIncludesMetadata() public {
        string memory meta = "{\"score\":95,\"assessor\":\"0x123\"}";
        string memory json = wrapper.buildMilestone("Assessment", "Desc", meta);

        assertTrue(_contains(json, "\"data\":{\"score\":95,\"assessor\":\"0x123\"}"), "Should include raw metadata");
    }

    function testMilestoneEmptyMetadata() public {
        string memory json = wrapper.buildMilestone("Assessment", "Desc", "{}");

        assertTrue(_contains(json, "\"data\":{}"), "Should handle empty metadata object");
    }

    function testMilestoneEscapesInput() public {
        string memory json = wrapper.buildMilestone('Title "A"', 'Desc "B"', "{}");

        assertTrue(_contains(json, 'Title \\"A\\"'), "Title should be escaped");
        assertTrue(_contains(json, 'Desc \\"B\\"'), "Description should be escaped");
    }

    // =========================================================================
    // JSON Validity Tests
    // =========================================================================

    function testProjectDetailsStartsAndEndsCorrectly() public {
        string memory json = wrapper.buildProjectDetails("Test", "Desc", "Loc", "");
        bytes memory b = bytes(json);

        assertEq(b[0], bytes1("{"), "Should start with {");
        assertEq(b[b.length - 1], bytes1("}"), "Should end with }");
    }

    function testImpactStartsAndEndsCorrectly() public {
        string memory json = wrapper.buildImpact("Work", "Desc", "Qm", bytes32(0), 1, 1_700_000_000, 42_161);
        bytes memory b = bytes(json);

        assertEq(b[0], bytes1("{"), "Should start with {");
        assertEq(b[b.length - 1], bytes1("}"), "Should end with }");
    }

    function testMilestoneStartsAndEndsCorrectly() public {
        string memory json = wrapper.buildMilestone("Title", "Desc", "{}");
        bytes memory b = bytes(json);

        assertEq(b[0], bytes1("{"), "Should start with {");
        assertEq(b[b.length - 1], bytes1("}"), "Should end with }");
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_projectDetailsNeverReverts(
        string calldata name,
        string calldata desc,
        string calldata loc,
        string calldata banner
    )
        public
    {
        // Should never revert regardless of input
        string memory json = wrapper.buildProjectDetails(name, desc, loc, banner);
        bytes memory b = bytes(json);
        assertTrue(b.length > 0, "Should produce non-empty output");
        assertEq(b[0], bytes1("{"), "Should start with {");
        assertEq(b[b.length - 1], bytes1("}"), "Should end with }");
    }

    function testFuzz_milestoneNeverReverts(string calldata title, string calldata desc) public {
        string memory json = wrapper.buildMilestone(title, desc, "{}");
        bytes memory b = bytes(json);
        assertTrue(b.length > 0, "Should produce non-empty output");
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /// @notice Check if a string contains a substring
    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);

        if (n.length > h.length) return false;
        if (n.length == 0) return true;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}
