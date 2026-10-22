// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherServiceSourceTestBase } from "../helpers/VoucherServiceSourceTestBase.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";

contract VoucherServiceSourceTest is VoucherServiceSourceTestBase {
    function testVoucherSetup_preparesIdentifierWhileCoreStillOffered() public {
        bytes32 id = _prepare();
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        assertEq(id, Codec.setupId(a));
        assertEq(source.setupOfClaim(1, a.claimHash), id);
        assertEq(source.redemptionOfCommitment(1), bytes32(0));
        assertEq(uint256(core.getCommitment(1).state), uint256(Core.CommitmentState.Offered));
        assertEq(a.coreModule, address(core));
        assertEq(a.holder, HOLDER);
        assertTrue(a.buyer != a.holder);
    }

    function testVoucherSetup_exactRepeatPreservesIdentityAndFrozenDeadline() public {
        bytes32 id = _prepare();
        assertEq(_prepare(), id);
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        vm.prank(BUYER);
        vm.expectRevert(VoucherRedemptionModule.RedemptionAlreadyPrepared.selector);
        source.prepareVoucherSetup(1, a.termsRevision, a.termsHash, a.claimHash, a.requestNonce, 2001);
        assertEq(source.getSetupAuthorization(id).acceptanceDeadline, 2000);
    }

    function testVoucherSetup_rejectsNonBuyerEvenWhenFixtureReturnsSameConsent() public {
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
        source.prepareVoucherSetup(1, 1, s.termsHash, s.claimHash, 1, 2000);
    }

    function testVoucherSetup_rejectsUnpinnedPeer() public {
        core.pinFixture(address(0));
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        vm.prank(BUYER);
        vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
        source.prepareVoucherSetup(1, 1, s.termsHash, s.claimHash, 1, 2000);
    }

    function testVoucherSetup_rejectsStaleRevisionHashNonceAndClaim() public {
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        for (uint256 i; i < 4; ++i) {
            vm.prank(BUYER);
            vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
            source.prepareVoucherSetup(
                1,
                i == 0 ? 2 : 1,
                i == 1 ? bytes32(uint256(1)) : s.termsHash,
                i == 2 ? bytes32(uint256(2)) : s.claimHash,
                i == 3 ? 2 : 1,
                2000
            );
        }
    }

    function testVoucherSetup_rejectsLegacyPersonalAndGdConsideration() public {
        Core.Commitment memory c = core.getCommitment(1);
        Services.ServiceOfferTerms memory t = core.getServiceOfferTerms(1);
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        Core.PendingClaim memory p = core.getPendingClaim(1, BUYER);
        for (uint256 i; i < 3; ++i) {
            t.terms.route = i == 0 ? Services.ServicePaymentRoute.Legacy : Services.ServicePaymentRoute.PersonalGd;
            if (i == 2) {
                t.terms.route = Services.ServicePaymentRoute.Voucher;
                c.consideration.amount = 1;
            }
            _rewrite(c, t, s, p);
            vm.prank(BUYER);
            vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
            source.prepareVoucherSetup(1, 1, s.termsHash, s.claimHash, 1, 2000);
        }
    }

    function testVoucherSetup_rejectsWrongChainPartyMembershipContextAndUnits() public {
        Core.Commitment memory c = core.getCommitment(1);
        Services.ServiceOfferTerms memory t = core.getServiceOfferTerms(1);
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        Core.PendingClaim memory p = core.getPendingClaim(1, BUYER);
        t.terms.voucherChainId = 101;
        _rewrite(c, t, s, p);
        _expectPrepareInvalid(s);
        t.terms.voucherChainId = 100;
        p.gardenContext = address(0xBAD);
        _rewrite(c, t, s, p);
        _expectPrepareInvalid(s);
        p.gardenContext = s.buyerGarden;
        c.targetUnits = 0;
        _rewrite(c, t, s, p);
        _expectPrepareInvalid(s);
    }

    function testVoucherSetup_rejectsZeroIssuerTokenHolderAndVoucherUnits() public {
        Core.Commitment memory c = core.getCommitment(1);
        Services.ServiceOfferTerms memory t = core.getServiceOfferTerms(1);
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        Core.PendingClaim memory p = core.getPendingClaim(1, BUYER);
        for (uint256 i; i < 4; ++i) {
            t.terms.voucherIssuer = i == 0 ? address(0) : address(0xA002);
            t.terms.voucherToken = i == 1 ? address(0) : address(0xA003);
            s.voucherHolder = i == 2 ? address(0) : HOLDER;
            t.terms.voucherUnits = i == 3 ? 0 : 100;
            _rewrite(c, t, s, p);
            vm.prank(BUYER);
            vm.expectRevert(Codec.InvalidVoucherServiceAuthorization.selector);
            source.prepareVoucherSetup(1, 1, s.termsHash, s.claimHash, 1, 2000);
        }
    }

    function testVoucherSetup_requiresFullAuthenticatedDepositBeforeReadiness() public {
        bytes32 id = _prepare();
        _expectGuardRevert(id, VoucherRedemptionModule.VoucherSetupNotReady.selector);
        _deliver(Codec.encodeSetupResult(_depositResult(id, 1)));
        (bytes32 readyId,, bytes32 receipt) = _guard(id);
        assertEq(readyId, id);
        assertEq(receipt, Codec.depositReceiptHash(source.getSetupAuthorization(id)));
        vm.expectRevert(VoucherRedemptionModule.CoreOnly.selector);
        source.validateVoucherServiceAcceptance(1, BUYER, 1, bytes32(0), bytes32(0), 1, HOLDER);
    }

    function testVoucherSetup_abortFirstPermanentlyRejectsAcceptance() public {
        bytes32 id = _funded();
        bytes32 authHash = Codec.hash(source.getSetupAuthorization(id));
        vm.prank(BUYER);
        bytes32 decision = source.abortSetup(id, authHash);
        vm.prank(BUYER);
        assertEq(source.abortSetup(id, authHash), decision);
        _expectGuardRevert(id, VoucherRedemptionModule.VoucherSetupNotReady.selector);
    }

    function testVoucherSetup_acceptedEverWinsBeforeOutboxAndAfterEveryLaterLifecycle() public {
        bytes32 id = _funded();
        _accept(id);
        bytes32 authHash = Codec.hash(source.getSetupAuthorization(id));
        for (uint256 state = 3; state <= 8; ++state) {
            core.setLifecycleFixture(Core.CommitmentState(state));
            vm.prank(BUYER);
            vm.expectRevert(VoucherRedemptionModule.VoucherSetupAlreadyAccepted.selector);
            source.abortSetup(id, authHash);
        }
        vm.warp(3000);
        bytes32 decision = source.finalizeActivation(id, authHash);
        assertEq(source.finalizeActivation(id, authHash), decision);
        assertEq(source.redemptionOfCommitment(1), id);
    }

    function testVoucherSetup_acceptanceDeadlineEqualityAndStrictSourceExpiry() public {
        bytes32 id = _funded();
        vm.warp(2000);
        _guard(id);
        bytes32 authHash = Codec.hash(source.getSetupAuthorization(id));
        vm.expectRevert(VoucherRedemptionModule.SetupAbortNotAuthorized.selector);
        source.abortSetup(id, authHash);
        vm.warp(2001);
        _expectGuardRevert(id, VoucherRedemptionModule.VoucherSetupNotReady.selector);
        source.abortSetup(id, authHash);
        assertEq(uint256(source.getSetup(id).decision), uint256(Codec.SetupDecision.Abort));
    }

    function testVoucherSetup_oldClaimRefundRemainsAvailableAfterDifferentClaimAccepted() public {
        bytes32 oldId = _funded();
        bytes32 oldHash = Codec.hash(source.getSetupAuthorization(oldId));
        _configure(2, keccak256("new exact claim"), address(0xB004));
        bytes32 newId = _funded();
        assertTrue(newId != oldId);
        _accept(newId);
        source.finalizeActivation(newId, Codec.hash(source.getSetupAuthorization(newId)));
        source.abortSetup(oldId, oldHash);
        assertEq(uint256(source.getSetup(oldId).decision), uint256(Codec.SetupDecision.Abort));
        assertEq(source.redemptionOfCommitment(1), newId);
    }

    function testVoucherSetup_pauseBlocksNewAcceptanceButAllowsAbortDispatchAndReads() public {
        bytes32 id = _funded();
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        source.pause();
        _expectGuardRevert(id, VoucherEndpoint.VoucherPaused.selector);
        vm.prank(BUYER);
        source.abortSetup(id, Codec.hash(a));
        source.dispatchSetupCommand(id, 1);
        assertEq(keccak256(router.lastData()), keccak256(source.getSetupCommand(id, 1)));
        vm.expectRevert(VoucherEndpoint.VoucherPaused.selector);
        source.dispatchSetupCommand(id, 0);
    }

    function testVoucherSetup_dispatchRetriesBindSamePayloadAndExactCallerFee() public {
        bytes32 id = _prepare();
        router.configure(3, false);
        assertEq(source.quoteSetupCommand(id, 0), 3);
        vm.deal(address(this), 10);
        vm.expectRevert(abi.encodeWithSelector(VoucherRedemptionModule.IncorrectRedemptionFee.selector, 3, 2));
        source.dispatchSetupCommand{ value: 2 }(id, 0);
        bytes32 first = source.dispatchSetupCommand{ value: 3 }(id, 0);
        bytes memory data = router.lastData();
        bytes32 second = source.dispatchSetupCommand{ value: 3 }(id, 0);
        assertTrue(first != second);
        assertEq(router.lastData(), data);
        assertEq(source.getSetup(id).lastPrepareMessageId, second);
    }

    function testVoucherSetup_legacyExecutionSelectorsRejectExplicitly() public {
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupRequired.selector);
        source.prepareRedemption(1);
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupRequired.selector);
        source.quoteDispatch(bytes32(0));
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupRequired.selector);
        source.dispatch(bytes32(0));
    }

    function testVoucherSetup_currentTermsRaceCannotUseOldPendingConsent() public {
        Core.Commitment memory c = core.getCommitment(1);
        Services.ServiceOfferTerms memory t = core.getServiceOfferTerms(1);
        Services.ServiceClaimConsent memory s = core.getServiceClaimConsent(1, BUYER);
        Core.PendingClaim memory p = core.getPendingClaim(1, BUYER);
        t.revision = 2;
        t.termsHash = keccak256("fictional changed terms");
        _rewrite(c, t, s, p);
        vm.prank(BUYER);
        vm.expectRevert(VoucherRedemptionModule.InvalidServiceAuthorization.selector);
        source.prepareVoucherSetup(1, 2, t.termsHash, s.claimHash, 1, 2000);
    }

    function testVoucherSetup_failedTransportRetainsSameOutboxForRepair() public {
        bytes32 id = _prepare();
        bytes memory payload = source.getSetupCommand(id, 0);
        router.configure(0, true);
        vm.expectRevert(bytes("fixture transport"));
        source.dispatchSetupCommand(id, 0);
        assertEq(source.getSetup(id).lastPrepareMessageId, bytes32(0));
        assertEq(source.getSetupCommand(id, 0), payload);
        router.configure(0, false);
        source.dispatchSetupCommand(id, 0);
        assertEq(router.lastData(), payload);
    }

    function testVoucherSetup_guardChecksEveryExactConsentFact() public {
        bytes32 id = _funded();
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(id);
        for (uint256 i; i < 6; ++i) {
            vm.prank(address(core));
            vm.expectRevert();
            source.validateVoucherServiceAcceptance(
                1,
                i == 0 ? address(0xBAD) : a.buyer,
                i == 1 ? 2 : a.termsRevision,
                i == 2 ? bytes32(uint256(1)) : a.termsHash,
                i == 3 ? bytes32(uint256(2)) : a.claimHash,
                i == 4 ? 2 : a.requestNonce,
                i == 5 ? address(0xBAD) : a.holder
            );
        }
    }

    function testVoucherSetup_timelockedUpgradePreservesNamespaceAndEndpointIdentity() public {
        bytes32 id = _funded();
        bytes32 authHash = Codec.hash(source.getSetupAuthorization(id));
        source.pause();
        VoucherRedemptionModule next = new VoucherRedemptionModule(address(router));
        source.scheduleUpgrade(address(next));
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        source.upgradeTo(address(next));
        vm.warp(block.timestamp + 48 hours);
        source.upgradeTo(address(next));
        assertEq(Codec.hash(source.getSetupAuthorization(id)), authHash);
        assertEq(source.getSetup(id).depositedUnits, 100);
        assertEq(address(source.commitmentPooling()), address(core));
    }

    function testVoucherSetup_upgradeCannotChangeTransportIdentity() public {
        source.pause();
        VoucherRedemptionModule next = new VoucherRedemptionModule(address(0xBADD));
        source.scheduleUpgrade(address(next));
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(VoucherEndpoint.ImmutableEndpointMismatch.selector);
        source.upgradeTo(address(next));
    }

    function testFuzz_VoucherSetup_deadlineChangesAuthorizationButNeverSetupIdentity(uint64 deadline) public {
        vm.assume(deadline != 2000);
        Codec.SetupAuthorization memory a = source.getSetupAuthorization(_prepare());
        bytes32 id = Codec.setupId(a);
        bytes32 authHash = Codec.hash(a);
        a.acceptanceDeadline = deadline;
        assertEq(Codec.setupId(a), id);
        assertTrue(Codec.hash(a) != authHash);
        assertEq(Codec.decodeAuthorization(Codec.encodeAuthorization(a)).acceptanceDeadline, deadline);
    }

    function _expectPrepareInvalid(Services.ServiceClaimConsent memory s) private {
        vm.prank(BUYER);
        vm.expectRevert();
        source.prepareVoucherSetup(1, 1, s.termsHash, s.claimHash, 1, 2000);
    }
}
