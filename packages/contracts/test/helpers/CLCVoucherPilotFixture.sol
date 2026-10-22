// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { ICLCSwapPool } from "../../src/interfaces/ICLCSwapPool.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { CLCPurchaseFixture } from "./CLCPurchaseFixture.sol";
import { CommitmentPoolingFixture } from "./CommitmentPoolingFixture.sol";
import { VoucherRedemptionRouter } from "./VoucherRedemptionFixture.sol";

/// @dev Real pinned CLC tokens/pool and actual core/source/escrow. Transport, Hats, Safe signers,
///      service delivery and all terms are fictional local stand-ins. One EVM switches chain IDs;
///      this proves neither DON finality, an Arbitrum deployment nor actual member signing.
abstract contract CLCVoucherPilotFixture is CLCPurchaseFixture, CommitmentPoolingFixture {
    uint64 internal constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant GNOSIS_SELECTOR = 465_200_170_687_744_372;
    uint256 internal constant SERVICE_VOUCHERS = 1_000_000;
    uint256 internal constant SERVICE_MINUTES = 60;
    uint256 internal constant EXCHANGE_INPUT = 2_044_986;
    uint256 internal constant EXCHANGE_GROSS = 1_022_493;
    uint256 internal constant EXCHANGE_POOL_FEE = 20_449;
    uint256 internal constant EXCHANGE_PROTOCOL_FEE = 2044;
    bytes32 internal constant SERVICE_TERMS = keccak256(
        "FICTIONAL full access: one booked 60-minute session; use within 30 days; mutually agreed booking; "
        "activation requires accepted agreement and escrow, not evidence of delivery"
    );
    bytes32 internal constant REMEDY_TERMS = keccak256(
        "FICTIONAL holder approves final delivered minutes and exact voucher split; issuer agrees refundable units; "
        "undelivered minutes returned only under mutual remedy; timeout alone decides neither delivery nor refund"
    );

    struct EconomicState {
        uint256 holderA;
        uint256 holderB;
        uint256 poolA;
        uint256 poolB;
        uint256 protocolB;
        uint256 accruedB;
        uint256 allowanceA;
        uint256 supplyA;
        uint256 supplyB;
    }

    ICLCGiftableToken internal voucherA;
    address internal issuerA;
    address internal buyerGarden;
    address internal guardian;
    Services internal services;
    VoucherRedemptionModule internal source;
    GnosisVoucherEscrow internal escrow;
    VoucherRedemptionRouter internal sourceRouter;
    VoucherRedemptionRouter internal destinationRouter;
    uint256 internal serviceId;
    bytes32 internal claimHash;
    bytes32 internal setupId;
    bytes32 internal authorizationHash;

    function _setUpPilot() internal {
        _selectGnosisForkAndCheckImplementations();
        _initializePurchaseFixture();
        issuerA = makeAddr("fictional-distinct-voucher-A-issuer-Safe-stand-in");
        voucherA = ICLCGiftableToken(
            ICLCERC1967Factory(CLC_FACTORY)
                .deployAndCall(
                    GIFTABLE_IMPLEMENTATION,
                    address(_timelockForIssuerA()),
                    abi.encodeCall(
                        ICLCGiftableToken.initialize,
                        ("Fictional issuer A service voucher", "PILOTA", uint8(6), issuerA, uint256(0))
                    )
                )
        );
        vm.startPrank(_communitySafeStandIn);
        _primary.index.register(address(voucherA));
        _primary.limiter.setLimitFor(address(voucherA), address(_primary.pool), 1000e6);
        _primary.quoter.setPriceIndexValue(address(voucherA), 1_000_000);
        vm.stopPrank();
        vm.prank(issuerA);
        voucherA.mintTo(_learner, EXCHANGE_INPUT);
        _setUpActualService();
        vm.chainId(100);
    }

    function _timelockForIssuerA() private returns (TimelockController) {
        address[] memory governors = new address[](1);
        governors[0] = issuerA;
        return new TimelockController(48 hours, governors, governors, address(0));
    }

    function _setUpActualService() private {
        vm.chainId(42_161);
        _setUpProductionFixture();
        buyerGarden = makeAddr("fictional-pilot-buyer-garden");
        guardian = makeAddr("fictional-pilot-emergency-pause-guardian");
        module.registerPool(buyerGarden, Core.PoolType.Garden);
        hats.setGardener(buyerGarden, _learner, true);
        hats.setOperator(POOL_GARDEN, CREATOR, true);
        services = Services(address(module));
        sourceRouter = new VoucherRedemptionRouter();
        destinationRouter = new VoucherRedemptionRouter();
        source = VoucherRedemptionModule(
            payable(address(new ERC1967Proxy(address(new VoucherRedemptionModule(address(sourceRouter))), "")))
        );
        vm.chainId(100);
        escrow = GnosisVoucherEscrow(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherEscrow(address(destinationRouter))),
                        abi.encodeCall(
                            GnosisVoucherEscrow.initialize,
                            (_communitySafeStandIn, guardian, ARBITRUM_SELECTOR, uint256(42_161), address(source))
                        )
                    )
                ))
        );
        vm.prank(_communitySafeStandIn);
        escrow.unpause();
        vm.chainId(42_161);
        source.initialize(_communitySafeStandIn, guardian, GNOSIS_SELECTOR, 100, address(escrow), address(module));
        vm.prank(_communitySafeStandIn);
        source.unpause();
        module.setPaused(true);
        Acceptance(address(module)).pinVoucherServiceSetupModule(address(source));
        module.setPaused(false);
    }

    function _exchange(uint256 minimum, uint256 deadline) internal returns (uint256) {
        vm.prank(_learner);
        return ICLCSwapPool(address(_primary.pool))
            .withdraw(address(_voucher), address(voucherA), EXCHANGE_INPUT, _learner, minimum, deadline);
    }

    function _approveExchange(uint256 amount) internal {
        vm.prank(_learner);
        voucherA.approve(address(_primary.pool), amount);
    }

    function _state() internal view returns (EconomicState memory state) {
        state = EconomicState(
            voucherA.balanceOf(_learner),
            _voucher.balanceOf(_learner),
            voucherA.balanceOf(address(_primary.pool)),
            _voucher.balanceOf(address(_primary.pool)),
            _voucher.balanceOf(_protocolFeeRecipient),
            _primary.pool.fees(address(_voucher)),
            voucherA.allowance(_learner, address(_primary.pool)),
            voucherA.totalSupply(),
            _voucher.totalSupply()
        );
    }

    function _assertSameState(EconomicState memory beforeState) internal {
        assertEq(keccak256(abi.encode(_state())), keccak256(abi.encode(beforeState)), "failed exchange changed economics");
    }

    function _heldCorrectVoucher() internal {
        vm.prank(_communitySafeStandIn);
        _primary.pool.withdrawLiquidity(address(_voucher), _issuerSafeStandIn, SERVICE_VOUCHERS);
        vm.prank(_issuerSafeStandIn);
        _voucher.transfer(_learner, SERVICE_VOUCHERS);
    }

    function _earnCorrectVoucher() internal returns (bytes32 entitlement) {
        // Explicit fictional inventory preparation. Accepted rewards do not reserve these funds;
        // the community may withdraw pool liquidity and only the issuer grants adapter allowance.
        vm.prank(_communitySafeStandIn);
        _primary.pool.withdrawLiquidity(address(_voucher), _issuerSafeStandIn, SERVICE_VOUCHERS);
        vm.chainId(42_161);
        (VoucherEntitlementModule earned, GnosisVoucherAdapter adapter) = _deployEarnedEndpoints();
        hats.setGardener(POOL_GARDEN, _learner, true);
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("fictional-individual-earns-full-session"));
        params.direction = Core.CommitmentDirection.Request;
        params.unitLabel = "reviewed accessibility note";
        params.metadataCID = "fictional-request: contribute-one-reviewed-accessibility-note; evidence-and-steward-review";
        vm.prank(CREATOR);
        uint256 requestId = module.createCommitment(params);
        bytes32 recognitionPolicy = earned.RECOGNITION_POLICY();
        vm.prank(CREATOR);
        earned.registerTerms(
            requestId,
            VoucherEntitlementModule.TermsInput(
                _issuerSafeStandIn,
                _issuerSafeStandIn,
                address(_voucher),
                SERVICE_VOUCHERS,
                recognitionPolicy,
                SERVICE_TERMS,
                0
            )
        );
        vm.prank(_issuerSafeStandIn);
        earned.approveTerms(requestId, 1);
        vm.prank(CREATOR);
        earned.consentTerms(requestId, 1);
        vm.startPrank(_learner);
        earned.consentTerms(requestId, 1);
        module.claimCommitment(requestId, Core.ClaimType.Individual, POOL_GARDEN);
        address[] memory contributors = new address[](1);
        contributors[0] = _learner;
        module.attachEvidence(requestId, "fictional-reviewed-accessibility-note-evidence", contributors);
        vm.stopPrank();
        vm.prank(CREATOR);
        module.markReadyForConfirmation(requestId, "fictional evidence ready for request creator review");
        vm.prank(CREATOR);
        module.confirmFulfillment(requestId);
        Core.RecognitionEntry[] memory entries = new Core.RecognitionEntry[](1);
        entries[0] = Core.RecognitionEntry(_learner, 10_000);
        vm.prank(CREATOR);
        entitlement =
            earned.prepareDistribution(requestId, entries, keccak256(abi.encode(block.chainid, requestId, entries)));
        vm.chainId(100);
        vm.prank(_issuerSafeStandIn);
        _voucher.approve(address(adapter), SERVICE_VOUCHERS);
        vm.chainId(42_161);
        vm.prank(CREATOR);
        bytes32 messageId = earned.dispatch(entitlement);
        vm.chainId(100);
        destinationRouter.deliver(
            address(adapter), _message(messageId, ARBITRUM_SELECTOR, address(earned), sourceRouter.lastData())
        );
        assertTrue(adapter.getExecutionResult(entitlement).success);
        assertFalse(_voucher.isWriter(address(adapter)));
        assertFalse(_voucher.isWriter(address(earned)));
        assertEq(_voucher.balanceOf(_learner), SERVICE_VOUCHERS);
        assertEq(_voucher.allowance(_issuerSafeStandIn, address(adapter)), 0);
        vm.chainId(42_161);
        sourceRouter.deliver(
            address(earned),
            _message(destinationRouter.lastMessageId(), GNOSIS_SELECTOR, address(adapter), destinationRouter.lastData())
        );
        assertEq(
            uint256(earned.getDistribution(entitlement).state), uint256(VoucherEntitlementModule.DeliveryState.Delivered)
        );
        assertEq(earned.distributionOfCommitment(requestId), entitlement);
        assertEq(uint256(module.getCommitment(requestId).state), uint256(Core.CommitmentState.Fulfilled));
        vm.chainId(100);
    }

    function _deployEarnedEndpoints() private returns (VoucherEntitlementModule earned, GnosisVoucherAdapter adapter) {
        earned = VoucherEntitlementModule(
            payable(address(new ERC1967Proxy(address(new VoucherEntitlementModule(address(sourceRouter))), "")))
        );
        vm.chainId(100);
        adapter = GnosisVoucherAdapter(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherAdapter(address(destinationRouter))),
                        abi.encodeCall(
                            GnosisVoucherAdapter.initialize,
                            (_communitySafeStandIn, guardian, ARBITRUM_SELECTOR, uint256(42_161), address(earned))
                        )
                    )
                ))
        );
        vm.prank(_issuerSafeStandIn);
        adapter.configureAsset(address(_voucher), _issuerSafeStandIn, true);
        vm.prank(_communitySafeStandIn);
        adapter.unpause();
        vm.chainId(42_161);
        earned.initialize(
            _communitySafeStandIn, guardian, GNOSIS_SELECTOR, 100, address(adapter), address(module), address(hats)
        );
        vm.startPrank(_communitySafeStandIn);
        earned.setIssuerAuthority(_issuerSafeStandIn, address(_voucher), _issuerSafeStandIn);
        earned.unpause();
        vm.stopPrank();
        module.setPaused(true);
        Acceptance(address(module)).pinEarnedVoucherModule(address(earned));
        module.setPaused(false);
    }

    function _prepareService() internal {
        vm.chainId(42_161);
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("fictional-pilot-full-access-session"));
        params.claimMode = Core.ClaimMode.ApprovalGated;
        params.targetUnits = SERVICE_MINUTES;
        params.unitLabel = "minutes of one booked 60-minute session";
        params.metadataCID = "fictional-full-access-booking-30-day-validity-and-mutual-remedy";
        vm.prank(CREATOR);
        serviceId = module.createCommitment(params);
        services.setServiceOfferTerms(
            serviceId,
            0,
            Services.ServiceOfferTermsInput(
                Services.ServicePaymentRoute.Voucher,
                SERVICE_TERMS,
                REMEDY_TERMS,
                100,
                _issuerSafeStandIn,
                address(_voucher),
                SERVICE_VOUCHERS
            ),
            0
        );
        Services.ServiceOfferTerms memory terms = services.getServiceOfferTerms(serviceId);
        vm.prank(_learner);
        claimHash = services.requestServiceClaim(
            serviceId, Services.ServiceClaimRequest(buyerGarden, _learner, 1, 1, terms.termsHash)
        );
        vm.prank(_learner);
        setupId = source.prepareVoucherSetup(serviceId, 1, terms.termsHash, claimHash, 1, uint64(block.timestamp + 1 days));
        authorizationHash = Codec.hash(source.getSetupAuthorization(setupId));
        _dispatchSource(0);
    }

    function _dispatchSource(uint8 kind) internal {
        vm.chainId(42_161);
        bytes32 messageId = source.dispatchSetupCommand(setupId, kind);
        vm.chainId(100);
        destinationRouter.deliver(
            address(escrow), _message(messageId, ARBITRUM_SELECTOR, address(source), sourceRouter.lastData())
        );
    }

    function _relayResult() internal {
        vm.chainId(42_161);
        sourceRouter.deliver(
            address(source),
            _message(destinationRouter.lastMessageId(), GNOSIS_SELECTOR, address(escrow), destinationRouter.lastData())
        );
    }

    function _message(
        bytes32 messageId,
        uint64 selector,
        address peer,
        bytes memory data
    )
        private
        pure
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage(messageId, selector, abi.encode(peer), data, new Client.EVMTokenAmount[](0));
    }

    function _approveAndDeposit() internal {
        vm.chainId(100);
        vm.prank(_issuerSafeStandIn);
        escrow.approveSetupAuthorization(setupId, authorizationHash);
        vm.startPrank(_learner);
        _voucher.approve(address(escrow), SERVICE_VOUCHERS);
        escrow.presentSetup(setupId, authorizationHash);
        vm.stopPrank();
        assertEq(_voucher.balanceOf(address(escrow)), SERVICE_VOUCHERS);
        _relayResult();
    }

    function _acceptAndActivate() internal {
        vm.chainId(42_161);
        vm.prank(CREATOR);
        services.acceptServiceClaim(serviceId, _learner, claimHash);
        Acceptance.VoucherServiceAcceptance memory accepted =
            Acceptance(address(module)).getVoucherServiceAcceptance(serviceId);
        assertEq(accepted.setupId, setupId);
        assertEq(accepted.authorizationHash, authorizationHash);
        assertEq(accepted.depositReceiptHash, Codec.depositReceiptHash(source.getSetupAuthorization(setupId)));
        source.finalizeActivation(setupId, authorizationHash);
        _dispatchSource(1);
        _relayResult();
        assertEq(uint256(source.getSetupResult(setupId).phase), uint256(Codec.SetupPhase.Active));
        vm.chainId(100);
    }

    function _finalize(
        uint256 deliveredMinutes,
        uint256 releaseUnits,
        uint256 refundUnits
    )
        internal
        returns (bytes32 decision)
    {
        vm.prank(_issuerSafeStandIn);
        escrow.authorizeReturn(setupId, authorizationHash, refundUnits);
        vm.prank(_learner);
        decision = escrow.finalizeAllocation(
            setupId, authorizationHash, Codec.FinalAllocation(deliveredMinutes, releaseUnits, refundUnits)
        );
    }

    function _assertNotExternalDelivery() internal {
        vm.chainId(42_161);
        assertEq(uint256(module.getCommitment(serviceId).state), uint256(Core.CommitmentState.Accepted));
        assertEq(services.getAcceptedServiceTerms(serviceId).gdPrice, 0);
        assertEq(services.getAcceptedServiceTerms(serviceId).offer.terms.serviceTermsRef, SERVICE_TERMS);
        vm.chainId(100);
    }
}
