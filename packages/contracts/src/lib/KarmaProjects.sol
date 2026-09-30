// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

import { IGap } from "../interfaces/IKarma.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { JsonBuilder } from "./JsonBuilder.sol";
import { KarmaLib } from "./Karma.sol";

/// @notice Storage-neutral project and canonical ProjectDetails reconciliation.
library KarmaProjectsLib {
    event GAPProjectCreated(bytes32 indexed projectUID, address indexed garden, string name);
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

    function reconcile(
        mapping(address garden => bytes32 projectUID) storage gardenProjects,
        mapping(address garden => bytes32 detailsHash) storage detailsHashes,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        string memory name,
        string memory slug,
        string memory description,
        string memory location,
        string memory bannerImage
    )
        internal
        returns (bytes32 projectUID)
    {
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "createProject", "Chain not supported");
            _record(
                garden,
                bytes32(0),
                IKarmaGAPModule.KarmaSyncOperation.Project,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                "chain_not_supported"
            );
            return bytes32(0);
        }

        projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) {
            projectUID = _createProject(gardenProjects, syncInFlight, garden, name);
            if (projectUID == bytes32(0)) return bytes32(0);
        } else {
            _record(
                garden,
                projectUID,
                IKarmaGAPModule.KarmaSyncOperation.Project,
                IKarmaGAPModule.KarmaSyncOutcome.Noop,
                projectUID,
                "already_exists"
            );
        }

        _reconcileDetails(detailsHashes, syncInFlight, garden, projectUID, name, slug, description, location, bannerImage);
    }

    function _createProject(
        mapping(address garden => bytes32 projectUID) storage gardenProjects,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        string memory name
    )
        private
        returns (bytes32 projectUID)
    {
        bytes32 lockKey = keccak256(abi.encodePacked("karma-project", garden));
        if (syncInFlight[lockKey]) {
            emit GAPOperationFailed(garden, "createProject", "Project sync already in flight");
            _record(
                garden,
                bytes32(0),
                IKarmaGAPModule.KarmaSyncOperation.Project,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                "sync_in_flight"
            );
            return bytes32(0);
        }

        AttestationRequestData memory requestData = AttestationRequestData({
            recipient: garden, expirationTime: 0, revocable: true, refUID: bytes32(0), data: abi.encode(true), value: 0
        });
        AttestationRequest memory request =
            AttestationRequest({ schema: KarmaLib.getProjectSchemaUID(), data: requestData });

        syncInFlight[lockKey] = true;
        try IGap(KarmaLib.getGapContract()).attest(request) returns (bytes32 uid) {
            syncInFlight[lockKey] = false;
            projectUID = uid;
            gardenProjects[garden] = uid;
            emit GAPProjectCreated(uid, garden, name);
            _record(
                garden, uid, IKarmaGAPModule.KarmaSyncOperation.Project, IKarmaGAPModule.KarmaSyncOutcome.Succeeded, uid, ""
            );
        } catch {
            syncInFlight[lockKey] = false;
            emit GAPOperationFailed(garden, "createProject", "Project attestation failed");
            _record(
                garden,
                bytes32(0),
                IKarmaGAPModule.KarmaSyncOperation.Project,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                "attestation_failed"
            );
        }
    }

    function _reconcileDetails(
        mapping(address garden => bytes32 detailsHash) storage detailsHashes,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        bytes32 projectUID,
        string memory name,
        string memory slug,
        string memory description,
        string memory location,
        string memory bannerImage
    )
        private
    {
        string memory detailsJson = JsonBuilder.buildProjectDetails(name, slug, description, location, bannerImage);
        bytes32 detailsHash = keccak256(bytes(detailsJson));
        if (detailsHashes[garden] == detailsHash) {
            _record(
                garden,
                projectUID,
                IKarmaGAPModule.KarmaSyncOperation.Details,
                IKarmaGAPModule.KarmaSyncOutcome.Noop,
                projectUID,
                "already_current"
            );
            return;
        }

        bytes32 lockKey = keccak256(abi.encodePacked("karma-details", garden));
        if (syncInFlight[lockKey]) {
            emit GAPOperationFailed(garden, "createProject", "Details sync already in flight");
            _record(
                garden,
                projectUID,
                IKarmaGAPModule.KarmaSyncOperation.Details,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                "sync_in_flight"
            );
            return;
        }

        AttestationRequestData memory requestData = AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: true,
            refUID: projectUID,
            data: abi.encode(detailsJson),
            value: 0
        });
        AttestationRequest memory request =
            AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: requestData });

        syncInFlight[lockKey] = true;
        try IGap(KarmaLib.getGapContract()).attest(request) returns (bytes32 uid) {
            syncInFlight[lockKey] = false;
            detailsHashes[garden] = detailsHash;
            _record(
                garden,
                projectUID,
                IKarmaGAPModule.KarmaSyncOperation.Details,
                IKarmaGAPModule.KarmaSyncOutcome.Succeeded,
                uid,
                ""
            );
        } catch {
            syncInFlight[lockKey] = false;
            emit GAPOperationFailed(garden, "createProject", "Details attestation failed");
            _record(
                garden,
                projectUID,
                IKarmaGAPModule.KarmaSyncOperation.Details,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                "attestation_failed"
            );
        }
    }

    function _record(
        address garden,
        bytes32 projectUID,
        IKarmaGAPModule.KarmaSyncOperation operation,
        IKarmaGAPModule.KarmaSyncOutcome outcome,
        bytes32 resultUID,
        string memory reason
    )
        private
    {
        emit KarmaSyncRecorded(garden, projectUID, address(0), operation, outcome, bytes32(0), resultUID, reason);
    }
}
