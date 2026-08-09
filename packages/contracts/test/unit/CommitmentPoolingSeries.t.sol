// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingSeriesTest
/// @notice Module-native commitment series lifecycle and replay identity for PRD-721.
contract CommitmentPoolingSeriesTest is CommitmentPoolingFixture {
    bytes32 private constant SERIES_KEY = keccak256("series-key");
    string private constant SERIES_CID = "bafy-series";

    function setUp() public {
        _setUpProductionFixture();
    }

    // ───────────────────────────── Creation ─────────────────────────────

    function testCreateCommitmentSeriesMakesTheCallerTheHolder() public {
        vm.expectEmit(true, true, true, true);
        emit ICommitmentPoolingModule.CommitmentSeriesCreated(1, poolId, CREATOR, SERIES_CID);
        vm.prank(CREATOR);
        uint256 seriesId = module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);

        assertEq(seriesId, 1, "series ids start at 1 so 0 stays the one-shot sentinel");
        ICommitmentPoolingModule.CommitmentSeries memory series = module.getCommitmentSeries(seriesId);
        assertEq(series.poolId, poolId);
        assertEq(series.createdBy, CREATOR);
        assertEq(series.currentHolder, CREATOR);
        assertEq(uint256(series.state), uint256(ICommitmentPoolingModule.CommitmentSeriesState.Active));
        assertEq(series.metadataCID, SERIES_CID);
        assertEq(series.creationPayloadHash, keccak256(abi.encode(poolId, keccak256(bytes(SERIES_CID)))));
        assertEq(module.getCommitmentSeriesIdByCreationRequest(CREATOR, SERIES_KEY), seriesId);
    }

    function testExactReplayReturnsTheSameSeriesWithoutASecondEvent() public {
        vm.prank(CREATOR);
        uint256 seriesId = module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);
        uint256 nextBefore = module.nextCommitmentSeriesId();

        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 replayed = module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);

        assertEq(replayed, seriesId);
        assertEq(module.nextCommitmentSeriesId(), nextBefore, "a replay must not allocate a second id");
        assertEq(vm.getRecordedLogs().length, 0, "a replay must not emit a second creation event");
    }

    function testReusingTheKeyWithADifferentPayloadReverts() public {
        vm.prank(CREATOR);
        uint256 seriesId = module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.SeriesCreationRequestConflict.selector, SERIES_KEY, seriesId)
        );
        vm.prank(CREATOR);
        module.createCommitmentSeries(poolId, SERIES_KEY, "bafy-different");
    }

    function testTheKeyIsScopedToTheHolder() public {
        vm.prank(CREATOR);
        uint256 first = module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);
        vm.prank(CLAIMANT);
        uint256 second = module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);

        assertTrue(first != second, "the same key from a different holder is a different series");
        assertEq(module.getCommitmentSeriesIdByCreationRequest(CLAIMANT, SERIES_KEY), second);
    }

    function testCreateRejectsAZeroKey() public {
        vm.expectRevert(ICommitmentPoolingModule.InvalidSeriesCreationRequestKey.selector);
        vm.prank(CREATOR);
        module.createCommitmentSeries(poolId, bytes32(0), SERIES_CID);
    }

    function testCreateRejectsAnEmptyMetadataCID() public {
        vm.expectRevert(ICommitmentPoolingModule.ReasonRequired.selector);
        vm.prank(CREATOR);
        module.createCommitmentSeries(poolId, SERIES_KEY, "");
    }

    function testCreateRejectsANonMemberOfTheSeriesPoolGarden() public {
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnauthorizedCaller.selector, address(0xBAD)));
        vm.prank(address(0xBAD));
        module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);
    }

    function testCreateRejectsAPoolThatIsNotReadyOrOpen() public {
        module.pausePool(poolId, "bafy-pause");

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.PoolNotInState.selector, poolId, ICommitmentPoolingModule.PoolState.Paused
            )
        );
        vm.prank(CREATOR);
        module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);
    }

    // ───────────────────────────── Lifecycle ─────────────────────────────

    function testHolderMovesTheSeriesBetweenActiveAndResting() public {
        uint256 seriesId = _series();

        vm.prank(CREATOR);
        module.restCommitmentSeries(seriesId);
        assertEq(
            uint256(module.getCommitmentSeries(seriesId).state),
            uint256(ICommitmentPoolingModule.CommitmentSeriesState.Resting)
        );

        vm.prank(CREATOR);
        module.resumeCommitmentSeries(seriesId);
        assertEq(
            uint256(module.getCommitmentSeries(seriesId).state),
            uint256(ICommitmentPoolingModule.CommitmentSeriesState.Active)
        );
    }

    function testRetiredIsTerminalAndImmutable() public {
        uint256 seriesId = _series();
        vm.prank(CREATOR);
        module.retireCommitmentSeries(seriesId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.InvalidCommitmentSeriesState.selector,
                seriesId,
                ICommitmentPoolingModule.CommitmentSeriesState.Retired
            )
        );
        vm.prank(CREATOR);
        module.resumeCommitmentSeries(seriesId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.InvalidCommitmentSeriesState.selector,
                seriesId,
                ICommitmentPoolingModule.CommitmentSeriesState.Retired
            )
        );
        vm.prank(CREATOR);
        module.updateCommitmentSeriesMetadata(seriesId, "bafy-after-retire");
    }

    function testMetadataChangesWhileActiveOrResting() public {
        uint256 seriesId = _series();

        vm.prank(CREATOR);
        module.updateCommitmentSeriesMetadata(seriesId, "bafy-revised");
        assertEq(module.getCommitmentSeries(seriesId).metadataCID, "bafy-revised");

        vm.prank(CREATOR);
        module.restCommitmentSeries(seriesId);
        vm.prank(CREATOR);
        module.updateCommitmentSeriesMetadata(seriesId, "bafy-resting-revision");
        assertEq(module.getCommitmentSeries(seriesId).metadataCID, "bafy-resting-revision");

        // Revising terms never rewrites the immutable creation identity.
        assertEq(
            module.getCommitmentSeries(seriesId).creationPayloadHash,
            keccak256(abi.encode(poolId, keccak256(bytes(SERIES_CID))))
        );
    }

    function testEveryMutationIsHolderOnly() public {
        uint256 seriesId = _series();
        bytes memory holderOnly =
            abi.encodeWithSelector(ICommitmentPoolingModule.CommitmentSeriesHolderOnly.selector, seriesId, CLAIMANT);

        vm.expectRevert(holderOnly);
        vm.prank(CLAIMANT);
        module.restCommitmentSeries(seriesId);

        vm.expectRevert(holderOnly);
        vm.prank(CLAIMANT);
        module.retireCommitmentSeries(seriesId);

        vm.expectRevert(holderOnly);
        vm.prank(CLAIMANT);
        module.updateCommitmentSeriesMetadata(seriesId, "bafy-not-yours");
    }

    function testUnknownSeriesReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnknownCommitmentSeries.selector, uint256(99)));
        module.getCommitmentSeries(99);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnknownCommitmentSeries.selector, uint256(99)));
        vm.prank(CREATOR);
        module.restCommitmentSeries(99);
    }

    // ─────────────────────── Commitment attachment ───────────────────────

    function testAnActiveSeriesBacksAnInstanceOffer() public {
        uint256 seriesId = _series();
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("series-instance"));
        params.commitmentSeriesId = seriesId;

        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        assertEq(module.getCommitment(commitmentId).commitmentSeriesId, seriesId);
    }

    function testARestingSeriesCannotBackANewInstance() public {
        uint256 seriesId = _series();
        vm.prank(CREATOR);
        module.restCommitmentSeries(seriesId);

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("series-resting"));
        params.commitmentSeriesId = seriesId;

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.CommitmentSeriesNotActive.selector, seriesId));
        vm.prank(CREATOR);
        module.createCommitment(params);
    }

    function testOnlyTheHolderCanCreateAnInstanceFromTheSeries() public {
        uint256 seriesId = _series();
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("series-other-holder"));
        params.commitmentSeriesId = seriesId;

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.CommitmentSeriesHolderOnly.selector, seriesId, CLAIMANT)
        );
        vm.prank(CLAIMANT);
        module.createCommitment(params);
    }

    function testRestingTheSeriesLeavesExistingInstancesAlone() public {
        uint256 seriesId = _series();
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("series-existing"));
        params.commitmentSeriesId = seriesId;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(CREATOR);
        module.retireCommitmentSeries(seriesId);

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered)
        );
        assertEq(module.getCommitment(commitmentId).commitmentSeriesId, seriesId);
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    function _series() private returns (uint256 seriesId) {
        vm.prank(CREATOR);
        return module.createCommitmentSeries(poolId, SERIES_KEY, SERIES_CID);
    }
}
