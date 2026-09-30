// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingExchangeLib } from "../../lib/CommitmentPooling/ExchangeLib.sol";
import { CommitmentPoolingRecognitionLib } from "../../lib/CommitmentPooling/RecognitionLib.sol";
import { CommitmentPoolingSeriesLib } from "../../lib/CommitmentPooling/SeriesLib.sol";
import { CommitmentPoolingViewsLib } from "../../lib/CommitmentPooling/ViewsLib.sol";
import { CommitmentPoolingOperations } from "./Operations.sol";

/// @title CommitmentPoolingExtensions
/// @notice The extension surfaces: atomic bilateral exchange, the canonical recognition
///         validator, standing-commitment series, and the read views.
/// @dev Shells only: behavior lives in the deployed Exchange/Recognition/Series/Views libraries.
///      Struct- and array-returning views forward raw return data through `_forwardView` — no
///      decode/re-encode happens here, so the big ABI encoders live in the views library. The
///      mapping slot constants it receives are compiler-derived via `.slot`, never
///      hand-maintained; each forwarding shell ends in an unreachable revert so the compiler
///      emits no phantom default-value return encoder. The series shell owns the series counter
///      increment. ABI, events, and reverts are unchanged.
abstract contract CommitmentPoolingExtensions is CommitmentPoolingOperations {
    // ═════════════════════════════ Exchange
    // ═════════════════════════════

    function acceptExchange(uint256 exchangeCommitmentId) external whenOperational nonReentrant {
        CommitmentPoolingExchangeLib.acceptExchange(
            _env(), pools, cycles, commitments, contributors, commitmentConfirmers, exchangeCommitmentId
        );
    }

    // ═════════════════════════════ Recognition
    // ═════════════════════════════

    function validateRecognitionSnapshot(
        uint256 commitmentId,
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries,
        bytes32 suppliedHash
    )
        external
        view
        returns (bytes32 canonicalHash)
    {
        return CommitmentPoolingRecognitionLib.validateRecognitionSnapshot(
            commitments, cycles, contributors, commitmentId, entries, suppliedHash
        );
    }

    // ═════════════════════════════ Series
    // ═════════════════════════════

    function createCommitmentSeries(
        uint256 poolId,
        bytes32 creationRequestKey,
        string calldata metadataCID
    )
        external
        whenOperational
        returns (uint256 seriesId)
    {
        seriesId = CommitmentPoolingSeriesLib.createCommitmentSeries(
            _env(),
            pools,
            commitmentSeries,
            seriesIdByCreationRequest,
            nextCommitmentSeriesId,
            poolId,
            creationRequestKey,
            metadataCID
        );
        if (seriesId == nextCommitmentSeriesId) nextCommitmentSeriesId = seriesId + 1;
    }

    function updateCommitmentSeriesMetadata(uint256 seriesId, string calldata metadataCID) external whenOperational {
        CommitmentPoolingSeriesLib.updateCommitmentSeriesMetadata(commitmentSeries, seriesId, metadataCID);
    }

    function restCommitmentSeries(uint256 seriesId) external whenOperational {
        CommitmentPoolingSeriesLib.restCommitmentSeries(commitmentSeries, seriesId);
    }

    function resumeCommitmentSeries(uint256 seriesId) external whenOperational {
        CommitmentPoolingSeriesLib.resumeCommitmentSeries(commitmentSeries, seriesId);
    }

    function retireCommitmentSeries(uint256 seriesId) external whenOperational {
        CommitmentPoolingSeriesLib.retireCommitmentSeries(commitmentSeries, seriesId);
    }

    function getCommitmentSeries(uint256 seriesId)
        external
        view
        returns (ICommitmentPoolingModule.CommitmentSeries memory)
    {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := commitmentSeries.slot
        }
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getCommitmentSeries.selector, slot, seriesId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    /// @notice Sender-safe read-through for an interrupted offline series send.
    function getCommitmentSeriesIdByCreationRequest(
        address holder,
        bytes32 creationRequestKey
    )
        external
        view
        returns (uint256 seriesId)
    {
        return seriesIdByCreationRequest[holder][creationRequestKey];
    }

    // ═════════════════════════════ Views
    // ═════════════════════════════

    function getCommitment(uint256 commitmentId) external view returns (ICommitmentPoolingModule.Commitment memory) {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := commitments.slot
        }
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getCommitment.selector, slot, commitmentId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function getRequirement(
        uint256 commitmentId,
        uint16 requirementIndex
    )
        external
        view
        returns (ICommitmentPoolingModule.CommitmentRequirement memory)
    {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := commitments.slot
        }
        _forwardView(
            abi.encodeWithSelector(CommitmentPoolingViewsLib.getRequirement.selector, slot, commitmentId, requirementIndex)
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function getContributor(
        uint256 commitmentId,
        address contributor
    )
        external
        view
        returns (ICommitmentPoolingModule.ContributorRecord memory)
    {
        uint256 commitmentsSlot;
        uint256 contributorsSlot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            commitmentsSlot := commitments.slot
            contributorsSlot := contributors.slot
        }
        _forwardView(
            abi.encodeWithSelector(
                CommitmentPoolingViewsLib.getContributor.selector,
                commitmentsSlot,
                contributorsSlot,
                commitmentId,
                contributor
            )
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function isContributor(uint256 commitmentId, address contributor) external view returns (bool) {
        _requireCommitment(commitmentId);
        return contributors[commitmentId][contributor].active;
    }

    function isEligibleContributor(uint256 commitmentId, address contributor) external view returns (bool) {
        return _isEligibleContributor(commitmentId, _requireCommitment(commitmentId), contributor);
    }

    function getPendingClaim(
        uint256 commitmentId,
        address claimant
    )
        external
        view
        returns (ICommitmentPoolingModule.PendingClaim memory)
    {
        uint256 commitmentsSlot;
        uint256 pendingClaimSlot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            commitmentsSlot := commitments.slot
            pendingClaimSlot := pendingClaim.slot
        }
        _forwardView(
            abi.encodeWithSelector(
                CommitmentPoolingViewsLib.getPendingClaim.selector,
                commitmentsSlot,
                pendingClaimSlot,
                commitmentId,
                claimant
            )
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function getConfirmers(uint256 commitmentId) external view returns (address[] memory) {
        uint256 commitmentsSlot;
        uint256 confirmersSlot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            commitmentsSlot := commitments.slot
            confirmersSlot := commitmentConfirmers.slot
        }
        _forwardView(
            abi.encodeWithSelector(
                CommitmentPoolingViewsLib.getConfirmers.selector, commitmentsSlot, confirmersSlot, commitmentId
            )
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId) {
        return workCommitment[workUID];
    }

    function getLinkedWorkUIDs(uint256 commitmentId) external view returns (bytes32[] memory) {
        uint256 commitmentsSlot;
        uint256 workUIDsSlot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            commitmentsSlot := commitments.slot
            workUIDsSlot := commitmentWorkUIDs.slot
        }
        _forwardView(
            abi.encodeWithSelector(
                CommitmentPoolingViewsLib.getLinkedWorkUIDs.selector, commitmentsSlot, workUIDsSlot, commitmentId
            )
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function isApprovalCounted(bytes32 approvalUID) external view returns (bool) {
        return approvalCounted[approvalUID];
    }

    function isEvidenceAttached(uint256 commitmentId, bytes32 cidHash) external view returns (bool) {
        _requireCommitment(commitmentId);
        return evidenceAttached[commitmentId][cidHash];
    }
}
