// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingMemberFundedClaimsTest
/// @notice Acceptance-time authority for member requests on priced Offers.
contract CommitmentPoolingMemberFundedClaimsTest is CommitmentPoolingFixture {
    address private constant POOL_STEWARD = address(0xA001);
    address private constant SECOND_FUNDER = address(0xF002);

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
        _setMember(SECOND_FUNDER);
    }

    function testCommitmentPooling_memberCanRequestPricedApprovalGatedOfferWithoutAcceptingIt() public {
        uint256 commitmentId =
            _pricedOffer(keccak256("member-priced-request"), ICommitmentPoolingModule.ClaimMode.ApprovalGated);

        uint256 openBefore = registry.openCommitmentCountOf(poolId, CREATOR);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        ICommitmentPoolingModule.PendingClaim memory claim = module.getPendingClaim(commitmentId, CLAIMANT);
        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertTrue(claim.active);
        assertEq(claim.claimant, CLAIMANT);
        assertEq(uint256(commitment.state), uint256(ICommitmentPoolingModule.CommitmentState.Offered));
        assertEq(commitment.counterparty, address(0));
        assertEq(commitment.payerGarden, address(0));
        assertEq(registry.openCommitmentCountOf(poolId, CREATOR), openBefore);
    }

    function testCommitmentPooling_onlyPoolStewardCanAcceptMemberPricedClaim() public {
        uint256 commitmentId = _pendingPricedOffer(keccak256("member-priced-accept"));

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CLAIMANT, poolId));
        vm.prank(CLAIMANT);
        module.acceptClaim(commitmentId, CLAIMANT);

        vm.prank(POOL_STEWARD);
        module.acceptClaim(commitmentId, CLAIMANT);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(uint256(commitment.state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));
        assertEq(commitment.counterparty, CLAIMANT);
        assertEq(commitment.payerGarden, POOL_GARDEN);
    }

    function testCommitmentPooling_pricedApprovalClaimRechecksMembershipAtAcceptance() public {
        uint256 commitmentId = _pendingPricedOffer(keccak256("member-priced-stale"));
        hats.setGardener(POOL_GARDEN, CLAIMANT, false);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotEligibleClaimant.selector, CLAIMANT));
        vm.prank(POOL_STEWARD);
        module.acceptClaim(commitmentId, CLAIMANT);

        assertTrue(module.getPendingClaim(commitmentId, CLAIMANT).active);
        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered)
        );
    }

    function testCommitmentPooling_noCallerCanDirectlyAcceptPricedOpenOffer() public {
        uint256 commitmentId = _pricedOffer(keccak256("member-priced-open"), ICommitmentPoolingModule.ClaimMode.Open);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.PricedOfferClaimRequiresSteward.selector, POOL_GARDEN, CLAIMANT)
        );
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.PricedOfferClaimRequiresSteward.selector, POOL_GARDEN, POOL_STEWARD
            )
        );
        vm.prank(POOL_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered)
        );
    }

    function testCommitmentPooling_firstStewardAcceptanceWinsTwoFundersWithoutASecondCapacityCommit() public {
        uint256 commitmentId =
            _pricedOffer(keccak256("two-funded-claims"), ICommitmentPoolingModule.ClaimMode.ApprovalGated);
        uint256 openCommitments = registry.openCommitmentCountOf(poolId, CREATOR);

        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        vm.prank(SECOND_FUNDER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        vm.prank(POOL_STEWARD);
        module.acceptClaim(commitmentId, CLAIMANT);

        assertEq(module.getCommitment(commitmentId).counterparty, CLAIMANT);
        assertFalse(module.getPendingClaim(commitmentId, CLAIMANT).active);
        assertTrue(module.getPendingClaim(commitmentId, SECOND_FUNDER).active);
        assertEq(registry.openCommitmentCountOf(poolId, CREATOR), openCommitments);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.Accepted
            )
        );
        vm.prank(POOL_STEWARD);
        module.acceptClaim(commitmentId, SECOND_FUNDER);
        assertEq(registry.openCommitmentCountOf(poolId, CREATOR), openCommitments);
    }

    function _pendingPricedOffer(bytes32 creationKey) private returns (uint256 commitmentId) {
        commitmentId = _pricedOffer(creationKey, ICommitmentPoolingModule.ClaimMode.ApprovalGated);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
    }

    function _pricedOffer(
        bytes32 creationKey,
        ICommitmentPoolingModule.ClaimMode claimMode
    )
        private
        returns (uint256 commitmentId)
    {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.claimMode = claimMode;
        params.consideration = ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.CeloSettlement,
            source: address(0),
            token: address(0),
            amount: 100 ether
        });
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
    }
}
