// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkApprovalSchema, WorkSchema } from "../Schemas.sol";
import { GardenAccount } from "../accounts/Garden.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotInActionRegistry } from "../Constants.sol";
import { KarmaLib } from "../lib/Karma.sol";

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

    /// @notice Handles the logic to be executed when an attestation is made
    /// @dev Validates operator identity, work relationship, and action validity
    ///
    /// **Validation Order (Security Critical):**
    /// 1. WORK RELATIONSHIP: Verify work was submitted to this garden
    /// 2. IDENTITY: Verify attester is a garden operator (can approve work)
    /// 3. ACTION: Verify action exists in registry
    /// 4. GAP INTEGRATION: Create project impact if approved and GAP supported
    ///
    /// **GAP Impact Creation:**
    /// - Only created if schema.approved == true
    /// - Only if chain supports GAP (KarmaLib.isSupported())
    /// - Uses try/catch to prevent GAP failures from reverting approval
    ///
    /// @param attestation The attestation data structure
    /// @return bool True if attestation is valid
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal override returns (bool) {
        WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
        Attestation memory workAttestation = _eas.getAttestation(schema.workUID);

        // WORK RELATIONSHIP: Verify work was submitted to this garden
        if (workAttestation.recipient != attestation.recipient) {
            revert NotInWorkRegistry();
        }

        GardenAccount gardenAccount = GardenAccount(payable(workAttestation.recipient));

        // IDENTITY CHECK: Verify operator status
        // This is the primary authorization - only operators can approve work
        if (gardenAccount.gardenOperators(attestation.attester) == false) {
            revert NotGardenOperator();
        }

        // ACTION VALIDATION: Verify action exists
        if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).startTime == 0) {
            revert NotInActionRegistry();
        }

        // GAP INTEGRATION: Create project impact if approved
        if (schema.approved && KarmaLib.isSupported()) {
            _createGAPProjectImpact(schema, workAttestation, gardenAccount);
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

    /// @notice Creates GAP project impact securely via GardenAccount
    /// @dev SECURITY: Only called after full validation in onAttest()
    /// @param schema Work approval schema data
    /// @param workAttestation The work attestation being approved
    /// @param gardenAccount The garden account to create impact for
    function _createGAPProjectImpact(
        WorkApprovalSchema memory schema,
        Attestation memory workAttestation,
        GardenAccount gardenAccount
    )
        private
    {
        // Skip if garden has no GAP project
        bytes32 projectUID = gardenAccount.getGAPProjectUID();
        if (projectUID == bytes32(0)) return;

        // Get work and action data
        WorkSchema memory workSchema = abi.decode(workAttestation.data, (WorkSchema));
        ActionRegistry.Action memory action = ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID);

        // Prepare impact data
        string memory workTitle = action.title;
        string memory impactDesc = schema.feedback;
        string memory proof = workSchema.media.length > 0 ? workSchema.media[0] : "";

        // SECURITY: Use try/catch to prevent GAP failures from reverting approval
        // The gardenAccount.createProjectImpact() has onlyOperator modifier
        // Since we already validated operator in onAttest(), this is secure
        // solhint-disable-next-line no-empty-blocks
        try gardenAccount.createProjectImpact(workTitle, impactDesc, proof) {
            // Success - event emitted by GardenAccount, no additional action needed
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Intentionally ignore failures - approval succeeds even if GAP integration fails
        }
    }

    /// @notice Authorizes an upgrade to the contract's implementation.
    /// @dev This function can only be called by the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
