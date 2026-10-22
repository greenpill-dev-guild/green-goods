// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { VoucherRedemptionReceiver } from "../../src/modules/VoucherRedemptionReceiver.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherRedemptionTransfers } from "../../src/libraries/VoucherRedemptionTransfers.sol";
import { VoucherRedemptionCodec } from "../../src/libraries/VoucherRedemptionCodec.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import {
    VoucherRedemptionRouter,
    VoucherRedemptionToken,
    VoucherRedemptionCoreMock
} from "../helpers/VoucherRedemptionFixture.sol";

/// @notice Deterministic local account/transport/token fixtures; no live CCIP or passkey proof.
contract VoucherRedemptionTest is Test {
    uint256 private constant SOURCE_CHAIN = 42_161;
    uint256 private constant DESTINATION_CHAIN = 100;
    uint64 private constant SOURCE_SELECTOR = 49_999;
    uint64 private constant DESTINATION_SELECTOR = 46_500;
    address private constant COMMUNITY_SAFE = address(0x1000);
    address private constant GUARDIAN = address(0x2000);
    address private constant ISSUER_SAFE = address(0x3000);
    address private constant BUYER = address(0x4000);
    address private constant HOLDER = address(0x5000);
    address private constant BUYER_GARDEN = address(0x6000);
    address private constant PROVIDER_GARDEN = address(0x7000);
    uint256 private constant COMMITMENT_ID = 7;

    VoucherRedemptionRouter private sourceRouter;
    VoucherRedemptionRouter private destinationRouter;
    VoucherRedemptionCoreMock private core;
    VoucherRedemptionToken private token;
    VoucherRedemptionModule private source;
    GnosisVoucherEscrow private escrow;
    mapping(bytes32 => bytes32) private _payloadHashes;

    function setUp() public {
        vm.chainId(SOURCE_CHAIN);
        sourceRouter = new VoucherRedemptionRouter();
        core = new VoucherRedemptionCoreMock();
        source = VoucherRedemptionModule(
            payable(address(new ERC1967Proxy(address(new VoucherRedemptionModule(address(sourceRouter))), "")))
        );

        vm.chainId(DESTINATION_CHAIN);
        destinationRouter = new VoucherRedemptionRouter();
        token = new VoucherRedemptionToken(ISSUER_SAFE);
        escrow = GnosisVoucherEscrow(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherEscrow(address(destinationRouter))),
                        abi.encodeCall(
                            GnosisVoucherEscrow.initialize,
                            (COMMUNITY_SAFE, GUARDIAN, SOURCE_SELECTOR, SOURCE_CHAIN, address(source))
                        )
                    )
                ))
        );
        vm.prank(COMMUNITY_SAFE);
        escrow.unpause();
        token.mintFixture(HOLDER, 100);
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);

        vm.chainId(SOURCE_CHAIN);
        source.initialize(COMMUNITY_SAFE, GUARDIAN, DESTINATION_SELECTOR, DESTINATION_CHAIN, address(escrow), address(core));
        vm.prank(COMMUNITY_SAFE);
        source.unpause();
        _configureAcceptedVoucher();
    }

    function testVoucherRedemptionModule_preparesCanonicalAcceptedVoucherIdentity() public {
        VoucherRedemptionCodec.Authorization memory authorization = _authorization();
        bytes32 expected = VoucherRedemptionCodec.redemptionId(authorization);
        assertTrue(expected != bytes32(0), "fixture canonical identity must be nonzero");
        vm.prank(BUYER);
        bytes32 actual = source.prepareRedemption(COMMITMENT_ID);
        assertEq(actual, expected, "accepted canonical terms must produce their stable redemption identity");
    }

    function testGnosisVoucherEscrow_holderPresentmentMovesExactlyBoundVoucherInventory() public {
        VoucherRedemptionCodec.Authorization memory authorization = _authorization();
        bytes32 id = VoucherRedemptionCodec.redemptionId(authorization);
        bytes32 payloadHash = VoucherRedemptionCodec.hash(authorization);
        vm.chainId(DESTINATION_CHAIN);
        destinationRouter.deliver(
            address(escrow),
            Client.Any2EVMMessage({
                messageId: keccak256("fictional service authorization"),
                sourceChainSelector: SOURCE_SELECTOR,
                sender: abi.encode(address(source)),
                data: VoucherRedemptionCodec.encodeAuthorization(authorization),
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, payloadHash);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 1);
        assertEq(token.balanceOf(address(escrow)), 100, "holder presentment must custody the authorized voucher units");
        assertEq(token.balanceOf(HOLDER), 0);
        assertEq(escrow.getExecutionResult(id).current.escrowedUnits, 100);
        assertEq(
            escrow.getExecutionResult(id).current.holderApprovedServiceUnits,
            0,
            "token presentment alone cannot approve service quantity"
        );
    }

    function _authorization() private view returns (VoucherRedemptionCodec.Authorization memory authorization) {
        authorization.version = 1;
        authorization.sourceChainId = SOURCE_CHAIN;
        authorization.sourceModule = address(source);
        authorization.commitmentId = COMMITMENT_ID;
        authorization.revision = 3;
        authorization.acceptedClaimHash = keccak256("fictional accepted claim");
        authorization.termsHash = keccak256("fictional frozen service terms");
        authorization.buyer = BUYER;
        authorization.holder = HOLDER;
        authorization.buyerGarden = BUYER_GARDEN;
        authorization.providerGarden = PROVIDER_GARDEN;
        authorization.destinationChainId = DESTINATION_CHAIN;
        authorization.destinationEscrow = address(escrow);
        authorization.issuer = ISSUER_SAFE;
        authorization.token = address(token);
        authorization.totalVoucherUnits = 100;
        authorization.totalServiceUnits = 10;
        authorization.serviceUnitLabelHash = keccak256("fictional lessons");
        authorization.serviceTermsRef = keccak256("fictional exact service terms");
        authorization.remedyTermsRef = keccak256("fictional mutual-consent remedy");
        authorization.remedyPolicy = 1;
    }

    function _configureAcceptedVoucher() private {
        VoucherRedemptionCodec.Authorization memory authorization = _authorization();
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted;
        accepted.offer.revision = authorization.revision;
        accepted.offer.termsHash = authorization.termsHash;
        accepted.offer.terms = ICommitmentServiceOffers.ServiceOfferTermsInput({
            route: ICommitmentServiceOffers.ServicePaymentRoute.Voucher,
            serviceTermsRef: authorization.serviceTermsRef,
            remedyTermsRef: authorization.remedyTermsRef,
            voucherChainId: DESTINATION_CHAIN,
            voucherIssuer: ISSUER_SAFE,
            voucherToken: address(token),
            voucherUnits: authorization.totalVoucherUnits
        });
        accepted.consent = ICommitmentServiceOffers.ServiceClaimConsent({
            termsRevision: authorization.revision,
            requestNonce: 1,
            buyerGarden: BUYER_GARDEN,
            voucherHolder: HOLDER,
            termsHash: authorization.termsHash,
            claimHash: authorization.acceptedClaimHash
        });
        accepted.buyer = BUYER;
        accepted.serviceRecipient = BUYER;
        accepted.providerGarden = PROVIDER_GARDEN;
        accepted.serviceUnits = authorization.totalServiceUnits;
        accepted.unitLabelHash = authorization.serviceUnitLabelHash;
        ICommitmentPoolingModule.Commitment memory commitment;
        commitment.poolId = 1;
        commitment.creator = address(0x8000);
        commitment.counterparty = BUYER;
        commitment.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        commitment.state = ICommitmentPoolingModule.CommitmentState.Accepted;
        commitment.claimType = ICommitmentPoolingModule.ClaimType.Individual;
        commitment.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        commitment.providerGarden = PROVIDER_GARDEN;
        commitment.payerGarden = BUYER_GARDEN;
        commitment.targetUnits = authorization.totalServiceUnits;
        commitment.unitLabel = "fictional lessons";
        core.configure(accepted, commitment);
    }

    function testVoucherRedemption_separatesServiceQuantityFromRepeatedVoucherPaymentsAndReturns() public {
        bytes32 id = _presentedSource();
        _release(id, 3, 20);
        _release(id, 3, 20);
        assertEq(_result(id).holderApprovedServiceUnits, 3);
        assertEq(_result(id).holderApprovedVoucherUnits, 40);
        assertEq(_result(id).actionServiceUnits, 0, "same service total is not counted twice");
        _allowReturn(id, 60);
        _return(id, 60);
        _relayCurrent(id);
        vm.chainId(SOURCE_CHAIN);
        assertEq(uint8(source.getRedemption(id).state), uint8(VoucherRedemptionModule.RedemptionState.Closed));
        assertEq(uint8(core.getCommitment(COMMITMENT_ID).state), uint8(ICommitmentPoolingModule.CommitmentState.Accepted));
        assertEq(source.getRedemption(id).latestResult.holderApprovedServiceUnits, 3);
        assertEq(token.balanceOf(ISSUER_SAFE), 40);
        assertEq(token.balanceOf(HOLDER), 60);
        assertEq(token.totalSupply(), 100);
    }

    function testVoucherRedemptionModule_revertsWhenCallerIsNotSourceBuyer() public {
        vm.expectRevert(VoucherRedemptionModule.SourceBuyerOnly.selector);
        vm.prank(COMMUNITY_SAFE);
        source.prepareRedemption(COMMITMENT_ID);
    }

    function testVoucherRedemptionModule_rejectsLegacyGdAndMismatchedAcceptedRevision() public {
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted = core.getAcceptedServiceTerms(COMMITMENT_ID);
        ICommitmentPoolingModule.Commitment memory commitment = core.getCommitment(COMMITMENT_ID);
        accepted.offer.terms.route = ICommitmentServiceOffers.ServicePaymentRoute.Legacy;
        _expectInvalid(accepted, commitment);
        accepted.offer.terms.route = ICommitmentServiceOffers.ServicePaymentRoute.PersonalGd;
        _expectInvalid(accepted, commitment);
        accepted.offer.terms.route = ICommitmentServiceOffers.ServicePaymentRoute.Voucher;
        ++accepted.consent.termsRevision;
        _expectInvalid(accepted, commitment);
        --accepted.consent.termsRevision;
        accepted.consent.termsHash = keccak256("different revision payload");
        _expectInvalid(accepted, commitment);
    }

    function testVoucherRedemptionModule_rejectsChangedPartiesPriceServiceUnitsAndChain() public {
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted = core.getAcceptedServiceTerms(COMMITMENT_ID);
        ICommitmentPoolingModule.Commitment memory commitment = core.getCommitment(COMMITMENT_ID);
        accepted.consent.voucherHolder = address(0);
        _expectInvalid(accepted, commitment);
        accepted.consent.voucherHolder = HOLDER;
        accepted.consent.buyerGarden = PROVIDER_GARDEN;
        _expectInvalid(accepted, commitment);
        accepted.consent.buyerGarden = BUYER_GARDEN;
        accepted.gdPrice = 1;
        _expectInvalid(accepted, commitment);
        accepted.gdPrice = 0;
        ++accepted.serviceUnits;
        _expectInvalid(accepted, commitment);
        --accepted.serviceUnits;
        accepted.offer.terms.voucherChainId = 42_220;
        _expectInvalid(accepted, commitment);
    }

    function testVoucherRedemptionModule_rejectsUnacceptedCancelledExpiredAndDisputedPromises() public {
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted = core.getAcceptedServiceTerms(COMMITMENT_ID);
        ICommitmentPoolingModule.Commitment memory commitment = core.getCommitment(COMMITMENT_ID);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Offered;
        _expectInvalid(accepted, commitment);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Cancelled;
        _expectInvalid(accepted, commitment);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Expired;
        _expectInvalid(accepted, commitment);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Disputed;
        _expectInvalid(accepted, commitment);
    }

    function testVoucherRedemptionModule_dispatchRetriesKeepExactIdentityAndCallerPaysFee() public {
        vm.prank(BUYER);
        bytes32 id = source.prepareRedemption(COMMITMENT_ID);
        bytes memory payload = source.getCommand(id);
        sourceRouter.configure(7, false, false);
        vm.deal(BUYER, 20);
        vm.expectRevert(abi.encodeWithSelector(VoucherRedemptionModule.IncorrectRedemptionFee.selector, 7, 0));
        vm.prank(BUYER);
        source.dispatch(id);
        vm.prank(BUYER);
        source.dispatch{ value: 7 }(id);
        vm.prank(BUYER);
        source.dispatch{ value: 7 }(id);
        assertEq(sourceRouter.lastData(), payload);
        assertEq(sourceRouter.lastGasLimit(), 2_000_000);
        assertEq(address(source).balance, 0);
        vm.expectRevert(VoucherRedemptionModule.RedemptionAlreadyPrepared.selector);
        vm.prank(BUYER);
        source.prepareRedemption(COMMITMENT_ID);
    }

    function testGnosisVoucherEscrow_issuerAndAssetApprovalCannotBeReplacedByGardenAuthority() public {
        bytes32 id = _open();
        bytes32 payloadHash = _payloadHashes[id];
        vm.expectRevert(GnosisVoucherEscrow.IssuerOnly.selector);
        vm.prank(COMMUNITY_SAFE);
        escrow.approveAuthorization(id, payloadHash);
        vm.expectRevert(VoucherRedemptionReceiver.IssuerApprovalRequired.selector);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 1);
        token.rotateOwnerFixture(address(0xDEAD));
        vm.expectRevert(VoucherRedemptionTransfers.WrongVoucherIssuer.selector);
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, payloadHash);
        assertEq(token.balanceOf(HOLDER), 100);
    }

    function testGnosisVoucherEscrow_ownerRotationBeforePresentmentRejectsAndAfterwardCannotStrandTokens() public {
        bytes32 id = _openApproved();
        bytes32 payloadHash = _payloadHashes[id];
        token.rotateOwnerFixture(address(0xDEAD));
        vm.expectRevert(VoucherRedemptionTransfers.WrongVoucherIssuer.selector);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 1);
        token.rotateOwnerFixture(ISSUER_SAFE);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 1);
        token.rotateOwnerFixture(address(0xDEAD));
        _release(id, 3, 40);
        _allowReturn(id, 60);
        _return(id, 60);
        assertEq(_result(id).releasedUnits, 40);
        assertEq(_result(id).returnedUnits, 60);
    }

    function testGnosisVoucherEscrow_sourceBuyerCannotSignForTheDistinctGnosisHolder() public {
        bytes32 id = _openApproved();
        bytes32 payloadHash = _payloadHashes[id];
        vm.expectRevert(VoucherRedemptionReceiver.HolderOnly.selector);
        vm.prank(BUYER);
        escrow.present(id, payloadHash, 1);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 1);
        vm.expectRevert(VoucherRedemptionReceiver.HolderOnly.selector);
        vm.prank(BUYER);
        escrow.approveDelivered(id, payloadHash, 2, 3, 40);
        vm.expectRevert(VoucherRedemptionReceiver.WrongRedemptionPayload.selector);
        vm.prank(HOLDER);
        escrow.approveDelivered(id, bytes32(uint256(1)), 2, 3, 40);
        assertEq(_result(id).holderApprovedServiceUnits, 0);
    }

    function testGnosisVoucherEscrow_mutualReturnPermissionDoesNotReserveOrForceUnits() public {
        bytes32 id = _presented();
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        vm.prank(HOLDER);
        escrow.returnUndelivered(id, _payloadHashes[id], 2, 100);
        _allowReturn(id, 100);
        assertEq(_result(id).mutualReturnUnits, 0);
        assertEq(token.balanceOf(address(escrow)), 100);
        _release(id, 3, 40);
        _return(id, 60);
        assertEq(_result(id).holderApprovedServiceUnits, 3);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        vm.prank(HOLDER);
        escrow.returnUndelivered(id, _payloadHashes[id], 4, 1);
    }

    function testGnosisVoucherEscrow_timeoutAndGenericFulfilledNeverApproveServiceOrAuthorizeReturns() public {
        bytes32 id = _presented();
        vm.warp(block.timestamp + 365 days);
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted = core.getAcceptedServiceTerms(COMMITMENT_ID);
        ICommitmentPoolingModule.Commitment memory commitment = core.getCommitment(COMMITMENT_ID);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        core.configure(accepted, commitment);
        assertEq(_result(id).holderApprovedServiceUnits, 0);
        assertEq(_result(id).releasedUnits, 0);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        vm.prank(HOLDER);
        escrow.returnUndelivered(id, _payloadHashes[id], 2, 100);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_failedAllowancePresentmentRepairsTheSameImmutableAction() public {
        bytes32 id = _openApproved();
        bytes32 payloadHash = _payloadHashes[id];
        vm.prank(HOLDER);
        token.approve(address(escrow), 99);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 1);
        bytes32 fixedAction = _result(id).actionHash;
        assertFalse(_result(id).actionSucceeded);
        assertEq(_result(id).escrowedUnits, 0);
        vm.expectRevert(GnosisVoucherEscrow.PendingRedemptionAction.selector);
        vm.prank(HOLDER);
        escrow.present(id, payloadHash, 2);
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);
        escrow.retry(id);
        assertTrue(_result(id).actionSucceeded);
        assertEq(_result(id).actionHash, fixedAction);
        assertEq(token.allowance(HOLDER, address(escrow)), 0);
        vm.expectRevert(GnosisVoucherEscrow.NoRetryableAction.selector);
        escrow.retry(id);
    }

    function testGnosisVoucherEscrow_unlimitedAllowanceProducesStoredRecoverableFailure() public {
        bytes32 id = _openApproved();
        vm.prank(HOLDER);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        assertFalse(_result(id).actionSucceeded);
        assertEq(
            escrow.failureReason(id), abi.encodeWithSelector(VoucherRedemptionTransfers.UnlimitedVoucherAllowance.selector)
        );
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);
        vm.prank(COMMUNITY_SAFE); // Safe-operated repair uses the existing fixed authorization.
        escrow.retry(id);
        assertEq(_result(id).escrowedUnits, 100);
    }

    function testGnosisVoucherEscrow_inexactPresentmentRollsBackEveryTokenAndAllowanceMutation() public {
        bytes32 id = _openApproved();
        token.configureFailure(address(0), 1, false);
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        assertFalse(_result(id).actionSucceeded);
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(token.allowance(HOLDER, address(escrow)), 100);
        token.configureFailure(address(0), 0, false);
        escrow.retry(id);
        assertEq(_result(id).escrowedUnits, 100);
    }

    function testGnosisVoucherEscrow_skippedFiniteAllowanceDebitCannotExpandCustodyAuthorization() public {
        bytes32 id = _openApproved();
        token.configureAllowanceDebit(true);
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        assertFalse(_result(id).actionSucceeded);
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(token.allowance(HOLDER, address(escrow)), 100);
        token.configureAllowanceDebit(false);
        escrow.retry(id);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_releaseFailurePreservesServiceApprovalAndCannotBecomeAReturn() public {
        bytes32 id = _presented();
        token.configureFailure(address(0), 0, true); // Token credits without debit; exact-check must roll it back.
        _release(id, 3, 40);
        bytes32 fixedAction = _result(id).actionHash;
        assertFalse(_result(id).actionSucceeded);
        assertEq(_result(id).holderApprovedServiceUnits, 3);
        assertEq(_result(id).holderApprovedVoucherUnits, 40);
        assertEq(_result(id).releasedUnits, 0);
        assertEq(token.balanceOf(ISSUER_SAFE), 0);
        assertEq(token.balanceOf(address(escrow)), 100);
        _allowReturn(id, 100);
        vm.expectRevert(GnosisVoucherEscrow.PendingRedemptionAction.selector);
        vm.prank(HOLDER);
        escrow.returnUndelivered(id, _payloadHashes[id], 3, 60);
        token.configureFailure(address(0), 0, false);
        escrow.retry(id);
        assertEq(_result(id).actionHash, fixedAction);
        assertEq(_result(id).releasedUnits, 40);
        _return(id, 60);
        assertEq(_result(id).returnedUnits, 60);
        assertEq(_result(id).holderApprovedServiceUnits, 3);
    }

    function testGnosisVoucherEscrow_returnFailurePreservesAllocationAndRepairsWithoutDoubleCounting() public {
        bytes32 id = _presented();
        _allowReturn(id, 60);
        token.configureFailure(HOLDER, 0, false);
        _return(id, 60);
        assertFalse(_result(id).actionSucceeded);
        assertEq(_result(id).mutualReturnUnits, 60);
        assertEq(_result(id).returnedUnits, 0);
        token.configureFailure(address(0), 0, false);
        escrow.retry(id);
        assertEq(_result(id).returnedUnits, 60);
        _release(id, 2, 40);
        assertEq(_result(id).releasedUnits + _result(id).returnedUnits, 100);
    }

    function testGnosisVoucherEscrow_rejectsServiceRegressionOverapprovalAndWrongActionNonce() public {
        bytes32 id = _presented();
        _release(id, 3, 40);
        bytes32 payloadHash = _payloadHashes[id];
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        vm.prank(HOLDER);
        escrow.approveDelivered(id, payloadHash, 3, 2, 1);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        vm.prank(HOLDER);
        escrow.approveDelivered(id, payloadHash, 3, 11, 1);
        vm.expectRevert(GnosisVoucherEscrow.WrongActionNonce.selector);
        vm.prank(HOLDER);
        escrow.approveDelivered(id, payloadHash, 2, 4, 20);
        assertEq(_result(id).holderApprovedServiceUnits, 3);
        assertEq(_result(id).holderApprovedVoucherUnits, 40);
    }

    function testGnosisVoucherEscrow_duplicateTransportCannotRepeatCustodyOrSpendAcknowledgmentReserve() public {
        bytes32 id = _presented();
        uint256 sends = destinationRouter.nonce();
        _deliverAuthorization(_authorization(), keccak256("duplicate business authorization"));
        _deliverAuthorization(_authorization(), keccak256("fictional service authorization"));
        assertEq(destinationRouter.nonce(), sends);
        assertEq(_result(id).actionNonce, 1);
        assertEq(token.balanceOf(address(escrow)), 100);
        VoucherRedemptionCodec.Authorization memory different = _authorization();
        different.totalVoucherUnits = 99;
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingRedemptionPayload.selector);
        _deliverAuthorization(different, keccak256("different message same redemption"));
        different.commitmentId = 8;
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingRedemptionPayload.selector);
        _deliverAuthorization(different, keccak256("fictional service authorization"));
    }

    function testGnosisVoucherEscrow_rejectsUnauthenticatedPeersAttachedTokensAndWrongProtocolBytes() public {
        vm.chainId(DESTINATION_CHAIN);
        Client.Any2EVMMessage memory message = _authorizationMessage(_authorization(), keccak256("bad message"));
        message.sender = abi.encode(COMMUNITY_SAFE);
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        destinationRouter.deliver(address(escrow), message);
        message.sender = abi.encode(address(source));
        message.sourceChainSelector = SOURCE_SELECTOR + 1;
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        destinationRouter.deliver(address(escrow), message);
        message.sourceChainSelector = SOURCE_SELECTOR;
        message.destTokenAmounts = new Client.EVMTokenAmount[](1);
        message.destTokenAmounts[0] = Client.EVMTokenAmount(address(token), 1);
        vm.expectRevert(VoucherEndpoint.AttachedTokensForbidden.selector);
        destinationRouter.deliver(address(escrow), message);
        message.destTokenAmounts = new Client.EVMTokenAmount[](0);
        message.data = bytes.concat(message.data, bytes32(uint256(1)));
        vm.expectRevert(VoucherRedemptionCodec.UnsupportedRedemptionMessage.selector);
        destinationRouter.deliver(address(escrow), message);
        message.data = VoucherRedemptionCodec.encodeAuthorization(_authorization());
        VoucherRedemptionCodec.Authorization memory wrong = _authorization();
        wrong.version = 2;
        message.data = VoucherRedemptionCodec.encodeAuthorization(wrong);
        vm.expectRevert(VoucherRedemptionCodec.UnsupportedRedemptionMessage.selector);
        destinationRouter.deliver(address(escrow), message);
    }

    function testVoucherRedemption_acknowledgmentFailureRecoveryNeverRepeatsSuccessfulDelivery() public {
        vm.prank(BUYER);
        bytes32 id = source.prepareRedemption(COMMITMENT_ID);
        vm.prank(BUYER);
        source.dispatch(id);
        vm.chainId(DESTINATION_CHAIN);
        destinationRouter.configure(0, true, false);
        _deliverAuthorization(_authorization(), keccak256("lost initial acknowledgment"));
        assertTrue(escrow.getExecutionResult(id).acknowledgmentFailureHash != bytes32(0));
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, _payloadHashes[id]);
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        _release(id, 10, 100);
        vm.chainId(SOURCE_CHAIN);
        vm.warp(block.timestamp + 30 days);
        assertEq(uint8(source.getRedemption(id).state), uint8(VoucherRedemptionModule.RedemptionState.Pending));
        vm.prank(GUARDIAN);
        source.pause();
        vm.chainId(DESTINATION_CHAIN);
        destinationRouter.configure(9, false, false);
        vm.deal(address(this), 100);
        vm.expectRevert(abi.encodeWithSelector(VoucherRedemptionReceiver.IncorrectAcknowledgmentFee.selector, 9, 0));
        escrow.retryAcknowledgment(id);
        _relayCurrent(id);
        assertEq(token.balanceOf(ISSUER_SAFE), 100);
        assertEq(_result(id).releasedUnits, 100);
        assertEq(destinationRouter.lastGasLimit(), 750_000);
        vm.chainId(SOURCE_CHAIN);
        assertEq(uint8(source.getRedemption(id).state), uint8(VoucherRedemptionModule.RedemptionState.Closed));
    }

    function testVoucherRedemption_staleFailureCannotReplaceNewerSuccessOrConflictWithSameSequence() public {
        bytes32 id = _presentedSource();
        token.configureFailure(ISSUER_SAFE, 0, false);
        _release(id, 3, 40);
        VoucherRedemptionCodec.Result memory failed = _result(id);
        _relayCurrent(id);
        token.configureFailure(address(0), 0, false);
        escrow.retry(id);
        _relayCurrent(id);
        uint64 successSequence = _result(id).resultSequence;
        _deliverResult(failed, keccak256("late old failure"));
        assertEq(source.getRedemption(id).latestResult.resultSequence, successSequence);
        assertTrue(source.getRedemption(id).latestResult.actionSucceeded);
        VoucherRedemptionCodec.Result memory conflict = _result(id);
        conflict.issuerReturnCeiling = 1;
        vm.expectRevert(VoucherRedemptionModule.ConflictingRedemptionResult.selector);
        _deliverResult(conflict, keccak256("same sequence conflict"));
        conflict = failed;
        conflict.resultSequence = successSequence + 1;
        vm.expectRevert(VoucherRedemptionCodec.InvalidRedemptionResult.selector);
        _deliverResult(conflict, keccak256("regressive future failure"));
    }

    function testVoucherRedemption_malformedResultsAndTransportReuseCannotChangeReportedQuantities() public {
        bytes32 id = _presentedSource();
        _release(id, 3, 40);
        VoucherRedemptionCodec.Result memory result = _result(id);
        bytes32 messageId = keccak256("fixed result transport");
        _deliverResult(result, messageId);
        ++result.resultSequence;
        vm.expectRevert(VoucherRedemptionModule.ConflictingRedemptionTransport.selector);
        _deliverResult(result, messageId);
        result.releasedUnits = 101;
        vm.expectRevert(VoucherRedemptionCodec.InvalidRedemptionResult.selector);
        _deliverResult(result, keccak256("impossible released total"));
    }

    function testGnosisVoucherEscrow_pauseStoresRecoverableActionAndGuardianCannotResumeOrExecute() public {
        bytes32 id = _presented();
        vm.prank(GUARDIAN);
        escrow.pause();
        _release(id, 3, 40);
        assertEq(escrow.failureReason(id), abi.encodeWithSelector(GnosisVoucherEscrow.ExecutionPaused.selector));
        assertEq(_result(id).holderApprovedServiceUnits, 3);
        vm.expectRevert();
        vm.prank(GUARDIAN);
        escrow.unpause();
        vm.expectRevert(VoucherRedemptionReceiver.SelfOnly.selector);
        vm.prank(COMMUNITY_SAFE);
        escrow.executeAction(id);
        vm.prank(COMMUNITY_SAFE);
        escrow.unpause();
        escrow.retry(id);
        assertEq(_result(id).releasedUnits, 40);
    }

    function testGnosisVoucherEscrow_reentrantTokenCannotAddApprovalsOrRepeatCustody() public {
        bytes32 id = _openApproved();
        token.configureReentry(address(escrow), abi.encodeCall(GnosisVoucherEscrow.retry, (id)));
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        assertFalse(token.reentrySucceeded());
        assertEq(_result(id).escrowedUnits, 100);
        assertEq(_result(id).actionNonce, 1);
    }

    function testGnosisVoucherEscrow_upgradeRequiresPausedOwnerAndFullDelayPreservingLedger() public {
        bytes32 id = _presented();
        _release(id, 3, 40);
        GnosisVoucherEscrow next = new GnosisVoucherEscrow(address(destinationRouter));
        vm.prank(COMMUNITY_SAFE);
        escrow.scheduleUpgrade(address(next));
        vm.prank(GUARDIAN);
        escrow.pause();
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vm.prank(COMMUNITY_SAFE);
        escrow.upgradeTo(address(next));
        vm.warp(block.timestamp + 48 hours);
        vm.prank(COMMUNITY_SAFE);
        escrow.upgradeTo(address(next));
        assertEq(_result(id).holderApprovedServiceUnits, 3);
        assertEq(_result(id).releasedUnits, 40);
        assertEq(escrow.remotePeer(), address(source));
        assertEq(escrow.scheduledImplementation(), address(0));
    }

    function testVoucherRedemption_fixedProtocolPayloadsAndBoundedGasAcceptCanonicalLedgers() public {
        vm.prank(BUYER);
        bytes32 id = source.prepareRedemption(COMMITMENT_ID);
        vm.prank(BUYER);
        source.dispatch(id);
        assertEq(source.getCommand(id).length, 704);
        vm.chainId(DESTINATION_CHAIN);
        (bool accepted, uint256 intakeGas) = destinationRouter.deliverBounded(
            address(escrow), _authorizationMessage(_authorization(), keccak256("gas bounded authorization")), 2_000_000
        );
        assertTrue(accepted, "authorization must fit its explicit receiver budget");
        _payloadHashes[id] = VoucherRedemptionCodec.hash(_authorization());
        emit log_named_uint("local authorization intake gas including mocked ack send", intakeGas);
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, _payloadHashes[id]);
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        _release(id, 3, 40);
        _allowReturn(id, 60);
        _return(id, 60);
        bytes memory resultBytes = VoucherRedemptionCodec.encodeResult(_result(id));
        assertEq(resultBytes.length, 640);
        vm.chainId(SOURCE_CHAIN);
        (accepted, intakeGas) = sourceRouter.deliverBounded(
            address(source), _resultMessage(resultBytes, keccak256("gas bounded latest result")), 750_000
        );
        assertTrue(accepted, "latest cumulative result must fit its explicit receiver budget");
        emit log_named_uint("local result reconciliation gas", intakeGas);
    }

    function testFuzz_VoucherRedemption_partialFinancialAllocationConservesIndependentServiceApproval(
        uint64 rawVoucherUnits,
        uint64 rawReleaseUnits,
        uint8 rawServiceUnits
    )
        public
    {
        uint256 total = bound(uint256(rawVoucherUnits), 2, 1e12);
        uint256 released = bound(uint256(rawReleaseUnits), 1, total - 1);
        uint256 services = bound(uint256(rawServiceUnits), 1, 10);
        VoucherRedemptionCodec.Authorization memory authorization = _authorization();
        authorization.totalVoucherUnits = total;
        vm.chainId(DESTINATION_CHAIN);
        if (total > 100) token.mintFixture(HOLDER, total - 100);
        vm.prank(HOLDER);
        token.approve(address(escrow), total);
        _deliverAuthorization(authorization, keccak256("fuzz authorized quantity"));
        bytes32 id = VoucherRedemptionCodec.redemptionId(authorization);
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, _payloadHashes[id]);
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
        _release(id, services, released);
        _allowReturn(id, total - released);
        _return(id, total - released);
        assertEq(_result(id).releasedUnits + _result(id).returnedUnits, total);
        assertEq(_result(id).holderApprovedServiceUnits, services);
        assertEq(token.balanceOf(address(escrow)), 0);
        VoucherRedemptionCodec.validateResult(_result(id), authorization);
    }

    function _expectInvalid(
        ICommitmentServiceOffers.AcceptedServiceTerms memory accepted,
        ICommitmentPoolingModule.Commitment memory commitment
    )
        private
    {
        core.configure(accepted, commitment);
        vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
        vm.prank(BUYER);
        source.prepareRedemption(COMMITMENT_ID);
    }

    function _open() private returns (bytes32 id) {
        vm.chainId(DESTINATION_CHAIN);
        _deliverAuthorization(_authorization(), keccak256("fictional service authorization"));
        return VoucherRedemptionCodec.redemptionId(_authorization());
    }

    function _openApproved() private returns (bytes32 id) {
        id = _open();
        vm.prank(ISSUER_SAFE);
        escrow.approveAuthorization(id, _payloadHashes[id]);
    }

    function _presented() private returns (bytes32 id) {
        id = _openApproved();
        vm.prank(HOLDER);
        escrow.present(id, _payloadHashes[id], 1);
    }

    function _presentedSource() private returns (bytes32 id) {
        vm.chainId(SOURCE_CHAIN);
        vm.prank(BUYER);
        id = source.prepareRedemption(COMMITMENT_ID);
        vm.prank(BUYER);
        source.dispatch(id);
        assertEq(source.getCommand(id), VoucherRedemptionCodec.encodeAuthorization(_authorization()));
        _presented();
    }

    function _result(bytes32 id) private view returns (VoucherRedemptionCodec.Result memory) {
        return escrow.getExecutionResult(id).current;
    }

    function _release(bytes32 id, uint256 cumulativeServices, uint256 vouchers) private {
        VoucherRedemptionCodec.Result memory result = _result(id);
        vm.prank(HOLDER);
        escrow.approveDelivered(id, result.payloadHash, result.actionNonce + 1, cumulativeServices, vouchers);
    }

    function _allowReturn(bytes32 id, uint256 ceiling) private {
        vm.prank(ISSUER_SAFE);
        escrow.authorizeReturn(id, _payloadHashes[id], ceiling);
    }

    function _return(bytes32 id, uint256 units) private {
        VoucherRedemptionCodec.Result memory result = _result(id);
        vm.prank(HOLDER);
        escrow.returnUndelivered(id, result.payloadHash, result.actionNonce + 1, units);
    }

    function _authorizationMessage(
        VoucherRedemptionCodec.Authorization memory authorization,
        bytes32 messageId
    )
        private
        view
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: SOURCE_SELECTOR,
            sender: abi.encode(address(source)),
            data: VoucherRedemptionCodec.encodeAuthorization(authorization),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _deliverAuthorization(VoucherRedemptionCodec.Authorization memory authorization, bytes32 messageId) private {
        destinationRouter.deliver(address(escrow), _authorizationMessage(authorization, messageId));
        _payloadHashes[VoucherRedemptionCodec.redemptionId(authorization)] = VoucherRedemptionCodec.hash(authorization);
    }

    function _resultMessage(bytes memory data, bytes32 messageId) private view returns (Client.Any2EVMMessage memory) {
        return Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: DESTINATION_SELECTOR,
            sender: abi.encode(address(escrow)),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _deliverResult(VoucherRedemptionCodec.Result memory result, bytes32 messageId) private {
        vm.chainId(SOURCE_CHAIN);
        sourceRouter.deliver(address(source), _resultMessage(VoucherRedemptionCodec.encodeResult(result), messageId));
        vm.chainId(DESTINATION_CHAIN);
    }

    function _relayCurrent(bytes32 id) private {
        vm.chainId(DESTINATION_CHAIN);
        escrow.retryAcknowledgment{ value: escrow.quoteAcknowledgment(id) }(id);
        bytes memory payload = destinationRouter.lastData();
        bytes32 messageId = destinationRouter.lastMessageId();
        vm.chainId(SOURCE_CHAIN);
        sourceRouter.deliver(address(source), _resultMessage(payload, messageId));
        vm.chainId(DESTINATION_CHAIN);
    }

    function testGnosisVoucherEscrow_rejectsWrongPayloadChainDestinationTokenAndRemedyPolicy() public {
        vm.chainId(DESTINATION_CHAIN);
        VoucherRedemptionCodec.Authorization memory authorization = _authorization();
        authorization.sourceChainId = 1;
        vm.expectRevert(VoucherRedemptionReceiver.InvalidRedemptionAuthorization.selector);
        _deliverAuthorization(authorization, keccak256("wrong source chain in payload"));
        authorization.sourceChainId = SOURCE_CHAIN;
        authorization.destinationEscrow = BUYER;
        vm.expectRevert(VoucherRedemptionReceiver.InvalidRedemptionAuthorization.selector);
        _deliverAuthorization(authorization, keccak256("wrong destination endpoint"));
        authorization.destinationEscrow = address(escrow);
        authorization.token = BUYER;
        vm.expectRevert(VoucherRedemptionReceiver.InvalidRedemptionAuthorization.selector);
        _deliverAuthorization(authorization, keccak256("asset without code"));
        authorization.token = address(token);
        authorization.remedyPolicy = 2;
        vm.expectRevert(VoucherRedemptionReceiver.InvalidRedemptionAuthorization.selector);
        _deliverAuthorization(authorization, keccak256("unsupported remedy"));
    }

    function testVoucherRedemptionModule_returnLaneRejectsWrongPeerTokensAndTrailingBytes() public {
        bytes32 id = _presentedSource();
        Client.Any2EVMMessage memory message =
            _resultMessage(VoucherRedemptionCodec.encodeResult(_result(id)), keccak256("untrusted result transport"));
        vm.chainId(SOURCE_CHAIN);
        message.sender = abi.encode(COMMUNITY_SAFE);
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        sourceRouter.deliver(address(source), message);
        message.sender = abi.encode(address(escrow));
        message.destTokenAmounts = new Client.EVMTokenAmount[](1);
        message.destTokenAmounts[0] = Client.EVMTokenAmount(address(token), 1);
        vm.expectRevert(VoucherEndpoint.AttachedTokensForbidden.selector);
        sourceRouter.deliver(address(source), message);
        message.destTokenAmounts = new Client.EVMTokenAmount[](0);
        message.data = bytes.concat(message.data, bytes32(uint256(1)));
        vm.expectRevert(VoucherRedemptionCodec.UnsupportedRedemptionMessage.selector);
        sourceRouter.deliver(address(source), message);
    }

    function testVoucherRedemptionModule_upgradePreservesAcceptedIdentityAndFrozenPayload() public {
        vm.prank(BUYER);
        bytes32 id = source.prepareRedemption(COMMITMENT_ID);
        bytes memory payload = source.getCommand(id);
        VoucherRedemptionModule next = new VoucherRedemptionModule(address(sourceRouter));
        vm.prank(COMMUNITY_SAFE);
        source.scheduleUpgrade(address(next));
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vm.prank(COMMUNITY_SAFE);
        source.upgradeTo(address(next));
        vm.prank(GUARDIAN);
        source.pause();
        vm.warp(block.timestamp + 48 hours);
        vm.prank(COMMUNITY_SAFE);
        source.upgradeTo(address(next));
        assertEq(source.redemptionOfCommitment(COMMITMENT_ID), id);
        assertEq(source.getCommand(id), payload);
        assertEq(address(source.commitmentPooling()), address(core));
    }

    function testGnosisVoucherEscrow_failedPaidAcknowledgmentRefundsFeeAndPreservesEconomicResult() public {
        bytes32 id = _presented();
        _release(id, 10, 100);
        uint64 sequence = _result(id).resultSequence;
        destinationRouter.configure(5, false, true);
        vm.deal(address(this), 20);
        vm.expectRevert(VoucherRedemptionRouter.MockTransportFailure.selector);
        escrow.retryAcknowledgment{ value: 5 }(id);
        assertEq(address(this).balance, 20);
        assertEq(token.balanceOf(ISSUER_SAFE), 100);
        assertEq(_result(id).resultSequence, sequence);
        destinationRouter.configure(5, false, false);
        escrow.retryAcknowledgment{ value: 5 }(id);
        assertEq(token.balanceOf(ISSUER_SAFE), 100);
        assertEq(escrow.getExecutionResult(id).acknowledgmentSequence, sequence);
    }
}
