// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Pooling } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

contract CommitmentPoolingRequestRewardsTest is CommitmentPoolingFixture {
    address private constant STEWARD = address(0xA001);

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, STEWARD, true);
        hats.setGardener(POOL_GARDEN, STEWARD, true);
    }

    function testCommitmentPoolingRequest_memberCanCreateWithoutRewardAndStewardCanAddItLater() public {
        Pooling.CreateCommitmentParams memory params = _request("member-request");
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        assertEq(uint256(module.getCommitment(id).state), uint256(Pooling.CommitmentState.Requested));
        vm.prank(STEWARD);
        module.setDeclaredConsideration(id, _reward());
        assertEq(module.getCommitment(id).consideration.amount, 1 ether);
    }

    function testCommitmentPoolingRequest_memberCannotSetRewardOnEitherRail() public {
        for (uint256 i = 0; i < 2; i++) {
            Pooling.CreateCommitmentParams memory params = _request(i == 0 ? "external" : "celo");
            params.consideration = _reward();
            if (i == 1) {
                params.consideration.rail = Pooling.ConsiderationRail.CeloSettlement;
                params.consideration.source = address(0);
                params.consideration.token = address(0);
            }
            vm.expectRevert(abi.encodeWithSelector(Pooling.NotPoolSteward.selector, CREATOR, poolId));
            vm.prank(CREATOR);
            module.createCommitment(params);
        }
        assertEq(module.nextCommitmentId(), 1, "rejected requests consume no IDs");
    }

    function testCommitmentPoolingRequest_stewardCanCreateForMemberWithRewardAndRetry() public {
        Pooling.CreateCommitmentParams memory params = _request("captured-request");
        params.commitmentType = Pooling.CommitmentType.StewardCaptured;
        params.onBehalfOf = CREATOR;
        params.consideration = _reward();
        vm.prank(STEWARD);
        uint256 id = module.createCommitment(params);
        assertEq(module.getCommitment(id).creator, CREATOR);
        assertEq(module.getCommitment(id).consideration.amount, 1 ether);
        vm.prank(STEWARD);
        assertEq(module.createCommitment(params), id);
    }

    function testCommitmentPoolingRequest_memberOfferConsiderationRemainsAllowed() public {
        Pooling.CreateCommitmentParams memory params = _baseParams(keccak256("member-offer"));
        params.consideration = _reward();
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        assertEq(module.getCommitment(id).consideration.amount, 1 ether);
    }

    function _request(string memory key) private view returns (Pooling.CreateCommitmentParams memory params) {
        params = _baseParams(keccak256(bytes(key)));
        params.direction = Pooling.CommitmentDirection.Request;
    }

    function _reward() private pure returns (Pooling.DeclaredConsideration memory) {
        return Pooling.DeclaredConsideration(
            Pooling.ConsiderationRail.ArbitrumExternal, address(0xF00D), address(0xDA1), 1 ether
        );
    }
}
