// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

import { IGap } from "../interfaces/IKarma.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { JsonBuilder } from "./JsonBuilder.sol";
import { KarmaLib } from "./Karma.sol";

/// @notice Storage-neutral Project Update and milestone attestation behavior.
library KarmaUpdatesLib {
    event GAPImpactCreated(bytes32 indexed projectUID, bytes32 indexed impactUID, bytes32 workUID);
    event GAPMilestoneCreated(bytes32 indexed projectUID, bytes32 indexed milestoneUID, string title);
    event GAPOperationFailed(address indexed garden, string operation, string reason);
    event KarmaSyncRecorded(
        address indexed garden,
        bytes32 indexed projectUID,
        address indexed account,
        IKarmaGAPModule.KarmaSyncOperation operation,
        IKarmaGAPModule.KarmaSyncOutcome outcome,
        bytes32 sourceUID,
        bytes32 resultUID,
        string reason
    );

    function createProjectUpdate(
        mapping(address garden => bytes32 projectUID) storage gardenProjects,
        mapping(bytes32 workUID => bytes32 updateUID) storage projectUpdateUIDs,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        string calldata workTitle,
        string calldata updateText,
        string calldata proofReference,
        bytes32 workUID,
        string calldata metadataReference
    )
        internal
        returns (bytes32 updateUID)
    {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) {
            emit GAPOperationFailed(garden, "createImpact", "No project");
            _record(garden, projectUID, workUID, bytes32(0), IKarmaGAPModule.KarmaSyncOutcome.Failed, "project_not_found");
            return bytes32(0);
        }
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "createImpact", "Chain not supported");
            _record(garden, projectUID, workUID, bytes32(0), IKarmaGAPModule.KarmaSyncOutcome.Failed, "chain_not_supported");
            return bytes32(0);
        }

        updateUID = projectUpdateUIDs[workUID];
        if (updateUID != bytes32(0)) {
            _record(garden, projectUID, workUID, updateUID, IKarmaGAPModule.KarmaSyncOutcome.Noop, "already_synced");
            return updateUID;
        }

        bytes32 lockKey = keccak256(abi.encodePacked("karma-update", workUID));
        if (syncInFlight[lockKey]) {
            emit GAPOperationFailed(garden, "createImpact", "Project Update sync already in flight");
            _record(garden, projectUID, workUID, bytes32(0), IKarmaGAPModule.KarmaSyncOutcome.Failed, "sync_in_flight");
            return bytes32(0);
        }

        string memory updateJson = JsonBuilder.buildProjectUpdate(
            workTitle, updateText, proofReference, workUID, garden, block.timestamp, metadataReference, block.chainid
        );
        AttestationRequestData memory requestData = AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: false,
            refUID: projectUID,
            data: abi.encode(updateJson),
            value: 0
        });
        AttestationRequest memory request =
            AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: requestData });

        syncInFlight[lockKey] = true;
        try IGap(KarmaLib.getGapContract()).attest(request) returns (bytes32 uid) {
            syncInFlight[lockKey] = false;
            updateUID = uid;
            projectUpdateUIDs[workUID] = uid;
            emit GAPImpactCreated(projectUID, uid, workUID);
            _record(garden, projectUID, workUID, uid, IKarmaGAPModule.KarmaSyncOutcome.Succeeded, "");
        } catch {
            syncInFlight[lockKey] = false;
            emit GAPOperationFailed(garden, "createImpact", "Attestation failed");
            _record(garden, projectUID, workUID, bytes32(0), IKarmaGAPModule.KarmaSyncOutcome.Failed, "attestation_failed");
        }
    }

    function createMilestone(
        mapping(address garden => bytes32 projectUID) storage gardenProjects,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        uint256 startDate,
        uint256 endDate,
        uint8 domain,
        string calldata location,
        string calldata assessmentConfigCID
    )
        internal
        returns (bytes32 milestoneUID)
    {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) {
            emit GAPOperationFailed(garden, "createMilestone", "No project");
            return bytes32(0);
        }
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "createMilestone", "Chain not supported");
            return bytes32(0);
        }

        bytes32 lockKey =
            keccak256(abi.encode("karma-milestone", garden, milestoneTitle, startDate, endDate, assessmentConfigCID));
        if (syncInFlight[lockKey]) {
            emit GAPOperationFailed(garden, "createMilestone", "Milestone sync already in flight");
            return bytes32(0);
        }

        string memory milestoneJson = JsonBuilder.buildMilestone(
            milestoneTitle, milestoneDescription, startDate, endDate, domain, location, assessmentConfigCID
        );
        AttestationRequestData memory requestData = AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: false,
            refUID: projectUID,
            data: abi.encode(milestoneJson),
            value: 0
        });
        AttestationRequest memory request =
            AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: requestData });

        syncInFlight[lockKey] = true;
        try IGap(KarmaLib.getGapContract()).attest(request) returns (bytes32 uid) {
            syncInFlight[lockKey] = false;
            milestoneUID = uid;
            emit GAPMilestoneCreated(projectUID, uid, milestoneTitle);
        } catch {
            syncInFlight[lockKey] = false;
            emit GAPOperationFailed(garden, "createMilestone", "Attestation failed");
        }
    }

    function _record(
        address garden,
        bytes32 projectUID,
        bytes32 workUID,
        bytes32 resultUID,
        IKarmaGAPModule.KarmaSyncOutcome outcome,
        string memory reason
    )
        private
    {
        emit KarmaSyncRecorded(
            garden,
            projectUID,
            address(0),
            IKarmaGAPModule.KarmaSyncOperation.ProjectUpdate,
            outcome,
            workUID,
            resultUID,
            reason
        );
    }
}
