// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../src/interfaces/ICommitmentRegistry.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";
import { CommitmentPoolingAccountingHandler } from "./handlers/CommitmentPoolingAccountingHandler.sol";

/// @title CommitmentPoolingAccountingInvariantTest
/// @notice Unit accounting, live counts, and roster consistency under arbitrary lifecycle order.
/// @dev Every one of the 122 example-based pooling tests drives one intended sequence. These
///      invariants hold across sequences nobody wrote down: cancel racing dispute, expire then
///      dispute then resolve-to-fulfilled, approvals arriving after a freeze.
///
///      The properties are the ones where a bug is silent rather than loud. A commitment whose
///      units are released twice, or whose `liveCommitmentCount` never returns to zero, does not
///      revert — it strands a cycle that can then never close, or lets a provider exceed the open
///      commitment cap that is the pool's only exposure limit.
contract CommitmentPoolingAccountingInvariantTest is CommitmentPoolingFixture {
    CommitmentPoolingAccountingHandler private handler;
    uint256 private invariantCycleId;

    /// @dev Inline target support; this forge-std version has no StdInvariant, matching
    ///      `test/invariant/RoleHierarchy.t.sol`.
    address[] private _targetedContracts;

    /// @dev First-observed frozen snapshot per commitment, for the immutability invariant.
    mapping(uint256 => bool) private frozenSeen;
    mapping(uint256 => uint32) private frozenContributorCount;
    mapping(uint256 => uint32) private frozenEligibleCount;
    mapping(uint256 => uint64) private frozenVerifiedCredits;

    function targetContracts() public view returns (address[] memory) {
        return _targetedContracts;
    }

    function setUp() public {
        _setUpProductionFixture();
        _registerActions(2);

        // An open cycle so roughly half of the handler's commitments are cycle-scoped. Without one
        // the cycle branch of the live-count accounting is unreachable and its invariant is vacuous.
        invariantCycleId = _openCycle();

        handler = new CommitmentPoolingAccountingHandler(
            address(module),
            address(registry),
            address(hats),
            address(mockEAS),
            address(decisionResolver),
            poolId,
            invariantCycleId
        );

        // The handler drives every actor, so each must be able to hold the roles the lifecycle
        // needs. Evaluator is what lets a dispute be raised by a non-party.
        address[] memory actors = handler.allActors();
        for (uint256 i = 0; i < actors.length; i++) {
            hats.setGardener(POOL_GARDEN, actors[i], true);
            hats.setEvaluator(POOL_GARDEN, actors[i], true);
        }
        module.setProviderOpenCommitmentCap(poolId, 128);

        _targetedContracts.push(address(handler));
    }

    // ═════════════════════ 1. Class quota and single-shot units
    // ═════════════════════

    /// @notice Committed plus fulfilled units never exceed the class quota, and units convert
    ///         exactly once.
    /// @dev Each commitment registers its own class with `quota == targetUnits`, so the legal
    ///      states are (0,0) before commit and after release, (quota,0) while committed, and
    ///      (0,quota) once fulfilled. Anything else means units were counted twice or leaked.
    function invariant_classAccountingStaysWithinQuota() public {
        uint256 count = handler.commitmentCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 commitmentId = handler.commitmentAt(i);
            ICommitmentRegistry.CommitmentClass memory class_ = registry.getClass(commitmentId);

            assertLe(
                class_.totalCommitted + class_.totalFulfilled, class_.quota, "committed + fulfilled exceeded the quota"
            );
            assertTrue(class_.totalCommitted == 0 || class_.totalCommitted == class_.quota, "partial committed balance");
            assertTrue(class_.totalFulfilled == 0 || class_.totalFulfilled == class_.quota, "partial fulfilled balance");
            assertFalse(
                class_.totalCommitted != 0 && class_.totalFulfilled != 0, "units counted as committed and fulfilled"
            );
        }
    }

    /// @notice A terminal commitment has released or fulfilled its units, never neither and never
    ///         both; and the accounting state agrees with the commitment state.
    /// @dev This is the "released exactly once" property. The registry's accounting state is
    ///      single-shot (`Registered -> Committed -> Released | Fulfilled`), so a double release
    ///      reverts inside the registry — what this catches is the other direction: a terminal
    ///      commitment that quietly kept its units committed, which holds a provider's open-count
    ///      slot forever.
    function invariant_terminalCommitmentsHoldNoCommittedUnits() public {
        uint256 count = handler.commitmentCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 commitmentId = handler.commitmentAt(i);
            ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
            if (!_isTerminal(commitment.state)) continue;

            ICommitmentRegistry.CommitmentClass memory class_ = registry.getClass(commitmentId);
            assertEq(class_.totalCommitted, 0, "a terminal commitment still holds committed units");

            if (commitment.state == ICommitmentPoolingModule.CommitmentState.Fulfilled) {
                assertEq(class_.totalFulfilled, class_.quota, "a fulfilled commitment did not convert its units");
                assertTrue(
                    class_.accountingState == ICommitmentRegistry.AccountingState.Fulfilled,
                    "fulfilled commitment without fulfilled accounting"
                );
            } else {
                assertEq(class_.totalFulfilled, 0, "a cancelled or expired commitment converted units");
                // Released, or Registered when an unaccepted Request never committed any units.
                // Still Committed would mean releaseUnits ran its arithmetic without closing the
                // slot, which leaves the provider's open-commitment seat occupied forever.
                assertTrue(
                    class_.accountingState == ICommitmentRegistry.AccountingState.Released
                        || class_.accountingState == ICommitmentRegistry.AccountingState.Registered,
                    "a cancelled or expired commitment left its units unreleased"
                );
            }
        }
    }

    // ═════════════════════ 2. Provider open-commitment count
    // ═════════════════════

    /// @notice `providerOpenCommitmentCount` equals the number of classes where that account
    ///         actually holds committed units.
    /// @dev The count is the pool's only exposure limit, and it is maintained by increment and
    ///      decrement rather than derived. A drift upward silently locks a provider out of the
    ///      pool; a drift downward lets them exceed the cap.
    function invariant_providerOpenCountMatchesCommittedClasses() public {
        address[] memory actors = handler.allActors();
        uint256 count = handler.commitmentCount();

        for (uint256 a = 0; a < actors.length; a++) {
            uint256 observed;
            for (uint256 i = 0; i < count; i++) {
                if (registry.committedOf(actors[a], handler.commitmentAt(i)) > 0) observed++;
            }
            assertEq(
                registry.openCommitmentCountOf(poolId, actors[a]),
                observed,
                "providerOpenCommitmentCount drifted from the committed classes"
            );
        }
    }

    // ═════════════════════ 3. Pool and cycle live counts
    // ═════════════════════

    /// @notice Pool and cycle live counts equal the number of non-terminal commitments.
    /// @dev Disputed counts as live, including a dispute raised on an already-Expired commitment:
    ///      `raiseDispute` re-increments both counters in that case so the resolution can decrement
    ///      exactly once. If that pairing were off by one, a cycle could never reach the
    ///      `liveCommitmentCount == 0` that closing requires — and this is the only test that walks
    ///      the Expired -> Disputed -> resolved episode in arbitrary combination with the others.
    function invariant_liveCountsMatchNonTerminalCommitments() public {
        uint256 count = handler.commitmentCount();
        uint256 live;
        uint256 liveInCycle;
        for (uint256 i = 0; i < count; i++) {
            ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(handler.commitmentAt(i));
            if (_isTerminal(commitment.state)) continue;
            live++;
            if (commitment.cycleId == invariantCycleId) liveInCycle++;
        }

        assertEq(module.getPool(poolId).liveCommitmentCount, live, "pool live count drifted");
        // The cycle counter is what closing a cycle gates on, and it is maintained by a separate
        // pair of increments — including the Expired -> Disputed re-increment. A cycle whose count
        // never returns to zero can never be closed.
        assertEq(module.getCycle(invariantCycleId).liveCommitmentCount, liveInCycle, "cycle live count drifted");
    }

    // ═════════════════════ 4. Contributor credit accounting
    // ═════════════════════

    /// @notice `eligibleContributorCount` and `totalVerifiedCredits` agree with the per-contributor
    ///         records.
    /// @dev Recognition divides by `totalVerifiedCredits` and requires exactly
    ///      `eligibleContributorCount` rows, so drift here does not revert — it produces a
    ///      recognition vector that can never be assembled, or one that omits a contributor.
    function invariant_contributorCreditTotalsAgreeWithRecords() public {
        address[] memory actors = handler.allActors();
        uint256 count = handler.commitmentCount();

        for (uint256 i = 0; i < count; i++) {
            uint256 commitmentId = handler.commitmentAt(i);
            ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);

            uint256 credited;
            uint256 creditSum;
            for (uint256 a = 0; a < actors.length; a++) {
                ICommitmentPoolingModule.ContributorRecord memory record = module.getContributor(commitmentId, actors[a]);
                uint256 credits = uint256(record.approvedWorkCredits) + record.evidenceCredits;
                if (credits == 0) continue;
                credited++;
                creditSum += credits;
            }

            assertEq(commitment.eligibleContributorCount, credited, "eligibleContributorCount drifted from the records");
            assertEq(commitment.totalVerifiedCredits, creditSum, "totalVerifiedCredits drifted from the records");
        }
    }

    // ═════════════════════ 5. Frozen roster immutability
    // ═════════════════════

    /// @notice Once frozen, a roster's size and credit totals never change again.
    /// @dev Scope note, verified 2026-08-06. `CommitmentPoolingProof.onWorkDecision` also short-
    ///      circuits on `commitment.contributorsFrozen`, and removing that clause survives every
    ///      invariant here. That is correct, not a coverage hole: `contributorsFrozen = true` is
    ///      assigned in exactly two places, and each sets the state to ReadyForConfirmation
    ///      (`CommitmentPoolingCredit.sol:62-63`) or Fulfilled (`CommitmentPoolingTerminal.sol:168`)
    ///      in the same breath, so `Accepted && frozen` — the only combination that clause can
    ///      change — is unreachable through the public API. It is defence-in-depth of the same kind
    ///      as the deliberately unreachable guards in `acceptExchange`. Killing that mutation would
    ///      require first introducing the bug that makes the state reachable.
    /// @dev The freeze is what makes a recognition snapshot reproducible: a late approval or
    ///      reversal landing after it would silently change a vector that has already been hashed
    ///      and, downstream, settled against.
    function invariant_frozenRosterNeverChanges() public {
        uint256 count = handler.commitmentCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 commitmentId = handler.commitmentAt(i);
            ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
            if (!commitment.contributorsFrozen) continue;

            if (!frozenSeen[commitmentId]) {
                frozenSeen[commitmentId] = true;
                frozenContributorCount[commitmentId] = commitment.contributorCount;
                frozenEligibleCount[commitmentId] = commitment.eligibleContributorCount;
                frozenVerifiedCredits[commitmentId] = commitment.totalVerifiedCredits;
                continue;
            }

            assertEq(commitment.contributorCount, frozenContributorCount[commitmentId], "frozen roster size changed");
            assertEq(
                commitment.eligibleContributorCount, frozenEligibleCount[commitmentId], "frozen eligible count changed"
            );
            assertEq(commitment.totalVerifiedCredits, frozenVerifiedCredits[commitmentId], "frozen credit total changed");
        }
    }

    /// @notice A frozen roster is never unfrozen.
    function invariant_freezeIsOneWay() public {
        uint256 count = handler.commitmentCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 commitmentId = handler.commitmentAt(i);
            if (!frozenSeen[commitmentId]) continue;
            assertTrue(module.getCommitment(commitmentId).contributorsFrozen, "a frozen roster was unfrozen");
        }
    }

    // ═════════════════════ Coverage guard
    // ═════════════════════

    /// @notice The handler can actually reach every state the invariants above are about.
    /// @dev Not expressible as an invariant — nothing exists at run start, so the assertions would
    ///      fail before the fuzzer acts — and `afterInvariant` reads rolled-back handler state.
    ///      A plain test is the honest place: it proves the handler's entry points work, so a
    ///      campaign that explores orderings is exploring real ones. Without this, a handler whose
    ///      every call silently reverted in its try/catch would satisfy all seven properties
    ///      vacuously, which is the classic way an invariant suite reports green while testing
    ///      nothing.
    /// @notice A cycle-scoped commitment that expires and is then disputed leaves both counters
    ///         consistent — deterministically, not when the fuzzer happens to find it.
    /// @dev This is the exact four-call episode a review's shrinker produced. Relying on the
    ///      campaign to rediscover it was seed-dependent: removing the cycle re-increment in
    ///      `CommitmentPoolingTerminal` survived one 16x96 run and was caught by the next. A known
    ///      counter defect must not depend on the seed, so the sequence is pinned here and the
    ///      campaign is left to find the episodes nobody wrote down.
    ///
    ///      `raiseDispute` decremented the counters on expiry and re-increments them here, so a
    ///      Disputed commitment holds its cycle open and the resolution decrements exactly once. If
    ///      that pairing were off, the cycle could never reach the zero that closing requires.
    function testCycleScopedExpiryThenDisputeKeepsBothCountersConsistent() public {
        handler.createCommitment(0, 0, 3, 5, true);
        assertEq(handler.cycleScopedCount(), 1, "the commitment must be cycle-scoped");
        uint256 commitmentId = handler.commitmentAt(0);

        handler.claimCommitment(0, 1);
        assertEq(module.getPool(poolId).liveCommitmentCount, 1, "an accepted commitment is live");
        assertEq(module.getCycle(invariantCycleId).liveCommitmentCount, 1, "and live in its cycle");

        handler.expireCommitment(0, 1, 9);
        assertEq(
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.Expired),
            "the commitment must actually expire"
        );
        assertEq(module.getPool(poolId).liveCommitmentCount, 0, "expiry decrements the pool counter");
        assertEq(module.getCycle(invariantCycleId).liveCommitmentCount, 0, "expiry decrements the cycle counter");

        handler.raiseDispute(0, 0);
        assertEq(
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.Disputed),
            "the expired commitment must actually be disputed"
        );
        assertEq(module.getPool(poolId).liveCommitmentCount, 1, "a dispute re-opens the pool counter");
        assertEq(module.getCycle(invariantCycleId).liveCommitmentCount, 1, "a dispute re-opens the cycle counter");
    }

    function testHandlerReachesEveryStateTheInvariantsCover() public {
        // Offer by actor 0, claimed by actor 1, two approvals to meet requiredCount, then confirm.
        handler.createCommitment(0, 0, 3, 5, false);
        assertEq(handler.commitmentCount(), 1, "handler cannot create a commitment");

        handler.claimCommitment(0, 1);
        assertGt(handler.acceptedCount(), 0, "handler cannot claim a commitment");

        // Both approvals credit the lead: a work attester must already be an active contributor,
        // and the lead is the only one on the roster until addContributor runs.
        handler.linkAndDecideWork(0, 0, 0, true);
        handler.linkAndDecideWork(0, 0, 0, true);
        assertGt(handler.approvedWorkCount(), 1, "handler cannot earn approved-work credit");

        // Two approvals meet requiredCount, so the roster froze and the state auto-flipped to
        // ReadyForConfirmation; the counterparty confirms.
        handler.confirmFulfillment(0, 1);
        assertGt(handler.fulfilledCount(), 0, "handler cannot reach Fulfilled");

        // A second commitment carried to Disputed, the state that keeps live counts non-zero.
        handler.createCommitment(1, 0, 2, 5, false);
        handler.claimCommitment(1, 2);
        handler.raiseDispute(1, 1);
        assertGt(handler.disputedCount(), 0, "handler cannot raise a dispute");

        // Cycle-scoped commitments and decisions that arrive after their link are both reachable;
        // each was previously impossible, which let a real mutation survive every invariant.
        handler.createCommitment(2, 0, 2, 5, true);
        assertGt(handler.cycleScopedCount(), 0, "handler cannot create a cycle-scoped commitment");

        handler.claimCommitment(2, 3);
        handler.linkAndDecideWork(2, 2, 2, true);
        handler.decideLinkedWork(0, false);
        assertGt(handler.lateDecisionCount(), 0, "handler cannot deliver a decision after its link");
    }

    function _openCycle() private returns (uint256 cycleId) {
        cycleId = module.seedCycle(
            poolId,
            ICommitmentPoolingModule.CycleType.Season,
            uint64(block.timestamp),
            uint64(block.timestamp + 365 days),
            "bafy-invariant-cycle"
        );
        module.openCycle(
            cycleId,
            ICommitmentPoolingModule.AllocationBps({
                gardeners: 6000, treasury: 1500, operator: 1000, evaluator: 500, community: 500, funder: 500
            }),
            ICommitmentPoolingModule.RecognitionPolicy({ equalParticipationBps: 2000, verifiedContributionBps: 8000 })
        );
    }

    function _isTerminal(ICommitmentPoolingModule.CommitmentState state) private pure returns (bool) {
        return state == ICommitmentPoolingModule.CommitmentState.Fulfilled
            || state == ICommitmentPoolingModule.CommitmentState.Cancelled
            || state == ICommitmentPoolingModule.CommitmentState.Expired;
    }
}
