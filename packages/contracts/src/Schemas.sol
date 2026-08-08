// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

struct AssessmentSchema {
    string title;
    string description;
    string assessmentConfigCID; // IPFS CID referencing full AssessmentConfigPayload JSON
    uint8 domain; // Domain enum: 0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE
    uint256 startDate;
    uint256 endDate;
    string location;
}

struct AssessmentV3Schema {
    string title;
    string description;
    string assessmentConfigCID;
    uint8 domain;
    uint256 startDate;
    uint256 endDate;
    string location;
    uint8 assessmentKind; // 0=Baseline, 1=Delta, 2=Technical
    uint256 cycleId; // 0 = not cycle-scoped
    bytes32 baselineUID; // required only for Delta
}

struct CommunityTestimonySchema {
    uint256 commitmentId; // 0 = garden-level testimony
    string title;
    string testimonyCID;
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
    uint8 confidence;
    uint8 verificationMethod;
    string reviewNotesCID;
}
