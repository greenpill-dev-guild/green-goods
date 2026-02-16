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
///      - Impact Update:   { title, text, startDate, endDate, deliverables[], links[], type }
///      - Milestone:       { title, text, startDate, endDate, domain, location, assessmentConfigCID, type }
library JsonBuilder {
    /// @notice Builds project details JSON for Karma GAP
    /// @param name Project name
    /// @param description Project description
    /// @param location Location of impact
    /// @param bannerImage IPFS CID for banner image (empty string if none)
    /// @return JSON string conforming to GAP project-details schema
    function buildProjectDetails(
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        internal
        pure
        returns (string memory)
    {
        string memory imageURL = bytes(bannerImage).length > 0 ? string(abi.encodePacked("ipfs://", bannerImage)) : "";

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
                StringUtils.escapeJSON(StringUtils.generateSlug(name)),
                "\",\"type\":\"project-details\"}"
            )
        );
    }

    /// @notice Builds impact JSON for work approval attestations
    /// @param workTitle Title of the approved work
    /// @param impactDescription Description of the impact
    /// @param proofIPFS IPFS CID for proof media
    /// @param workUID UID of the original work attestation
    /// @param garden Garden account address (for Green Goods link)
    /// @param timestamp Block timestamp for ISO date formatting
    /// @return JSON string conforming to GAP project-update schema
    function buildImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID,
        address garden,
        uint256 timestamp
    )
        internal
        pure
        returns (string memory)
    {
        string memory isoDate = StringUtils.timestampToISO(timestamp);

        // Part 1: title, text, dates
        bytes memory part1 = abi.encodePacked(
            "{\"title\":\"",
            StringUtils.escapeJSON(workTitle),
            "\",\"text\":\"",
            StringUtils.escapeJSON(impactDescription),
            "\",\"startDate\":\"",
            isoDate,
            "\",\"endDate\":\"",
            isoDate
        );

        // Part 2: deliverables
        bytes memory part2 = abi.encodePacked(
            "\",\"deliverables\":[{\"name\":\"Work Evidence\",\"proof\":\"ipfs://",
            StringUtils.escapeJSON(proofIPFS),
            "\",\"description\":\"",
            StringUtils.escapeJSON(impactDescription),
            "\"}]"
        );

        // Part 3: links
        bytes memory part3 = abi.encodePacked(
            ",\"links\":[{\"type\":\"other\",\"url\":\"https://greengoods.app/#/home/0x",
            StringUtils.addressToHexString(garden),
            "/work/0x",
            StringUtils.bytes32ToHexString(workUID),
            "\",\"label\":\"View in Green Goods\"}],\"type\":\"project-update\"}"
        );

        return string(abi.encodePacked(part1, part2, part3));
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
