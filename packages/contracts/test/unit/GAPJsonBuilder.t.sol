// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { JsonBuilder, InvalidDomainValue } from "../../src/lib/JsonBuilder.sol";

/// @title JsonBuilderWrapper
/// @notice Wrapper to expose internal library functions for testing
/// @dev Library functions are internal, so we need a wrapper contract to call them
contract JsonBuilderWrapper {
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
        return JsonBuilder.buildProjectDetails(name, description, location, bannerImage);
    }

    function buildImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID,
        address garden,
        uint256 timestamp,
        string calldata metadataCID
    )
        external
        pure
        returns (string memory)
    {
        return JsonBuilder.buildImpact(workTitle, impactDescription, proofIPFS, workUID, garden, timestamp, metadataCID);
    }

    function buildMilestone(
        string calldata title,
        string calldata desc,
        uint256 startDate,
        uint256 endDate,
        uint8 domain,
        string calldata location,
        string calldata assessmentConfigCID
    )
        external
        pure
        returns (string memory)
    {
        return JsonBuilder.buildMilestone(title, desc, startDate, endDate, domain, location, assessmentConfigCID);
    }
}

/// @title JsonBuilderTest
/// @notice Unit tests for JsonBuilder library functions
/// @dev Tests JSON structure, escaping, edge cases, and schema conformance
contract JsonBuilderTest is Test {
    JsonBuilderWrapper private wrapper;

    function setUp() public {
        wrapper = new JsonBuilderWrapper();
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

        assertTrue(_contains(json, "ipfs://QmABC123"), "Should build IPFS protocol URL from bare CID");
    }

    function testProjectDetailsEmptyBannerImage() public {
        string memory json = wrapper.buildProjectDetails("Garden", "Desc", "Loc", "");

        assertTrue(_contains(json, "\"imageURL\":\"\""), "Empty banner should produce empty imageURL");
    }

    function testProjectDetailsGatewayURLNormalization() public {
        string memory json =
            wrapper.buildProjectDetails("Garden", "Desc", "Loc", "https://greengoods.mypinata.cloud/ipfs/bafkreiabc123");

        assertTrue(
            _contains(json, "\"imageURL\":\"ipfs://bafkreiabc123\""), "Gateway URL should be normalized to ipfs:// protocol"
        );
        assertFalse(_contains(json, "https://"), "Should not contain any https:// after normalization");
    }

    function testProjectDetailsIpfsProtocolPassthrough() public {
        string memory json = wrapper.buildProjectDetails("Garden", "Desc", "Loc", "ipfs://bafkreiexisting");

        assertTrue(
            _contains(json, "\"imageURL\":\"ipfs://bafkreiexisting\""), "ipfs:// prefixed URL should pass through unchanged"
        );
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
        address garden = address(0xBEEF);

        string memory json =
            wrapper.buildImpact("Planted Trees", "Planted 100 trees", "QmProof", workUID, garden, 1_700_000_000, "");

        assertTrue(_contains(json, "\"title\":\"Planted Trees\""), "Should contain title");
        assertTrue(_contains(json, "\"text\":\"Planted 100 trees\""), "Should contain text");
        assertTrue(_contains(json, "\"type\":\"project-update\""), "Should have correct type");
    }

    function testImpactISODateFormat() public {
        // Unix timestamp 1700000000 = 2023-11-14T22:13:20.000Z
        string memory json = wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), address(0xBEEF), 1_700_000_000, "");

        assertTrue(_contains(json, "\"startDate\":\"2023-11-14T22:13:20.000Z\""), "Should format startDate as ISO");
        assertTrue(_contains(json, "\"endDate\":\"2023-11-14T22:13:20.000Z\""), "Should format endDate as ISO");
    }

    function testImpactDeliverables() public {
        string memory json =
            wrapper.buildImpact("Work", "Impact desc", "QmEvidenceHash", bytes32(0), address(0xBEEF), 1_700_000_000, "");

        assertTrue(_contains(json, "\"deliverables\":[{"), "Should contain deliverables array");
        assertTrue(_contains(json, "\"name\":\"Work Evidence\""), "Should have deliverable name");
        assertTrue(_contains(json, "\"proof\":\"ipfs://QmEvidenceHash\""), "Should have IPFS proof link");
    }

    function testImpactGreenGoodsLink() public {
        bytes32 workUID = bytes32(uint256(0xABCD));
        address garden = address(0x1234);

        string memory json = wrapper.buildImpact("Work", "Desc", "QmProof", workUID, garden, 1_700_000_000, "");

        assertTrue(_contains(json, "https://greengoods.app/#/home/0x"), "Should use app domain + hash route");
        assertTrue(_contains(json, "/work/0x"), "Should include work route with UID");
        assertTrue(_contains(json, "\"label\":\"View in Green Goods\""), "Should have link label");
    }

    function testImpactUsesGardenAddressInLink() public {
        address garden = address(0x1234);
        string memory json = wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), garden, 1_700_000_000, "");

        assertTrue(_contains(json, "0000000000000000000000000000000000001234"), "Should include garden address hex");
    }

    function testImpactEscapesUserInput() public {
        string memory json = wrapper.buildImpact(
            'Work "Title"', 'Impact "Description"', "QmProof", bytes32(0), address(0xBEEF), 1_700_000_000, ""
        );

        assertTrue(_contains(json, 'Work \\"Title\\"'), "Title quotes escaped");
        assertTrue(_contains(json, 'Impact \\"Description\\"'), "Description quotes escaped");
    }

    function testImpactWithMetadataCID() public {
        string memory json =
            wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), address(0xBEEF), 1_700_000_000, "bafkreiMetadata123");

        assertTrue(
            _contains(json, "\"metadataCID\":\"ipfs://bafkreiMetadata123\""),
            "Should include metadataCID with ipfs:// prefix"
        );
    }

    function testImpactWithEmptyMetadataCID() public {
        string memory json = wrapper.buildImpact("Work", "Desc", "QmProof", bytes32(0), address(0xBEEF), 1_700_000_000, "");

        assertFalse(_contains(json, "metadataCID"), "Empty metadataCID should not appear in JSON");
    }

    // =========================================================================
    // buildMilestone Tests
    // =========================================================================

    function testMilestoneBasicStructure() public {
        string memory json = wrapper.buildMilestone(
            "Q1 Assessment", "Completed assessment", 1_700_000_000, 1_702_000_000, 0, "Garden Plot A", "QmConfig123"
        );

        assertTrue(_contains(json, "\"title\":\"Q1 Assessment\""), "Should contain title");
        assertTrue(_contains(json, "\"text\":\"Completed assessment\""), "Should contain text");
        assertTrue(_contains(json, "\"type\":\"project-milestone\""), "Should have correct type");
    }

    function testMilestoneISODates() public {
        string memory json = wrapper.buildMilestone("Assessment", "Desc", 1_700_000_000, 1_702_000_000, 0, "Loc", "QmCID");

        assertTrue(_contains(json, "\"startDate\":\"2023-11-14T22:13:20.000Z\""), "Should format startDate as ISO");
        assertTrue(_contains(json, "\"endDate\":\"2023-12-08T01:46:40.000Z\""), "Should format endDate as ISO");
    }

    function testMilestoneDomainNames() public {
        // Test all 4 domains produce human-readable names
        string memory jsonSolar = wrapper.buildMilestone("A", "D", 0, 0, 0, "", "");
        assertTrue(_contains(jsonSolar, "\"domain\":\"SOLAR\""), "Domain 0 should be SOLAR");

        string memory jsonAgro = wrapper.buildMilestone("A", "D", 0, 0, 1, "", "");
        assertTrue(_contains(jsonAgro, "\"domain\":\"AGRO\""), "Domain 1 should be AGRO");

        string memory jsonEdu = wrapper.buildMilestone("A", "D", 0, 0, 2, "", "");
        assertTrue(_contains(jsonEdu, "\"domain\":\"EDU\""), "Domain 2 should be EDU");

        string memory jsonWaste = wrapper.buildMilestone("A", "D", 0, 0, 3, "", "");
        assertTrue(_contains(jsonWaste, "\"domain\":\"WASTE\""), "Domain 3 should be WASTE");
    }

    function testMilestoneLocation() public {
        string memory json = wrapper.buildMilestone("Assessment", "Desc", 0, 0, 0, "Garden Plot A", "QmCID");

        assertTrue(_contains(json, "\"location\":\"Garden Plot A\""), "Should include location");
    }

    function testMilestoneConfigCID() public {
        string memory json = wrapper.buildMilestone(
            "Assessment", "Desc", 0, 0, 0, "Loc", "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        );

        assertTrue(
            _contains(
                json, "\"assessmentConfigCID\":\"ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi\""
            ),
            "Should include assessmentConfigCID with ipfs:// prefix"
        );
    }

    function testMilestoneEscapesInput() public {
        string memory json = wrapper.buildMilestone('Title "A"', 'Desc "B"', 0, 0, 0, 'Loc "C"', "QmCID");

        assertTrue(_contains(json, 'Title \\"A\\"'), "Title should be escaped");
        assertTrue(_contains(json, 'Desc \\"B\\"'), "Description should be escaped");
        assertTrue(_contains(json, 'Loc \\"C\\"'), "Location should be escaped");
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
        string memory json = wrapper.buildImpact("Work", "Desc", "Qm", bytes32(0), address(0xBEEF), 1_700_000_000, "");
        bytes memory b = bytes(json);

        assertEq(b[0], bytes1("{"), "Should start with {");
        assertEq(b[b.length - 1], bytes1("}"), "Should end with }");
    }

    function testImpactWithMetadataCIDStartsAndEndsCorrectly() public {
        string memory json =
            wrapper.buildImpact("Work", "Desc", "Qm", bytes32(0), address(0xBEEF), 1_700_000_000, "bafkreiMeta456");
        bytes memory b = bytes(json);

        assertEq(b[0], bytes1("{"), "Should start with {");
        assertEq(b[b.length - 1], bytes1("}"), "Should end with }");
    }

    function testMilestoneStartsAndEndsCorrectly() public {
        string memory json = wrapper.buildMilestone("Title", "Desc", 0, 0, 0, "", "");
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

    function testFuzz_milestoneValidDomainNeverReverts(
        string calldata title,
        string calldata desc,
        uint256 start,
        uint256 end,
        uint8 domain
    )
        public
    {
        vm.assume(domain <= 3);
        string memory json = wrapper.buildMilestone(title, desc, start, end, domain, "", "QmCID");
        bytes memory b = bytes(json);
        assertTrue(b.length > 0, "Should produce non-empty output");
    }

    function testFuzz_milestoneRevertsForInvalidDomain(uint8 domain) public {
        vm.assume(domain > 3);
        vm.expectRevert(abi.encodeWithSelector(InvalidDomainValue.selector, domain));
        wrapper.buildMilestone("Title", "Desc", 0, 0, domain, "", "QmCID");
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
