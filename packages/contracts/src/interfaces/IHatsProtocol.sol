// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IHatsProtocol
/// @notice Extended interface for Hats Protocol v1
/// @dev Includes functions needed for Green Goods hat tree management
///
/// Hats Protocol: https://docs.hatsprotocol.xyz/
/// Contract Address (all chains): 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137
interface IHatsProtocol {
    // ═══════════════════════════════════════════════════════════════════════════
    // Read Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Check if an account is wearing a hat
    /// @dev Returns true if:
    ///   1. Account holds a balance of the hat's token
    ///   2. The hat is active
    ///   3. The account is eligible to wear the hat
    /// @param _user The address to check
    /// @param _hatId The hat ID to check
    /// @return isWearer True if the account is wearing the hat
    function isWearerOfHat(address _user, uint256 _hatId) external view returns (bool isWearer);

    /// @notice Check if a hat is active
    /// @param _hatId The hat ID to check
    /// @return active True if the hat is active
    function isActive(uint256 _hatId) external view returns (bool active);

    /// @notice Check if an address is an admin of a hat
    /// @dev Checks all ancestor hats (transitive admin)
    /// @param _user The address to check
    /// @param _hatId The hat ID to check
    /// @return isAdmin True if the address is an admin
    function isAdminOfHat(address _user, uint256 _hatId) external view returns (bool isAdmin);

    /// @notice Get the admin hat ID at a specific level
    /// @param _hatId The hat ID
    /// @param _level The level to get admin at (0 = top hat)
    /// @return adminHatId The admin hat ID at that level
    function getAdminAtLevel(uint256 _hatId, uint32 _level) external pure returns (uint256 adminHatId);

    /// @notice Get a hat's level in the tree (0 = top hat)
    /// @param _hatId The hat ID
    /// @return level The hat's level
    function getHatLevel(uint256 _hatId) external view returns (uint32 level);

    /// @notice Check if hat is a top hat
    /// @param _hatId The hat ID
    /// @return isTopHat_ True if the hat is a top hat
    function isTopHat(uint256 _hatId) external view returns (bool isTopHat_);

    /// @notice Get hat details
    /// @param _hatId The hat ID
    /// @return details The hat details string
    /// @return maxSupply Maximum number of wearers
    /// @return supply Current number of wearers
    /// @return eligibility The eligibility module address
    /// @return toggle The toggle module address
    /// @return imageURI The image URI
    /// @return lastHatId The last child hat ID created
    /// @return mutable_ Whether the hat is mutable
    /// @return active Whether the hat is active
    function viewHat(uint256 _hatId)
        external
        view
        returns (
            string memory details,
            uint32 maxSupply,
            uint32 supply,
            address eligibility,
            address toggle,
            string memory imageURI,
            uint16 lastHatId,
            bool mutable_,
            bool active
        );

    /// @notice Get next child hat ID for a parent
    /// @param _admin The admin hat ID
    /// @return nextId The next available child hat ID
    function getNextId(uint256 _admin) external view returns (uint256 nextId);

    /// @notice Get the image URI for a hat
    /// @param _hatId The hat ID
    /// @return imageUri The image URI
    function getHatImageUri(uint256 _hatId) external view returns (string memory imageUri);

    // ═══════════════════════════════════════════════════════════════════════════
    // Write Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a new hat
    /// @dev Caller must be an admin of _admin
    /// @param _admin The admin hat ID for the new hat
    /// @param _details The hat details string (max 7000 chars)
    /// @param _maxSupply Maximum number of wearers
    /// @param _eligibility The eligibility module address
    /// @param _toggle The toggle module address
    /// @param _mutable Whether the hat is mutable
    /// @param _imageURI The image URI (max 7000 chars)
    /// @return newHatId The ID of the created hat
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
        returns (uint256 newHatId);

    /// @notice Mint a hat to an account
    /// @dev Caller must be an admin of the hat
    /// @param _hatId The hat ID to mint
    /// @param _wearer The account to mint to
    /// @return success True if minting succeeded
    function mintHat(uint256 _hatId, address _wearer) external returns (bool success);

    /// @notice Batch mint hats to multiple wearers
    /// @param _hatIds Array of hat IDs to mint
    /// @param _wearers Array of addresses to mint to
    /// @return success True if all mints succeeded
    function batchMintHats(uint256[] calldata _hatIds, address[] calldata _wearers) external returns (bool success);

    /// @notice Transfer a hat from one account to another
    /// @dev Caller must be an admin of the hat. Only mutable hats can be transferred.
    /// @param _hatId The hat ID to transfer
    /// @param _from The current wearer
    /// @param _to The new wearer
    function transferHat(uint256 _hatId, address _from, address _to) external;

    /// @notice Mint a top hat to an account
    /// @dev Creates a new hat tree with the target as the top hat wearer
    /// @param _target The account to mint the top hat to
    /// @param _details The hat details string
    /// @param _imageURI The image URI
    /// @return topHatId The ID of the created top hat
    function mintTopHat(
        address _target,
        string calldata _details,
        string calldata _imageURI
    )
        external
        returns (uint256 topHatId);

    /// @notice Batch create multiple hats
    /// @dev All hats must be in the same tree
    /// @param _admins Array of admin hat IDs
    /// @param _details Array of details strings
    /// @param _maxSupplies Array of max supplies
    /// @param _eligibilityModules Array of eligibility module addresses
    /// @param _toggleModules Array of toggle module addresses
    /// @param _mutables Array of mutability flags
    /// @param _imageURIs Array of image URIs
    /// @return success True if all hats were created
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
        returns (bool success);

    /// @notice Change hat details
    /// @dev Only callable by admin of mutable hat
    /// @param _hatId The hat ID
    /// @param _newDetails The new details string
    function changeHatDetails(uint256 _hatId, string calldata _newDetails) external;

    /// @notice Change hat eligibility module
    /// @dev Only callable by admin of mutable hat
    /// @param _hatId The hat ID
    /// @param _newEligibility The new eligibility module address
    function changeHatEligibility(uint256 _hatId, address _newEligibility) external;

    /// @notice Change hat toggle module
    /// @dev Only callable by admin of mutable hat
    /// @param _hatId The hat ID
    /// @param _newToggle The new toggle module address
    function changeHatToggle(uint256 _hatId, address _newToggle) external;

    /// @notice Change hat image URI
    /// @dev Only callable by admin of mutable hat
    /// @param _hatId The hat ID
    /// @param _newImageURI The new image URI
    function changeHatImageURI(uint256 _hatId, string calldata _newImageURI) external;

    /// @notice Change hat max supply
    /// @dev Only callable by admin of mutable hat. Cannot reduce below current supply.
    /// @param _hatId The hat ID
    /// @param _newMaxSupply The new max supply
    function changeHatMaxSupply(uint256 _hatId, uint32 _newMaxSupply) external;

    /// @notice Make a hat immutable
    /// @dev One-way operation, cannot be undone
    /// @param _hatId The hat ID
    function makeHatImmutable(uint256 _hatId) external;

    /// @notice Set a wearer's eligibility status
    /// @dev Only callable by the hat's eligibility module
    /// @param _hatId The hat ID
    /// @param _wearer The wearer address
    /// @param _eligible Whether the wearer is eligible
    /// @param _standing Whether the wearer is in good standing
    /// @return updated True if status was updated
    function setHatWearerStatus(
        uint256 _hatId,
        address _wearer,
        bool _eligible,
        bool _standing
    )
        external
        returns (bool updated);

    /// @notice Check and update a wearer's status
    /// @dev Triggers eligibility check and emits events
    /// @param _hatId The hat ID
    /// @param _wearer The wearer address
    /// @return updated True if status changed
    function checkHatWearerStatus(uint256 _hatId, address _wearer) external returns (bool updated);

    /// @notice Check and update a hat's status
    /// @dev Triggers toggle check and emits events
    /// @param _hatId The hat ID
    /// @return toggled True if status changed
    function checkHatStatus(uint256 _hatId) external returns (bool toggled);
}
