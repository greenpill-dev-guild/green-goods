// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";
import { Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../../src/interfaces/ICommitmentPoolingModule.sol";
import { MockEAS } from "../../../src/mocks/EAS.sol";
import { MockHatsModule } from "../../helpers/MockHatsModule.sol";

interface IMockWorkDecisionResolver {
    function setLatestDecisionSequence(bytes32 workUID, uint64 sequence) external;
    function setDecisionSequence(bytes32 decisionUID, uint64 sequence) external;
}

/// @title CommitmentPoolingAccountingHandler
/// @notice Drives the commitment lifecycle in arbitrary order for the accounting invariants.
/// @dev Every call is wrapped in try/catch: the fuzzer's job is to find reachable orderings, and a
///      rejected transition is a correct outcome, not a failure. What matters is that the calls
///      which DO land leave the accounting consistent, which is what the invariants assert.
///
///      Deliberately neither a fixture subclass nor a `Test`. The invariant target must expose
///      only lifecycle entry points: a fixture would let the fuzzer rebuild the world mid-run, and
///      inheriting `Test` publishes `failed()` as a target selector, spending campaign calls on
///      something that is not part of the lifecycle. Hence the raw cheatcode handle and the local
///      `_bound` below.
contract CommitmentPoolingAccountingHandler {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant POOL_GARDEN = address(0xCAFE);
    bytes32 internal constant WORK_SCHEMA_UID = bytes32(uint256(101));
    bytes32 internal constant WORK_APPROVAL_SCHEMA_UID = bytes32(uint256(102));
    uint256 internal constant ACTOR_COUNT = 4;

    ICommitmentPoolingModule private immutable module;
    MockEAS private immutable eas;
    IMockWorkDecisionResolver private immutable decisionResolver;
    uint256 private immutable poolId;

    address[] private actors;

    /// @dev Every commitment the module actually created, so the invariants enumerate exactly the
    ///      records that exist rather than guessing at an id range.
    uint256[] private commitments;

    /// @dev Reachability counters. An invariant suite whose handler calls all reverted would pass
    ///      every property vacuously; `invariant_handlerReachedMeaningfulStates` reads these.
    uint256 public acceptedCount;
    uint256 public approvedWorkCount;
    uint256 public fulfilledCount;
    uint256 public disputedCount;

    uint256 private nonce;

    constructor(
        address module_,
        address, /* registry — the invariant contract reads it directly */
        address hats_,
        address eas_,
        address decisionResolver_,
        uint256 poolId_
    ) {
        module = ICommitmentPoolingModule(module_);
        eas = MockEAS(eas_);
        decisionResolver = IMockWorkDecisionResolver(decisionResolver_);
        poolId = poolId_;

        for (uint256 i = 0; i < ACTOR_COUNT; i++) {
            address actor = address(uint160(0x5000 + i));
            actors.push(actor);
            MockHatsModule(hats_).setGardener(POOL_GARDEN, actor, true);
        }
    }

    function allActors() external view returns (address[] memory) {
        return actors;
    }

    function commitmentCount() external view returns (uint256) {
        return commitments.length;
    }

    function commitmentAt(uint256 index) external view returns (uint256) {
        return commitments[index];
    }

    // ───────────────────────────── Lifecycle actions ─────────────────────────────

    /// @dev An Offer commits its units at creation; a Request commits them at acceptance. Both
    ///      directions are reachable so the release path covers each holder.
    function createCommitment(uint8 creatorSeed, uint8 directionSeed, uint8 unitSeed, uint8 dueSeed) external {
        address creator = _actor(creatorSeed);
        ICommitmentPoolingModule.CreateCommitmentParams memory params;
        params.poolId = poolId;
        params.creationRequestKey = keccak256(abi.encode("invariant-commitment", nonce++));
        params.direction = directionSeed % 2 == 0
            ? ICommitmentPoolingModule.CommitmentDirection.Offer
            : ICommitmentPoolingModule.CommitmentDirection.Request;
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.claimType = ICommitmentPoolingModule.ClaimType.Individual;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.Open;
        params.contributorPolicy = ICommitmentPoolingModule.ContributorPolicy.LeadManaged;
        params.unitLabel = "hours";
        params.targetUnits = uint256(_bound(unitSeed, 1, 8));
        params.metadataCID = "bafy-invariant-commitment";
        // A due date in the near future keeps `expireCommitment` reachable via warping.
        params.dueDate = uint64(block.timestamp + _bound(dueSeed, 1, 30) * 1 days);
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: 2 });

        vm.prank(creator);
        try module.createCommitment(params) returns (uint256 commitmentId) {
            commitments.push(commitmentId);
        } catch { }
    }

    function claimCommitment(uint256 idSeed, uint8 claimantSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(claimantSeed));
        try module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN) {
            acceptedCount++;
        } catch { }
    }

    function addContributor(uint256 idSeed, uint8 leadSeed, uint8 contributorSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(leadSeed));
        try module.addContributor(commitmentId, _actor(contributorSeed)) { } catch { }
    }

    function removeContributor(uint256 idSeed, uint8 leadSeed, uint8 contributorSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(leadSeed));
        try module.removeContributor(commitmentId, _actor(contributorSeed)) { } catch { }
    }

    function attachEvidence(uint256 idSeed, uint8 leadSeed, uint8 creditedSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        address[] memory credited = new address[](1);
        credited[0] = _actor(creditedSeed);

        vm.prank(_actor(leadSeed));
        try module.attachEvidence(commitmentId, "bafy-invariant-evidence", credited) { } catch { }
    }

    /// @dev The full approve path: a real Work attestation, a link, then a decision through the
    ///      resolver bridge — the only way credits are created in production.
    function linkAndDecideWork(uint256 idSeed, uint8 leadSeed, uint8 workerSeed, bool approved) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        uint256 slot = nonce++;
        bytes32 workUID = keccak256(abi.encode(commitmentId, "work", slot));
        bytes32 approvalUID = keccak256(abi.encode(commitmentId, "approval", slot));
        _setWorkAttestation(workUID, _actor(workerSeed));

        vm.prank(_actor(leadSeed));
        try module.linkWork(commitmentId, workUID, 0, keccak256(abi.encode(commitmentId, "link", slot))) { }
        catch {
            return;
        }

        _setApprovalAttestation(approvalUID, workUID, approved);
        decisionResolver.setDecisionSequence(approvalUID, uint64(slot + 1));
        decisionResolver.setLatestDecisionSequence(workUID, uint64(slot + 1));

        vm.prank(address(decisionResolver));
        try module.onWorkDecision(workUID, approvalUID, uint64(slot + 1), POOL_GARDEN, approved) {
            if (approved) approvedWorkCount++;
        } catch { }
    }

    function markReady(uint256 idSeed, uint8 callerSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(callerSeed));
        try module.markReadyForConfirmation(commitmentId, "invariant ready") { } catch { }
    }

    function confirmFulfillment(uint256 idSeed, uint8 callerSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(callerSeed));
        try module.confirmFulfillment(commitmentId) {
            fulfilledCount++;
        } catch { }
    }

    function cancelCommitment(uint256 idSeed, uint8 callerSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(callerSeed));
        try module.cancelCommitment(commitmentId, "bafy-invariant-cancel") { } catch { }
    }

    /// @dev Expiry is time-driven, so the handler must be able to move time forward. Warping only
    ///      ever moves forward, so no other transition is invalidated by it.
    function expireCommitment(uint256 idSeed, uint8 callerSeed, uint8 daysSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.warp(block.timestamp + _bound(daysSeed, 1, 40) * 1 days);
        vm.prank(_actor(callerSeed));
        try module.expireCommitment(commitmentId) { } catch { }
    }

    /// @dev Reachable from Accepted, ReadyForConfirmation, and Expired. The Expired case is the
    ///      one that re-increments the live counters, so it must be reachable here for
    ///      `invariant_liveCountsMatchNonTerminalCommitments` to be about anything.
    function raiseDispute(uint256 idSeed, uint8 callerSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        vm.prank(_actor(callerSeed));
        try module.raiseDispute(commitmentId, "bafy-invariant-dispute") {
            disputedCount++;
        } catch { }
    }

    function resolveDispute(uint256 idSeed, uint8 resolutionSeed) external {
        (bool ok, uint256 commitmentId) = _pickCommitment(idSeed);
        if (!ok) return;

        ICommitmentPoolingModule.DisputeResolution resolution =
            ICommitmentPoolingModule.DisputeResolution(uint8(_bound(resolutionSeed, 0, 3)));

        // Resolution is a steward act; the invariant test owns the module.
        try module.resolveDispute(commitmentId, resolution, "bafy-invariant-resolution") { } catch { }
    }

    // ───────────────────────────── Internals ─────────────────────────────

    function _actor(uint8 seed) private view returns (address) {
        return actors[seed % ACTOR_COUNT];
    }

    /// @dev Local stand-in for `StdUtils.bound`, which would arrive with `Test`. Inclusive.
    function _bound(uint256 value, uint256 min, uint256 max) private pure returns (uint256) {
        return min + (value % (max - min + 1));
    }

    function _pickCommitment(uint256 seed) private view returns (bool ok, uint256 commitmentId) {
        if (commitments.length == 0) return (false, 0);
        return (true, commitments[seed % commitments.length]);
    }

    function _setWorkAttestation(bytes32 workUID, address contributor) private {
        string[] memory media = new string[](0);
        eas.setAttestationByUID(
            workUID,
            Attestation({
                uid: workUID,
                schema: WORK_SCHEMA_UID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: POOL_GARDEN,
                attester: contributor,
                revocable: false,
                data: abi.encode(uint256(0), "Work", "", "bafy-work", media)
            })
        );
    }

    function _setApprovalAttestation(bytes32 approvalUID, bytes32 workUID, bool approved) private {
        eas.setAttestationByUID(
            approvalUID,
            Attestation({
                uid: approvalUID,
                schema: WORK_APPROVAL_SCHEMA_UID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: workUID,
                recipient: POOL_GARDEN,
                attester: address(0xDEC1DE),
                revocable: false,
                data: abi.encode(uint256(0), workUID, approved, "approved", uint8(2), uint8(1), "")
            })
        );
    }
}
