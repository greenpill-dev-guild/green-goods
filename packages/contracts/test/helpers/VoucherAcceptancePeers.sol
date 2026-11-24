// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Voucher } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";

/// @dev Explicit fictional readiness stand-in, not authenticated Gnosis escrow or member signing proof.
contract VoucherServiceReadinessMock {
    address public immutable commitmentPooling;
    uint256 public immutable LOCAL_CHAIN_ID = block.chainid;
    bool public ready = true;
    bool public zeroReceipt;

    error EscrowNotReady();
    error InvalidGuardContext();

    constructor(address core) {
        commitmentPooling = core;
    }

    function voucherAcceptanceProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function setReady(bool value) external {
        ready = value;
    }

    function setZeroReceipt(bool value) external {
        zeroReceipt = value;
    }

    function validateVoucherServiceAcceptance(
        uint256 id,
        address buyer,
        uint64 revision,
        bytes32 termsHash,
        bytes32 claimHash,
        uint64 requestNonce,
        address holder
    )
        external
        view
        returns (bytes32 setupId, bytes32 authorizationHash, bytes32 depositReceiptHash)
    {
        if (!ready) revert EscrowNotReady();
        Core core = Core(commitmentPooling);
        Service service = Service(commitmentPooling);
        Core.PendingClaim memory pending = core.getPendingClaim(id, buyer);
        Service.ServiceClaimConsent memory consent = service.getServiceClaimConsent(id, buyer);
        Service.ServiceOfferTerms memory terms = service.getServiceOfferTerms(id);
        if (
            msg.sender != commitmentPooling || core.getCommitment(id).state != Core.CommitmentState.Offered
                || !pending.active || pending.claimant != buyer || pending.requestedBy != buyer
                || pending.kind != Core.ClaimType.Individual || pending.gardenContext != consent.buyerGarden
                || consent.termsRevision != revision || consent.termsHash != termsHash || consent.claimHash != claimHash
                || consent.requestNonce != requestNonce || consent.voucherHolder != holder || terms.revision != revision
                || terms.termsHash != termsHash || service.getAcceptedServiceTerms(id).buyer != address(0)
                || Voucher(commitmentPooling).getVoucherServiceAcceptance(id).setupId != bytes32(0)
        ) {
            revert InvalidGuardContext();
        }
        if (zeroReceipt) return (bytes32(0), bytes32(0), bytes32(0));
        setupId = keccak256(abi.encode(id, claimHash, requestNonce));
        authorizationHash = keccak256(abi.encode(revision, termsHash, buyer, holder));
        depositReceiptHash = keccak256(abi.encode(setupId, authorizationHash, "fictional full deposit"));
    }
}

/// @dev Pin/binding test peer only. Real issuer/participant authorization uses VoucherEntitlement tests.
contract EarnedVoucherAcceptanceMock {
    address public immutable commitmentPooling;
    uint256 public immutable LOCAL_CHAIN_ID;
    uint16 public immutable version;
    bool public ready = true;
    bool public wrongMagic;
    error ConsentNotReady();

    constructor(address core, uint256 chain, uint16 version_) {
        commitmentPooling = core;
        LOCAL_CHAIN_ID = chain;
        version = version_;
    }

    function voucherAcceptanceProtocolVersion() external view returns (uint16) {
        return version;
    }

    function bind(uint256 id, uint64 revision, bytes32 termsHash) external {
        Voucher(commitmentPooling).bindEarnedVoucherTerms(id, revision, termsHash);
    }

    function setReady(bool value) external {
        ready = value;
    }

    function setWrongMagic(bool value) external {
        wrongMagic = value;
    }

    function validateEarnedVoucherAcceptance(uint256, uint64, bytes32, address, address) external view returns (bytes4) {
        if (!ready) revert ConsentNotReady();
        require(msg.sender == commitmentPooling, "core only");
        return wrongMagic
            ? bytes4(0)
            : bytes4(keccak256("validateEarnedVoucherAcceptance(uint256,uint64,bytes32,address,address)"));
    }
}

/// @dev Deliberately selector-compatible but stateful guard, proving the core uses STATICCALL.
contract MutatingEarnedVoucherPeer {
    address public immutable commitmentPooling;
    uint256 public immutable LOCAL_CHAIN_ID = block.chainid;
    uint256 public calls;

    constructor(address core) {
        commitmentPooling = core;
    }

    function voucherAcceptanceProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function bind(uint256 id, bytes32 termsHash) external {
        Voucher(commitmentPooling).bindEarnedVoucherTerms(id, 1, termsHash);
    }

    function validateEarnedVoucherAcceptance(uint256, uint64, bytes32, address, address) external returns (bytes4) {
        calls++;
        return bytes4(keccak256("validateEarnedVoucherAcceptance(uint256,uint64,bytes32,address,address)"));
    }
}
