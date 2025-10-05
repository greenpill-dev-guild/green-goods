// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { AssessmentSchema } from "../Schemas.sol";
import { GardenAccount } from "../accounts/Garden.sol";

error NotGardenOperator();

/// @title AssessmentResolver
/// @notice A schema resolver for Garden Assessment attestations
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract AssessmentResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    /**
     * @dev Storage gap for future upgrades
     * Reserves 50 slots for future state variables
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs) SchemaResolver(IEAS(easAddrs)) {
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

    /// @notice Handles the logic to be executed when an attestation is made.
    /// @dev Verifies the attester is a garden operator for the target garden.
    /// @param attestation The attestation data structure.
    /// @return A boolean indicating whether the attestation is valid.
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal view override returns (bool) {
        // Decode the assessment schema to validate structure
        AssessmentSchema memory schema = abi.decode(attestation.data, (AssessmentSchema));

        // Get the garden account from the recipient
        GardenAccount gardenAccount = GardenAccount(payable(attestation.recipient));

        // Verify attester is a garden operator
        if (gardenAccount.gardenOperators(attestation.attester) == false) {
            revert NotGardenOperator();
        }

        // Additional validation: check version is valid (currently only version 2)
        require(schema.version == 2, "Invalid schema version");

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
