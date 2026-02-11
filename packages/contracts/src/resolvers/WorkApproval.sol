// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkApprovalSchema, WorkSchema } from "../Schemas.sol";
import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IERC6551Account } from "../interfaces/IERC6551Account.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotInActionRegistry } from "./Work.sol";

error NotInWorkRegistry();
error NotGardenOperator();

/// @title WorkApprovalResolver
/// @notice A schema resolver for the Actions event schema
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract WorkApprovalResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    address public immutable ACTION_REGISTRY;

    /// @dev Reserved slot — previously `greenGoodsResolver`. Do not reuse.
    uint256 private __reservedSlot0;

    /// @notice The Karma GAP module for impact creation
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Emitted when the KarmaGAPModule is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /**
     * @dev Storage gap for future upgrades
     * Reserves 48 slots (50 total - 2 used: __reservedSlot0, karmaGAPModule)
     * Note: ACTION_REGISTRY is immutable (not in storage)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[48] private __gap;

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

    /// @notice Sets the KarmaGAPModule address
    /// @param _module The new KarmaGAPModule address
    function setKarmaGAPModule(address _module) external onlyOwner {
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_module);
        emit KarmaGAPModuleUpdated(oldModule, _module);
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
    /// - Only if KarmaGAPModule is configured (module handles chain support)
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

        // Use IGardenAccessControl interface for role verification
        IGardenAccessControl accessControl = IGardenAccessControl(workAttestation.recipient);

        // IDENTITY CHECK: Verify evaluator OR operator status
        // Uses IGardenAccessControl interface for swappable access control backends
        bool isEvaluator = accessControl.isEvaluator(attestation.attester);
        bool isOperator = accessControl.isOperator(attestation.attester);
        if (!isEvaluator && !isOperator) {
            revert NotGardenOperator();
        }

        // ACTION VALIDATION: Verify action exists
        if (ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID).startTime == 0) {
            revert NotInActionRegistry();
        }

        // GAP INTEGRATION: Create project impact if approved
        if (schema.approved && address(karmaGAPModule) != address(0)) {
            _createGAPProjectImpact(schema, workAttestation);
        }

        return (true);
    }

    /// @notice Handles the logic to be executed when an attestation is revoked.
    /// @dev Only garden operators can revoke work approvals.
    ///
    /// **Validation:**
    /// - Verifies the revoker is an operator of the garden the approval was for
    /// - Original approver OR any garden operator can revoke
    ///
    /// @param attestation The attestation being revoked
    /// @return A boolean indicating whether the revocation is valid.
    function onRevoke(Attestation calldata attestation, uint256 /*value*/ ) internal view override returns (bool) {
        // The approval attestation recipient is the garden address
        IGardenAccessControl accessControl = IGardenAccessControl(attestation.recipient);

        // IDENTITY CHECK: Evaluators or operators can revoke work approvals
        bool isEvaluator = accessControl.isEvaluator(attestation.attester);
        bool isOperator = accessControl.isOperator(attestation.attester);
        if (!isEvaluator && !isOperator) {
            revert NotGardenOperator();
        }

        return true;
    }

    /// @notice Creates GAP project impact securely via KarmaGAPModule
    /// @dev SECURITY: Only called after full validation in onAttest()
    /// @param schema Work approval schema data
    /// @param workAttestation The work attestation being approved
    function _createGAPProjectImpact(WorkApprovalSchema memory schema, Attestation memory workAttestation) private {
        // Get work and action data
        WorkSchema memory workSchema = abi.decode(workAttestation.data, (WorkSchema));
        ActionRegistry.Action memory action = ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID);

        // Prepare impact data
        string memory workTitle = action.title;
        string memory impactDesc = schema.feedback;
        string memory proof = workSchema.media.length > 0 ? workSchema.media[0] : "";

        (,, uint256 tokenId) = IERC6551Account(workAttestation.recipient).token();

        // SECURITY: Use try/catch to prevent GAP failures from reverting approval
        // solhint-disable-next-line no-empty-blocks
        try karmaGAPModule.createImpact(workAttestation.recipient, tokenId, workTitle, impactDesc, proof, schema.workUID) {
            // Success - event emitted by module, no additional action needed
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
