// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

/// @notice Isolated storage/event model for selecting the five PRD-721 bounded vectors.
/// @dev The target deliberately exercises the complete named loop for each vector and returns
///      the ABI-encoded event data length. Deploying a fresh target per measurement prevents
///      warm-state or prior-size residue from lowering a later result.
contract CommitmentPoolingBoundsTarget {
    struct Requirement {
        uint256 actionUID;
        uint8 domain;
        uint32 requiredCount;
        uint32 approvedCount;
    }

    Requirement[] private requirements;
    bytes32[] private linkedWorks;
    address[] private contributors;
    address[] private confirmers;

    mapping(address account => uint64 credits) private contributorCredits;
    mapping(address account => bool credited) private evidenceCredited;
    mapping(address account => bool included) private confirmerIncluded;
    mapping(bytes32 payloadHash => bool seen) private replaySeen;

    event RequirementsBench(uint256[] actionUIDs, uint8[] domains, uint32[] requiredCounts);
    event LinkedWorksBench(bytes32[] workUIDs);
    event ContributorsBench(address[] contributors, uint64[] credits);
    event EvidenceBench(string cid, address[] creditedContributors);
    event ConfirmersBench(address[] confirmers, uint32 threshold, bool protocolFallbackEnabled);

    function benchmarkRequirements(uint256 size) external returns (uint256 payloadBytes, uint256 checksum) {
        uint256[] memory actionUIDs = new uint256[](size);
        uint8[] memory domains = new uint8[](size);
        uint32[] memory requiredCounts = new uint32[](size);

        for (uint256 i = 0; i < size; i++) {
            uint256 actionUID = i + 1;
            uint8 domain = uint8(i % 4);
            uint32 requiredCount = uint32((i % 3) + 1);
            requirements.push(Requirement(actionUID, domain, requiredCount, 0));
            actionUIDs[i] = actionUID;
            domains[i] = domain;
            requiredCounts[i] = requiredCount;
        }

        for (uint256 i = 0; i < size; i++) {
            requirements[i].approvedCount = requirements[i].requiredCount;
        }

        for (uint256 i = 0; i < size; i++) {
            Requirement storage requirement = requirements[i];
            require(requirement.approvedCount >= requirement.requiredCount, "requirement not ready");
            checksum += requirement.actionUID + requirement.approvedCount;
        }

        bytes memory payload = abi.encode(actionUIDs, domains, requiredCounts);
        bytes32 payloadHash = keccak256(payload);
        replaySeen[payloadHash] = true;
        require(replaySeen[payloadHash], "replay read-through failed");
        emit RequirementsBench(actionUIDs, domains, requiredCounts);
        return (payload.length, checksum);
    }

    function benchmarkLinkedWorks(uint256 size) external returns (uint256 payloadBytes, uint256 checksum) {
        bytes32[] memory workUIDs = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            bytes32 workUID = keccak256(abi.encode("work", i));
            linkedWorks.push(workUID);
            workUIDs[i] = workUID;
        }

        for (uint256 i = 0; i < size; i++) {
            checksum ^= uint256(linkedWorks[i]);
        }

        bytes memory payload = abi.encode(workUIDs);
        emit LinkedWorksBench(workUIDs);
        return (payload.length, checksum);
    }

    function benchmarkContributors(uint256 size) external returns (uint256 payloadBytes, uint256 checksum) {
        address[] memory contributorVector = new address[](size);
        uint64[] memory creditVector = new uint64[](size);

        for (uint256 i = 0; i < size; i++) {
            address contributor = address(uint160(i + 1));
            contributors.push(contributor);
            contributorCredits[contributor] = uint64(i + 1);
        }

        for (uint256 i = 0; i < size; i++) {
            address contributor = contributors[i];
            uint64 credits = contributorCredits[contributor];
            contributorVector[i] = contributor;
            creditVector[i] = credits;
            checksum += uint160(contributor) + credits;
        }

        bytes memory payload = abi.encode(contributorVector, creditVector);
        emit ContributorsBench(contributorVector, creditVector);
        return (payload.length, checksum);
    }

    function benchmarkEvidence(uint256 size) external returns (uint256 payloadBytes, uint256 checksum) {
        address[] memory creditedContributors = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            address contributor = address(uint160(i + 1));
            require(!evidenceCredited[contributor], "duplicate evidence credit");
            evidenceCredited[contributor] = true;
            creditedContributors[i] = contributor;
            checksum += uint160(contributor);
        }

        string memory cid = "bafybeihcommitmentpoolingworstcaseevidencepayload";
        bytes memory payload = abi.encode(cid, creditedContributors);
        emit EvidenceBench(cid, creditedContributors);
        return (payload.length, checksum);
    }

    function benchmarkConfirmers(uint256 size) external returns (uint256 payloadBytes, uint256 checksum) {
        address[] memory confirmerVector = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            address confirmer = address(uint160(i + 1));
            require(!confirmerIncluded[confirmer], "duplicate confirmer");
            confirmerIncluded[confirmer] = true;
            confirmers.push(confirmer);
            confirmerVector[i] = confirmer;
        }

        for (uint256 i = 0; i < size; i++) {
            address confirmer = confirmers[i];
            require(confirmerIncluded[confirmer], "confirmer revalidation failed");
            checksum += uint160(confirmer);
        }

        uint32 threshold = uint32(size);
        bytes memory payload = abi.encode(confirmerVector, threshold, true);
        emit ConfirmersBench(confirmerVector, threshold, true);
        return (payload.length, checksum);
    }
}

/// @title CommitmentPoolingBoundsTest
/// @notice Required 8/16/24/32 gas and event-payload matrix for all five bounds.
contract CommitmentPoolingBoundsTest is Test {
    uint256 private constant TRANSACTION_GAS_CEILING = 10_000_000;
    uint256 private constant EVENT_DATA_CEILING = 16_384;
    string private constant RESULTS_PATH = ".generated/commitment-pooling-bounds.csv";

    function testBoundedConstantMatrix() public {
        vm.writeFile(RESULTS_PATH, "bound,size,gas,event_payload_bytes\n");
        _measureAll(8);
        _measureAll(16);
        _measureAll(24);
        _measureAll(32);
    }

    function _measureAll(uint256 size) private {
        _measureRequirements(size);
        _measureLinkedWorks(size);
        _measureContributors(size);
        _measureEvidence(size);
        _measureConfirmers(size);
    }

    function _measureRequirements(uint256 size) private {
        CommitmentPoolingBoundsTarget target = new CommitmentPoolingBoundsTarget();
        uint256 gasBefore = gasleft();
        (uint256 payloadBytes, uint256 checksum) = target.benchmarkRequirements(size);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_REQUIREMENTS", size, gasUsed, payloadBytes, checksum);
    }

    function _measureLinkedWorks(uint256 size) private {
        CommitmentPoolingBoundsTarget target = new CommitmentPoolingBoundsTarget();
        uint256 gasBefore = gasleft();
        (uint256 payloadBytes, uint256 checksum) = target.benchmarkLinkedWorks(size);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_LINKED_WORKS_PER_COMMITMENT", size, gasUsed, payloadBytes, checksum);
    }

    function _measureContributors(uint256 size) private {
        CommitmentPoolingBoundsTarget target = new CommitmentPoolingBoundsTarget();
        uint256 gasBefore = gasleft();
        (uint256 payloadBytes, uint256 checksum) = target.benchmarkContributors(size);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONTRIBUTORS_PER_COMMITMENT", size, gasUsed, payloadBytes, checksum);
    }

    function _measureEvidence(uint256 size) private {
        CommitmentPoolingBoundsTarget target = new CommitmentPoolingBoundsTarget();
        uint256 gasBefore = gasleft();
        (uint256 payloadBytes, uint256 checksum) = target.benchmarkEvidence(size);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT", size, gasUsed, payloadBytes, checksum);
    }

    function _measureConfirmers(uint256 size) private {
        CommitmentPoolingBoundsTarget target = new CommitmentPoolingBoundsTarget();
        uint256 gasBefore = gasleft();
        (uint256 payloadBytes, uint256 checksum) = target.benchmarkConfirmers(size);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONFIRMERS", size, gasUsed, payloadBytes, checksum);
    }

    function _record(string memory bound, uint256 size, uint256 gasUsed, uint256 payloadBytes, uint256 checksum) private {
        string memory prefix = string.concat(bound, "/", vm.toString(size));
        emit log_named_uint(string.concat(prefix, "/gas"), gasUsed);
        emit log_named_uint(string.concat(prefix, "/payload-bytes"), payloadBytes);
        vm.writeLine(
            RESULTS_PATH,
            string.concat(bound, ",", vm.toString(size), ",", vm.toString(gasUsed), ",", vm.toString(payloadBytes))
        );
        assertGt(checksum, 0, string.concat(prefix, "/empty-checksum"));
        assertLt(gasUsed, TRANSACTION_GAS_CEILING, string.concat(prefix, "/transaction-unsafe"));
        assertLe(payloadBytes, EVENT_DATA_CEILING, string.concat(prefix, "/event-payload-unsafe"));
    }
}
