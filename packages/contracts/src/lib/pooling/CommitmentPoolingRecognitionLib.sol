// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";
import { CommitmentPoolingCreditLib } from "./CommitmentPoolingCreditLib.sol";
import { CommitmentPoolingGuardLib } from "./CommitmentPoolingGuardLib.sol";

/// @title CommitmentPoolingRecognitionLib
/// @notice Deployed behavior library: the canonical recognition validator shared by settlement and
///         Hypercert composition.
/// @dev The module cannot enumerate contributors, so completeness is proved by requiring exactly
///      `eligibleContributorCount` strictly ascending eligible rows. Everything else — policy,
///      credits, weights, remainders — is recomputed here from on-chain records, so a
///      self-consistent caller-supplied vector is never authority for anything.
///      Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingRecognitionLib {
    function validateRecognitionSnapshot(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries,
        bytes32 suppliedHash
    )
        external
        view
        returns (bytes32 canonicalHash)
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Fulfilled) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        // The credit total is also the verified-pass divisor, so a zero here is never reachable
        // for a Fulfilled commitment and must still fail by name rather than by panic.
        if (commitment.eligibleContributorCount == 0 || commitment.totalVerifiedCredits == 0) {
            revert ICommitmentPoolingModule.NoEligibleContributors(commitmentId);
        }
        if (entries.length != commitment.eligibleContributorCount) revert ICommitmentPoolingModule.InvalidAllocation();

        uint256[] memory credits = _readCanonicalCredits(contributors, commitmentId, commitment, entries);
        _assertCanonicalWeights(entries, credits, commitment.totalVerifiedCredits, _recognitionPolicyOf(cycles, commitment));

        // Every field of `entries` is now proven equal to the recomputed vector, so hashing the
        // supplied array and hashing a rebuilt one are the same bytes.
        canonicalHash = keccak256(abi.encode(block.chainid, commitmentId, entries));
        if (canonicalHash != suppliedHash) revert ICommitmentPoolingModule.InvalidAllocation();
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    /// @dev A cycle-scoped commitment uses the policy snapshotted at its cycle's open; a
    ///      cycle-less one uses the immutable protocol preset.
    function _recognitionPolicyOf(
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        private
        view
        returns (ICommitmentPoolingModule.RecognitionPolicy memory policy)
    {
        if (commitment.cycleId == 0) {
            return ICommitmentPoolingModule.RecognitionPolicy({
                equalParticipationBps: CommitmentPoolingCommonLib.CYCLELESS_EQUAL_PARTICIPATION_BPS,
                verifiedContributionBps: CommitmentPoolingCommonLib.CYCLELESS_VERIFIED_CONTRIBUTION_BPS
            });
        }
        policy = cycles[commitment.cycleId].recognitionPolicy;
        // A cycle that never opened carries no snapshot, so there is no policy to recompute from.
        if (
            uint256(policy.equalParticipationBps) + policy.verifiedContributionBps
                != CommitmentPoolingCommonLib.TOTAL_ALLOCATION_BPS
        ) {
            revert ICommitmentPoolingModule.RecognitionPolicyUnavailable(commitment.cycleId);
        }
    }

    /// @dev Proves the canonical sort and per-row eligibility, and reads each row's credit total.
    ///      Strictly ascending is what rejects both an out-of-order row and a duplicate.
    function _readCanonicalCredits(
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries
    )
        private
        view
        returns (uint256[] memory credits)
    {
        credits = new uint256[](entries.length);
        address previous;
        for (uint256 i = 0; i < entries.length; i++) {
            address contributor = entries[i].contributor;
            if (contributor <= previous) revert ICommitmentPoolingModule.InvalidAllocation();
            if (!CommitmentPoolingCreditLib.isEligibleContributor(contributors, commitmentId, commitment, contributor)) {
                revert ICommitmentPoolingModule.NotEligibleContributor(contributor);
            }
            ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][contributor];
            credits[i] = uint256(record.approvedWorkCredits) + record.evidenceCredits;
            previous = contributor;
        }
    }

    /// @dev The two passes are computed independently and never pooled or interleaved. Equal
    ///      remainders go to the first addresses in ascending order; verified remainders go to the
    ///      largest fractional numerator remainders, ties broken by ascending address. Within
    ///      either pass the remainder is smaller than the row count, so no row gains more than one
    ///      extra bps from that pass, and the two components sum to exactly 10_000.
    function _assertCanonicalWeights(
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries,
        uint256[] memory credits,
        uint256 totalVerifiedCredits,
        ICommitmentPoolingModule.RecognitionPolicy memory policy
    )
        private
        pure
    {
        uint256 rows = entries.length;
        uint256 equalBase = uint256(policy.equalParticipationBps) / rows;
        uint256 equalRemainder = uint256(policy.equalParticipationBps) % rows;

        uint256[] memory verifiedFloor = new uint256[](rows);
        uint256[] memory numeratorRemainder = new uint256[](rows);
        uint256 assignedVerified;
        for (uint256 i = 0; i < rows; i++) {
            uint256 numerator = uint256(policy.verifiedContributionBps) * credits[i];
            verifiedFloor[i] = numerator / totalVerifiedCredits;
            numeratorRemainder[i] = numerator % totalVerifiedCredits;
            assignedVerified += verifiedFloor[i];
        }
        uint256 verifiedRemainder = uint256(policy.verifiedContributionBps) - assignedVerified;

        uint256 total;
        for (uint256 i = 0; i < rows; i++) {
            uint256 weight = equalBase + verifiedFloor[i];
            if (i < equalRemainder) weight += 1;
            if (_remainderRank(numeratorRemainder, i) < verifiedRemainder) weight += 1;
            if (entries[i].recognitionWeightBps != weight) revert ICommitmentPoolingModule.InvalidAllocation();
            total += weight;
        }
        if (total != CommitmentPoolingCommonLib.TOTAL_ALLOCATION_BPS) {
            revert ICommitmentPoolingModule.InvalidAllocation();
        }
    }

    /// @dev Position of row `index` ordered by descending numerator remainder. Rows already sit in
    ///      ascending address order, so a tie resolves to the lower index, which is the lower
    ///      address. Rows are capped at MAX_CONTRIBUTORS_PER_COMMITMENT, so this stays bounded.
    function _remainderRank(uint256[] memory remainders, uint256 index) private pure returns (uint256 rank) {
        uint256 own = remainders[index];
        for (uint256 j = 0; j < remainders.length; j++) {
            if (j == index) continue;
            if (remainders[j] > own || (remainders[j] == own && j < index)) rank++;
        }
    }
}
