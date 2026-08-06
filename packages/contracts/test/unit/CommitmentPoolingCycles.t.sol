// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingCyclesTest
/// @notice Cycle lifecycle coverage for PRD-721.
contract CommitmentPoolingCyclesTest is CommitmentPoolingFixture {
    function setUp() public {
        _setUpProductionFixture();
    }

    // ───────────────────────────── Seed and open ─────────────────────────────

    function testSeedCycleRejectsAnInvertedWindowAndCountsNonTerminalCycles() public {
        uint64 start = uint64(block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.InvalidTimeWindow.selector, start, start));
        module.seedCycle(poolId, ICommitmentPoolingModule.CycleType.Season, start, start, "bafy-cycle");

        assertEq(module.getPool(poolId).nonTerminalCycleCount, 0);
        uint256 cycleId = _seed(ICommitmentPoolingModule.CycleType.Season);
        assertEq(module.getPool(poolId).nonTerminalCycleCount, 1);
        assertEq(uint256(module.getCycle(cycleId).state), uint256(ICommitmentPoolingModule.CycleState.Seeded));
    }

    function testSeedCycleRequiresPoolSteward() public {
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CREATOR, poolId));
        vm.prank(CREATOR);
        module.seedCycle(
            poolId,
            ICommitmentPoolingModule.CycleType.Season,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            "bafy-cycle"
        );
    }

    function testOpenCycleRequiresBothBpsVectorsToSumToTenThousand() public {
        uint256 cycleId = _seed(ICommitmentPoolingModule.CycleType.Season);

        ICommitmentPoolingModule.AllocationBps memory badAllocation = _allocation();
        badAllocation.gardeners = 1;
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.openCycle(cycleId, badAllocation, _recognition());

        ICommitmentPoolingModule.RecognitionPolicy memory badRecognition =
            ICommitmentPoolingModule.RecognitionPolicy({ equalParticipationBps: 2000, verifiedContributionBps: 7000 });
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        module.openCycle(cycleId, _allocation(), badRecognition);

        module.openCycle(cycleId, _allocation(), _recognition());
        ICommitmentPoolingModule.Cycle memory cycle = module.getCycle(cycleId);
        assertEq(uint256(cycle.state), uint256(ICommitmentPoolingModule.CycleState.Open));
        assertEq(cycle.allocation.gardeners, 5000);
        assertEq(cycle.recognitionPolicy.equalParticipationBps, 2000);
    }

    function testOnlyOneSeasonMayBeOpenWhileCampaignsOverlapFreely() public {
        uint256 seasonOne = _seed(ICommitmentPoolingModule.CycleType.Season);
        uint256 seasonTwo = _seed(ICommitmentPoolingModule.CycleType.Season);
        module.openCycle(seasonOne, _allocation(), _recognition());
        assertEq(module.getPool(poolId).openSeasonCycleId, seasonOne);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.SeasonAlreadyOpen.selector, poolId, seasonOne));
        module.openCycle(seasonTwo, _allocation(), _recognition());

        // Campaigns never read or write the Season guard.
        uint256 campaignOne = _seed(ICommitmentPoolingModule.CycleType.Campaign);
        uint256 campaignTwo = _seed(ICommitmentPoolingModule.CycleType.Campaign);
        module.openCycle(campaignOne, _allocation(), _recognition());
        module.openCycle(campaignTwo, _allocation(), _recognition());
        assertEq(module.getPool(poolId).openSeasonCycleId, seasonOne);
    }

    // ──────────────────────── Reconcile, compost, cancel ────────────────────────

    function testCloseCycleRequiresEveryCycleCommitmentToBeTerminal() public {
        uint256 cycleId = _openSeason();
        uint256 commitmentId = _createCycleOffer(keccak256("cycle-commitment"), cycleId);
        assertEq(module.getCycle(cycleId).liveCommitmentCount, 1);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.CycleHasLiveCommitments.selector, cycleId, uint32(1))
        );
        module.closeCycle(cycleId);

        vm.prank(CREATOR);
        module.cancelCommitment(commitmentId, "");
        assertEq(module.getCycle(cycleId).liveCommitmentCount, 0);

        module.closeCycle(cycleId);
        assertEq(uint256(module.getCycle(cycleId).state), uint256(ICommitmentPoolingModule.CycleState.Reconciled));
        assertEq(module.getPool(poolId).openSeasonCycleId, 0, "closing an open Season clears the guard");
    }

    function testAnOpenDisputeHoldsTheCycleOpen() public {
        uint256 cycleId = _openSeason();
        uint256 commitmentId = _createCycleOffer(keccak256("cycle-dispute"), cycleId);
        _acceptOffer(commitmentId);

        vm.prank(CREATOR);
        module.raiseDispute(commitmentId, "bafy-dispute");

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.CycleHasLiveCommitments.selector, cycleId, uint32(1))
        );
        module.closeCycle(cycleId);
    }

    function testCompostFollowsReconciliationAndClearsTheNonTerminalCount() public {
        uint256 cycleId = _openSeason();
        module.closeCycle(cycleId);
        assertEq(module.getPool(poolId).nonTerminalCycleCount, 1, "Reconciled still counts");

        module.compostCycle(cycleId);
        assertEq(uint256(module.getCycle(cycleId).state), uint256(ICommitmentPoolingModule.CycleState.Composted));
        assertEq(module.getPool(poolId).nonTerminalCycleCount, 0);
    }

    function testCompostRejectsACycleThatWasNeverReconciled() public {
        uint256 cycleId = _openSeason();

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CycleNotInState.selector, cycleId, ICommitmentPoolingModule.CycleState.Open
            )
        );
        module.compostCycle(cycleId);
    }

    function testCancelCycleRequiresAReasonAndNoLiveCommitments() public {
        uint256 cycleId = _openSeason();
        uint256 commitmentId = _createCycleOffer(keccak256("cycle-cancel"), cycleId);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.CycleHasLiveCommitments.selector, cycleId, uint32(1))
        );
        module.cancelCycle(cycleId, "bafy-cancel");

        vm.prank(CREATOR);
        module.cancelCommitment(commitmentId, "");

        vm.expectRevert(ICommitmentPoolingModule.ReasonRequired.selector);
        module.cancelCycle(cycleId, "");

        module.cancelCycle(cycleId, "bafy-cancel");
        assertEq(uint256(module.getCycle(cycleId).state), uint256(ICommitmentPoolingModule.CycleState.Cancelled));
        assertEq(module.getPool(poolId).nonTerminalCycleCount, 0);
        assertEq(module.getPool(poolId).openSeasonCycleId, 0);
    }

    function testCommitmentCreationRequiresAnOpenCycleOfTheSamePool() public {
        uint256 cycleId = _seed(ICommitmentPoolingModule.CycleType.Season);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CycleNotAcceptingCommitments.selector,
                cycleId,
                ICommitmentPoolingModule.CycleState.Seeded
            )
        );
        _createCycleOffer(keccak256("seeded-cycle"), cycleId);
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    function _allocation() private pure returns (ICommitmentPoolingModule.AllocationBps memory) {
        return ICommitmentPoolingModule.AllocationBps({
            gardeners: 5000,
            treasury: 2000,
            operator: 1000,
            evaluator: 1000,
            community: 500,
            funder: 500
        });
    }

    function _recognition() private pure returns (ICommitmentPoolingModule.RecognitionPolicy memory) {
        return ICommitmentPoolingModule.RecognitionPolicy({ equalParticipationBps: 2000, verifiedContributionBps: 8000 });
    }

    function _seed(ICommitmentPoolingModule.CycleType cycleType) private returns (uint256) {
        return module.seedCycle(poolId, cycleType, uint64(block.timestamp), uint64(block.timestamp + 30 days), "bafy-cycle");
    }

    function _openSeason() private returns (uint256 cycleId) {
        cycleId = _seed(ICommitmentPoolingModule.CycleType.Season);
        module.openCycle(cycleId, _allocation(), _recognition());
    }

    function _createCycleOffer(bytes32 creationKey, uint256 cycleId) private returns (uint256) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.cycleId = cycleId;
        vm.prank(CREATOR);
        return module.createCommitment(params);
    }
}
