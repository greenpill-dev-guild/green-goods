// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CommitmentPoolingExtensions } from "./CommitmentPooling/Extensions.sol";

/// @title CommitmentPoolingModule
/// @notice Commitment Pooling control plane for pool, commitment, contributor, and proof lifecycles.
/// @dev EIP-170 architecture: behavior lives in deployed external libraries under
///      `src/lib/CommitmentPooling/` (DELEGATECALLed, so events, reverts, and `msg.sender`
///      surface from the proxy unchanged and each library carries its own 24,576-byte budget).
///      The `./CommitmentPooling/*` abstract contracts are thin shells in a single linear chain:
///      Storage -> Base -> Admin -> Lifecycle -> Operations -> Extensions -> this contract.
///      Extensions stays last before this contract; a new surface points at the current tail and
///      Extensions re-points at it. Only CommitmentPoolingStorage declares state — libraries
///      hold none and receive explicit storage references — so the frozen 38-entry + `__gap[12]`
///      layout is independent of both the chain and the libraries.
///      `bun run check:sizes` gates every deployable against the EIP-170 limit.
///      Keep this file and the contract name stable: tests resolve the implementation through
///      `deployCode("CommitmentPooling.sol:CommitmentPoolingModule")` (Foundry links the library
///      addresses automatically) and the storage-layout baseline is keyed on the contract name.
contract CommitmentPoolingModule is CommitmentPoolingExtensions {
    function initialize(address owner_, address rootGarden_) external initializer {
        _initializePooling(owner_, rootGarden_);
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }
}
