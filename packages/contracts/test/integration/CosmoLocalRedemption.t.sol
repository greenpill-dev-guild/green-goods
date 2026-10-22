// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { VoucherRedemptionCodec as Codec } from "../../src/libraries/VoucherRedemptionCodec.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { VoucherRedemptionReceiver } from "../../src/modules/VoucherRedemptionReceiver.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";
import { VoucherRedemptionRouter, VoucherRedemptionToken } from "../helpers/VoucherRedemptionFixture.sol";

/// @notice Real core service promises, explicit distinct holder custody and independent voucher outcomes.
/// @dev Hats, ERC20 and transport are local stand-ins. No member-passkey or live CCIP proof.
contract CosmoLocalRedemptionTest is CommitmentPoolingFixture {
    address private constant BUYER_GARDEN = address(0xBA01);
    address private constant BUYER = address(0xBA02);
    address private constant PROVIDER_STEWARD = address(0xBA03);
    address private constant GNOSIS_HOLDER = address(0xBA04);
    address private constant ISSUER_SAFE = address(0xBA05);
    address private constant COMMUNITY_SAFE = address(0xBA06);
    address private constant GUARDIAN = address(0xBA07);
    uint64 private constant SOURCE_SELECTOR = 49_999;
    uint64 private constant DESTINATION_SELECTOR = 46_500;
    Service private services;
    VoucherRedemptionModule private source;
    GnosisVoucherEscrow private escrow;
    VoucherRedemptionRouter private sourceRouter;
    VoucherRedemptionRouter private destinationRouter;
    VoucherRedemptionToken private token;
    mapping(bytes32 => bytes32) private payloadHashes;

    function setUp() public {
        vm.chainId(42_161);
        _setUpProductionFixture();
        services = Service(address(module));
        module.registerPool(BUYER_GARDEN, Core.PoolType.Garden);
        hats.setGardener(BUYER_GARDEN, BUYER, true);
        hats.setOperator(POOL_GARDEN, PROVIDER_STEWARD, true);
        sourceRouter = new VoucherRedemptionRouter();
        source = VoucherRedemptionModule(
            payable(address(new ERC1967Proxy(address(new VoucherRedemptionModule(address(sourceRouter))), "")))
        );
        vm.chainId(100);
        destinationRouter = new VoucherRedemptionRouter();
        token = new VoucherRedemptionToken(ISSUER_SAFE);
        token.mintFixture(GNOSIS_HOLDER, 100);
        escrow = GnosisVoucherEscrow(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherEscrow(address(destinationRouter))),
                        abi.encodeCall(
                            GnosisVoucherEscrow.initialize,
                            (COMMUNITY_SAFE, GUARDIAN, SOURCE_SELECTOR, uint256(42_161), address(source))
                        )
                    )
                ))
        );
        vm.prank(COMMUNITY_SAFE);
        escrow.unpause();
        vm.prank(GNOSIS_HOLDER);
        token.approve(address(escrow), 100);
        vm.chainId(42_161);
        source.initialize(COMMUNITY_SAFE, GUARDIAN, DESTINATION_SELECTOR, 100, address(escrow), address(module));
        vm.prank(COMMUNITY_SAFE);
        source.unpause();
    }

    function testIntegration_CosmoLocalRedemption_realCrossGardenVoucherPromiseClosesFinanciallyWithoutCoreFulfillment()
        public
    {
        uint256 commitmentId = _acceptVoucherOffer(poolId, keccak256("fictional cross-garden voucher access"), false);
        bytes32 id = _present(commitmentId);
        vm.prank(GNOSIS_HOLDER);
        escrow.approveDelivered(id, payloadHashes[id], 2, 3, 40);
        vm.prank(ISSUER_SAFE);
        escrow.authorizeReturn(id, payloadHashes[id], 60);
        vm.prank(GNOSIS_HOLDER);
        escrow.returnUndelivered(id, payloadHashes[id], 3, 60);
        _reconcile(id);
        Core.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(commitment.counterparty, BUYER);
        assertEq(commitment.payerGarden, BUYER_GARDEN);
        assertEq(commitment.providerGarden, POOL_GARDEN);
        assertEq(uint8(commitment.state), uint8(Core.CommitmentState.Accepted));
        assertEq(uint8(commitment.consideration.rail), uint8(Core.ConsiderationRail.None));
        assertEq(commitment.consideration.amount, 0, "voucher-only service must not create G$ debt");
        assertEq(services.getAcceptedServiceTerms(commitmentId).gdPrice, 0);
        assertEq(uint8(source.getRedemption(id).state), uint8(VoucherRedemptionModule.RedemptionState.Closed));
        assertEq(source.getRedemption(id).latestResult.holderApprovedServiceUnits, 3);
        assertEq(token.balanceOf(ISSUER_SAFE), 40);
        assertEq(token.balanceOf(GNOSIS_HOLDER), 60);
    }

    function testIntegration_CosmoLocalRedemption_ordinarySourceConfirmationDoesNotSignForGnosisHolder() public {
        uint256 commitmentId = _acceptVoucherOffer(poolId, keccak256("fictional ordinary confirmation"), false);
        bytes32 id = _present(commitmentId);
        _ready(commitmentId);
        vm.prank(BUYER);
        module.confirmFulfillment(commitmentId);
        _assertUnapproved(commitmentId, id);
        vm.chainId(100);
        vm.expectRevert(VoucherRedemptionReceiver.HolderOnly.selector);
        vm.prank(BUYER);
        escrow.approveDelivered(id, payloadHashes[id], 2, 10, 100);
        vm.prank(GNOSIS_HOLDER);
        escrow.approveDelivered(id, payloadHashes[id], 2, 10, 100);
        _reconcile(id);
        assertEq(source.getRedemption(id).latestResult.holderApprovedServiceUnits, 10);
    }

    function testIntegration_CosmoLocalRedemption_authorizedPoolFallbackStillRequiresExplicitHolderApproval() public {
        module.registerPool(ROOT_GARDEN, Core.PoolType.Protocol);
        uint256 commitmentId = _acceptVoucherOffer(poolId, keccak256("fictional fallback confirmation"), true);
        bytes32 id = _present(commitmentId);
        vm.chainId(42_161);
        hats.setGardener(POOL_GARDEN, BUYER, true);
        vm.prank(CREATOR);
        module.addContributor(commitmentId, BUYER); // Ordinary confirmer excluded as contributor.
        _ready(commitmentId);
        vm.prank(PROVIDER_STEWARD);
        module.confirmFulfillmentAsFallback(commitmentId, "fictional ordinary confirmer is a contributor");
        _assertUnapproved(commitmentId, id);
    }

    function testIntegration_CosmoLocalRedemption_disputeResolvedFulfilledIsNotHolderApprovedDischarge() public {
        uint256 commitmentId = _acceptVoucherOffer(poolId, keccak256("fictional dispute confirmation"), false);
        bytes32 id = _present(commitmentId);
        _ready(commitmentId);
        vm.prank(PROVIDER_STEWARD);
        module.raiseDispute(commitmentId, "fictional service dispute");
        vm.prank(PROVIDER_STEWARD);
        module.resolveDispute(commitmentId, Core.DisputeResolution.Fulfilled, "fictional authorized resolution");
        _assertUnapproved(commitmentId, id);
    }

    function testIntegration_CosmoLocalRedemption_protocolOfferUsesExistingProviderAndExplicitHolderTerms() public {
        vm.chainId(42_161);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setGardener(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, PROVIDER_STEWARD, true);
        uint256 protocol = module.registerPool(ROOT_GARDEN, Core.PoolType.Protocol);
        module.setProviderOpenCommitmentCap(protocol, 128);
        module.setPoolCharter(protocol, "fictional protocol service charter");
        module.markPoolReady(protocol);
        module.openPool(protocol);
        uint256 commitmentId = _acceptVoucherOffer(protocol, keccak256("fictional protocol voucher service"), false);
        bytes32 id = _present(commitmentId);
        vm.prank(GNOSIS_HOLDER);
        escrow.approveDelivered(id, payloadHashes[id], 2, 10, 100);
        _reconcile(id);
        assertEq(module.getCommitment(commitmentId).providerGarden, ROOT_GARDEN);
        assertEq(module.getCommitment(commitmentId).payerGarden, BUYER_GARDEN);
        assertEq(source.getRedemption(id).latestResult.releasedUnits, 100);
        assertEq(services.getAcceptedServiceTerms(commitmentId).consent.voucherHolder, GNOSIS_HOLDER);
    }

    function _acceptVoucherOffer(
        uint256 selectedPool,
        bytes32 creationKey,
        bool protocolFallback
    )
        private
        returns (uint256 commitmentId)
    {
        vm.chainId(42_161);
        Core.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.poolId = selectedPool;
        params.claimMode = Core.ClaimMode.ApprovalGated;
        params.protocolFallbackEnabled = protocolFallback;
        params.unitLabel = "fictional lesson";
        params.targetUnits = 10;
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        services.setServiceOfferTerms(
            commitmentId,
            0,
            Service.ServiceOfferTermsInput({
                route: Service.ServicePaymentRoute.Voucher,
                serviceTermsRef: keccak256("fictional ten-lesson voucher service terms"),
                remedyTermsRef: keccak256("fictional mutual financial-return remedy"),
                voucherChainId: 100,
                voucherIssuer: ISSUER_SAFE,
                voucherToken: address(token),
                voucherUnits: 100
            }),
            0
        );
        Service.ServiceOfferTerms memory terms = services.getServiceOfferTerms(commitmentId);
        vm.prank(BUYER);
        bytes32 claimHash = services.requestServiceClaim(
            commitmentId,
            Service.ServiceClaimRequest({
                buyerGarden: BUYER_GARDEN,
                voucherHolder: GNOSIS_HOLDER,
                expectedRevision: terms.revision,
                requestNonce: 1,
                expectedTermsHash: terms.termsHash
            })
        );
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(commitmentId, BUYER, claimHash);
    }

    function _present(uint256 commitmentId) private returns (bytes32 id) {
        vm.prank(BUYER);
        id = source.prepareRedemption(commitmentId);
        Codec.Authorization memory authorization = Codec.decodeAuthorization(source.getCommand(id));
        assertEq(authorization.totalServiceUnits, 10);
        assertEq(authorization.totalVoucherUnits, 100);
        assertEq(authorization.serviceUnitLabelHash, keccak256("fictional lesson"));
        payloadHashes[id] = Codec.hash(authorization);
        vm.prank(BUYER);
        bytes32 messageId = source.dispatch(id);
        vm.chainId(100);
        destinationRouter.deliver(
            address(escrow),
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: SOURCE_SELECTOR,
                sender: abi.encode(address(source)),
                data: Codec.encodeAuthorization(authorization),
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, payloadHashes[id]);
        vm.prank(GNOSIS_HOLDER);
        escrow.present(id, payloadHashes[id], 1);
    }

    function _ready(uint256 commitmentId) private {
        vm.chainId(42_161);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "fictional service evidence", credited);
        vm.prank(PROVIDER_STEWARD);
        module.markReadyForConfirmation(commitmentId, "fictional authorized readiness");
    }

    function _assertUnapproved(uint256 commitmentId, bytes32 id) private {
        assertEq(uint8(module.getCommitment(commitmentId).state), uint8(Core.CommitmentState.Fulfilled));
        vm.chainId(100);
        assertEq(escrow.getExecutionResult(id).current.holderApprovedServiceUnits, 0);
        assertEq(escrow.getExecutionResult(id).current.releasedUnits, 0);
        assertEq(token.balanceOf(address(escrow)), 100);
        _reconcile(id);
        assertEq(source.getRedemption(id).latestResult.holderApprovedServiceUnits, 0);
    }

    function _reconcile(bytes32 id) private {
        vm.chainId(100);
        escrow.retryAcknowledgment(id);
        bytes memory data = destinationRouter.lastData();
        bytes32 messageId = destinationRouter.lastMessageId();
        vm.chainId(42_161);
        sourceRouter.deliver(
            address(source),
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: DESTINATION_SELECTOR,
                sender: abi.encode(address(escrow)),
                data: data,
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
    }
}
