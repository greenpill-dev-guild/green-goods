// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingPauseFreezeTest
/// @notice Pool-level freeze coverage and the paused backfill registration exception.
contract CommitmentPoolingPauseFreezeTest is CommitmentPoolingFixture {
    address private constant POOL_STEWARD = address(0xA001);
    address private constant SECOND_GARDEN = address(0xCAFF);

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
    }

    function testPausedPoolBlocksEveryFrozenSelectorBeforeMutation() public {
        uint256[] memory commitmentIds = new uint256[](8);
        commitmentIds[0] = _createOffer(keccak256("pause-claim"));
        commitmentIds[1] = _pendingOffer(keccak256("pause-accept-claim"));
        commitmentIds[2] = _pendingOffer(keccak256("pause-decline-claim"));
        (, commitmentIds[3]) = _offerPair(keccak256("pause-exchange"));
        commitmentIds[4] = _acceptedOfferWithEvidence(keccak256("pause-submit"));
        commitmentIds[5] = _acceptedOfferWithEvidence(keccak256("pause-ready"));
        commitmentIds[6] = _readyOffer(keccak256("pause-confirm"));
        commitmentIds[7] = _readyOffer(keccak256("pause-fallback"));
        _pausePool();

        for (uint256 index; index < commitmentIds.length; ++index) {
            _expectPoolPaused();
            _invokeBlockedAction(index, commitmentIds[index]);
        }
    }

    function testRegisterPoolRemainsCallableWhileModulePaused() public {
        module.setPaused(true);

        uint256 registeredPoolId = module.registerPool(SECOND_GARDEN, ICommitmentPoolingModule.PoolType.Garden);

        (uint256 resolvedPoolId, ICommitmentPoolingModule.Pool memory pool) = module.getPoolByGarden(SECOND_GARDEN);
        assertEq(registeredPoolId, resolvedPoolId);
        assertEq(pool.garden, SECOND_GARDEN);
        assertEq(uint256(pool.state), uint256(ICommitmentPoolingModule.PoolState.NotReady));
    }

    function testPausedRegistrationPreservesAuthorityRootAndDuplicateGates() public {
        module.setPaused(true);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnauthorizedCaller.selector, address(0xBAD)));
        vm.prank(address(0xBAD));
        module.registerPool(SECOND_GARDEN, ICommitmentPoolingModule.PoolType.Garden);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ProtocolGardenMismatch.selector, ROOT_GARDEN, SECOND_GARDEN)
        );
        module.registerPool(SECOND_GARDEN, ICommitmentPoolingModule.PoolType.Protocol);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.PoolExists.selector, POOL_GARDEN));
        module.registerPool(POOL_GARDEN, ICommitmentPoolingModule.PoolType.Garden);
    }

    function testPausedRegistrationDoesNotUngateGardenMintHook() public {
        module.setPaused(true);

        vm.expectRevert(ICommitmentPoolingModule.ModulePaused.selector);
        vm.prank(GARDEN_TOKEN);
        module.onGardenMinted(SECOND_GARDEN);
    }

    function testPausedPoolStillAllowsProofAndRosterWindDown() public {
        uint256 commitmentId = _createOffer(keccak256("pause-proof-roster"));
        _acceptOffer(commitmentId);
        address contributor = address(0xC011);
        _setMember(contributor);
        _pausePool();

        vm.prank(CREATOR);
        module.addContributor(commitmentId, contributor);
        assertTrue(module.isContributor(commitmentId, contributor));
        vm.prank(CREATOR);
        module.removeContributor(commitmentId, contributor);
        assertFalse(module.isContributor(commitmentId, contributor));

        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-paused-proof", credited);
        assertEq(module.getCommitment(commitmentId).evidenceCount, 1);
    }

    function testPausedPoolStillAllowsCancellationAndExpiry() public {
        uint256 cancellable = _createOffer(keccak256("pause-cancel"));
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("pause-expire"));
        params.dueDate = uint64(block.timestamp + 1);
        vm.prank(CREATOR);
        uint256 expiring = module.createCommitment(params);
        _pausePool();

        vm.prank(CREATOR);
        module.cancelCommitment(cancellable, "paused wind-down");
        vm.warp(block.timestamp + 2);
        module.expireCommitment(expiring);

        assertEq(
            uint256(module.getCommitment(cancellable).state), uint256(ICommitmentPoolingModule.CommitmentState.Cancelled)
        );
        assertEq(uint256(module.getCommitment(expiring).state), uint256(ICommitmentPoolingModule.CommitmentState.Expired));
    }

    function testPausedPoolStillAllowsDisputeRecovery() public {
        uint256 commitmentId = _createOffer(keccak256("pause-dispute"));
        _acceptOffer(commitmentId);
        _pausePool();

        vm.prank(CLAIMANT);
        module.raiseDispute(commitmentId, "bafy-paused-dispute");
        vm.prank(POOL_STEWARD);
        module.resolveDispute(
            commitmentId, ICommitmentPoolingModule.DisputeResolution.RestorePrevious, "bafy-paused-resolved"
        );

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted)
        );
    }

    function _pendingOffer(bytes32 creationKey) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
    }

    function _acceptedOfferWithEvidence(bytes32 creationKey) private returns (uint256 commitmentId) {
        commitmentId = _createOffer(creationKey);
        _acceptOffer(commitmentId);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-pause-evidence", credited);
    }

    function _readyOffer(bytes32 creationKey) private returns (uint256 commitmentId) {
        commitmentId = _acceptedOfferWithEvidence(creationKey);
        vm.prank(POOL_STEWARD);
        module.markReadyForConfirmation(commitmentId, "ready before pause");
    }

    function _offerPair(bytes32 seed) private returns (uint256 idA, uint256 idB) {
        idA = _createOffer(keccak256(abi.encode(seed, "a")));
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256(abi.encode(seed, "b")));
        params.counterCommitmentId = idA;
        vm.prank(CLAIMANT);
        idB = module.createCommitment(params);
    }

    function _pausePool() private {
        vm.prank(POOL_STEWARD);
        module.pausePool(poolId, "bafy-paused");
    }

    function _expectPoolPaused() private {
        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.PoolNotInState.selector, poolId, ICommitmentPoolingModule.PoolState.Paused
            )
        );
    }

    function _invokeBlockedAction(uint256 index, uint256 commitmentId) private {
        if (index == 0) {
            vm.prank(CLAIMANT);
            module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        } else if (index == 1) {
            vm.prank(POOL_STEWARD);
            module.acceptClaim(commitmentId, CLAIMANT);
        } else if (index == 2) {
            vm.prank(POOL_STEWARD);
            module.declineClaim(commitmentId, CLAIMANT, "bafy-declined");
        } else if (index == 3) {
            vm.prank(CREATOR);
            module.acceptExchange(commitmentId);
        } else if (index == 4) {
            vm.prank(CLAIMANT);
            module.submitForConfirmation(commitmentId);
        } else if (index == 5) {
            vm.prank(POOL_STEWARD);
            module.markReadyForConfirmation(commitmentId, "ready");
        } else if (index == 6) {
            vm.prank(CLAIMANT);
            module.confirmFulfillment(commitmentId);
        } else {
            vm.prank(POOL_STEWARD);
            module.confirmFulfillmentAsFallback(commitmentId, "ordinary path unavailable");
        }
    }
}
