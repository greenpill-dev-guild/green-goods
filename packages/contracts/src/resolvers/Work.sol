// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkSchema } from "../Schemas.sol";
import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { ActionRegistry } from "../registries/Action.sol";

error NotActiveAction();
/// @notice Thrown when attester is not a member (gardener or operator) of the garden
error NotGardenMember();
error NotInActionRegistry();

/// @title WorkResolver
/// @notice A schema resolver for the Actions event schema
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract WorkResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    address public immutable ACTION_REGISTRY;

    /**
     * @dev Storage gap for future upgrades
     * Reserves 50 slots (50 total - 0 used in storage)
     * Note: ACTION_REGISTRY is immutable (not in storage)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs, address actionAddrs) SchemaResolver(IEAS(easAddrs)) {
        ACTION_REGISTRY = actionAddrs;
        _disableInitializers();
    }

    /// @notice Initializes the contract and sets the specified address as the owner.
    /// @dev This function replaces the constructor for upgradable contracts.
    /// @param _multisig The address that will own the contract.
    function initialize(address _multisig) external initializer {
        __Ownable_init();
        _transferOwnership(_multisig);
    }

    /// @notice Indicates whether the resolver is payable.
    /// @dev This is a pure function that always returns true.
    /// @return A boolean indicating that the resolver is payable.
    function isPayable() public pure override returns (bool) {
        return true;
    }

    /// @notice Handles the logic to be executed when an attestation is made
    /// @dev Validates attester identity and action validity before allowing work submission
    ///
    /// **Validation Order (Security Critical):**
    /// 1. IDENTITY: Verify attester is a gardener OR operator of the target garden
    /// 2. ACTION: Verify action exists in registry
    /// 3. TIMING: Verify action is still active (not expired)
    ///
    /// @param attestation The attestation data structure
    /// @return bool True if attestation is valid
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal view override returns (bool) {
        WorkSchema memory schema = abi.decode(attestation.data, (WorkSchema));
        IGardenAccessControl accessControl = IGardenAccessControl(attestation.recipient);

        // IDENTITY CHECK: Verify gardener OR operator status FIRST
        // Both roles can submit work - explicit policy for Hats Protocol compatibility
        // Uses IGardenAccessControl interface for swappable access control backends
        bool isGardener = accessControl.isGardener(attestation.attester);
        bool isOperator = accessControl.isOperator(attestation.attester);

        if (!isGardener && !isOperator) {
            revert NotGardenMember();
        }

        // ACTION VALIDATION: Verify action exists in registry
        if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).startTime == 0) {
            revert NotInActionRegistry();
        }

        // TIMING VALIDATION: Verify action is still active
        if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).endTime < block.timestamp) {
            revert NotActiveAction();
        }

        return (true);
    }

    // solhint-disable no-unused-vars
    /// @notice Handles the logic to be executed when an attestation is revoked.
    /// @dev Work submissions are NOT revocable - always returns false.
    /// @return Always false - work submissions cannot be revoked.
    function onRevoke(Attestation calldata, /*attestation*/ uint256 /*value*/ ) internal pure override returns (bool) {
        // Work submissions are permanent and cannot be revoked
        return false;
    }

    /// @notice Authorizes an upgrade to the contract's implementation.
    /// @dev This function can only be called by the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
