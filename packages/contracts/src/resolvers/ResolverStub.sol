// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @notice Error thrown when function is not implemented
error NotImplemented();

/// @title ResolverStub
/// @notice Minimal resolver stub for deterministic proxy deployment
/// @dev This contract has no constructor parameters, making it identical across chains
contract ResolverStub is UUPSUpgradeable, OwnableUpgradeable {
    /// @notice Initialize the stub with proper ownership
    function initialize(address _owner) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init();
        _transferOwnership(_owner);
    }

    /// @notice Restrict upgrades to owner only
    function _authorizeUpgrade(address) internal override onlyOwner {
        // Only owner can upgrade
    }

    /// @notice Fallback function
    fallback() external payable {
        revert NotImplemented();
    }

    /// @notice Receive function
    receive() external payable {
        revert NotImplemented();
    }
}
