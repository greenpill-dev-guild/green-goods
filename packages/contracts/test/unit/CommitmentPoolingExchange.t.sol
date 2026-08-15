// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingExchangeTest
/// @notice Atomic bilateral Offer x Offer acceptance for PRD-721.
contract CommitmentPoolingExchangeTest is CommitmentPoolingFixture {
    address private constant OUTSIDER = address(0xC001);
    address private constant POOL_STEWARD = address(0xA001);

    function setUp() public {
        _setUpProductionFixture();
        _setMember(OUTSIDER);
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
    }

    function testAcceptExchangeAcceptsBothSidesAtomically() public {
        (uint256 idA, uint256 idB) = _offerPair(keccak256("exchange-happy"));

        vm.expectEmit(true, true, true, true);
        emit ICommitmentPoolingModule.ExchangeAccepted(idA, idB, poolId, CLAIMANT, CREATOR);
        vm.prank(CREATOR);
        module.acceptExchange(idB);

        ICommitmentPoolingModule.Commitment memory offerA = module.getCommitment(idA);
        ICommitmentPoolingModule.Commitment memory offerB = module.getCommitment(idB);
        assertEq(uint256(offerA.state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));
        assertEq(uint256(offerB.state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));

        // Each creator stays the lead provider of their own Offer and becomes the other's claimant.
        assertEq(offerA.leadProvider, CREATOR);
        assertEq(offerA.counterparty, CLAIMANT);
        assertEq(offerB.leadProvider, CLAIMANT);
        assertEq(offerB.counterparty, CREATOR);
        assertTrue(module.isContributor(idA, CREATOR));
        assertTrue(module.isContributor(idB, CLAIMANT));
    }

    function testAcceptExchangeMakesNoSecondRegistryCommit() public {
        (uint256 idA, uint256 idB) = _offerPair(keccak256("exchange-registry"));
        uint256 creatorSlots = registry.openCommitmentCountOf(poolId, CREATOR);
        uint256 claimantSlots = registry.openCommitmentCountOf(poolId, CLAIMANT);
        assertEq(registry.committedOf(CREATOR, idA), 1);
        assertEq(registry.committedOf(CLAIMANT, idB), 1);

        vm.prank(CREATOR);
        module.acceptExchange(idB);

        // Both Offers reserved their provider slot at creation; acceptance reserves nothing more.
        assertEq(registry.openCommitmentCountOf(poolId, CREATOR), creatorSlots);
        assertEq(registry.openCommitmentCountOf(poolId, CLAIMANT), claimantSlots);
        assertEq(registry.committedOf(CREATOR, idA), 1);
        assertEq(registry.committedOf(CLAIMANT, idB), 1);
    }

    function testAcceptExchangeIgnoresTheProviderCapThatAlreadyReservedBothSlots() public {
        (uint256 idA, uint256 idB) = _offerPair(keccak256("exchange-cap"));
        // A later cap reduction constrains new reservations only; it cannot strand a live Offer.
        module.setProviderOpenCommitmentCap(poolId, 1);

        vm.prank(CREATOR);
        module.acceptExchange(idB);

        assertEq(uint256(module.getCommitment(idB).state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));
    }

    function testAcceptExchangeIsCallableOnlyByTheCreatorOfA() public {
        (, uint256 idB) = _offerPair(keccak256("exchange-caller"));

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnauthorizedCaller.selector, CLAIMANT));
        vm.prank(CLAIMANT);
        module.acceptExchange(idB);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnauthorizedCaller.selector, OUTSIDER));
        vm.prank(OUTSIDER);
        module.acceptExchange(idB);
    }

    function testAcceptExchangeRequiresANonZeroCounterpart() public {
        uint256 lone = _createOffer(keccak256("exchange-lonely"));

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ExchangeCounterpartMismatch.selector, lone));
        vm.prank(CREATOR);
        module.acceptExchange(lone);
    }

    function testAcceptExchangeRejectsANonOfferDirectionOnEitherSide() public {
        uint256 idA = _createOffer(keccak256("exchange-direction-a"));
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("exchange-direction-b"));
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.counterCommitmentId = idA;
        vm.prank(CLAIMANT);
        uint256 idB = module.createCommitment(params);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.ExchangeDirectionInvalid.selector,
                idA,
                idB,
                ICommitmentPoolingModule.CommitmentDirection.Offer,
                ICommitmentPoolingModule.CommitmentDirection.Request
            )
        );
        vm.prank(CREATOR);
        module.acceptExchange(idB);
    }

    function testAcceptExchangeRejectsACounterpartThatLeftOffered() public {
        (uint256 idA, uint256 idB) = _offerPair(keccak256("exchange-lapsed-a"));
        vm.prank(CREATOR);
        module.cancelCommitment(idA, "");

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.ExchangeStateInvalid.selector,
                idA,
                ICommitmentPoolingModule.CommitmentState.Cancelled
            )
        );
        vm.prank(CREATOR);
        module.acceptExchange(idB);
    }

    function testAcceptExchangeRejectsAnExchangeOfferThatLeftOffered() public {
        (, uint256 idB) = _offerPair(keccak256("exchange-lapsed-b"));
        vm.prank(CLAIMANT);
        module.cancelCommitment(idB, "");

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.ExchangeStateInvalid.selector,
                idB,
                ICommitmentPoolingModule.CommitmentState.Cancelled
            )
        );
        vm.prank(CREATOR);
        module.acceptExchange(idB);
    }

    function testAcceptExchangeRejectsACreatorWhoLostGardenMembership() public {
        (, uint256 idB) = _offerPair(keccak256("exchange-membership"));
        hats.setGardener(POOL_GARDEN, CLAIMANT, false);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotEligibleContributor.selector, CLAIMANT));
        vm.prank(CREATOR);
        module.acceptExchange(idB);
    }

    function testAcceptExchangeAcceptsACycleScopedPair() public {
        uint256 cycleId = _openCycle();
        (uint256 idA, uint256 idB) = _offerPairInCycle(keccak256("exchange-cycle"), cycleId);

        vm.prank(CREATOR);
        module.acceptExchange(idB);

        assertEq(uint256(module.getCommitment(idA).state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));
        assertEq(uint256(module.getCommitment(idB).state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));
    }

    /// @dev Steward-captured consent is refused at B's creation, which is the reachable boundary;
    ///      acceptExchange repeats the same guard before mutating either side.
    function testStewardCapturedCreationCannotNameAnExchangeCounterpart() public {
        uint256 idA = _createOffer(keccak256("exchange-captured-a"));
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("exchange-captured-b"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.StewardCaptured;
        params.onBehalfOf = CLAIMANT;
        params.counterCommitmentId = idA;

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ExchangeCreatorConsentRequired.selector, idA));
        module.createCommitment(params);
    }

    function testAcceptExchangeLeavesLaterLifecyclesIndependent() public {
        (uint256 idA, uint256 idB) = _offerPair(keccak256("exchange-independent"));
        vm.prank(CREATOR);
        module.acceptExchange(idB);

        module.cancelCommitment(idA, "one side winds down alone");

        assertEq(uint256(module.getCommitment(idA).state), uint256(ICommitmentPoolingModule.CommitmentState.Cancelled));
        assertEq(uint256(module.getCommitment(idB).state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted));
    }

    // ───────────────────────────── Helpers
    // ─────────────────────────────

    /// @notice A priced side must be rejected before either Offer mutates. `acceptExchange` derives
    ///         one `gardenContext` from the pool and hands it to both acceptances, so a payable
    ///         exchange would record that single garden as payer for a trade between two people —
    ///         and in the protocol pool that garden is the protocol Safe (register #90).
    function testAcceptExchangeRejectsAPricedOfferOnEitherSide() public {
        uint256 idA = _createOffer(keccak256("exchange-priced-a"));
        vm.prank(POOL_STEWARD);
        module.setDeclaredConsideration(idA, _pricedConsideration(500));
        uint256 idB = _createExchangeOffer(keccak256("exchange-priced-b"), idA, 0);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ExchangeConsiderationUnsupported.selector, idA, 500)
        );
        vm.prank(CREATOR);
        module.acceptExchange(idB);

        // Nothing moved: both sides stay Offered and unclaimed.
        assertEq(uint256(module.getCommitment(idA).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered));
        assertEq(uint256(module.getCommitment(idB).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered));
        assertEq(module.getCommitment(idA).payerGarden, address(0), "a rejected exchange records no payer");
        assertEq(module.getCommitment(idB).payerGarden, address(0), "a rejected exchange records no payer");
    }

    function testAcceptExchangeRejectsAPricedCounterpartOffer() public {
        uint256 idA = _createOffer(keccak256("exchange-priced-b-a"));
        uint256 idB = _createExchangeOffer(keccak256("exchange-priced-b-b"), idA, 0);
        vm.prank(POOL_STEWARD);
        module.setDeclaredConsideration(idB, _pricedConsideration(700));

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ExchangeConsiderationUnsupported.selector, idB, 700)
        );
        vm.prank(CREATOR);
        module.acceptExchange(idB);
    }

    /// @notice Free exchange still records a payer on both sides — the pool garden, which for a
    ///         garden pool is also the provider garden. This pins the barter case explicitly.
    function testFreeExchangeRecordsThePoolGardenAsPayerOnBothSides() public {
        (uint256 idA, uint256 idB) = _offerPair(keccak256("exchange-free-payer"));
        vm.prank(CREATOR);
        module.acceptExchange(idB);

        ICommitmentPoolingModule.Commitment memory offerA = module.getCommitment(idA);
        ICommitmentPoolingModule.Commitment memory offerB = module.getCommitment(idB);
        assertEq(offerA.payerGarden, POOL_GARDEN, "barter payer is the pool garden");
        assertEq(offerB.payerGarden, POOL_GARDEN, "barter payer is the pool garden");
        assertEq(offerA.payerGarden, offerA.providerGarden, "garden pool keeps payer == provider");
        assertEq(offerB.payerGarden, offerB.providerGarden, "garden pool keeps payer == provider");
        assertEq(offerA.consideration.amount, 0, "exchange is barter");
    }

    function _pricedConsideration(uint256 amount)
        private
        pure
        returns (ICommitmentPoolingModule.DeclaredConsideration memory)
    {
        return ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal,
            source: address(0xF00D),
            token: address(0xBEE5),
            amount: amount
        });
    }

    function _offerPair(bytes32 seed) private returns (uint256 idA, uint256 idB) {
        idA = _createOffer(keccak256(abi.encode(seed, "a")));
        idB = _createExchangeOffer(keccak256(abi.encode(seed, "b")), idA, 0);
    }

    function _offerPairInCycle(bytes32 seed, uint256 cycleId) private returns (uint256 idA, uint256 idB) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256(abi.encode(seed, "a")));
        params.cycleId = cycleId;
        vm.prank(CREATOR);
        idA = module.createCommitment(params);
        idB = _createExchangeOffer(keccak256(abi.encode(seed, "b")), idA, cycleId);
    }

    function _createExchangeOffer(
        bytes32 creationKey,
        uint256 counterCommitmentId,
        uint256 cycleId
    )
        private
        returns (uint256 commitmentId)
    {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.counterCommitmentId = counterCommitmentId;
        params.cycleId = cycleId;
        vm.prank(CLAIMANT);
        return module.createCommitment(params);
    }

    function _openCycle() private returns (uint256 cycleId) {
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
                gardeners: 6000, treasury: 1500, operator: 1000, evaluator: 500, community: 500, funder: 500
            }),
            ICommitmentPoolingModule.RecognitionPolicy({ equalParticipationBps: 2000, verifiedContributionBps: 8000 })
        );
    }
}
