// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

struct AssessmentSchema {
    string title;
    string description;
    string assessmentType;
    string[] capitals; // Array of capital names (e.g., "social", "living", "intellectual")
    string metricsJSON; // IPFS CID of flexible metrics object
    string[] evidenceMedia; // IPFS CIDs for photos/videos
    string[] reportDocuments; // IPFS CIDs for PDFs/reports
    bytes32[] impactAttestations; // Reference attestation UIDs
    uint256 startDate;
    uint256 endDate;
    string location;
    string[] tags;
}

struct WorkSchema {
    uint256 actionUID;
    string title;
    string feedback;
    string metadata;
    string[] media;
}

struct WorkApprovalSchema {
    uint256 actionUID;
    bytes32 workUID;
    bool approved;
    string feedback;
}
