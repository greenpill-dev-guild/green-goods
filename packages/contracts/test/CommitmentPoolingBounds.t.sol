// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "./helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingBoundsTest
/// @notice PRD-721 production-path gas and canonical-event payload matrix at 8/16/24/32/40.
/// @dev Every measurement deploys a fresh real proxy/module dependency graph. Gas is the largest
///      transaction in the named production path, never a synthetic storage-loop substitute.
contract CommitmentPoolingBoundsTest is CommitmentPoolingFixture {
    uint256 private constant TRANSACTION_GAS_CEILING = 10_000_000;
    uint256 private constant EVENT_DATA_CEILING = 16_384;
    string private constant RESULTS_PATH = ".generated/commitment-pooling-bounds.csv";

    function testBoundedConstantMatrix() public {
        vm.writeFile(RESULTS_PATH, "bound,size,gas,event_payload_bytes\n");
        _measureAll(8);
        _measureAll(16);
        _measureAll(24);
        _measureAll(32);
        _measureAll(40);
    }

    function _measureAll(uint256 size) private {
        _measureRequirements(size);
        _measureLinkedWorks(size);
        _measureContributors(size);
        _measureEvidence(size);
        _measureConfirmers(size);
    }

    function _measureRequirements(uint256 size) private {
        _setUpProductionFixture();
        _registerActions(size);

        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256(abi.encode("requirements", size)));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](size);
        for (uint256 i = 0; i < size; i++) {
            params.requirements[i] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: i, requiredCount: 1 });
        }

        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.createCommitment(params);
        uint256 gasUsed = gasBefore - gasleft();
        uint256 commitmentId = module.nextCommitmentId() - 1;

        vm.prank(CREATOR);
        uint256 replayGasBefore = gasleft();
        module.createCommitment(params);
        gasUsed = _max(gasUsed, replayGasBefore - gasleft());

        _acceptOffer(commitmentId);
        for (uint256 i = 0; i < size; i++) {
            bytes32 workUID = keccak256(abi.encode("requirement-work", size, i));
            _setWorkAttestation(workUID, CREATOR, i);
            vm.prank(CREATOR);
            module.linkWork(commitmentId, workUID, uint16(i), keccak256(abi.encode("requirement-link", size, i)));
        }
        for (uint256 i = 0; i < size; i++) {
            bytes32 workUID = keccak256(abi.encode("requirement-work", size, i));
            bytes32 approvalUID = keccak256(abi.encode("requirement-approval", size, i));
            decisionResolver.setLatestDecisionSequence(workUID, 1);
            decisionResolver.setDecisionSequence(approvalUID, 1);
            _setApprovalAttestation(approvalUID, workUID, i, true);
            vm.prank(address(decisionResolver));
            uint256 approvalGasBefore = gasleft();
            module.onWorkDecision(workUID, approvalUID, 1, POOL_GARDEN, true);
            gasUsed = _max(gasUsed, approvalGasBefore - gasleft());
        }
        _record("MAX_REQUIREMENTS", size, gasUsed, _commitmentCreatedDataBytes(params));
    }

    function _measureLinkedWorks(uint256 size) private {
        _setUpProductionFixture();
        uint256 commitmentId = _createOffer(keccak256(abi.encode("linked-works", size)));
        _acceptOffer(commitmentId);

        uint256 gasUsed;
        for (uint256 i = 0; i < size; i++) {
            bytes32 workUID = keccak256(abi.encode("work", size, i));
            _setWorkAttestation(workUID, CREATOR, 0);
            vm.prank(CREATOR);
            uint256 gasBefore = gasleft();
            module.linkWork(commitmentId, workUID, 0, keccak256(abi.encode("link", size, i)));
            gasUsed = _max(gasUsed, gasBefore - gasleft());
        }

        uint256 freezeGasBefore = gasleft();
        module.markReadyForConfirmation(commitmentId, "bounded freshness scan");
        gasUsed = _max(gasUsed, freezeGasBefore - gasleft());
        _record("MAX_LINKED_WORKS_PER_COMMITMENT", size, gasUsed, _readyEventDataBytes("bounded freshness scan"));
    }

    function _measureContributors(uint256 size) private {
        _setUpProductionFixture();
        uint256 commitmentId = _createOffer(keccak256(abi.encode("contributors", size)));
        _acceptOffer(commitmentId);

        address[] memory credited = new address[](size);
        credited[0] = CREATOR;
        uint256 gasUsed;
        for (uint256 i = 1; i < size; i++) {
            address contributor = address(uint160(0x1000 + i));
            credited[i] = contributor;
            _setMember(contributor);
            vm.prank(CREATOR);
            uint256 gasBefore = gasleft();
            module.addContributor(commitmentId, contributor);
            gasUsed = _max(gasUsed, gasBefore - gasleft());
        }

        vm.prank(CREATOR);
        uint256 evidenceGasBefore = gasleft();
        module.attachEvidence(commitmentId, "bafy-contributor-finalization", credited);
        gasUsed = _max(gasUsed, evidenceGasBefore - gasleft());

        uint256 readyGasBefore = gasleft();
        module.markReadyForConfirmation(commitmentId, "bounded contributor finalization");
        gasUsed = _max(gasUsed, readyGasBefore - gasleft());

        vm.prank(CLAIMANT);
        uint256 confirmGasBefore = gasleft();
        module.confirmFulfillment(commitmentId);
        gasUsed = _max(gasUsed, confirmGasBefore - gasleft());
        _record(
            "MAX_CONTRIBUTORS_PER_COMMITMENT", size, gasUsed, abi.encode("bafy-contributor-finalization", credited).length
        );
    }

    function _measureEvidence(uint256 size) private {
        _setUpProductionFixture();
        uint256 commitmentId = _createOffer(keccak256(abi.encode("evidence", size)));
        _acceptOffer(commitmentId);

        address[] memory credited = new address[](size);
        credited[0] = CREATOR;
        for (uint256 i = 1; i < size; i++) {
            address contributor = address(uint160(0x2000 + i));
            credited[i] = contributor;
            _setMember(contributor);
            vm.prank(CREATOR);
            module.addContributor(commitmentId, contributor);
        }

        string memory cid = "bafybeihcommitmentpoolingworstcaseevidencepayload";
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.attachEvidence(commitmentId, cid, credited);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT", size, gasUsed, abi.encode(cid, credited).length);
    }

    function _measureConfirmers(uint256 size) private {
        _setUpProductionFixture();
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256(abi.encode("confirmers", size)));
        params.confirmers = new address[](size);
        params.confirmationThreshold = uint32(size);
        for (uint256 i = 0; i < size; i++) {
            params.confirmers[i] = address(uint160(0x3000 + i));
        }

        vm.prank(CREATOR);
        module.createCommitment(params);
        uint256 commitmentId = module.nextCommitmentId() - 1;

        vm.prank(CLAIMANT);
        uint256 gasBefore = gasleft();
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        uint256 gasUsed = gasBefore - gasleft();

        address rosterCandidate = address(uint160(0x4000 + size));
        _setMember(rosterCandidate);
        vm.prank(CREATOR);
        uint256 rosterGasBefore = gasleft();
        module.addContributor(commitmentId, rosterCandidate);
        gasUsed = _max(gasUsed, rosterGasBefore - gasleft());
        _record("MAX_CONFIRMERS", size, gasUsed, abi.encode(params.confirmers, params.confirmationThreshold, false).length);
    }

    function _record(string memory bound, uint256 size, uint256 gasUsed, uint256 payloadBytes) private {
        string memory prefix = string.concat(bound, "/", vm.toString(size));
        emit log_named_uint(string.concat(prefix, "/gas"), gasUsed);
        emit log_named_uint(string.concat(prefix, "/payload-bytes"), payloadBytes);
        vm.writeLine(
            RESULTS_PATH,
            string.concat(bound, ",", vm.toString(size), ",", vm.toString(gasUsed), ",", vm.toString(payloadBytes))
        );
        assertGt(gasUsed, 0, string.concat(prefix, "/empty-production-path"));
        assertLt(gasUsed, TRANSACTION_GAS_CEILING, string.concat(prefix, "/transaction-unsafe"));
        assertLe(payloadBytes, EVENT_DATA_CEILING, string.concat(prefix, "/event-payload-unsafe"));
    }

    function _commitmentCreatedDataBytes(ICommitmentPoolingModule.CreateCommitmentParams memory params)
        private
        pure
        returns (uint256)
    {
        uint8[] memory domains = new uint8[](params.requirements.length < 4 ? params.requirements.length : 4);
        uint256[] memory actionUIDs = new uint256[](params.requirements.length);
        uint8[] memory requirementDomains = new uint8[](params.requirements.length);
        uint32[] memory requiredCounts = new uint32[](params.requirements.length);
        return abi.encode(
            params.commitmentSeriesId,
            params.creationRequestKey,
            bytes32(0),
            CREATOR,
            CREATOR,
            params.direction,
            params.commitmentType,
            params.claimType,
            params.claimMode,
            params.contributorPolicy,
            domains,
            actionUIDs,
            requirementDomains,
            requiredCounts,
            params.unitLabel,
            params.targetUnits,
            params.requiresAssessment,
            params.dueDate,
            params.metadataCID,
            params.needUID,
            params.counterCommitmentId,
            params.declaredUnitValue,
            params.declaredValueBasis
        ).length;
    }

    function _readyEventDataBytes(string memory reason) private pure returns (uint256) {
        return abi.encode(false, reason).length;
    }

    function _max(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a : b;
    }
}
