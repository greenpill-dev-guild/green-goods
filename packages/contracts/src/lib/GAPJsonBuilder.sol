// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { StringUtils } from "./StringUtils.sol";

/// @title GAPJsonBuilder
/// @notice Library for building Karma GAP attestation JSON payloads
/// @dev Extracted from KarmaGAPModule to reduce contract size and enable isolated testing.
///      All functions are pure/view with no storage dependencies.
///
///      JSON Schemas:
///      - Project Details: { title, description, locationOfImpact, imageURL, slug, type }
///      - Impact Update:   { title, text, startDate, endDate, deliverables[], links[], type }
///      - Milestone:       { title, text, type, data }
library GAPJsonBuilder {
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
        string memory imageURL =
            bytes(bannerImage).length > 0 ? string(abi.encodePacked("https://w3s.link/ipfs/", bannerImage)) : "";

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
    /// @param tokenId Garden token ID (for Green Goods link)
    /// @param timestamp Block timestamp for ISO date formatting
    /// @param chainId Chain ID for Green Goods link
    /// @return JSON string conforming to GAP project-update schema
    function buildImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID,
        uint256 tokenId,
        uint256 timestamp,
        uint256 chainId
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
            ",\"links\":[{\"type\":\"other\",\"url\":\"https://greengoods.me/garden/",
            StringUtils.uint2str(chainId),
            "/",
            StringUtils.uint2str(tokenId),
            "/work/0x",
            StringUtils.bytes32ToHexString(workUID),
            "\",\"label\":\"View in Green Goods\"}],\"type\":\"project-update\"}"
        );

        return string(abi.encodePacked(part1, part2, part3));
    }

    /// @notice Builds milestone JSON for assessment attestations
    /// @param title Milestone title
    /// @param desc Milestone description
    /// @param meta Additional metadata (raw JSON)
    /// @return JSON string conforming to GAP project-milestone schema
    function buildMilestone(
        string calldata title,
        string calldata desc,
        string calldata meta
    )
        internal
        pure
        returns (string memory)
    {
        bytes memory part1 = abi.encodePacked("{\"title\":\"", StringUtils.escapeJSON(title), "\",\"text\":\"");
        bytes memory part2 = abi.encodePacked(StringUtils.escapeJSON(desc), "\",\"type\":\"project-milestone\",\"data\":");
        return string(abi.encodePacked(part1, part2, meta, "}"));
    }
}
