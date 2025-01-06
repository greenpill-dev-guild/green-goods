// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

struct AssessmentSchema {
    string title;
    string[] media;
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
