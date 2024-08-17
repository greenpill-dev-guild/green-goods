// SPDX-License-Identifier: MIT

pragma solidity ^0.8.25;

struct WorkSchema {
    bytes32 uid;
    string name;
    string description;
    string[] attributes;
}

struct WorkApprovalSchema {
    bytes32 uid;
    string name;
    string description;
    string[] attributes;
}

