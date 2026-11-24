// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { VoucherServiceSourceRouter, VoucherServiceSourceCore } from "./VoucherServiceSourceFixture.sol";

/// @dev Fictional source accounts and deterministic transport. No actual core/signing/CCIP proof.
abstract contract VoucherServiceSourceTestBase is Test {
    VoucherServiceSourceRouter internal router;
    VoucherServiceSourceCore internal core;
    VoucherRedemptionModule internal source;
    address internal constant BUYER = address(0xB001);
    address internal constant HOLDER = address(0xB002);
    address internal constant DESTINATION = address(0xD001);
    uint256 internal transportNonce;

    function setUp() public virtual {
        vm.warp(1000);
        router = new VoucherServiceSourceRouter();
        core = new VoucherServiceSourceCore();
        VoucherRedemptionModule implementation = new VoucherRedemptionModule(address(router));
        source = VoucherRedemptionModule(
            payable(address(
                    new ERC1967Proxy(
                        address(implementation),
                        abi.encodeCall(
                            VoucherRedemptionModule.initialize,
                            (address(this), address(0x600D), 100, 100, DESTINATION, address(core))
                        )
                    )
                ))
        );
        core.pinFixture(address(source));
        _configure(1, keccak256("fictional exact pending claim"), HOLDER);
        source.unpause();
    }

    function _configure(uint64 nonce, bytes32 claimHash, address holder) internal {
        Core.Commitment memory c;
        c.state = Core.CommitmentState.Offered;
        c.direction = Core.CommitmentDirection.Offer;
        c.claimType = Core.ClaimType.Individual;
        c.claimMode = Core.ClaimMode.ApprovalGated;
        c.providerGarden = address(0xA001);
        c.targetUnits = 10;
        c.unitLabel = "fictional lessons";
        Services.ServiceOfferTerms memory offer;
        offer.revision = 1;
        offer.termsHash = keccak256("fictional exact voucher terms");
        offer.terms = Services.ServiceOfferTermsInput(
            Services.ServicePaymentRoute.Voucher,
            keccak256("fictional service"),
            keccak256("fictional mutual remedy"),
            100,
            address(0xA002),
            address(0xA003),
            100
        );
        Services.ServiceClaimConsent memory consent =
            Services.ServiceClaimConsent(1, nonce, address(0xB003), holder, offer.termsHash, claimHash);
        Core.PendingClaim memory pending =
            Core.PendingClaim(BUYER, BUYER, Core.ClaimType.Individual, consent.buyerGarden, uint64(block.timestamp), true);
        core.configure(c, offer, consent, pending);
    }

    function _prepare() internal returns (bytes32 id) {
        Services.ServiceOfferTerms memory offer = core.getServiceOfferTerms(1);
        Services.ServiceClaimConsent memory consent = core.getServiceClaimConsent(1, BUYER);
        vm.prank(BUYER);
        return source.prepareVoucherSetup(1, offer.revision, offer.termsHash, consent.claimHash, consent.requestNonce, 2000);
    }

    function _funded() internal returns (bytes32 id) {
        id = _prepare();
        _deliver(Codec.encodeSetupResult(_depositResult(id, 1)));
    }

    function _guard(bytes32 id) internal returns (bytes32, bytes32, bytes32) {
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        vm.prank(address(core));
        return source.validateVoucherServiceAcceptance(
            a.commitmentId, a.buyer, a.termsRevision, a.termsHash, a.claimHash, a.requestNonce, a.holder
        );
    }

    function _expectGuardRevert(bytes32 id, bytes4 selector) internal {
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        vm.prank(address(core));
        vm.expectRevert(selector);
        source.validateVoucherServiceAcceptance(
            a.commitmentId, a.buyer, a.termsRevision, a.termsHash, a.claimHash, a.requestNonce, a.holder
        );
    }

    function _accept(bytes32 id) internal {
        (bytes32 readyId, bytes32 authHash, bytes32 receiptHash) = _guard(id);
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        core.acceptFixture(
            Acceptance.VoucherServiceAcceptance(
                address(source), a.claimHash, a.termsRevision, a.requestNonce, readyId, authHash, receiptHash
            )
        );
    }

    function _activated() internal returns (bytes32 id) {
        id = _funded();
        _accept(id);
        source.finalizeActivation(id, Codec.hash(source.getSetupAuthorization(id)));
    }

    function _depositResult(bytes32 id, uint64 sequence) internal view returns (Codec.SetupResult memory r) {
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        r.version = Codec.VERSION;
        r.setupId = id;
        r.authorizationHash = Codec.hash(a);
        r.resultSequence = sequence;
        r.phase = Codec.SetupPhase.Deposited;
        r.issuerApproved = true;
        r.depositReceiptHash = Codec.depositReceiptHash(a);
        r.depositedUnits = a.voucherUnits;
        r.actionSucceeded = true;
    }

    function _finalResult(bytes32 id, uint64 sequence) internal view returns (Codec.FinalResultV2 memory r) {
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        r.protocolVersion = Codec.VERSION;
        r.setupId = id;
        r.payloadHash = Codec.hash(a);
        r.sequence = sequence;
        r.activationDecisionId = source.getSetup(id).decisionId;
        r.issuerReturnApprovalAtFreeze = 60;
        r.allocation = Codec.FinalAllocation(3, 40, 60);
        r.decisionId = Codec.finalDecisionId(a, r.activationDecisionId, r.allocation, 60);
        r.release = Codec.LegProgress(Codec.LegState.Pending, 0, bytes32(0));
        r.refund = Codec.LegProgress(Codec.LegState.Pending, 0, bytes32(0));
    }

    function _message(bytes memory data) internal returns (Client.Any2EVMMessage memory m) {
        m.messageId = keccak256(abi.encode(++transportNonce));
        m.sourceChainSelector = 100;
        m.sender = abi.encode(DESTINATION);
        m.data = data;
        m.destTokenAmounts = new Client.EVMTokenAmount[](0);
    }

    function _deliver(bytes memory data) internal {
        router.deliver(address(source), _message(data));
    }

    function _rewrite(
        Core.Commitment memory c,
        Services.ServiceOfferTerms memory offer,
        Services.ServiceClaimConsent memory consent,
        Core.PendingClaim memory pending
    )
        internal
    {
        core.configure(c, offer, consent, pending);
    }

    function _invalidResult(Codec.SetupResult memory r) internal {
        bytes memory data = Codec.encodeSetupResult(r);
        Client.Any2EVMMessage memory m = _message(data);
        vm.expectRevert(Codec.InvalidVoucherServiceResult.selector);
        router.deliver(address(source), m);
    }
}
