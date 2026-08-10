// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingPayerTest
/// @notice Proves `payerGarden` identifies the asking side rather than the delivering side
///         (register #90). `providerGarden` answers "who did the work"; `payerGarden` answers
///         "whose Safe owes the consideration", and settlement may only ever spend the latter.
/// @dev The two garden-internal cases must resolve both addresses to the same garden. That is the
///      regression guard for every existing single-garden pool: if these two drift apart, the
///      change stopped being backwards compatible.
contract CommitmentPoolingPayerTest is CommitmentPoolingFixture {
    address internal constant PROVIDER_MEMBER = address(0xD00D);
    address internal constant GARDEN_STEWARD = address(0xDEED);
    address internal constant ROOT_STEWARD = address(0xBEEF);
    address internal constant CONSIDERATION_SOURCE = address(0x5EED);
    address internal constant CONSIDERATION_TOKEN = address(0x70CE);

    uint256 internal protocolPoolId;

    function setUp() public {
        _setUpProductionFixture();

        // The protocol pool is the root garden's ordinary pool: the only pool whose asker and
        // doer are routinely different accounts, which is exactly what this suite exercises.
        hats.setGardener(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setGardener(ROOT_GARDEN, ROOT_STEWARD, true);
        hats.setOperator(ROOT_GARDEN, ROOT_STEWARD, true);
        protocolPoolId = module.registerPool(ROOT_GARDEN, ICommitmentPoolingModule.PoolType.Protocol);
        module.setProviderOpenCommitmentCap(protocolPoolId, 128);
        module.setPoolCharter(protocolPoolId, "bafy-protocol-charter");
        module.markPoolReady(protocolPoolId);
        module.openPool(protocolPoolId);

        hats.setGardener(POOL_GARDEN, PROVIDER_MEMBER, true);
        hats.setGardener(POOL_GARDEN, GARDEN_STEWARD, true);
        hats.setOperator(POOL_GARDEN, GARDEN_STEWARD, true);
    }

    // ═══════════════════ Garden-internal: unchanged behaviour ═══════════════════

    function testGardenOfferPaysFromTheSameGardenThatProvides() public {
        uint256 commitmentId = _createOffer(keccak256("payer-garden-offer"));
        _acceptOffer(commitmentId);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.providerGarden, POOL_GARDEN, "provider is the pool garden");
        assertEq(commitment.payerGarden, POOL_GARDEN, "single-garden pools keep payer == provider");
    }

    function testGardenRequestPaysFromTheSameGardenThatProvides() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("payer-garden-request"));
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.providerGarden, POOL_GARDEN, "provider is the claiming garden");
        assertEq(commitment.payerGarden, POOL_GARDEN, "single-garden pools keep payer == provider");
    }

    // ═══════════════════ Protocol pool: the two corrected flows ═══════════════════

    /// @notice "Run this event / complete this survey." The protocol asks, a garden delivers, and
    ///         the protocol Safe is what settlement spends — not the garden's own Safe.
    function testProtocolRequestPaysFromTheProtocolPoolNotTheDeliveringGarden() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("payer-protocol-request"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        // Payer is fixed at creation, before anyone has claimed: the ask is what commits the Safe.
        assertEq(module.getCommitment(commitmentId).payerGarden, ROOT_GARDEN, "a Request's payer is known at creation");

        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.providerGarden, POOL_GARDEN, "the claiming garden delivers");
        assertEq(commitment.payerGarden, ROOT_GARDEN, "acceptance must not move a Request's payer to the claimant");
        assertTrue(commitment.payerGarden != commitment.providerGarden, "the protocol pool separates asker from doer");
    }

    /// @notice "Technical support / onboarding session." The protocol delivers, a garden claims it,
    ///         and the claiming garden's Safe is what settlement spends.
    function testProtocolOfferPaysFromTheClaimingGardenNotTheProtocolPool() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("payer-protocol-offer"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        // Nobody owes anything until the Offer is taken up.
        assertEq(module.getCommitment(commitmentId).payerGarden, address(0), "an unclaimed Offer has no payer");

        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.providerGarden, ROOT_GARDEN, "the protocol pool delivers its own Offer");
        assertEq(commitment.payerGarden, POOL_GARDEN, "the garden that claimed the service is the payer");
        assertTrue(commitment.payerGarden != commitment.providerGarden, "the protocol pool separates asker from doer");
    }

    /// @notice Free is representable, and it is the default. A zero-amount consideration must not
    ///         imply an unpayable commitment or a missing payer.
    function testAnUnpricedProtocolOfferStillRecordsItsPayer() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("payer-protocol-free"));
        params.poolId = protocolPoolId;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.consideration.amount, 0, "the fixture default is free");
        assertEq(commitment.payerGarden, POOL_GARDEN, "a free commitment still names who would pay");
    }

    /// @notice A free approval-gated Offer still requires the claimant to be a current member.
    function testCommitmentPoolingPayer_approvalGatedFreeOfferRechecksClaimantMembership() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256("payer-protocol-free-pending"));
        params.poolId = protocolPoolId;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        hats.setGardener(POOL_GARDEN, PROVIDER_MEMBER, false);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotEligibleClaimant.selector, PROVIDER_MEMBER));
        vm.prank(CREATOR);
        module.acceptClaim(commitmentId, PROVIDER_MEMBER);
    }

    /// @notice A priced Individual claim must still have a steward when approval binds the payer.
    function testCommitmentPoolingPayer_approvalGatedPricedOfferRechecksIndividualStewardship() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256("payer-protocol-priced-individual-pending"));
        params.poolId = protocolPoolId;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        params.consideration = _arbitrum(500);
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(GARDEN_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        hats.setOperator(POOL_GARDEN, GARDEN_STEWARD, false);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.PricedOfferClaimRequiresSteward.selector, POOL_GARDEN, GARDEN_STEWARD
            )
        );
        vm.prank(CREATOR);
        module.acceptClaim(commitmentId, GARDEN_STEWARD);
    }

    /// @notice A Garden claim rechecks the human steward rather than the GardenAccount claimant.
    function testCommitmentPoolingPayer_approvalGatedPricedOfferRechecksGardenClaimStewardship() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256("payer-protocol-priced-garden-pending"));
        params.poolId = protocolPoolId;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        params.consideration = _arbitrum(500);
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(GARDEN_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);
        hats.setOperator(POOL_GARDEN, GARDEN_STEWARD, false);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotEligibleClaimant.selector, GARDEN_STEWARD));
        vm.prank(CREATOR);
        module.acceptClaim(commitmentId, POOL_GARDEN);
    }

    /// @notice The payer is a settlement fact, so it must be final once acceptance stores it.
    function testAcceptedPayerIsImmutableAcrossLaterTermEdits() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("payer-immutable"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        address payerAtAcceptance = module.getCommitment(commitmentId).payerGarden;
        _setMember(address(0xFEED));
        vm.prank(PROVIDER_MEMBER);
        module.addContributor(commitmentId, address(0xFEED));

        assertEq(module.getCommitment(commitmentId).payerGarden, payerAtAcceptance, "roster edits never move the payer");
    }

    // ═══════════════ Recipient derivation (settlement boundary) ═══════════════
    //
    // The recipient rule lives in SettlementModule, which does not exist yet, so these cannot test
    // its behaviour. What they do test is the half that exists and that the rule depends on: that
    // the pooling module records enough — and unambiguously enough — to derive the recipient, and
    // what that derivation yields in each case. `_paysTheClaimingGardenSafe` is the specified
    // predicate from settlement-spec.md verbatim (register #91), so when the settlement lane
    // dispatches it has a fixed target rather than a prose paragraph.

    /// @dev Request + Garden claim pays exactly one recipient, the claiming garden's Safe.
    ///      Everything else fans out to the frozen contributor roster.
    function _paysTheClaimingGardenSafe(uint256 commitmentId) private view returns (bool) {
        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        return commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request
            && commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden;
    }

    /// @notice The case the rule exists for. Without it, a garden-scoped Request would fan out to
    ///         the contributor roster — and the roster holds the steward who claimed, not the
    ///         garden. Green Goods would be paying a person for work the garden took on.
    function testGardenClaimedProtocolRequestPaysTheGardenAndNotTheStewardWhoClaimed() public {
        uint256 commitmentId = _protocolRequestClaimedByGarden(keccak256("recipient-garden-request"));
        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);

        assertTrue(_paysTheClaimingGardenSafe(commitmentId), "a garden-claimed Request pays the garden Safe");
        assertEq(
            uint256(commitment.counterpartyKind),
            uint256(ICommitmentPoolingModule.ClaimType.Garden),
            "the claim is recorded as institutional"
        );
        // The recipient is resolvable and is the GardenAccount, never the human who operated it.
        assertEq(commitment.counterparty, POOL_GARDEN, "counterparty is the GardenAccount");
        assertEq(commitment.providerGarden, POOL_GARDEN, "provider is the claiming garden");
        assertEq(commitment.payerGarden, ROOT_GARDEN, "the protocol asked, so the protocol pays");

        // This is why the special case is necessary rather than cosmetic: the garden itself is not
        // on the roster, and the person who claimed for it is.
        assertEq(commitment.leadProvider, GARDEN_STEWARD, "the lead is the steward who claimed");
        assertTrue(module.getContributor(commitmentId, GARDEN_STEWARD).active, "the steward is a contributor");
        assertFalse(
            module.getContributor(commitmentId, POOL_GARDEN).active,
            "the garden is never a contributor, so a contributor fan-out would miss it entirely"
        );
    }

    function testIndividualClaimedProtocolRequestPaysContributorsNotAGardenSafe() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256("recipient-individual-request"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);

        assertFalse(_paysTheClaimingGardenSafe(commitmentId), "an individual Request pays contributors");
        assertTrue(module.getContributor(commitmentId, PROVIDER_MEMBER).active, "the gardener is the contributor");
        assertEq(module.getCommitment(commitmentId).payerGarden, ROOT_GARDEN, "the protocol still pays");
    }

    /// @notice An Offer's claimant is the payer, so paying them would be a self-transfer. The
    ///         roster makes that structurally impossible, which is what the rule relies on.
    function testGardenClaimedProtocolOfferNeverPaysItsOwnClaimant() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("recipient-garden-offer"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        vm.prank(GARDEN_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertFalse(_paysTheClaimingGardenSafe(commitmentId), "an Offer always pays contributors");
        assertEq(commitment.payerGarden, POOL_GARDEN, "the claiming garden pays for the service");
        assertEq(commitment.providerGarden, ROOT_GARDEN, "the protocol delivered it");
        assertEq(commitment.leadProvider, CREATOR, "the Offer creator leads delivery");
        assertFalse(
            module.getContributor(commitmentId, POOL_GARDEN).active,
            "the paying garden is not a contributor, so it can never receive its own payment"
        );
    }

    function testGardenInternalCommitmentPaysContributorsFromItsOwnSafe() public {
        uint256 commitmentId = _createOffer(keccak256("recipient-garden-internal"));
        _acceptOffer(commitmentId);
        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);

        assertFalse(_paysTheClaimingGardenSafe(commitmentId), "garden-internal commitments pay contributors");
        assertEq(commitment.payerGarden, commitment.providerGarden, "one garden is both payer and provider");
        assertTrue(module.getContributor(commitmentId, CREATOR).active, "the provider is the contributor");
    }

    /// @notice The rule assumed Garden claims were protocol-only. They were not: a garden pool's
    ///         claim branch never inspected `kind`, so any member could make one and the claimant
    ///         resolved to the pool's own garden — collapsing payer, provider, and recipient onto
    ///         one account and ordering a Safe-to-itself transfer. Creation now refuses it.
    function testGardenPoolRefusesAGardenClaimTypeAtCreation() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("garden-claim-refused"));
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.GardenClaimRequiresProtocolPool.selector, poolId));
        vm.prank(CREATOR);
        module.createCommitment(params);
    }

    /// @notice Protocol-pool reach is cross-garden. Letting the protocol garden claim its own
    ///         institutional Request would derive ROOT_GARDEN as payer, provider, and beneficiary,
    ///         ordering a meaningless Safe-to-itself transfer.
    function testProtocolGardenCannotClaimItsOwnGardenRequest() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("protocol-self-garden-claim"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.GardenClaimMustBeExternal.selector, protocolPoolId, ROOT_GARDEN)
        );
        vm.prank(ROOT_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, ROOT_GARDEN);
    }

    /// @notice The same guard runs before an approval-gated request can enter pending state, so a
    ///         steward cannot queue the invalid shape and ask a different operator to accept it.
    function testProtocolGardenCannotRequestApprovalForItsOwnGardenClaim() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256("protocol-self-garden-pending"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.GardenClaimMustBeExternal.selector, protocolPoolId, ROOT_GARDEN)
        );
        vm.prank(ROOT_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, ROOT_GARDEN);

        assertFalse(module.getPendingClaim(commitmentId, ROOT_GARDEN).active, "invalid claim is never persisted");
    }

    /// @notice Carried all the way to Fulfilled, because that is the state settlement reads. The
    ///         frozen eligible set is what a contributor fan-out would pay, and it contains the
    ///         steward and not the garden — so the recipient rule is load-bearing at exactly the
    ///         point the payout plan is built, not merely at acceptance.
    function testFulfilledGardenClaimedRequestFreezesAnEligibleSetWithoutTheGarden() public {
        uint256 commitmentId = _fulfilledGardenClaimedRequest(keccak256("recipient-frozen-set"));
        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);

        assertEq(
            uint256(commitment.state),
            uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled),
            "settlement only ever reads a Fulfilled commitment"
        );
        assertTrue(commitment.contributorsFrozen, "the roster is frozen");
        assertEq(commitment.eligibleContributorCount, 1, "exactly one eligible contributor");

        ICommitmentPoolingModule.ContributorRecord memory steward = module.getContributor(commitmentId, GARDEN_STEWARD);
        assertTrue(steward.active && steward.evidenceCredits != 0, "the steward is in the frozen eligible set");
        assertFalse(
            module.getContributor(commitmentId, POOL_GARDEN).active,
            "the garden that earned it is absent from the set a contributor fan-out would pay"
        );
        assertTrue(_paysTheClaimingGardenSafe(commitmentId), "so the recipient rule must redirect to the garden Safe");
    }

    /// @notice The Arbitrum rail is a durable public record, so it must not name the steward as the
    ///         party paid for institutional work either.
    function testArbitrumRecordNamesTheGardenNotTheStewardForAGardenClaimedRequest() public {
        uint256 commitmentId = _fulfilledGardenClaimedRequest(keccak256("recipient-arbitrum-record"));

        vm.expectEmit(true, true, true, true);
        emit ICommitmentPoolingModule.ConsiderationPaid(
            commitmentId, CONSIDERATION_SOURCE, POOL_GARDEN, CONSIDERATION_TOKEN, 500, keccak256("ref"), CREATOR
        );
        vm.prank(CREATOR);
        module.recordConsiderationPaid(commitmentId, keccak256("ref"));
    }

    function testArbitrumRecordStillNamesTheLeadForAnIndividualClaim() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _baseParams(keccak256("recipient-arbitrum-individual"));
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.consideration = _arbitrum(500);
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        vm.prank(PROVIDER_MEMBER);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        _creditAndFulfil(commitmentId, PROVIDER_MEMBER, PROVIDER_MEMBER);

        // The gardener claimed it personally, so the gardener is who was paid.
        vm.expectEmit(true, true, true, true);
        emit ICommitmentPoolingModule.ConsiderationPaid(
            commitmentId, CONSIDERATION_SOURCE, PROVIDER_MEMBER, CONSIDERATION_TOKEN, 500, keccak256("ref2"), CREATOR
        );
        vm.prank(CREATOR);
        module.recordConsiderationPaid(commitmentId, keccak256("ref2"));
    }

    function _fulfilledGardenClaimedRequest(bytes32 key) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(key);
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        params.consideration = _arbitrum(500);
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        vm.prank(GARDEN_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);
        _creditAndFulfil(commitmentId, GARDEN_STEWARD, GARDEN_STEWARD);
    }

    /// @dev Credit, freeze, and confirm through the protocol steward override and the Request's
    ///      default confirmer, who is its creator and never a contributor.
    function _creditAndFulfil(uint256 commitmentId, address evidenceCaller, address credited) private {
        address[] memory rows = new address[](1);
        rows[0] = credited;
        vm.prank(evidenceCaller);
        module.attachEvidence(commitmentId, "bafy-recipient-credit", rows);
        vm.prank(CREATOR);
        module.markReadyForConfirmation(commitmentId, "ready for recipient coverage");
        vm.prank(CREATOR);
        module.confirmFulfillment(commitmentId);
    }

    function _arbitrum(uint256 amount) private pure returns (ICommitmentPoolingModule.DeclaredConsideration memory) {
        return ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal,
            source: CONSIDERATION_SOURCE,
            token: CONSIDERATION_TOKEN,
            amount: amount
        });
    }

    function _protocolRequestClaimedByGarden(bytes32 key) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(key);
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        vm.prank(GARDEN_STEWARD);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);
    }
}
