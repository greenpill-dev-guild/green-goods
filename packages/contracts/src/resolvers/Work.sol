// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkSchema } from "../Schemas.sol";
import { GardenAccount } from "../accounts/Garden.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotGardenerAccount, NotInActionRegistry } from "../Constants.sol";

error NotActiveAction();

/// @title WorkResolver
/// @notice A schema resolver for the Actions event schema
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract WorkResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    address public actionRegistry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs, address actionAddrs) SchemaResolver(IEAS(easAddrs)) {
        actionRegistry = actionAddrs;
        // _disableInitializers();
    }

    /// @notice Initializes the contract and sets the multisig wallet as the owner.
    /// @dev This function replaces the constructor for upgradable contracts.
    /// @param _multisig The address of the multisig wallet to transfer ownership to.
    function initialize(address _multisig) external initializer {
        __Ownable_init();
        // transferOwnership(_multisig);
    }

    /// @notice Indicates whether the resolver is payable.
    /// @dev This is a pure function that always returns true.
    /// @return A boolean indicating that the resolver is payable.
    function isPayable() public pure override returns (bool) {
        return true;
    }

    /// @notice Handles the logic to be executed when an attestation is made.
    /// @dev Verifies the attester and the action's validity and active status.
    /// @param attestation The attestation data structure.
    /// @return A boolean indicating whether the attestation is valid.
    function onAttest(Attestation calldata attestation, uint256 /*value*/) internal view override returns (bool) {
        WorkSchema memory schema = abi.decode(attestation.data, (WorkSchema));

        GardenAccount gardenAccount = GardenAccount(payable(attestation.recipient));

        if (gardenAccount.gardeners(attestation.attester) == false) {
            revert NotGardenerAccount();
        }

        if (ActionRegistry(actionRegistry).getAction(schema.actionUID).startTime == 0) {
            revert NotInActionRegistry();
        }

        if (ActionRegistry(actionRegistry).getAction(schema.actionUID).endTime < block.timestamp) {
            revert NotActiveAction();
        }

        return (true);
    }

    // solhint-disable no-unused-vars
    /// @notice Handles the logic to be executed when an attestation is revoked.
    /// @dev This function can only be called by the contract owner.
    /// @return A boolean indicating whether the revocation is valid.
    function onRevoke(
        Attestation calldata /*attestation*/,
        uint256 /*value*/
    ) internal view override onlyOwner returns (bool) {
        return true;
    }

    /// @notice Authorizes an upgrade to the contract's implementation.
    /// @dev This function can only be called by the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
