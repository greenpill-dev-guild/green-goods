// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CommitmentPoolingViews } from "./pooling/CommitmentPoolingViews.sol";

/// @title CommitmentPoolingModule
/// @notice Commitment Pooling control plane for pool, commitment, contributor, and proof lifecycles.
/// @dev Behavior is split across `./pooling/*` abstract contracts in a single linear chain:
///      Storage -> Access -> Credit -> Config -> Pools -> CreationValidation -> Creation ->
///      Claims -> Confirmation -> Proof -> Terminal -> Cycles -> Roster -> Terms -> Sync ->
///      Exchange -> Recognition -> Series -> Views -> this contract. Views stays last before this
///      contract; a new module points at the current tail and Views re-points at it. Only
///      CommitmentPoolingStorage declares state, so the frozen 38-entry + `__gap[12]` layout is
///      independent of the split.
///      Keep this file and the contract name stable: tests resolve the implementation through
///      `deployCode("CommitmentPooling.sol:CommitmentPoolingModule")` and the storage-layout
///      baseline is keyed on the contract name.
contract CommitmentPoolingModule is CommitmentPoolingViews {
    function initialize(address owner_, address rootGarden_) external initializer {
        _initializePooling(owner_, rootGarden_);
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }
}
