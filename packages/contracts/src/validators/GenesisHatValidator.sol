// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IHats } from "../interfaces/IHats.sol";
import { IGreenWillValidator } from "../interfaces/IGreenWillValidator.sol";
import { ZeroAddress } from "../errors/CommonErrors.sol";

/// @title GenesisHatValidator
/// @notice Validates the Genesis badge against the protocol hat on Arbitrum
contract GenesisHatValidator is IGreenWillValidator {
    error NotHatWearer(address account, uint256 hatId);

    IHats public immutable hats;
    uint256 public immutable hatId;

    constructor(address _hats, uint256 _hatId) {
        if (_hats == address(0)) revert ZeroAddress();
        hats = IHats(_hats);
        hatId = _hatId;
    }

    function validate(address account, bytes calldata) external view returns (bytes32 sourceRef) {
        if (!hats.isWearerOfHat(account, hatId)) {
            revert NotHatWearer(account, hatId);
        }

        return bytes32(hatId);
    }
}
