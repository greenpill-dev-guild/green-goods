// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Voucher } from "../../interfaces/ICommitmentVoucherAcceptance.sol";
import {
    IVoucherAcceptancePeer,
    IEarnedVoucherAcceptancePeer,
    IVoucherServiceAcceptancePeer
} from "../../interfaces/IVoucherAcceptancePeers.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";
import { CommitmentPoolingServiceOfferStorageLib as ServiceStore } from "./ServiceOfferStorageLib.sol";
import { CommitmentPoolingVoucherAcceptanceStorageLib as Store } from "./VoucherAcceptanceStorageLib.sol";

/// @notice Internal-only named voucher acceptance rules; no callback registry or new deployed linker.
library CommitmentPoolingVoucherAcceptanceLib {
    function pin(address peer, bool earned) internal {
        Store.State storage state = Store.state();
        if ((earned ? state.earnedVoucherModule : state.voucherServiceSetupModule) != address(0)) {
            revert Voucher.VoucherAcceptancePeerAlreadyPinned();
        }
        if (
            peer.code.length == 0 || IVoucherAcceptancePeer(peer).voucherAcceptanceProtocolVersion() != 1
                || IVoucherAcceptancePeer(peer).commitmentPooling() != address(this)
                || IVoucherAcceptancePeer(peer).LOCAL_CHAIN_ID() != block.chainid
        ) revert Voucher.InvalidVoucherAcceptancePeer();
        if (earned) {
            state.earnedVoucherModule = peer;
            emit Voucher.EarnedVoucherModulePinned(peer);
        } else {
            state.voucherServiceSetupModule = peer;
            emit Voucher.VoucherServiceSetupModulePinned(peer);
        }
    }

    function bind(
        mapping(uint256 => Core.Commitment) storage commitments,
        uint256 commitmentId,
        uint64 revision,
        bytes32 termsHash
    )
        internal
    {
        Store.State storage state = Store.state();
        if (msg.sender != state.earnedVoucherModule || msg.sender == address(0)) {
            revert Voucher.UnregisteredEarnedVoucherModule();
        }
        Core.Commitment storage commitment = CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePreAcceptanceState(commitmentId, commitment);
        Voucher.EarnedVoucherBinding storage binding = state.earned[commitmentId];
        if (
            revision != binding.revision + 1 || termsHash == bytes32(0)
                || (binding.module != address(0) && binding.module != msg.sender) || binding.acceptedRevision != 0
        ) {
            revert Voucher.EarnedVoucherBindingMismatch(commitmentId);
        }
        binding.module = msg.sender;
        binding.revision = revision;
        binding.termsHash = termsHash;
        emit Voucher.EarnedVoucherTermsBound(commitmentId, msg.sender, revision, termsHash);
    }

    /// @dev Ordinary claims already read the service revision in the legacy-path guard. Avoid the
    ///      route's separate storage slot when no service terms exist; no caller can supply this choice.
    function applies(uint256 commitmentId) internal view returns (bool) {
        if (Store.state().earned[commitmentId].module != address(0)) return true;
        Service.ServiceOfferTerms storage terms = ServiceStore.state().terms[commitmentId];
        return terms.revision != 0 && terms.terms.route == Service.ServicePaymentRoute.Voucher;
    }

    /// @dev Called outside the exchange authority-skip branch, while current pending claims still exist.
    function validate(
        uint256 commitmentId,
        address creator,
        address claimant
    )
        internal
        view
        returns (Voucher.VoucherServiceAcceptance memory receipt)
    {
        Store.State storage state = Store.state();
        Voucher.EarnedVoucherBinding storage binding = state.earned[commitmentId];
        if (binding.module != address(0)) {
            bytes4 magic = IEarnedVoucherAcceptancePeer(binding.module)
                .validateEarnedVoucherAcceptance(commitmentId, binding.revision, binding.termsHash, creator, claimant);
            if (magic != IEarnedVoucherAcceptancePeer.validateEarnedVoucherAcceptance.selector) {
                revert Voucher.EarnedVoucherBindingMismatch(commitmentId);
            }
        }
        ServiceStore.State storage services = ServiceStore.state();
        Service.ServiceOfferTerms storage terms = services.terms[commitmentId];
        if (terms.terms.route != Service.ServicePaymentRoute.Voucher) return receipt;
        Service.ServiceClaimConsent storage consent = services.claimConsent[commitmentId][claimant];
        if (
            state.voucherServiceSetupModule == address(0) || consent.claimHash == bytes32(0)
                || consent.termsRevision != terms.revision || consent.termsHash != terms.termsHash
        ) {
            revert Voucher.InvalidVoucherServiceAcceptance(commitmentId);
        }
        receipt.setupModule = state.voucherServiceSetupModule;
        receipt.claimHash = consent.claimHash;
        receipt.termsRevision = consent.termsRevision;
        receipt.requestNonce = consent.requestNonce;
        (receipt.setupId, receipt.authorizationHash, receipt.depositReceiptHash) = IVoucherServiceAcceptancePeer(
                receipt.setupModule
            )
            .validateVoucherServiceAcceptance(
                commitmentId,
                claimant,
                terms.revision,
                terms.termsHash,
                consent.claimHash,
                consent.requestNonce,
                consent.voucherHolder
            );
        if (
            receipt.setupId == bytes32(0) || receipt.authorizationHash == bytes32(0)
                || receipt.depositReceiptHash == bytes32(0)
        ) {
            revert Voucher.InvalidVoucherServiceAcceptance(commitmentId);
        }
    }

    /// @dev No external call occurs here or after this receipt write in final core acceptance.
    function record(
        uint256 commitmentId,
        address creator,
        address claimant,
        Voucher.VoucherServiceAcceptance memory receipt
    )
        internal
    {
        Store.State storage state = Store.state();
        Voucher.EarnedVoucherBinding storage binding = state.earned[commitmentId];
        if (binding.module != address(0)) {
            binding.acceptedRevision = binding.revision;
            binding.acceptedTermsHash = binding.termsHash;
            binding.acceptedCounterparty = claimant;
            emit Voucher.EarnedVoucherAcceptanceRecorded(
                commitmentId, binding.module, binding.revision, binding.termsHash, creator, claimant
            );
        }
        if (receipt.setupModule != address(0)) {
            if (state.acceptedService[commitmentId].setupId != bytes32(0)) {
                revert Voucher.InvalidVoucherServiceAcceptance(commitmentId);
            }
            state.acceptedService[commitmentId] = receipt;
            emit Voucher.VoucherServiceAcceptanceRecorded(
                commitmentId,
                receipt.claimHash,
                receipt.setupId,
                receipt.setupModule,
                receipt.termsRevision,
                receipt.requestNonce,
                receipt.authorizationHash,
                receipt.depositReceiptHash
            );
        }
    }
}
