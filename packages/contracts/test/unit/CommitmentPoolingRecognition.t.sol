// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingRecognitionTest
/// @notice Canonical recognition recomputation and hashing for PRD-721.
/// @dev Contributor addresses are deliberately ascending so index order is canonical sort order.
contract CommitmentPoolingRecognitionTest is CommitmentPoolingFixture {
    address private constant LEAD = address(0x1001);
    address private constant SECOND = address(0x1002);
    address private constant THIRD = address(0x1003);
    address private constant OUTSIDER = address(0x1009);

    function setUp() public {
        _setUpProductionFixture();
        _registerActions(1);
        _setMember(LEAD);
        _setMember(SECOND);
        _setMember(THIRD);
    }

    // ─────────────────────── Cycle-less 20/80 preset ───────────────────────

    function testCyclelessPresetSplitsEqualParticipationRemaindersByAscendingAddress() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-equal"), 0);

        // Three equal one-credit contributors under 2_000 equal / 8_000 verified:
        // equal   2_000 / 3 = 666 with remainder 2 -> 667, 667, 666
        // verified 8_000 / 3 = 2_666 with remainder 2, all numerator remainders tie -> 2_667, 2_667, 2_666
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(3334), 3334, 3332]);
        bytes32 canonical = module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
        assertEq(canonical, _hash(commitmentId, entries));
    }

    function testVerifiedRemaindersAreAwardedByDescendingFractionalRemainder() public {
        uint256 commitmentId = _fulfilledWorkCommitment(keccak256("recognition-verified"));

        // Credits 1 / 2 / 4 over a total of 7 under 2_000 equal / 8_000 verified:
        // equal    667, 667, 666
        // verified floors 1_142 (rem 6), 2_285 (rem 5), 4_571 (rem 3); 2 bps left, awarded to the
        //          two largest remainders -> 1_143, 2_286, 4_571
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(1810), 2953, 5237]);
        bytes32 canonical = module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
        assertEq(canonical, _hash(commitmentId, entries));
    }

    function testSingleEligibleContributorTakesTheWholeAllocation() public {
        uint256 commitmentId = _fulfilledSoloCommitment(keccak256("recognition-solo"));

        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](1);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: 10_000 });
        assertEq(
            module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries)),
            _hash(commitmentId, entries)
        );
    }

    // ───────────────────────── Opened cycle policy ─────────────────────────

    function testOpenedCyclePolicyOverridesTheCyclelessPreset() public {
        uint256 cycleId = _openCycle(4000, 6000);
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-cycle"), cycleId);

        // equal    4_000 / 3 = 1_333 with remainder 1 -> 1_334, 1_333, 1_333
        // verified 6_000 / 3 = 2_000 exactly, no remainder
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(3334), 3333, 3333]);
        assertEq(
            module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries)),
            _hash(commitmentId, entries)
        );
    }

    // ──────────────────────────── Rejections ────────────────────────────

    function testRejectsACommitmentThatIsNotFulfilled() public {
        uint256 commitmentId = _createOffer(keccak256("recognition-unfulfilled"));
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](1);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: CREATOR, recognitionWeightBps: 10_000 });

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.Offered
            )
        );
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    function testRejectsACallerSelectedWeight() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-weights"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(3333), 3334, 3333]);

        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    function testRejectsAnOmittedContributor() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-omission"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](2);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: 5000 });
        entries[1] = ICommitmentPoolingModule.RecognitionEntry({ contributor: SECOND, recognitionWeightBps: 5000 });

        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    function testRejectsAnUnsortedVector() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-unsorted"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](3);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: SECOND, recognitionWeightBps: 3334 });
        entries[1] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: 3334 });
        entries[2] = ICommitmentPoolingModule.RecognitionEntry({ contributor: THIRD, recognitionWeightBps: 3332 });

        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    function testRejectsADuplicateRow() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-duplicate"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](3);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: 3334 });
        entries[1] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: 3334 });
        entries[2] = ICommitmentPoolingModule.RecognitionEntry({ contributor: THIRD, recognitionWeightBps: 3332 });

        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    /// @dev OUTSIDER sorts after SECOND, so the sort rule passes and eligibility is what rejects.
    function testRejectsAnIneligibleAddress() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-ineligible"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](3);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: 3334 });
        entries[1] = ICommitmentPoolingModule.RecognitionEntry({ contributor: SECOND, recognitionWeightBps: 3334 });
        entries[2] = ICommitmentPoolingModule.RecognitionEntry({ contributor: OUTSIDER, recognitionWeightBps: 3332 });

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotEligibleContributor.selector, OUTSIDER));
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    function testRejectsAHashOverADifferentPreimage() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-hash"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(3334), 3334, 3332]);

        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, keccak256(abi.encode(commitmentId, entries)));
    }

    function testCanonicalHashIsDomainSeparatedByChainAndCommitment() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-preimage"), 0);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(3334), 3334, 3332]);

        bytes32 expected = keccak256(abi.encode(block.chainid, commitmentId, entries));
        assertEq(module.validateRecognitionSnapshot(commitmentId, entries, expected), expected);
    }

    // ──────────────── Defense in depth: incoherent aggregate credits ────────────────

    /// @notice The total-allocation guard rejects a vector whose every row is individually correct.
    /// @dev Recorded because a review round wrongly called this guard redundant. It is redundant
    ///      only while `totalVerifiedCredits == sum(per-contributor credits)` — an invariant
    ///      maintained *outside* this function, by the credit and roster paths. The moment those
    ///      diverge, every per-row equality still passes and the vector silently under-allocates:
    ///      three one-credit contributors against a stored aggregate of 5 recompute to
    ///      2268 / 2268 / 2267, which totals 6,803. Only the final `total != 10_000` check catches
    ///      that, so it is load-bearing against upgrade, migration, or accounting drift.
    ///
    ///      `invariant_contributorCreditTotalsAgreeWithRecords` is the other half of the pair: it
    ///      proves no *public* path can produce the divergence this test injects directly.
    function testRejectsACoherentVectorOverAnIncoherentCreditAggregate() public {
        uint256 commitmentId = _fulfilledEvidenceCommitment(keccak256("recognition-aggregate-drift"), 0);
        assertEq(module.getCommitment(commitmentId).totalVerifiedCredits, 3, "three one-credit contributors");

        _corruptTotalVerifiedCredits(commitmentId, 5);

        // The vector below is exactly what the module recomputes under the corrupted aggregate, so
        // every per-row equality passes and the total guard is the only thing left to reject it.
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _entries([uint16(2268), 2268, 2267]);
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.validateRecognitionSnapshot(commitmentId, entries, _hash(commitmentId, entries));
    }

    /// @dev `commitments` is slot 169; `totalVerifiedCredits` is struct slot 13 at byte offset 8,
    ///      packed beside the two contributor counters. Read back through the public getter so a
    ///      storage-layout change makes this test fail loudly rather than silently corrupt nothing.
    function _corruptTotalVerifiedCredits(uint256 commitmentId, uint64 value) private {
        bytes32 slot = bytes32(uint256(keccak256(abi.encode(commitmentId, uint256(169)))) + 13);
        uint256 word = uint256(vm.load(address(module), slot));
        uint256 mask = uint256(type(uint64).max) << 64;
        vm.store(address(module), slot, bytes32((word & ~mask) | (uint256(value) << 64)));

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.totalVerifiedCredits, value, "storage layout moved; this test wrote the wrong slot");
        assertEq(commitment.eligibleContributorCount, 3, "neighbouring packed field was clobbered");
    }

    // ───────────────────────────── Helpers ─────────────────────────────

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

    function _entries(uint16[3] memory weights)
        private
        pure
        returns (ICommitmentPoolingModule.RecognitionEntry[] memory entries)
    {
        entries = new ICommitmentPoolingModule.RecognitionEntry[](3);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: LEAD, recognitionWeightBps: weights[0] });
        entries[1] = ICommitmentPoolingModule.RecognitionEntry({ contributor: SECOND, recognitionWeightBps: weights[1] });
        entries[2] = ICommitmentPoolingModule.RecognitionEntry({ contributor: THIRD, recognitionWeightBps: weights[2] });
    }

    /// @dev Three contributors carrying one evidence credit each.
    function _fulfilledEvidenceCommitment(bytes32 creationKey, uint256 cycleId) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.cycleId = cycleId;
        vm.prank(LEAD);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);
        vm.prank(LEAD);
        module.addContributor(commitmentId, SECOND);
        vm.prank(LEAD);
        module.addContributor(commitmentId, THIRD);

        address[] memory credited = new address[](3);
        credited[0] = LEAD;
        credited[1] = SECOND;
        credited[2] = THIRD;
        vm.prank(LEAD);
        module.attachEvidence(commitmentId, "bafy-recognition-evidence", credited);

        module.markReadyForConfirmation(commitmentId, "ready for recognition coverage");
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
    }

    function _fulfilledSoloCommitment(bytes32 creationKey) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        vm.prank(LEAD);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);

        address[] memory credited = new address[](1);
        credited[0] = LEAD;
        vm.prank(LEAD);
        module.attachEvidence(commitmentId, "bafy-recognition-solo", credited);

        module.markReadyForConfirmation(commitmentId, "ready for solo recognition");
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
    }

    /// @dev Approved-Work credits of 1 / 2 / 4 across one seven-count requirement.
    function _fulfilledWorkCommitment(bytes32 creationKey) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: 7 });
        vm.prank(LEAD);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);
        vm.prank(LEAD);
        module.addContributor(commitmentId, SECOND);
        vm.prank(LEAD);
        module.addContributor(commitmentId, THIRD);

        _approveWorks(commitmentId, LEAD, 1, 0);
        _approveWorks(commitmentId, SECOND, 2, 10);
        _approveWorks(commitmentId, THIRD, 4, 20);

        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
    }

    function _approveWorks(uint256 commitmentId, address contributor, uint256 count, uint256 offset) private {
        for (uint256 i = 0; i < count; i++) {
            bytes32 workUID = keccak256(abi.encode(commitmentId, "work", offset + i));
            bytes32 approvalUID = keccak256(abi.encode(commitmentId, "approval", offset + i));
            _setWorkAttestation(workUID, contributor, 0);
            vm.prank(LEAD);
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
            "bafy-cycle"
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
