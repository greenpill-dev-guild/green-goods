// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IHats } from "../interfaces/IHats.sol";

/// @title MockHats
/// @notice Enhanced mock implementation of Hats Protocol for testing
/// @dev Supports full hat creation, tree structure, and eligibility management
contract MockHats is IHats {
    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error NotAdmin();
    error HatNotActive();
    error AlreadyWearingHat();
    error NotEligible();
    error MaxSupplyReached();
    error ArrayLengthMismatch();
    error HatNotMutable();
    error MaxLevelReached();

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 internal constant LEVEL_SIZE = 16;
    uint256 internal constant MAX_LEVELS = 14;

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    struct Hat {
        string details;
        uint32 maxSupply;
        uint32 supply;
        address eligibility;
        address toggle;
        string imageURI;
        uint16 lastHatId;
        bool mutable_;
        bool active;
        uint256 admin;
    }

    /// @notice Hat data by ID
    mapping(uint256 => Hat) public hats;

    /// @notice Wearer status: hatId => wearer => isWearer
    mapping(uint256 => mapping(address => bool)) public wearers;

    /// @notice Eligibility status: hatId => wearer => isEligible
    mapping(uint256 => mapping(address => bool)) public eligibility;

    /// @notice Standing status: hatId => wearer => inGoodStanding
    mapping(uint256 => mapping(address => bool)) public standing;

    /// @notice Counter for top hat IDs
    uint256 public topHatCount;

    // ═══════════════════════════════════════════════════════════════════════════
    // Hat ID Utilities (matching Hats Protocol bit structure)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function getHatLevel(uint256 _hatId) public pure returns (uint32) {
        uint32 level = 0;
        // Check each 16-bit segment after the first 32 bits (top hat domain)
        for (uint256 i = 0; i < MAX_LEVELS; i++) {
            uint256 shift = 256 - 32 - ((i + 1) * LEVEL_SIZE);
            if ((_hatId >> shift) & 0xFFFF == 0) break;
            level++;
        }
        return level;
    }

    /// @inheritdoc IHats
    function isTopHat(uint256 _hatId) public pure returns (bool) {
        // Top hat has no levels after the domain (first 32 bits)
        return (_hatId << 32) == 0;
    }

    /// @inheritdoc IHats
    function getAdminAtLevel(uint256 _hatId, uint32 _level) public pure returns (uint256) {
        // Mask out everything below the specified level
        uint256 levelBits = (MAX_LEVELS - _level) * LEVEL_SIZE;
        uint256 mask = type(uint256).max << levelBits;
        return _hatId & mask;
    }

    /// @inheritdoc IHats
    function getNextId(uint256 _admin) public view returns (uint256) {
        Hat storage adminHat = hats[_admin];
        uint32 level = getHatLevel(_admin);
        if (level >= MAX_LEVELS) revert MaxLevelReached();
        uint256 shift = 256 - 32 - ((level + 1) * LEVEL_SIZE);
        return _admin | (uint256(adminHat.lastHatId + 1) << shift);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Read Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function isWearerOfHat(address _user, uint256 _hatId) external view returns (bool) {
        return wearers[_hatId][_user] && hats[_hatId].active && _isEligible(_hatId, _user);
    }

    /// @inheritdoc IHats
    function isActive(uint256 _hatId) external view returns (bool) {
        return hats[_hatId].active;
    }

    /// @inheritdoc IHats
    function isAdminOfHat(address _user, uint256 _hatId) external view returns (bool) {
        if (isTopHat(_hatId)) {
            return wearers[_hatId][_user];
        }
        // Check all ancestor hats (transitive admin)
        uint32 level = getHatLevel(_hatId);
        for (uint32 i = 0; i < level; i++) {
            uint256 adminHat = getAdminAtLevel(_hatId, i);
            if (wearers[adminHat][_user]) return true;
        }
        return false;
    }

    /// @inheritdoc IHats
    function viewHat(uint256 _hatId)
        external
        view
        returns (
            string memory details,
            uint32 maxSupply,
            uint32 supply,
            address eligibilityAddr,
            address toggle,
            string memory imageURI,
            uint16 lastHatId,
            bool mutable_,
            bool active
        )
    {
        Hat storage hat = hats[_hatId];
        return (
            hat.details,
            hat.maxSupply,
            hat.supply,
            hat.eligibility,
            hat.toggle,
            hat.imageURI,
            hat.lastHatId,
            hat.mutable_,
            hat.active
        );
    }

    /// @inheritdoc IHats
    function getHatImageUri(uint256 _hatId) external view returns (string memory) {
        return hats[_hatId].imageURI;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Write Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function mintTopHat(
        address _target,
        string calldata _details,
        string calldata _imageURI
    )
        external
        returns (uint256 topHatId)
    {
        topHatCount++;
        topHatId = uint256(topHatCount) << 224; // First 32 bits are domain

        hats[topHatId] = Hat({
            details: _details,
            maxSupply: 1,
            supply: 1,
            eligibility: address(0),
            toggle: address(0),
            imageURI: _imageURI,
            lastHatId: 0,
            mutable_: false,
            active: true,
            admin: topHatId // Self-admin
         });

        wearers[topHatId][_target] = true;
        eligibility[topHatId][_target] = true;
        standing[topHatId][_target] = true;
    }

    /// @inheritdoc IHats
    function createHat(
        uint256 _admin,
        string calldata _details,
        uint32 _maxSupply,
        address _eligibility,
        address _toggle,
        bool _mutable,
        string calldata _imageURI
    )
        external
        returns (uint256 newHatId)
    {
        // In production, check caller is admin. For mock, we allow anyone for testing flexibility

        newHatId = getNextId(_admin);
        hats[_admin].lastHatId++;

        hats[newHatId] = Hat({
            details: _details,
            maxSupply: _maxSupply,
            supply: 0,
            eligibility: _eligibility,
            toggle: _toggle,
            imageURI: _imageURI,
            lastHatId: 0,
            mutable_: _mutable,
            active: true,
            admin: _admin
        });

        return newHatId;
    }

    /// @inheritdoc IHats
    function mintHat(uint256 _hatId, address _wearer) external returns (bool) {
        Hat storage hat = hats[_hatId];
        if (!hat.active) revert HatNotActive();
        if (wearers[_hatId][_wearer]) revert AlreadyWearingHat();
        if (hat.supply >= hat.maxSupply) revert MaxSupplyReached();

        wearers[_hatId][_wearer] = true;
        eligibility[_hatId][_wearer] = true;
        standing[_hatId][_wearer] = true;
        hat.supply++;

        return true;
    }

    /// @inheritdoc IHats
    function batchMintHats(uint256[] calldata _hatIds, address[] calldata _wearers) external returns (bool) {
        if (_hatIds.length != _wearers.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < _hatIds.length; i++) {
            Hat storage hat = hats[_hatIds[i]];
            if (!hat.active) revert HatNotActive();
            if (wearers[_hatIds[i]][_wearers[i]]) revert AlreadyWearingHat();
            if (hat.supply >= hat.maxSupply) revert MaxSupplyReached();

            wearers[_hatIds[i]][_wearers[i]] = true;
            eligibility[_hatIds[i]][_wearers[i]] = true;
            standing[_hatIds[i]][_wearers[i]] = true;
            hat.supply++;
        }
        return true;
    }

    /// @inheritdoc IHats
    function batchCreateHats(
        uint256[] calldata _admins,
        string[] calldata _details,
        uint32[] calldata _maxSupplies,
        address[] calldata _eligibilityModules,
        address[] calldata _toggleModules,
        bool[] calldata _mutables,
        string[] calldata _imageURIs
    )
        external
        returns (bool)
    {
        uint256 length = _admins.length;
        if (
            _details.length != length || _maxSupplies.length != length || _eligibilityModules.length != length
                || _toggleModules.length != length || _mutables.length != length || _imageURIs.length != length
        ) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < length; i++) {
            uint256 newHatId = getNextId(_admins[i]);
            hats[_admins[i]].lastHatId++;

            hats[newHatId] = Hat({
                details: _details[i],
                maxSupply: _maxSupplies[i],
                supply: 0,
                eligibility: _eligibilityModules[i],
                toggle: _toggleModules[i],
                imageURI: _imageURIs[i],
                lastHatId: 0,
                mutable_: _mutables[i],
                active: true,
                admin: _admins[i]
            });
        }
        return true;
    }

    /// @inheritdoc IHats
    function transferHat(uint256 _hatId, address _from, address _to) external {
        if (!hats[_hatId].mutable_) revert HatNotMutable();

        wearers[_hatId][_from] = false;
        hats[_hatId].supply--;

        wearers[_hatId][_to] = true;
        eligibility[_hatId][_to] = true;
        standing[_hatId][_to] = true;
        hats[_hatId].supply++;
    }

    /// @inheritdoc IHats
    function changeHatDetails(uint256 _hatId, string calldata _newDetails) external {
        if (!hats[_hatId].mutable_ && !isTopHat(_hatId)) revert HatNotMutable();
        hats[_hatId].details = _newDetails;
    }

    /// @inheritdoc IHats
    function changeHatEligibility(uint256 _hatId, address _newEligibility) external {
        if (!hats[_hatId].mutable_) revert HatNotMutable();
        hats[_hatId].eligibility = _newEligibility;
    }

    /// @inheritdoc IHats
    function changeHatToggle(uint256 _hatId, address _newToggle) external {
        if (!hats[_hatId].mutable_) revert HatNotMutable();
        hats[_hatId].toggle = _newToggle;
    }

    /// @inheritdoc IHats
    function changeHatImageURI(uint256 _hatId, string calldata _newImageURI) external {
        if (!hats[_hatId].mutable_ && !isTopHat(_hatId)) revert HatNotMutable();
        hats[_hatId].imageURI = _newImageURI;
    }

    /// @inheritdoc IHats
    function changeHatMaxSupply(uint256 _hatId, uint32 _newMaxSupply) external {
        if (!hats[_hatId].mutable_) revert HatNotMutable();
        hats[_hatId].maxSupply = _newMaxSupply;
    }

    /// @inheritdoc IHats
    function makeHatImmutable(uint256 _hatId) external {
        hats[_hatId].mutable_ = false;
    }

    /// @inheritdoc IHats
    function setHatWearerStatus(uint256 _hatId, address _wearer, bool _eligible, bool _standing) external returns (bool) {
        eligibility[_hatId][_wearer] = _eligible;
        standing[_hatId][_wearer] = _standing;
        return true;
    }

    /// @inheritdoc IHats
    function checkHatWearerStatus(uint256 _hatId, address _wearer) external returns (bool) {
        // In mock, just return current status
        return eligibility[_hatId][_wearer] && standing[_hatId][_wearer];
    }

    /// @inheritdoc IHats
    function checkHatStatus(uint256 _hatId) external returns (bool) {
        // In mock, just return current status
        return hats[_hatId].active;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set whether an address is wearing a hat (test helper)
    /// @param _hatId The hat ID
    /// @param _wearer The address
    /// @param _isWearer Whether the address is wearing the hat
    function setWearer(uint256 _hatId, address _wearer, bool _isWearer) external {
        if (_isWearer && !wearers[_hatId][_wearer]) {
            wearers[_hatId][_wearer] = true;
            eligibility[_hatId][_wearer] = true;
            standing[_hatId][_wearer] = true;
            hats[_hatId].supply++;
        } else if (!_isWearer && wearers[_hatId][_wearer]) {
            wearers[_hatId][_wearer] = false;
            hats[_hatId].supply--;
        }
    }

    /// @notice Set whether a hat is active (test helper)
    /// @dev When activating a hat with maxSupply == 0, this function sets maxSupply = 100
    ///      and also sets mutable_ = true as a side effect.
    /// @param _hatId The hat ID
    /// @param _active Whether the hat is active
    function setHatActive(uint256 _hatId, bool _active) external {
        hats[_hatId].active = _active;
        // Set a reasonable default maxSupply if activating and not already set
        if (_active && hats[_hatId].maxSupply == 0) {
            hats[_hatId].maxSupply = 100;
            hats[_hatId].mutable_ = true;
        }
    }

    /// @notice Set eligibility status (test helper)
    /// @param _hatId The hat ID
    /// @param _wearer The wearer address
    /// @param isEligible_ Whether the wearer is eligible
    function setEligibility(uint256 _hatId, address _wearer, bool isEligible_) external {
        eligibility[_hatId][_wearer] = isEligible_;
    }

    /// @notice Set standing status (test helper)
    /// @param _hatId The hat ID
    /// @param _wearer The wearer address
    /// @param _inStanding Whether the wearer is in good standing
    function setStanding(uint256 _hatId, address _wearer, bool _inStanding) external {
        standing[_hatId][_wearer] = _inStanding;
    }

    /// @notice Batch set wearers for a hat (test helper)
    /// @param _hatId The hat ID
    /// @param _wearersArr Array of addresses
    /// @param _areWearers Array of booleans
    function batchSetWearers(uint256 _hatId, address[] calldata _wearersArr, bool[] calldata _areWearers) external {
        if (_wearersArr.length != _areWearers.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < _wearersArr.length; i++) {
            if (_areWearers[i] && !wearers[_hatId][_wearersArr[i]]) {
                wearers[_hatId][_wearersArr[i]] = true;
                eligibility[_hatId][_wearersArr[i]] = true;
                standing[_hatId][_wearersArr[i]] = true;
                hats[_hatId].supply++;
            } else if (!_areWearers[i] && wearers[_hatId][_wearersArr[i]]) {
                wearers[_hatId][_wearersArr[i]] = false;
                hats[_hatId].supply--;
            }
        }
    }

    /// @notice Get hat admin (test helper)
    /// @param _hatId The hat ID
    /// @return admin The admin hat ID
    function getHatAdmin(uint256 _hatId) external view returns (uint256) {
        return hats[_hatId].admin;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function _isEligible(uint256 _hatId, address _wearer) internal view returns (bool) {
        // If no eligibility module, use stored eligibility
        // In production, would call the eligibility module
        return eligibility[_hatId][_wearer] && standing[_hatId][_wearer];
    }
}
