// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

struct AssessmentSchema {
    uint8 version;
    uint8 soilMoisturePercentage;
    uint256 carbonTonStock;
    uint256 carbonTonPotential;
    uint256 gardenSquareMeters;
    string biome;
    string remoteReportPDF;
    string speciesRegistryJSON;
    string[] polygonCoordinates;
    string[] treeGenusesObserved;
    string[] weedGenusesObserved;
    string[] issues;
    string[] tags;
}

struct WorkSchema {
    uint8 version;
    uint256 actionUID;
    string title;
    string feedback;
    string metadata;
    string[] media;
}

struct WorkApprovalSchema {
    uint8 version;
    uint256 actionUID;
    bytes32 workUID;
    bool approved;
    string feedback;
}
