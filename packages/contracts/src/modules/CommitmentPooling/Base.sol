// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "../../lib/CommitmentPooling/CommonLib.sol";
import { CommitmentPoolingCreditLib } from "../../lib/CommitmentPooling/CreditLib.sol";
import { CommitmentPoolingViewsLib } from "../../lib/CommitmentPooling/ViewsLib.sol";
import { CommitmentPoolingStorage } from "./Storage.sol";

/// @title CommitmentPoolingBase
/// @notice The library-call context builder, the raw-return view forwarding path, and the guards
///         still applied module-side.
/// @dev The full guard and credit engines live in `CommitmentPoolingGuardLib` and
///      `CommitmentPoolingCreditLib` for the deployed behavior libraries; only what the
///      module-side chain itself calls is kept here, delegating where a library twin exists so
///      the semantics have exactly one home.
abstract contract CommitmentPoolingBase is CommitmentPoolingStorage {
    /// @dev The value-typed configuration snapshot every deployed behavior library call receives.
    ///      Storage mappings are threaded separately — see `CommitmentPoolingCommonLib`.
    function _env() internal view returns (CommitmentPoolingCommonLib.Env memory env) {
        env = CommitmentPoolingCommonLib.Env({
            hats: hatsModule,
            registry: commitmentRegistry,
            actionRegistry: actionRegistry,
            workApprovalResolver: workApprovalResolver,
            eas: eas,
            workSchemaUID: workSchemaUID,
            workApprovalSchemaUID: workApprovalSchemaUID,
            legacyAssessmentSchemaUID: legacyAssessmentSchemaUID,
            assessmentV3SchemaUID: assessmentV3SchemaUID,
            protocolPoolId: protocolPoolId,
            owner: owner()
        });
    }

    function _requireCompleteConfiguration() internal view {
        if (
            gardenToken == address(0) || address(hatsModule) == address(0) || address(actionRegistry) == address(0)
                || address(commitmentRegistry) == address(0) || workApprovalResolver == address(0) || address(eas) == address(0)
                || workSchemaUID == bytes32(0) || workApprovalSchemaUID == bytes32(0) || legacyAssessmentSchemaUID == bytes32(0)
                || assessmentV3SchemaUID == bytes32(0)
        ) revert ICommitmentPoolingModule.ModuleNotReady();
    }

    function _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind kind, bytes32 uid) internal pure {
        if (uid == bytes32(0)) revert ICommitmentPoolingModule.SchemaUIDRequired(kind);
    }

    function _setSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind kind, bytes32 previous, bytes32 next) internal {
        if (previous == next) return;
        emit ICommitmentPoolingModule.ModuleSchemaUIDUpdated(kind, previous, next);
    }

    function _requireCommitment(uint256 commitmentId)
        internal
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = commitments[commitmentId];
        if (commitment.state == ICommitmentPoolingModule.CommitmentState.None) {
            revert ICommitmentPoolingModule.UnknownCommitment(commitmentId);
        }
    }

    /// @dev Recognition eligibility, delegated so the definition has exactly one home in
    ///      `CommitmentPoolingCreditLib`.
    function _isEligibleContributor(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address contributor
    )
        internal
        view
        returns (bool)
    {
        return CommitmentPoolingCreditLib.isEligibleContributor(contributors, commitmentId, commitment, contributor);
    }

    /// @notice Self-only executor behind the raw-return view forwarding path.
    /// @dev The struct- and array-returning views carry the module's largest ABI encoders, so
    ///      their bodies live in `CommitmentPoolingViewsLib` and their return data is forwarded
    ///      raw instead of being decoded and re-encoded here (which would pull every encoder back
    ///      into this contract). Solidity's type system does not allow a `view` function to
    ///      DELEGATECALL, so the `view` shells STATICCALL this executor, which performs the
    ///      DELEGATECALL — the static context still guarantees no state write can occur, and the
    ///      library holds only view functions. The target is fixed at link time; only calldata is
    ///      caller-supplied, and callers other than the module itself are rejected.
    function poolingViewDelegate(bytes calldata data) external {
        if (msg.sender != address(this)) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok, bytes memory ret) = address(CommitmentPoolingViewsLib).delegatecall(data);
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            let ptr := add(ret, 0x20)
            let len := mload(ret)
            switch ok
            case 0 { revert(ptr, len) }
            default { return(ptr, len) }
        }
    }

    /// @dev Terminates the calling frame with the library view's exact return or revert data.
    ///      Every caller is unreachable after this call returns control — it never does.
    function _forwardView(bytes memory data) internal view {
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok, bytes memory ret) =
            address(this).staticcall(abi.encodeWithSelector(this.poolingViewDelegate.selector, data));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            let ptr := add(ret, 0x20)
            let len := mload(ret)
            switch ok
            case 0 { revert(ptr, len) }
            default { return(ptr, len) }
        }
    }
}
