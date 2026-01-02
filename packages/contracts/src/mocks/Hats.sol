// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IHats } from "../interfaces/IHats.sol";

/// @title MockHats
/// @notice Mock implementation of Hats Protocol for testing
/// @dev Allows setting hat wearers directly without the full Hats logic
contract MockHats is IHats {
    /// @notice Mapping of hat ID => wearer => isWearer
    mapping(uint256 => mapping(address => bool)) public wearers;

    /// @notice Mapping of hat ID => isActive
    mapping(uint256 => bool) public hatActive;

    /// @notice Mapping of hat ID => imageUri
    mapping(uint256 => string) public hatImageUri;

    // ═══════════════════════════════════════════════════════════════════════════
    // IHats Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function isWearerOfHat(address _user, uint256 _hatId) external view override returns (bool) {
        return wearers[_hatId][_user] && hatActive[_hatId];
    }

    /// @inheritdoc IHats
    function isActive(uint256 _hatId) external view override returns (bool) {
        return hatActive[_hatId];
    }

    /// @inheritdoc IHats
    function getHatImageUri(uint256 _hatId) external view override returns (string memory) {
        return hatImageUri[_hatId];
    }

    /// @inheritdoc IHats
    function mintHat(uint256 _hatId, address _wearer) external override returns (bool) {
        wearers[_hatId][_wearer] = true;
        return true;
    }

    /// @inheritdoc IHats
    function transferHat(uint256 _hatId, address _from, address _to) external override {
        wearers[_hatId][_from] = false;
        wearers[_hatId][_to] = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set whether an address is wearing a hat
    /// @param _hatId The hat ID
    /// @param _wearer The address
    /// @param _isWearer Whether the address is wearing the hat
    function setWearer(uint256 _hatId, address _wearer, bool _isWearer) external {
        wearers[_hatId][_wearer] = _isWearer;
    }

    /// @notice Set whether a hat is active
    /// @param _hatId The hat ID
    /// @param _isActive Whether the hat is active
    function setHatActive(uint256 _hatId, bool _isActive) external {
        hatActive[_hatId] = _isActive;
    }

    /// @notice Set the image URI for a hat
    /// @param _hatId The hat ID
    /// @param _imageUri The image URI
    function setHatImageUri(uint256 _hatId, string calldata _imageUri) external {
        hatImageUri[_hatId] = _imageUri;
    }

    /// @notice Batch set wearers for a hat
    /// @param _hatId The hat ID
    /// @param _wearers Array of addresses
    /// @param _areWearers Array of booleans
    function batchSetWearers(uint256 _hatId, address[] calldata _wearers, bool[] calldata _areWearers) external {
        require(_wearers.length == _areWearers.length, "Length mismatch");
        for (uint256 i = 0; i < _wearers.length; i++) {
            wearers[_hatId][_wearers[i]] = _areWearers[i];
        }
    }
}
