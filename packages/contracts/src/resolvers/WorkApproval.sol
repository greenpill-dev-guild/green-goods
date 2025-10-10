// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkApprovalSchema } from "../Schemas.sol";
import { GardenAccount } from "../accounts/Garden.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotInActionRegistry } from "../Constants.sol";

error NotInWorkRegistry();
error NotGardenOperator();

/// @title WorkApprovalResolver
/// @notice A schema resolver for the Actions event schema
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract WorkApprovalResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
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
    /// @return A boolean indicating that the resolver is payable
    function isPayable() public pure override returns (bool) {
        return true;
    }

    /// @notice Handles the logic to be executed when an attestation is made.
    /// @dev Verifies the attester, work, and action's validity.
    /// @param attestation The attestation data structure.
    /// @return A boolean indicating whether the attestation is valid.
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal view override returns (bool) {
        WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
        Attestation memory workAttestation = _eas.getAttestation(schema.workUID);

        if (workAttestation.attester != attestation.recipient) {
            revert NotInWorkRegistry();
        }

        GardenAccount gardenAccount = GardenAccount(payable(workAttestation.recipient));

        if (gardenAccount.gardenOperators(attestation.attester) == false) {
            revert NotGardenOperator();
        }

        if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).startTime == 0) {
            revert NotInActionRegistry();
        }

        return (true);
    }

    // solhint-disable no-unused-vars
    /// @notice Handles the logic to be executed when an attestation is revoked.
    /// @dev This function can only be called by the contract owner.
    /// @return A boolean indicating whether the revocation is valid.
    function onRevoke(
        Attestation calldata, /*attestation*/
        uint256 /*value*/
    )
        internal
        view
        override
        onlyOwner
        returns (bool)
    {
        return true;
    }

    /// @notice Authorizes an upgrade to the contract's implementation.
    /// @dev This function can only be called by the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
