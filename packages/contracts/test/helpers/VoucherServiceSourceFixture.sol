// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";

interface IVoucherServiceSourceReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

/// @dev Deterministic local transport stand-in; never a CCIP finality/DON receipt.
contract VoucherServiceSourceRouter {
    uint256 public fee;
    uint256 public nonce;
    bytes public lastData;
    bool public sendFails;

    function configure(uint256 fee_, bool fails_) external {
        fee = fee_;
        sendFails = fails_;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        return fee;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        require(!sendFails && msg.value == fee && message.tokenAmounts.length == 0, "fixture transport");
        lastData = message.data;
        return keccak256(abi.encode(++nonce));
    }

    function deliver(address receiver, Client.Any2EVMMessage memory message) external {
        IVoucherServiceSourceReceiver(receiver).ccipReceive(message);
    }
}

/// @dev Selector-faithful local core views; actual core acceptance is tested in its owning lane.
contract VoucherServiceSourceCore {
    Core.Commitment private _commitment;
    Services.ServiceOfferTerms private _offer;
    Services.ServiceClaimConsent private _consent;
    Core.PendingClaim private _pending;
    Acceptance.VoucherServiceAcceptance private _accepted;
    address public voucherServiceSetupModule;

    function serviceOfferProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function voucherAcceptanceProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function pinFixture(address source) external {
        voucherServiceSetupModule = source;
    }

    function configure(
        Core.Commitment memory c,
        Services.ServiceOfferTerms memory offer,
        Services.ServiceClaimConsent memory consent,
        Core.PendingClaim memory pending
    )
        external
    {
        _commitment.state = c.state;
        _commitment.direction = c.direction;
        _commitment.claimType = c.claimType;
        _commitment.claimMode = c.claimMode;
        _commitment.providerGarden = c.providerGarden;
        _commitment.targetUnits = c.targetUnits;
        _commitment.unitLabel = c.unitLabel;
        _commitment.consideration = c.consideration;
        _offer = offer;
        _consent = consent;
        _pending = pending;
    }

    function acceptFixture(Acceptance.VoucherServiceAcceptance memory accepted) external {
        _accepted = accepted;
        _pending.active = false;
        _commitment.state = Core.CommitmentState.Accepted;
        _commitment.counterparty = _pending.claimant;
    }

    function setLifecycleFixture(Core.CommitmentState state) external {
        _commitment.state = state;
    }

    function getCommitment(uint256) external view returns (Core.Commitment memory) {
        return _commitment;
    }

    function getServiceOfferTerms(uint256) external view returns (Services.ServiceOfferTerms memory) {
        return _offer;
    }

    function getServiceClaimConsent(uint256, address) external view returns (Services.ServiceClaimConsent memory) {
        return _consent;
    }

    function getPendingClaim(uint256, address) external view returns (Core.PendingClaim memory) {
        return _pending;
    }

    function getVoucherServiceAcceptance(uint256) external view returns (Acceptance.VoucherServiceAcceptance memory) {
        return _accepted;
    }

    function getAcceptedServiceTerms(uint256) external pure returns (Services.AcceptedServiceTerms memory accepted) {
        return accepted;
    }
}
