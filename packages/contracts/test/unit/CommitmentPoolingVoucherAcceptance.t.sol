// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentVoucherAcceptance as Voucher } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { EarnedVoucherAcceptanceMock, MutatingEarnedVoucherPeer } from "../helpers/VoucherAcceptancePeers.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @notice Real final acceptance with explicit local named-peer stand-ins; no transport/custody proof.
contract CommitmentPoolingVoucherAcceptanceTest is CommitmentPoolingFixture {
    Voucher private voucher;
    EarnedVoucherAcceptanceMock private peer;
    bytes32 private constant TERMS = keccak256("fictional revision one");

    function setUp() public {
        _setUpProductionFixture();
        voucher = Voucher(address(module));
        peer = new EarnedVoucherAcceptanceMock(address(module), block.chainid, 1);
    }

    function testVoucherAcceptance_pinRequiresPausedOwnerAndCannotBeReplaced() public {
        vm.expectRevert(Core.ModuleMustBePaused.selector);
        voucher.pinEarnedVoucherModule(address(peer));
        module.setPaused(true);
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(CLAIMANT);
        voucher.pinEarnedVoucherModule(address(peer));
        voucher.pinEarnedVoucherModule(address(peer));
        vm.expectRevert(Voucher.VoucherAcceptancePeerAlreadyPinned.selector);
        voucher.pinEarnedVoucherModule(address(peer));
    }

    function testVoucherAcceptance_pinRejectsWrongCoreChainVersionAndMissingCode() public {
        module.setPaused(true);
        EarnedVoucherAcceptanceMock wrongCore = new EarnedVoucherAcceptanceMock(address(0xBAD), block.chainid, 1);
        EarnedVoucherAcceptanceMock wrongChain = new EarnedVoucherAcceptanceMock(address(module), block.chainid + 1, 1);
        EarnedVoucherAcceptanceMock wrongVersion = new EarnedVoucherAcceptanceMock(address(module), block.chainid, 2);
        vm.expectRevert(Voucher.InvalidVoucherAcceptancePeer.selector);
        voucher.pinEarnedVoucherModule(address(0xBAD));
        vm.expectRevert(Voucher.InvalidVoucherAcceptancePeer.selector);
        voucher.pinEarnedVoucherModule(address(wrongCore));
        vm.expectRevert(Voucher.InvalidVoucherAcceptancePeer.selector);
        voucher.pinEarnedVoucherModule(address(wrongChain));
        vm.expectRevert(Voucher.InvalidVoucherAcceptancePeer.selector);
        voucher.pinEarnedVoucherModule(address(wrongVersion));
        voucher.pinEarnedVoucherModule(address(peer));
        assertEq(voucher.voucherAcceptanceProtocolVersion(), 1);
    }

    function testVoucherAcceptance_onlyPinnedPeerBindsSequentialPreacceptanceTerms() public {
        uint256 id = _createOffer(keccak256("binding-authority"));
        vm.expectRevert(Voucher.UnregisteredEarnedVoucherModule.selector);
        peer.bind(id, 1, TERMS);
        _pin();
        vm.expectRevert(Voucher.UnregisteredEarnedVoucherModule.selector);
        voucher.bindEarnedVoucherTerms(id, 1, TERMS);
        vm.expectRevert(abi.encodeWithSelector(Voucher.EarnedVoucherBindingMismatch.selector, id));
        peer.bind(id, 2, TERMS);
        vm.expectRevert(abi.encodeWithSelector(Voucher.EarnedVoucherBindingMismatch.selector, id));
        peer.bind(id, 1, bytes32(0));
        peer.bind(id, 1, TERMS);
        peer.bind(id, 2, keccak256("fictional revision two"));
        assertEq(voucher.getEarnedVoucherBinding(id).revision, 2);
        _acceptOffer(id);
        vm.expectRevert(abi.encodeWithSelector(Core.CommitmentNotInState.selector, id, Core.CommitmentState.Accepted));
        peer.bind(id, 3, TERMS);
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedRevision, 2);
    }

    function testVoucherAcceptance_guardFailureRollsBackGatedPendingAndProviderState() public {
        _pin();
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("guard-pending"));
        params.claimMode = Core.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        peer.bind(id, 1, TERMS);
        vm.prank(CLAIMANT);
        module.claimCommitment(id, Core.ClaimType.Individual, POOL_GARDEN);
        peer.setReady(false);
        vm.expectRevert(EarnedVoucherAcceptanceMock.ConsentNotReady.selector);
        module.acceptClaim(id, CLAIMANT);
        assertTrue(module.getPendingClaim(id, CLAIMANT).active);
        assertFalse(module.isContributor(id, CREATOR));
        assertEq(module.getCommitment(id).counterparty, address(0));
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedRevision, 0);
        peer.setReady(true);
        module.acceptClaim(id, CLAIMANT);
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedCounterparty, CLAIMANT);
    }

    function testVoucherAcceptance_wrongMagicAndExistingProviderMembershipStillReject() public {
        _pin();
        uint256 id = _createOffer(keccak256("guard-magic"));
        peer.bind(id, 1, TERMS);
        peer.setWrongMagic(true);
        vm.expectRevert(abi.encodeWithSelector(Voucher.EarnedVoucherBindingMismatch.selector, id));
        _acceptOffer(id);
        peer.setWrongMagic(false);
        hats.setGardener(POOL_GARDEN, CREATOR, false);
        vm.expectRevert(abi.encodeWithSelector(Core.NotEligibleContributor.selector, CREATOR));
        _acceptOffer(id);
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedRevision, 0);
    }

    function testVoucherAcceptance_exchangeSecondGuardFailureRollsBackBothLegs() public {
        _pin();
        uint256 a = _createOffer(keccak256("guard-exchange-a"));
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("guard-exchange-b"));
        params.counterCommitmentId = a;
        vm.prank(CLAIMANT);
        uint256 b = module.createCommitment(params);
        peer.bind(b, 1, TERMS);
        peer.setReady(false);
        vm.expectRevert(EarnedVoucherAcceptanceMock.ConsentNotReady.selector);
        vm.prank(CREATOR);
        module.acceptExchange(b);
        assertEq(uint256(module.getCommitment(a).state), uint256(Core.CommitmentState.Offered));
        assertEq(uint256(module.getCommitment(b).state), uint256(Core.CommitmentState.Offered));
        assertFalse(module.isContributor(a, CREATOR));
        peer.setReady(true);
        vm.prank(CREATOR);
        module.acceptExchange(b);
        assertEq(voucher.getEarnedVoucherBinding(b).acceptedCounterparty, CREATOR);
    }

    function testUpgrade_VoucherAcceptance_sameArtifactPreservesBindingPinsAndAcceptedEverFacts() public {
        _pin();
        uint256 accepted = _createOffer(keccak256("guard-upgrade-accepted"));
        peer.bind(accepted, 1, TERMS);
        _acceptOffer(accepted);
        uint256 pending = _createOffer(keccak256("guard-upgrade-pending"));
        peer.bind(pending, 1, TERMS);
        bytes32 beforeHash =
            keccak256(abi.encode(voucher.getEarnedVoucherBinding(accepted), voucher.getEarnedVoucherBinding(pending)));
        module.setPaused(true);
        address replacement = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        UUPSUpgradeable(address(module)).upgradeTo(replacement);
        assertEq(
            keccak256(abi.encode(voucher.getEarnedVoucherBinding(accepted), voucher.getEarnedVoucherBinding(pending))),
            beforeHash
        );
        vm.expectRevert(Voucher.VoucherAcceptancePeerAlreadyPinned.selector);
        voucher.pinEarnedVoucherModule(address(peer));
        module.setPaused(false);
        module.cancelCommitment(accepted, "fictional terminal cancellation");
        assertEq(voucher.getEarnedVoucherBinding(accepted).acceptedRevision, 1);
        assertEq(voucher.getEarnedVoucherBinding(accepted).acceptedCounterparty, CLAIMANT);
        _acceptOffer(pending);
        assertEq(voucher.getEarnedVoucherBinding(pending).acceptedRevision, 1);
    }

    function testVoucherAcceptance_guardCannotMutateUnderStaticcallAndAcceptanceRollsBack() public {
        MutatingEarnedVoucherPeer mutating = new MutatingEarnedVoucherPeer(address(module));
        module.setPaused(true);
        voucher.pinEarnedVoucherModule(address(mutating));
        module.setPaused(false);
        uint256 id = _createOffer(keccak256("static-view-guard"));
        mutating.bind(id, TERMS);
        vm.expectRevert(); // EVM rejects SSTORE in the typed view STATICCALL.
        _acceptOffer(id);
        assertEq(mutating.calls(), 0);
        assertEq(module.getCommitment(id).counterparty, address(0));
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedRevision, 0);
    }

    function testVoucherAcceptance_legacyNeedsNoPeerAndHasNoImplicitBinding() public {
        uint256 id = _createOffer(keccak256("guard-legacy"));
        _acceptOffer(id);
        assertEq(voucher.getEarnedVoucherBinding(id).module, address(0));
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedRevision, 0);
        assertEq(voucher.getVoucherServiceAcceptance(id).setupId, bytes32(0));
    }

    function _pin() private {
        module.setPaused(true);
        voucher.pinEarnedVoucherModule(address(peer));
        module.setPaused(false);
    }
}
