// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

import { IGap } from "../interfaces/IKarma.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { KarmaLib } from "./Karma.sol";

/// @notice Storage-neutral access and membership reconciliation for Karma GAP projects.
library KarmaAccessLib {
    event GAPProjectAdminAdded(bytes32 indexed projectUID, address indexed admin);
    event GAPProjectAdminRemoved(bytes32 indexed projectUID, address indexed admin);
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
        mapping(address garden => mapping(address account => bytes32 memberUID)) storage memberUIDs,
        mapping(address garden => mapping(address account => bytes32 projectUID)) storage memberProjectUIDs,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        address account
    )
        internal
        returns (bool roleActive, bool changed)
    {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "No project");
            _recordPrerequisiteFailure(garden, projectUID, account, "project_not_found");
            return (false, false);
        }
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Chain not supported");
            _recordPrerequisiteFailure(garden, projectUID, account, "chain_not_supported");
            return (false, false);
        }
        if (account == address(0)) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Invalid account");
            _recordPrerequisiteFailure(garden, projectUID, account, "invalid_account");
            return (false, false);
        }

        bool accessSucceeded;
        (roleActive, changed, accessSucceeded) = _reconcileAccess(syncInFlight, garden, projectUID, account);
        if (!accessSucceeded) {
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Membership,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "role_state_unavailable"
            );
            return (roleActive, changed);
        }

        bool membershipChanged =
            _reconcileMembership(memberUIDs, memberProjectUIDs, syncInFlight, garden, projectUID, account, roleActive);
        changed = changed || membershipChanged;
    }

    function recordPrerequisiteFailure(address garden, bytes32 projectUID, address account, string memory reason) internal {
        _recordPrerequisiteFailure(garden, projectUID, account, reason);
    }

    function _reconcileAccess(
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        bytes32 projectUID,
        address account
    )
        private
        returns (bool roleActive, bool changed, bool succeeded)
    {
        if (garden.code.length == 0) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Project admin sync failed");
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Access,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "admin_sync_failed"
            );
            return (false, false, false);
        }

        bytes32 lockKey = keccak256(abi.encodePacked("karma-access", garden, account));
        if (syncInFlight[lockKey]) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Access sync already in flight");
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Access,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "sync_in_flight"
            );
            return (false, false, false);
        }

        syncInFlight[lockKey] = true;
        try IGardenAccount(garden).syncKarmaProjectAccess(account) returns (bool active, bool accessChanged) {
            syncInFlight[lockKey] = false;
            roleActive = active;
            changed = accessChanged;
            succeeded = true;
            if (accessChanged) {
                if (active) emit GAPProjectAdminAdded(projectUID, account);
                else emit GAPProjectAdminRemoved(projectUID, account);
            }
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Access,
                accessChanged ? IKarmaGAPModule.KarmaSyncOutcome.Succeeded : IKarmaGAPModule.KarmaSyncOutcome.Noop,
                bytes32(0),
                bytes32(0),
                accessChanged ? "" : (active ? "already_current" : "already_absent")
            );
        } catch {
            syncInFlight[lockKey] = false;
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Project admin sync failed");
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Access,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "admin_sync_failed"
            );
        }
    }

    function _reconcileMembership(
        mapping(address garden => mapping(address account => bytes32 memberUID)) storage memberUIDs,
        mapping(address garden => mapping(address account => bytes32 projectUID)) storage memberProjectUIDs,
        mapping(bytes32 key => bool active) storage syncInFlight,
        address garden,
        bytes32 projectUID,
        address account,
        bool roleActive
    )
        private
        returns (bool changed)
    {
        bytes32 memberUID = memberUIDs[garden][account];
        bool belongsToCurrentProject = memberProjectUIDs[garden][account] == projectUID;
        if (!roleActive) {
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Membership,
                IKarmaGAPModule.KarmaSyncOutcome.Noop,
                bytes32(0),
                belongsToCurrentProject ? memberUID : bytes32(0),
                belongsToCurrentProject ? "history_retained" : "role_inactive"
            );
            return false;
        }
        if (memberUID != bytes32(0) && belongsToCurrentProject) {
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Membership,
                IKarmaGAPModule.KarmaSyncOutcome.Noop,
                bytes32(0),
                memberUID,
                "already_exists"
            );
            return false;
        }

        bytes32 lockKey = keccak256(abi.encodePacked("karma-membership", projectUID, account));
        if (syncInFlight[lockKey]) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Membership sync already in flight");
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Membership,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "sync_in_flight"
            );
            return false;
        }

        AttestationRequestData memory memberData = AttestationRequestData({
            recipient: account, expirationTime: 0, revocable: true, refUID: projectUID, data: abi.encode(true), value: 0
        });
        AttestationRequest memory memberRequest =
            AttestationRequest({ schema: KarmaLib.getMemberOfSchemaUID(), data: memberData });

        syncInFlight[lockKey] = true;
        try IGap(KarmaLib.getGapContract()).attest(memberRequest) returns (bytes32 uid) {
            syncInFlight[lockKey] = false;
            memberUIDs[garden][account] = uid;
            memberProjectUIDs[garden][account] = projectUID;
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Membership,
                IKarmaGAPModule.KarmaSyncOutcome.Succeeded,
                bytes32(0),
                uid,
                ""
            );
            return true;
        } catch {
            syncInFlight[lockKey] = false;
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "MemberOf attestation failed");
            _record(
                garden,
                projectUID,
                account,
                IKarmaGAPModule.KarmaSyncOperation.Membership,
                IKarmaGAPModule.KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "attestation_failed"
            );
            return false;
        }
    }

    function _recordPrerequisiteFailure(address garden, bytes32 projectUID, address account, string memory reason) private {
        _record(
            garden,
            projectUID,
            account,
            IKarmaGAPModule.KarmaSyncOperation.Membership,
            IKarmaGAPModule.KarmaSyncOutcome.Failed,
            bytes32(0),
            bytes32(0),
            reason
        );
        _record(
            garden,
            projectUID,
            account,
            IKarmaGAPModule.KarmaSyncOperation.Access,
            IKarmaGAPModule.KarmaSyncOutcome.Failed,
            bytes32(0),
            bytes32(0),
            reason
        );
    }

    function _record(
        address garden,
        bytes32 projectUID,
        address account,
        IKarmaGAPModule.KarmaSyncOperation operation,
        IKarmaGAPModule.KarmaSyncOutcome outcome,
        bytes32 sourceUID,
        bytes32 resultUID,
        string memory reason
    )
        private
    {
        emit KarmaSyncRecorded(garden, projectUID, account, operation, outcome, sourceUID, resultUID, reason);
    }
}
