// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentVoucherAcceptance as Acceptance } from "../../interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherServiceCodec as Service } from "../../libraries/VoucherServiceCodec.sol";
import { VoucherServiceConsentLib as Consent } from "./VoucherServiceConsentLib.sol";
import { VoucherServiceSourceStorage as Store } from "./VoucherServiceSourceStorage.sol";

/// @notice Immutable source authorization records and their single Activate/Abort outbox choice.
/// @dev Internal functions execute in the endpoint, using its existing namespace. No new storage,
///      external call, deployment link or authority is added. Concrete errors/events retain their ABI.
library VoucherServiceOutboxLib {
    struct Selection {
        bytes32 setupId;
        bytes32 decisionId;
        bool changed;
        Service.SetupDecisionCommand command;
    }

    function selectDecision(
        Service.SetupAuthorization memory a,
        Service.SetupDecision decision,
        bytes32 acceptanceHash,
        Service.AbortReason reason
    )
        internal
        returns (Selection memory selection)
    {
        bytes32 id = Service.setupId(a);
        Store.State storage s = Store.state();
        Store.SourceSetup storage record = s.setups[id];
        selection.setupId = id;
        selection.decisionId = record.decisionId;
        if (record.decision != Service.SetupDecision.None) return selection;
        Service.SetupDecisionCommand memory command = Service.SetupDecisionCommand(
            Service.VERSION, id, record.authorizationHash, decision, Service.depositReceiptHash(a), acceptanceHash, reason
        );
        record.decision = decision;
        record.decisionAt = uint64(block.timestamp);
        record.decisionId = Service.decisionId(command);
        s.decisionCommands[id] = Service.encodeDecision(a, command);
        selection.decisionId = record.decisionId;
        selection.changed = true;
        selection.command = command;
    }

    function authorization(bytes32 id, uint256 localChain) internal view returns (Service.SetupAuthorization memory a) {
        if (block.chainid != localChain) _fail(bytes4(keccak256("InvalidEndpoint()")));
        if (Store.state().setups[id].authorizationHash == bytes32(0)) _fail(bytes4(keccak256("UnknownRedemption()")));
        return Service.decodeAuthorization(Store.state().authorizations[id]);
    }

    function boundAuthorization(
        bytes32 id,
        bytes32 expected,
        uint256 localChain
    )
        internal
        view
        returns (Service.SetupAuthorization memory a)
    {
        a = authorization(id, localChain);
        if (Service.hash(a) != expected) _fail(bytes4(keccak256("InvalidServiceAuthorization()")));
    }

    function setupCommand(bytes32 id, uint8 kind, uint256 localChain) internal view returns (bytes memory command) {
        authorization(id, localChain);
        if (kind == 0) command = Store.state().authorizations[id];
        else if (kind == 1) command = Store.state().decisionCommands[id];
        else revert Service.UnsupportedVoucherServiceMessage();
        if (command.length == 0) _fail(bytes4(keccak256("VoucherSetupNotReady()")));
    }

    function abort(Service.SetupAuthorization memory a, Service.AbortReason reason) internal returns (Selection memory) {
        (, bool exact) = Consent.acceptedReceipt(a);
        if (exact || Store.state().setups[Service.setupId(a)].decision == Service.SetupDecision.Activate) {
            _fail(bytes4(keccak256("VoucherSetupAlreadyAccepted()")));
        }
        return selectDecision(a, Service.SetupDecision.Abort, bytes32(0), reason);
    }

    function activate(
        Service.SetupAuthorization memory a,
        mapping(uint256 => bytes32) storage acceptedSetups
    )
        internal
        returns (Selection memory)
    {
        (Acceptance.VoucherServiceAcceptance memory receipt, bool exact) = Consent.acceptedReceipt(a);
        if (!exact) _fail(bytes4(keccak256("VoucherSetupNotReady()")));
        bytes32 id = Service.setupId(a);
        if (Store.state().setups[id].decision == Service.SetupDecision.Abort) {
            _fail(bytes4(keccak256("VoucherSetupAborted()")));
        }
        acceptedSetups[a.commitmentId] = id;
        return selectDecision(a, Service.SetupDecision.Activate, keccak256(abi.encode(receipt)), Service.AbortReason.None);
    }

    // Keep declarations on the concrete endpoint for Contract.Error.selector and exact ABI metadata.
    // Signature-derived four-byte reverts avoid duplicate entries from an inlined library declaration.
    function _fail(bytes4 selector) private pure {
        assembly ("memory-safe") {
            mstore(0, selector)
            revert(0, 4)
        }
    }
}
