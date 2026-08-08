// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingTermsTest
/// @notice Pre-acceptance term edits and the Arbitrum-rail reward record for PRD-721.
contract CommitmentPoolingTermsTest is CommitmentPoolingFixture {
    address private constant POOL_STEWARD = address(0xA001);
    address private constant CONFIRMER_ONE = address(0xC0F1);
    address private constant CONFIRMER_TWO = address(0xC0F2);
    address private constant REWARD_SOURCE = address(0x5EED);
    address private constant REWARD_TOKEN = address(0x70CE);

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
    }

    // ─────────────────────────── Declared reward ───────────────────────────

    function testSetDeclaredRewardIsStewardOnlyAndPreAcceptanceOnly() public {
        uint256 commitmentId = _createOffer(keccak256("reward-gating"));

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CREATOR, poolId));
        vm.prank(CREATOR);
        module.setDeclaredReward(commitmentId, _arbitrumReward(500));

        vm.prank(POOL_STEWARD);
        module.setDeclaredReward(commitmentId, _arbitrumReward(500));
        assertEq(module.getCommitment(commitmentId).reward.amount, 500);

        _acceptOffer(commitmentId);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.Accepted
            )
        );
        vm.prank(POOL_STEWARD);
        module.setDeclaredReward(commitmentId, _arbitrumReward(900));
    }

    function testSetDeclaredRewardEnforcesRailBinding() public {
        uint256 commitmentId = _createOffer(keccak256("reward-rail"));

        // ArbitrumExternal without a source is not a payable reference.
        vm.expectRevert(ICommitmentPoolingModule.InvalidRewardConfiguration.selector);
        vm.prank(POOL_STEWARD);
        module.setDeclaredReward(
            commitmentId,
            ICommitmentPoolingModule.DeclaredReward({
                rail: ICommitmentPoolingModule.RewardRail.ArbitrumExternal,
                source: address(0),
                token: REWARD_TOKEN,
                amount: 500
            })
        );

        // CeloSettlement carries zero source/token sentinels; SettlementModule derives both.
        vm.prank(POOL_STEWARD);
        module.setDeclaredReward(
            commitmentId,
            ICommitmentPoolingModule.DeclaredReward({
                rail: ICommitmentPoolingModule.RewardRail.CeloSettlement,
                source: address(0),
                token: address(0),
                amount: 700
            })
        );
        assertEq(
            uint256(module.getCommitment(commitmentId).reward.rail),
            uint256(ICommitmentPoolingModule.RewardRail.CeloSettlement)
        );
    }

    // ─────────────────────────── Declared value ───────────────────────────

    function testSetDeclaredValueEnforcesThePairRule() public {
        uint256 commitmentId = _createOffer(keccak256("value-pair"));

        vm.expectRevert(ICommitmentPoolingModule.InvalidValueDeclaration.selector);
        vm.prank(POOL_STEWARD);
        module.setDeclaredValue(commitmentId, 12, "");

        vm.expectRevert(ICommitmentPoolingModule.InvalidValueDeclaration.selector);
        vm.prank(POOL_STEWARD);
        module.setDeclaredValue(commitmentId, 0, "G$");

        vm.expectEmit(true, false, false, true);
        emit ICommitmentPoolingModule.ValueDeclared(commitmentId, 12, "G$");
        vm.prank(POOL_STEWARD);
        module.setDeclaredValue(commitmentId, 12, "G$");

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.declaredUnitValue, 12);
        assertEq(commitment.declaredValueBasis, "G$");
    }

    // ─────────────────────────── Confirmer rule ───────────────────────────

    function testSetConfirmerRuleRewritesNamedGroupAndThreshold() public {
        uint256 commitmentId = _createOffer(keccak256("confirmer-rewrite"));
        address[] memory confirmers = new address[](2);
        confirmers[0] = CONFIRMER_ONE;
        confirmers[1] = CONFIRMER_TWO;

        vm.prank(POOL_STEWARD);
        module.setConfirmerRule(commitmentId, confirmers, 2, false);

        assertEq(module.getConfirmers(commitmentId).length, 2);
        assertEq(module.getCommitment(commitmentId).confirmationThreshold, 2);

        // Clearing the named group restores the direction-aware default at threshold 1.
        vm.prank(POOL_STEWARD);
        module.setConfirmerRule(commitmentId, new address[](0), 7, false);
        assertEq(module.getConfirmers(commitmentId).length, 0);
        assertEq(module.getCommitment(commitmentId).confirmationThreshold, 1);
    }

    function testSetConfirmerRuleRevalidatesReachabilityAfterTheRewrite() public {
        uint256 commitmentId = _createOffer(keccak256("confirmer-unreachable"));
        address[] memory confirmers = new address[](1);
        confirmers[0] = CONFIRMER_ONE;

        // One named confirmer can never satisfy a threshold of two.
        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ConfirmationThresholdUnreachable.selector, commitmentId)
        );
        vm.prank(POOL_STEWARD);
        module.setConfirmerRule(commitmentId, confirmers, 2, false);

        // The rejected rewrite left nothing behind.
        assertEq(module.getConfirmers(commitmentId).length, 0);
        assertEq(module.getCommitment(commitmentId).confirmationThreshold, 1);
    }

    function testSetConfirmerRuleProtocolFallbackNeedsARegisteredProtocolPool() public {
        uint256 commitmentId = _createOffer(keccak256("confirmer-fallback"));

        vm.expectRevert(ICommitmentPoolingModule.ModuleNotReady.selector);
        vm.prank(POOL_STEWARD);
        module.setConfirmerRule(commitmentId, new address[](0), 1, true);

        module.registerPool(ROOT_GARDEN, ICommitmentPoolingModule.PoolType.Protocol);

        vm.prank(POOL_STEWARD);
        module.setConfirmerRule(commitmentId, new address[](0), 1, true);
        assertTrue(module.getCommitment(commitmentId).protocolFallbackEnabled);
    }

    function testSetConfirmerRuleRejectsAZeroThresholdForANamedGroup() public {
        uint256 commitmentId = _createOffer(keccak256("confirmer-zero-threshold"));
        address[] memory confirmers = new address[](1);
        confirmers[0] = CONFIRMER_ONE;

        vm.expectRevert(ICommitmentPoolingModule.InvalidConfirmerRule.selector);
        vm.prank(POOL_STEWARD);
        module.setConfirmerRule(commitmentId, confirmers, 0, false);
    }

    // ──────────────────────────── Reward record ────────────────────────────

    function testRecordRewardPaidEmitsTheDerivedRecordExactlyOnce() public {
        uint256 commitmentId = _fulfilledCommitmentWithReward(keccak256("reward-record"), _arbitrumReward(1500));

        vm.expectEmit(true, true, true, true);
        emit ICommitmentPoolingModule.RewardPaid(
            commitmentId, REWARD_SOURCE, CREATOR, REWARD_TOKEN, 1500, keccak256("payout"), POOL_STEWARD
        );
        vm.prank(POOL_STEWARD);
        module.recordRewardPaid(commitmentId, keccak256("payout"));

        assertTrue(module.getCommitment(commitmentId).rewardPaid);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.RewardAlreadyRecorded.selector, commitmentId));
        vm.prank(POOL_STEWARD);
        module.recordRewardPaid(commitmentId, keccak256("payout-again"));
    }

    function testRecordRewardPaidIsStewardOnlyAndFulfilledOnly() public {
        uint256 commitmentId = _createOfferWithReward(keccak256("reward-state"), _arbitrumReward(1500));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.Offered
            )
        );
        vm.prank(POOL_STEWARD);
        module.recordRewardPaid(commitmentId, keccak256("payout"));

        _fulfill(commitmentId);
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CLAIMANT, poolId));
        vm.prank(CLAIMANT);
        module.recordRewardPaid(commitmentId, keccak256("payout"));
    }

    function testRecordRewardPaidRejectsTheCeloSettlementRail() public {
        uint256 commitmentId = _fulfilledCommitmentWithReward(
            keccak256("reward-celo"),
            ICommitmentPoolingModule.DeclaredReward({
                rail: ICommitmentPoolingModule.RewardRail.CeloSettlement,
                source: address(0),
                token: address(0),
                amount: 1500
            })
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.RewardRailMismatch.selector,
                commitmentId,
                ICommitmentPoolingModule.RewardRail.ArbitrumExternal,
                ICommitmentPoolingModule.RewardRail.CeloSettlement
            )
        );
        vm.prank(POOL_STEWARD);
        module.recordRewardPaid(commitmentId, keccak256("payout"));
    }

    function testRecordRewardPaidRejectsAnUndeclaredReward() public {
        uint256 commitmentId = _createOffer(keccak256("reward-undeclared"));
        _fulfill(commitmentId);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.RewardNotDeclared.selector, commitmentId));
        vm.prank(POOL_STEWARD);
        module.recordRewardPaid(commitmentId, keccak256("payout"));
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    function _arbitrumReward(uint256 amount) private pure returns (ICommitmentPoolingModule.DeclaredReward memory) {
        return ICommitmentPoolingModule.DeclaredReward({
            rail: ICommitmentPoolingModule.RewardRail.ArbitrumExternal,
            source: REWARD_SOURCE,
            token: REWARD_TOKEN,
            amount: amount
        });
    }

    function _createOfferWithReward(
        bytes32 creationKey,
        ICommitmentPoolingModule.DeclaredReward memory reward
    )
        private
        returns (uint256 commitmentId)
    {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.reward = reward;
        vm.prank(CREATOR);
        return module.createCommitment(params);
    }

    function _fulfilledCommitmentWithReward(
        bytes32 creationKey,
        ICommitmentPoolingModule.DeclaredReward memory reward
    )
        private
        returns (uint256 commitmentId)
    {
        commitmentId = _createOfferWithReward(creationKey, reward);
        _fulfill(commitmentId);
    }

    /// @dev Accept, credit, freeze, and confirm through the ordinary counterparty path.
    function _fulfill(uint256 commitmentId) private {
        _acceptOffer(commitmentId);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-terms-credit", credited);
        module.markReadyForConfirmation(commitmentId, "ready for reward coverage");
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
    }
}
