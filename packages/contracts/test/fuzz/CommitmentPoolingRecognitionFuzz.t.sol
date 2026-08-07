// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingRecognitionFuzzTest
/// @notice Property coverage for `validateRecognitionSnapshot` across contributor counts, credit
///         distributions, and policy splits.
/// @dev The recognition vector is what settlement and Hypercert composition both divide by, so
///      "sums to exactly 10,000" is not a rounding nicety — a vector that sums to 9,999 silently
///      strands value, and one that sums to 10,001 over-issues it. The example-based suite in
///      `test/unit/CommitmentPoolingRecognition.t.sol` pins three hand-computed vectors; this
///      covers the space between them.
///
///      The algorithm runs two independent integer passes with separate remainder distribution
///      (`CommitmentPoolingRecognition._assertCanonicalWeights`), so the interesting inputs are
///      the ones where both passes have a remainder to place at once.
///
///      Structure of each test: build the canonical vector, prove the module accepts it, then
///      assert the *properties* on the accepted vector rather than re-checking it against the
///      construction. Acceptance alone would be circular — so
///      `testFuzzTheCanonicalVectorIsTheOnlyOneAccepted` proves the module rejects every
///      one-bps perturbation, which is what makes the acceptance above mean something.
contract CommitmentPoolingRecognitionFuzzTest is CommitmentPoolingFixture {
    /// @dev Bounded well under MAX_CONTRIBUTORS_PER_COMMITMENT (40) because every credit costs a
    ///      real link + approve round trip; `CommitmentPoolingBounds.t.sol` covers the ceiling.
    uint256 private constant MAX_FUZZ_CONTRIBUTORS = 6;
    uint256 private constant MAX_CREDITS_PER_CONTRIBUTOR = 4;
    uint256 private constant TOTAL_BPS = 10_000;

    /// @dev Ascending by construction, so index order is canonical sort order.
    address[] private roster;
    uint256[] private credits;
    uint256 private totalCredits;
    uint256 private commitmentCounter;

    function setUp() public {
        _setUpProductionFixture();
        _registerActions(1);
    }

    // ───────────────────────────── Core invariant ─────────────────────────────

    /// @notice Every canonical vector totals exactly 10,000 bps, for every reachable input.
    /// forge-config: default.fuzz.runs = 96
    function testFuzzCanonicalVectorTotalsExactlyTenThousand(
        uint8 rawCount,
        uint256 creditSeed,
        uint16 rawEqualBps
    )
        public
    {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _canonicalEntries(equalBps);

        // Acceptance proves the vector below is the module's own; the assertions are about it.
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));

        uint256 total;
        for (uint256 i = 0; i < entries.length; i++) {
            total += entries[i].recognitionWeightBps;
        }
        assertEq(total, TOTAL_BPS, "recognition weights must total exactly 10,000 bps");
    }

    /// @notice No row gains more than one extra bps from either pass.
    /// @dev The two passes are computed independently and never pooled. Within each, the remainder
    ///      is strictly smaller than the row count, so a row can pick up at most 1 from each — a
    ///      row receiving 2 from one pass would mean the remainder leaked across rows.
    /// forge-config: default.fuzz.runs = 96
    function testFuzzNoRowGainsMoreThanOneExtraBpsPerPass(uint8 rawCount, uint256 creditSeed, uint16 rawEqualBps) public {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _canonicalEntries(equalBps);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));

        uint256 rows = entries.length;
        uint256 equalBase = uint256(equalBps) / rows;
        uint16 verifiedBps = uint16(TOTAL_BPS - equalBps);

        for (uint256 i = 0; i < rows; i++) {
            uint256 floor = (uint256(verifiedBps) * credits[i]) / totalCredits;
            uint256 weight = entries[i].recognitionWeightBps;

            assertGe(weight, equalBase + floor, "a row fell below its two floors");
            assertLe(weight, equalBase + floor + 2, "a row gained more than one extra bps per pass");
        }
    }

    // ─────────────────────── Remainder placement rules ───────────────────────

    /// @notice Equal-pass remainders go to the lowest addresses, in order and without gaps.
    /// forge-config: default.fuzz.runs = 96
    function testFuzzEqualPassRemaindersGoToTheLowestAddresses(
        uint8 rawCount,
        uint256 creditSeed,
        uint16 rawEqualBps
    )
        public
    {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _canonicalEntries(equalBps);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));

        uint256 rows = entries.length;
        uint256 equalRemainder = uint256(equalBps) % rows;

        // Rows are ascending by address, so "the first `equalRemainder` rows" is the rule itself.
        // Subtracting that predicted bonus must leave every row with a legal verified-pass bonus of
        // 0 or 1. Any other placement — highest addresses, scattered, double-awarded — leaves some
        // row needing a negative or two-bps verified bonus, and fails here.
        uint256 predictedTotal;
        for (uint256 i = 0; i < rows; i++) {
            uint256 verifiedBonus = _verifiedBonusOf(entries, i, equalBps);
            assertLe(verifiedBonus, 1, "a row carries two verified-pass bps, so the equal remainder went elsewhere");
            predictedTotal += i < equalRemainder ? 1 : 0;
        }
        assertEq(predictedTotal, equalRemainder, "the equal remainder must be fully placed across the lowest rows");
    }

    /// @notice Verified-pass remainders go to the largest fractional remainders, ties by ascending
    ///         address.
    /// @dev Asserted as an ordering property over the accepted vector: every row that received the
    ///      bonus must rank at or above every row that did not. That is a different statement from
    ///      the loop that produced it, so a shared off-by-one would not satisfy both.
    /// forge-config: default.fuzz.runs = 96
    function testFuzzVerifiedRemaindersFollowFractionalOrderThenAddress(
        uint8 rawCount,
        uint256 creditSeed,
        uint16 rawEqualBps
    )
        public
    {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _canonicalEntries(equalBps);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));

        uint256 rows = entries.length;
        uint16 verifiedBps = uint16(TOTAL_BPS - equalBps);
        uint256[] memory remainders = new uint256[](rows);
        uint256 assigned;
        for (uint256 i = 0; i < rows; i++) {
            uint256 numerator = uint256(verifiedBps) * credits[i];
            remainders[i] = numerator % totalCredits;
            assigned += numerator / totalCredits;
        }
        uint256 verifiedRemainder = uint256(verifiedBps) - assigned;

        uint256 awarded;
        for (uint256 i = 0; i < rows; i++) {
            if (_verifiedBonusOf(entries, i, equalBps) == 1) awarded++;
        }
        assertEq(awarded, verifiedRemainder, "the verified remainder was not fully distributed");

        for (uint256 i = 0; i < rows; i++) {
            if (_verifiedBonusOf(entries, i, equalBps) != 1) continue;
            for (uint256 j = 0; j < rows; j++) {
                if (_verifiedBonusOf(entries, j, equalBps) == 1) continue;
                // Winner i must outrank loser j: bigger remainder, or equal remainder and a lower
                // address (which, rows being ascending, is a lower index).
                assertTrue(
                    remainders[i] > remainders[j] || (remainders[i] == remainders[j] && i < j),
                    "a verified remainder bps went to a row that does not outrank a skipped row"
                );
            }
        }
    }

    // ─────────────────────── Uniqueness and hash stability ───────────────────────

    /// @notice Exactly one vector is accepted: moving a single bps between rows is rejected.
    /// @dev Without this the acceptance in every test above would be near-vacuous — a validator
    ///      that accepted anything summing to 10,000 would pass them all. This covers the WEIGHTS;
    ///      `testFuzzRejectsEveryMalformedVectorShape` covers the vector's shape, which is a
    ///      separate family of defect (order, duplicates, length) that reweighting cannot express.
    /// forge-config: default.fuzz.runs = 96
    function testFuzzTheCanonicalVectorIsTheOnlyOneAccepted(
        uint8 rawCount,
        uint256 creditSeed,
        uint16 rawEqualBps,
        uint8 rawDonor
    )
        public
    {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _canonicalEntries(equalBps);
        uint256 rows = entries.length;
        if (rows < 2) return;

        // Pick a donor with a bps to give, so the perturbation is a real reallocation rather than
        // an underflow.
        uint256 donor = bound(rawDonor, 0, rows - 1);
        for (uint256 offset = 0; offset < rows; offset++) {
            uint256 candidate = (donor + offset) % rows;
            if (entries[candidate].recognitionWeightBps > 0) {
                donor = candidate;
                break;
            }
        }
        if (entries[donor].recognitionWeightBps == 0) return;
        uint256 recipient = (donor + 1) % rows;

        entries[donor].recognitionWeightBps -= 1;
        entries[recipient].recognitionWeightBps += 1;

        // Still totals 10,000 — only the per-row recomputation can reject it.
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    /// @notice Every malformed *shape* is rejected, not just every wrong weight.
    /// @dev The one-bps test above perturbs values while keeping the vector well-formed, so on its
    ///      own it left the strict-ascending check unexercised — removing that check from
    ///      `_readCanonicalCredits` survived the whole fuzz suite. Order, duplication, and length
    ///      are the three ways a caller can misdescribe the roster while every weight still looks
    ///      canonical.
    /// forge-config: default.fuzz.runs = 96
    function testFuzzRejectsEveryMalformedVectorShape(uint8 rawCount, uint256 creditSeed, uint16 rawEqualBps) public {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory canonical = _canonicalEntries(equalBps);
        uint256 rows = canonical.length;

        // Wrong length, both directions. Reachable at every roster size.
        _expectRejected(commitmentId, _resized(canonical, rows + 1));
        if (rows > 1) _expectRejected(commitmentId, _resized(canonical, rows - 1));
        if (rows < 2) return;

        // Descending order: same rows, same weights, wrong sort.
        ICommitmentPoolingModule.RecognitionEntry[] memory swapped = _copy(canonical);
        (swapped[0], swapped[1]) = (canonical[1], canonical[0]);
        _expectRejected(commitmentId, swapped);

        // A duplicate row, which strict-ascending rejects for the same reason as bad order.
        ICommitmentPoolingModule.RecognitionEntry[] memory duplicated = _copy(canonical);
        duplicated[1].contributor = canonical[0].contributor;
        _expectRejected(commitmentId, duplicated);
    }

    function _expectRejected(uint256 commitmentId, ICommitmentPoolingModule.RecognitionEntry[] memory entries) private {
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    function _copy(ICommitmentPoolingModule.RecognitionEntry[] memory source)
        private
        pure
        returns (ICommitmentPoolingModule.RecognitionEntry[] memory copied)
    {
        copied = new ICommitmentPoolingModule.RecognitionEntry[](source.length);
        for (uint256 i = 0; i < source.length; i++) {
            copied[i] = source[i];
        }
    }

    /// @dev Truncates or pads; a padded tail row reuses the last contributor, so the vector is the
    ///      wrong length AND unsorted, which is exactly what a careless caller would produce.
    function _resized(
        ICommitmentPoolingModule.RecognitionEntry[] memory source,
        uint256 length
    )
        private
        pure
        returns (ICommitmentPoolingModule.RecognitionEntry[] memory resized)
    {
        resized = new ICommitmentPoolingModule.RecognitionEntry[](length);
        for (uint256 i = 0; i < length; i++) {
            resized[i] = i < source.length ? source[i] : source[source.length - 1];
        }
    }

    /// @notice The canonical hash is stable and bound to this commitment on this chain.
    /// forge-config: default.fuzz.runs = 64
    function testFuzzCanonicalHashIsStableAndDomainSeparated(
        uint8 rawCount,
        uint256 creditSeed,
        uint16 rawEqualBps
    )
        public
    {
        (uint256 commitmentId, uint16 equalBps) = _fulfilledFuzzCommitment(rawCount, creditSeed, rawEqualBps);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _canonicalEntries(equalBps);
        bytes32 expected = _hash(commitmentId, entries);

        assertEq(module.validateRecognitionSnapshot(commitmentId, entries, expected), expected);
        assertEq(
            module.validateRecognitionSnapshot(commitmentId, entries, expected), expected, "hash must be deterministic"
        );
        assertTrue(
            expected != keccak256(abi.encode(block.chainid, commitmentId + 1, entries)),
            "hash must be bound to its commitment"
        );
    }

    // ───────────────────────────── Construction ─────────────────────────────

    /// @dev Builds the vector the module recomputes: two independent integer passes, each
    ///      distributing its own remainder. Deliberately mirrors the production loop — the tests
    ///      above are what give it teeth, by asserting properties of the accepted result and by
    ///      proving no neighbouring vector is accepted.
    function _canonicalEntries(uint16 equalBps)
        private
        view
        returns (ICommitmentPoolingModule.RecognitionEntry[] memory entries)
    {
        uint256 rows = roster.length;
        uint16 verifiedBps = uint16(TOTAL_BPS - equalBps);
        uint256 equalBase = uint256(equalBps) / rows;
        uint256 equalRemainder = uint256(equalBps) % rows;

        uint256[] memory floors = new uint256[](rows);
        uint256[] memory remainders = new uint256[](rows);
        uint256 assigned;
        for (uint256 i = 0; i < rows; i++) {
            uint256 numerator = uint256(verifiedBps) * credits[i];
            floors[i] = numerator / totalCredits;
            remainders[i] = numerator % totalCredits;
            assigned += floors[i];
        }
        uint256 verifiedRemainder = uint256(verifiedBps) - assigned;

        entries = new ICommitmentPoolingModule.RecognitionEntry[](rows);
        for (uint256 i = 0; i < rows; i++) {
            uint256 weight = equalBase + floors[i];
            if (i < equalRemainder) weight += 1;
            if (_rankOf(remainders, i) < verifiedRemainder) weight += 1;
            entries[i] =
                ICommitmentPoolingModule.RecognitionEntry({ contributor: roster[i], recognitionWeightBps: uint16(weight) });
        }
    }

    /// @dev Rows strictly ahead of `index` by remainder, ties resolved to the lower index.
    function _rankOf(uint256[] memory remainders, uint256 index) private pure returns (uint256 rank) {
        uint256 own = remainders[index];
        for (uint256 j = 0; j < remainders.length; j++) {
            if (j == index) continue;
            if (remainders[j] > own || (remainders[j] == own && j < index)) rank++;
        }
    }

    /// @dev Bps a row carries above its two independent floors: 0, 1, or 2.
    function _excessOf(
        ICommitmentPoolingModule.RecognitionEntry[] memory entries,
        uint256 index,
        uint16 equalBps
    )
        private
        view
        returns (uint256)
    {
        uint256 floor = (uint256(TOTAL_BPS - equalBps) * credits[index]) / totalCredits;
        return entries[index].recognitionWeightBps - (uint256(equalBps) / entries.length) - floor;
    }

    /// @dev The verified-pass bonus, derived by subtracting the equal-pass bonus that the rule
    ///      under test predicts. Deliberately *not* clamped: if the equal rule were wrong, some row
    ///      would need a negative or two-bps verified bonus, and this reverts or returns 2 instead
    ///      of quietly agreeing. That is what makes the equal-pass assertion falsifiable rather
    ///      than a restatement of its own premise.
    function _verifiedBonusOf(
        ICommitmentPoolingModule.RecognitionEntry[] memory entries,
        uint256 index,
        uint16 equalBps
    )
        private
        returns (uint256)
    {
        uint256 excess = _excessOf(entries, index, equalBps);
        uint256 predictedEqualBonus = index < uint256(equalBps) % entries.length ? 1 : 0;

        assertGe(excess, predictedEqualBonus, "equal-pass remainder did not go to the lowest addresses");
        return excess - predictedEqualBonus;
    }

    function _hash(
        uint256 commitmentId,
        ICommitmentPoolingModule.RecognitionEntry[] memory entries
    )
        private
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, commitmentId, entries));
    }

    /// @dev One fulfilled commitment whose contributors carry the fuzzed credit vector under the
    ///      fuzzed policy split. Every credit is a real link + approve through the decision bridge,
    ///      so the credits the validator reads are the ones the module actually recorded.
    function _fulfilledFuzzCommitment(
        uint8 rawCount,
        uint256 creditSeed,
        uint16 rawEqualBps
    )
        private
        returns (uint256 commitmentId, uint16 equalBps)
    {
        uint256 count = bound(rawCount, 1, MAX_FUZZ_CONTRIBUTORS);
        equalBps = uint16(bound(rawEqualBps, 0, TOTAL_BPS));
        _buildRoster(count, creditSeed);

        uint256 cycleId = _openCycle(equalBps, uint16(TOTAL_BPS - equalBps));
        commitmentCounter++;
        bytes32 creationKey = keccak256(abi.encode("recognition-fuzz", commitmentCounter));

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.cycleId = cycleId;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] =
            ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: uint32(totalCredits) });

        vm.prank(roster[0]);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);

        for (uint256 i = 1; i < roster.length; i++) {
            vm.prank(roster[0]);
            module.addContributor(commitmentId, roster[i]);
        }

        uint256 offset;
        for (uint256 i = 0; i < roster.length; i++) {
            _approveWorks(commitmentId, roster[i], credits[i], offset);
            offset += credits[i];
        }

        // The requirement count equals the total credits, so the last approval freezes the roster
        // and flips the commitment to ReadyForConfirmation on its own.
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
    }

    /// @dev Ascending addresses so index order is canonical sort order, with each contributor
    ///      carrying at least one credit — the eligibility floor the validator enforces.
    function _buildRoster(uint256 count, uint256 creditSeed) private {
        delete roster;
        delete credits;
        totalCredits = 0;

        for (uint256 i = 0; i < count; i++) {
            address contributor = address(uint160(0x2000 + (commitmentCounter * 64) + i));
            _setMember(contributor);
            roster.push(contributor);

            uint256 credit = 1 + ((creditSeed >> (8 * i)) & 0xFF) % MAX_CREDITS_PER_CONTRIBUTOR;
            credits.push(credit);
            totalCredits += credit;
        }
    }

    function _approveWorks(uint256 commitmentId, address contributor, uint256 count, uint256 offset) private {
        for (uint256 i = 0; i < count; i++) {
            bytes32 workUID = keccak256(abi.encode(commitmentId, "work", offset + i));
            bytes32 approvalUID = keccak256(abi.encode(commitmentId, "approval", offset + i));
            _setWorkAttestation(workUID, contributor, 0);
            vm.prank(roster[0]);
            module.linkWork(commitmentId, workUID, 0, keccak256(abi.encode(commitmentId, "link", offset + i)));
            _setApprovalAttestation(approvalUID, workUID, 0, true);
            decisionResolver.setDecisionSequence(approvalUID, 1);
            decisionResolver.setLatestDecisionSequence(workUID, 1);
            vm.prank(address(decisionResolver));
            module.onWorkDecision(workUID, approvalUID, 1, POOL_GARDEN, true);
        }
    }

    function _openCycle(uint16 equalBps, uint16 verifiedBps) private returns (uint256 cycleId) {
        cycleId = module.seedCycle(
            poolId,
            ICommitmentPoolingModule.CycleType.Season,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            "bafy-recognition-fuzz-cycle"
        );
        module.openCycle(
            cycleId,
            ICommitmentPoolingModule.AllocationBps({
                gardeners: 6000,
                treasury: 1500,
                operator: 1000,
                evaluator: 500,
                community: 500,
                funder: 500
            }),
            ICommitmentPoolingModule.RecognitionPolicy({
                equalParticipationBps: equalBps,
                verifiedContributionBps: verifiedBps
            })
        );
    }
}
