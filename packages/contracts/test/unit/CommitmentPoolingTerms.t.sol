// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingTermsTest
/// @notice Pre-acceptance term edits and the Arbitrum-rail consideration record for PRD-721.
contract CommitmentPoolingTermsTest is CommitmentPoolingFixture {
    address private constant POOL_STEWARD = address(0xA001);
    address private constant CONFIRMER_ONE = address(0xC0F1);
    address private constant CONFIRMER_TWO = address(0xC0F2);
    address private constant REWARD_SOURCE = address(0x5EED);
    address private constant REWARD_TOKEN = address(0x70CE);

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
        // Claiming a priced Offer commits the garden to pay for it, which is a steward's call, so
        // the priced tests below claim as the steward rather than as CLAIMANT. CLAIMANT stays a
        // plain member on purpose — the steward-only assertions here depend on it.
        hats.setGardener(POOL_GARDEN, POOL_STEWARD, true);
    }

    // ─────────────────────────── Declared consideration ───────────────────────────

    function testSetDeclaredConsiderationIsStewardOnlyAndPreAcceptanceOnly() public {
        uint256 commitmentId = _createOffer(keccak256("consideration-gating"));

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CREATOR, poolId));
        vm.prank(CREATOR);
        module.setDeclaredConsideration(commitmentId, _arbitrumConsideration(500));

        vm.prank(POOL_STEWARD);
        module.setDeclaredConsideration(commitmentId, _arbitrumConsideration(500));
        assertEq(module.getCommitment(commitmentId).consideration.amount, 500);

        // Priced now, so the claim is a steward's to make.
        vm.prank(POOL_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.Accepted
            )
        );
        vm.prank(POOL_STEWARD);
        module.setDeclaredConsideration(commitmentId, _arbitrumConsideration(900));
    }

    function testSetDeclaredConsiderationEnforcesRailBinding() public {
        uint256 commitmentId = _createOffer(keccak256("consideration-rail"));

        // ArbitrumExternal without a source is not a payable reference.
        vm.expectRevert(ICommitmentPoolingModule.InvalidConsiderationConfiguration.selector);
        vm.prank(POOL_STEWARD);
        module.setDeclaredConsideration(
            commitmentId,
            ICommitmentPoolingModule.DeclaredConsideration({
                rail: ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal,
                source: address(0),
                token: REWARD_TOKEN,
                amount: 500
            })
        );

        // CeloSettlement carries zero source/token sentinels; SettlementModule derives both.
        vm.prank(POOL_STEWARD);
        module.setDeclaredConsideration(
            commitmentId,
            ICommitmentPoolingModule.DeclaredConsideration({
                rail: ICommitmentPoolingModule.ConsiderationRail.CeloSettlement,
                source: address(0),
                token: address(0),
                amount: 700
            })
        );
        assertEq(
            uint256(module.getCommitment(commitmentId).consideration.rail),
            uint256(ICommitmentPoolingModule.ConsiderationRail.CeloSettlement)
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

    // ──────────────────────────── Consideration record ────────────────────────────

    function testRecordConsiderationPaidEmitsTheDerivedRecordExactlyOnce() public {
        uint256 commitmentId =
            _fulfilledCommitmentWithConsideration(keccak256("consideration-record"), _arbitrumConsideration(1500));

        vm.expectEmit(true, true, true, true);
        emit ICommitmentPoolingModule.ConsiderationPaid(
            commitmentId, REWARD_SOURCE, CREATOR, REWARD_TOKEN, 1500, keccak256("payout"), POOL_STEWARD
        );
        vm.prank(POOL_STEWARD);
        module.recordConsiderationPaid(commitmentId, keccak256("payout"));

        assertTrue(module.getCommitment(commitmentId).considerationPaid);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ConsiderationAlreadyRecorded.selector, commitmentId)
        );
        vm.prank(POOL_STEWARD);
        module.recordConsiderationPaid(commitmentId, keccak256("payout-again"));
    }

    function testRecordConsiderationPaidIsStewardOnlyAndFulfilledOnly() public {
        uint256 commitmentId = _createOfferWithConsideration(keccak256("consideration-state"), _arbitrumConsideration(1500));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.Offered
            )
        );
        vm.prank(POOL_STEWARD);
        module.recordConsiderationPaid(commitmentId, keccak256("payout"));

        _fulfillPriced(commitmentId);
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CLAIMANT, poolId));
        vm.prank(CLAIMANT);
        module.recordConsiderationPaid(commitmentId, keccak256("payout"));
    }

    function testRecordConsiderationPaidRejectsTheCeloSettlementRail() public {
        uint256 commitmentId = _fulfilledCommitmentWithConsideration(
            keccak256("consideration-celo"),
            ICommitmentPoolingModule.DeclaredConsideration({
                rail: ICommitmentPoolingModule.ConsiderationRail.CeloSettlement,
                source: address(0),
                token: address(0),
                amount: 1500
            })
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.ConsiderationRailMismatch.selector,
                commitmentId,
                ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal,
                ICommitmentPoolingModule.ConsiderationRail.CeloSettlement
            )
        );
        vm.prank(POOL_STEWARD);
        module.recordConsiderationPaid(commitmentId, keccak256("payout"));
    }

    /// @notice A member cannot commit their garden to pay for an Offer; a steward can.
    /// @dev The garden that claims a priced Offer becomes its payer, so claiming one is the garden
    ///      promising to pay. Before this rule any gardener could bind their garden to that
    ///      obligation and reserve the provider's capacity against it, with no steward involved.
    function testCommitmentPoolingTerms_pricedOfferIsClaimableOnlyByASteward() public {
        uint256 commitmentId = _createOfferWithConsideration(keccak256("priced-claim"), _arbitrumConsideration(500));

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.PricedOfferClaimRequiresSteward.selector, POOL_GARDEN, CLAIMANT)
        );
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        vm.prank(POOL_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        assertEq(uint8(module.getCommitment(commitmentId).state), uint8(ICommitmentPoolingModule.CommitmentState.Accepted));
    }

    /// @notice A free Offer stays claimable by any member — the gate is the price, not the shape.
    /// @dev Ordinary peer-to-peer mutual aid is the common pilot case and must not need a steward.
    function testCommitmentPoolingTerms_freeOfferStaysClaimableByAnyMember() public {
        uint256 commitmentId = _createOffer(keccak256("free-claim"));

        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        assertEq(uint8(module.getCommitment(commitmentId).state), uint8(ICommitmentPoolingModule.CommitmentState.Accepted));
    }

    function testRecordConsiderationPaidRejectsAnUndeclaredConsideration() public {
        uint256 commitmentId = _createOffer(keccak256("consideration-undeclared"));
        _fulfill(commitmentId);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ConsiderationNotDeclared.selector, commitmentId));
        vm.prank(POOL_STEWARD);
        module.recordConsiderationPaid(commitmentId, keccak256("payout"));
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    function _arbitrumConsideration(uint256 amount)
        private
        pure
        returns (ICommitmentPoolingModule.DeclaredConsideration memory)
    {
        return ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal,
            source: REWARD_SOURCE,
            token: REWARD_TOKEN,
            amount: amount
        });
    }

    function _createOfferWithConsideration(
        bytes32 creationKey,
        ICommitmentPoolingModule.DeclaredConsideration memory consideration
    )
        private
        returns (uint256 commitmentId)
    {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.consideration = consideration;
        vm.prank(CREATOR);
        return module.createCommitment(params);
    }

    function _fulfilledCommitmentWithConsideration(
        bytes32 creationKey,
        ICommitmentPoolingModule.DeclaredConsideration memory consideration
    )
        private
        returns (uint256 commitmentId)
    {
        commitmentId = _createOfferWithConsideration(creationKey, consideration);
        _fulfillPriced(commitmentId);
    }

    /// @dev The priced twin of `_fulfill`: a priced Offer may only be claimed by a steward of the
    ///      garden that will owe the consideration, so the steward is also the confirmer here.
    function _fulfillPriced(uint256 commitmentId) private {
        vm.prank(POOL_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-terms-credit", credited);
        module.markReadyForConfirmation(commitmentId, "ready for consideration coverage");
        vm.prank(POOL_STEWARD);
        module.confirmFulfillment(commitmentId);
    }

    /// @dev Accept, credit, freeze, and confirm through the ordinary counterparty path.
    function _fulfill(uint256 commitmentId) private {
        _acceptOffer(commitmentId);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-terms-credit", credited);
        module.markReadyForConfirmation(commitmentId, "ready for consideration coverage");
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
    }
}
