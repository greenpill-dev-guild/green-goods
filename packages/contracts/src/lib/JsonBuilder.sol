// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { StringUtils } from "./StringUtils.sol";

error InvalidDomainValue(uint8 domain);

/// @title JsonBuilder
/// @notice Library for building Karma GAP attestation JSON payloads
/// @dev Extracted from KarmaGAPModule to reduce contract size and enable isolated testing.
///      All functions are pure/view with no storage dependencies.
///
///      JSON Schemas:
///      - Project Details: { title, description, locationOfImpact, imageURL, slug, type }
///      - Project Update:  { title, text, startsAt, endsAt, deliverables[], type }
///      - Milestone:       { title, text, startDate, endDate, domain, location, assessmentConfigCID, type }
library JsonBuilder {
    /// @notice Builds project details JSON for Karma GAP
    /// @param name Project name
    /// @param description Project description
    /// @param location Location of impact
    /// @param bannerImage IPFS CID for banner image (empty string if none)
    /// @return JSON string conforming to GAP project-details schema
    function buildProjectDetails(
        string memory name,
        string memory slug,
        string memory description,
        string memory location,
        string memory bannerImage
    )
        internal
        pure
        returns (string memory)
    {
        string memory imageURL = StringUtils.toHTTPURL(bannerImage);
        string memory canonicalSlug = bytes(slug).length == 0 ? StringUtils.generateSlug(name) : slug;

        return string(
            abi.encodePacked(
                "{\"title\":\"",
                StringUtils.escapeJSON(name),
                "\",\"description\":\"",
                StringUtils.escapeJSON(description),
                "\",\"locationOfImpact\":\"",
                StringUtils.escapeJSON(location),
                "\",\"imageURL\":\"",
                StringUtils.escapeJSON(imageURL),
                "\",\"slug\":\"",
                StringUtils.escapeJSON(canonicalSlug),
                "\",\"type\":\"project-details\"}"
            )
        );
    }

    /// @notice Backward-compatible project-details builder that derives the slug from the name.
    function buildProjectDetails(
        string memory name,
        string memory description,
        string memory location,
        string memory bannerImage
    )
        internal
        pure
        returns (string memory)
    {
        return buildProjectDetails(name, "", description, location, bannerImage);
    }

    /// @notice Backward-compatible wrapper for Project Update JSON.
    /// @param workTitle Title of the approved work
    /// @param impactDescription Description of the impact
    /// @param proofIPFS IPFS CID for proof media
    /// @param workUID UID of the original work attestation
    /// @param garden Garden account address (for Green Goods link)
    /// @param timestamp Block timestamp for ISO date formatting
    /// @param metadataCID IPFS CID for structured work metadata (domain-specific indicators)
    /// @return JSON string conforming to GAP project-update schema
    function buildImpact(
        string memory workTitle,
        string memory impactDescription,
        string memory proofIPFS,
        bytes32 workUID,
        address garden,
        uint256 timestamp,
        string memory metadataCID
    )
        internal
        view
        returns (string memory)
    {
        return buildProjectUpdate(
            workTitle, impactDescription, proofIPFS, workUID, garden, timestamp, metadataCID, block.chainid
        );
    }

    /// @notice Builds a Karma-supported Project Update with browser-safe evidence links.
    function buildProjectUpdate(
        string memory workTitle,
        string memory updateText,
        string memory proofReference,
        bytes32 workUID,
        address garden,
        uint256 timestamp,
        string memory metadataReference,
        uint256 chainId
    )
        internal
        pure
        returns (string memory)
    {
        string memory greenGoodsURL = string(
            abi.encodePacked(
                "https://www.greengoods.app/home/0x",
                StringUtils.addressToHexString(garden),
                "/work/0x",
                StringUtils.bytes32ToHexString(workUID)
            )
        );
        string memory easURL = string(
            abi.encodePacked(_easScanBaseURL(chainId), "/attestation/view/0x", StringUtils.bytes32ToHexString(workUID))
        );
        string memory text = string(
            abi.encodePacked(
                updateText,
                "\n\n[View in Green Goods](",
                greenGoodsURL,
                ")\n\n[View original attestation on EAS Scan](",
                easURL,
                ")"
            )
        );

        return string(
            abi.encodePacked(
                "{\"title\":\"",
                StringUtils.escapeJSON(workTitle),
                "\",\"text\":\"",
                StringUtils.escapeJSON(text),
                "\",\"startsAt\":",
                StringUtils.uint2str(timestamp),
                ",\"endsAt\":",
                StringUtils.uint2str(timestamp),
                ",\"deliverables\":[",
                _buildDeliverables(updateText, proofReference, metadataReference),
                "],\"type\":\"project-update\"}"
            )
        );
    }

    function _buildDeliverables(
        string memory updateText,
        string memory proofReference,
        string memory metadataReference
    )
        private
        pure
        returns (bytes memory)
    {
        bytes memory evidence = bytes(proofReference).length == 0
            ? bytes("")
            : abi.encodePacked(
                "{\"name\":\"Work Evidence\",\"proof\":\"",
                StringUtils.escapeJSON(StringUtils.toHTTPURL(proofReference)),
                "\",\"description\":\"",
                StringUtils.escapeJSON(updateText),
                "\"}"
            );
        bytes memory metadata = bytes(metadataReference).length == 0
            ? bytes("")
            : abi.encodePacked(
                evidence.length == 0 ? "" : ",",
                "{\"name\":\"Work Metadata\",\"proof\":\"",
                StringUtils.escapeJSON(StringUtils.toHTTPURL(metadataReference)),
                "\",\"description\":\"Structured Green Goods Work metadata\"}"
            );
        return abi.encodePacked(evidence, metadata);
    }

    function _easScanBaseURL(uint256 chainId) private pure returns (string memory) {
        if (chainId == 42_161) return "https://arbitrum.easscan.org";
        if (chainId == 42_220) return "https://celo.easscan.org";
        if (chainId == 11_155_111) return "https://sepolia.easscan.org";
        return "https://easscan.org";
    }

    /// @notice Builds milestone JSON for assessment attestations
    /// @param title Milestone title
    /// @param desc Milestone description
    /// @param startDate Unix timestamp for assessment start
    /// @param endDate Unix timestamp for assessment end
    /// @param domain Domain enum value (0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE)
    /// @param location Location of the assessment
    /// @param assessmentConfigCID IPFS CID for the full assessment config
    /// @return JSON string conforming to GAP project-milestone schema
    function buildMilestone(
        string calldata title,
        string calldata desc,
        uint256 startDate,
        uint256 endDate,
        uint8 domain,
        string calldata location,
        string calldata assessmentConfigCID
    )
        internal
        pure
        returns (string memory)
    {
        string memory startISO = StringUtils.timestampToISO(startDate);
        string memory endISO = StringUtils.timestampToISO(endDate);

        // Part 1: title, text, dates
        bytes memory part1 = abi.encodePacked(
            "{\"title\":\"",
            StringUtils.escapeJSON(title),
            "\",\"text\":\"",
            StringUtils.escapeJSON(desc),
            "\",\"startDate\":\"",
            startISO,
            "\",\"endDate\":\"",
            endISO
        );

        // Part 2: domain, location
        bytes memory part2 = abi.encodePacked(
            "\",\"domain\":\"", _domainToString(domain), "\",\"location\":\"", StringUtils.escapeJSON(location)
        );

        // Part 3: assessment config + type
        bytes memory part3 = abi.encodePacked(
            "\",\"assessmentConfigCID\":\"ipfs://",
            StringUtils.escapeJSON(assessmentConfigCID),
            "\",\"type\":\"project-milestone\"}"
        );

        return string(abi.encodePacked(part1, part2, part3));
    }

    /// @notice Converts domain enum to human-readable string
    /// @param domain Domain value (0-3)
    /// @return Domain name string
    function _domainToString(uint8 domain) private pure returns (string memory) {
        if (domain == 0) return "SOLAR";
        if (domain == 1) return "AGRO";
        if (domain == 2) return "EDU";
        if (domain == 3) return "WASTE";
        revert InvalidDomainValue(domain);
    }
}
