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
error InvalidConfidence();
error InvalidVerificationMethod();
error ActionMismatch();
/// @notice Thrown when attestation uses wrong schema UID
error InvalidSchema();
/// @notice Thrown when the action has expired (endTime < block.timestamp)
error ActionExpired();

/// @title WorkApprovalResolver
/// @notice A schema resolver for the Actions event schema
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract WorkApprovalResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    address public immutable ACTION_REGISTRY;

    /// @notice The Karma GAP module for impact creation
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Expected EAS schema UID for work approval attestations
    bytes32 public schemaUID;

    /// @notice Emitted when the KarmaGAPModule is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the KarmaGAPModule is intentionally disabled
    event KarmaGAPModuleDisabled(address indexed oldModule);

    /// @notice Emitted when the expected schema UID is updated
    event SchemaUIDUpdated(bytes32 indexed schemaUID);

    /**
     * @dev Storage gap for future upgrades
     * Reserves 48 slots (50 total - 2 used: karmaGAPModule, schemaUID)
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

    /// @notice Sets the KarmaGAPModule address (use address(0) to disable)
    /// @param _module The new KarmaGAPModule address, or address(0) to disable
    function setKarmaGAPModule(address _module) external onlyOwner {
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_module);
        emit KarmaGAPModuleUpdated(oldModule, _module);
        if (_module == address(0)) {
            emit KarmaGAPModuleDisabled(oldModule);
        }
    }

    /// @notice Sets the expected schema UID for work approval attestations
    /// @dev When schemaUID is bytes32(0), schema validation is bypassed. This is intentional
    ///      during the deployment window before EAS schemas are registered.
    /// @param _schemaUID The schema UID to validate against
    function setSchemaUID(bytes32 _schemaUID) external onlyOwner {
        schemaUID = _schemaUID;
        emit SchemaUIDUpdated(_schemaUID);
    }

    /// @notice Indicates whether the resolver is payable.
    /// @dev This is a pure function that always returns false.
    /// @return A boolean indicating that the resolver is not payable.
    function isPayable() public pure override returns (bool) {
        return false;
    }

    /// @notice Handles the logic to be executed when an attestation is made
    /// @dev Validates operator identity, work relationship, action validity, and confidence fields
    ///
    /// **Validation Order (Security Critical):**
    /// 1. WORK RELATIONSHIP: Verify work was submitted to this garden
    /// 2. IDENTITY: Verify attester is a garden operator (can approve/reject work)
    /// 3. ACTION: Verify action exists in registry
    /// 4. CONFIDENCE: Validate confidence value (0-3) and verificationMethod bitmask (0-15)
    /// 5. GAP INTEGRATION: Create project impact if approved and GAP supported
    ///
    /// **GAP Impact Creation:**
    /// - Only created if schema.approved == true
    /// - Only if KarmaGAPModule is configured (module handles chain support)
    /// - Uses try/catch to prevent GAP failures from reverting approval
    ///
    /// @param attestation The attestation data structure
    /// @return bool True if attestation is valid
    // solhint-disable-next-line code-complexity
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal override returns (bool) {
        if (schemaUID != bytes32(0) && attestation.schema != schemaUID) revert InvalidSchema();

        WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
        Attestation memory workAttestation = _eas.getAttestation(schema.workUID);

        // WORK RELATIONSHIP: Verify work was submitted to this garden
        if (workAttestation.recipient != attestation.recipient) {
            revert NotInWorkRegistry();
        }

        // ACTION CROSS-VALIDATION: Verify approval references same action as work
        WorkSchema memory workSchema = abi.decode(workAttestation.data, (WorkSchema));
        if (schema.actionUID != workSchema.actionUID) revert ActionMismatch();

        // Use IGardenAccessControl interface for role verification
        IGardenAccessControl accessControl = IGardenAccessControl(workAttestation.recipient);

        // IDENTITY CHECK: Only operators can approve/reject work
        // Evaluators handle assessments via AssessmentResolver, not work approvals
        if (!accessControl.isOperator(attestation.attester)) {
            revert NotGardenOperator();
        }

        // ACTION VALIDATION: Verify action exists and is still active
        ActionRegistry.Action memory action = ActionRegistry(ACTION_REGISTRY).getAction(schema.actionUID);
        if (action.startTime == 0) {
            revert NotInActionRegistry();
        }

        // TIMING VALIDATION: Verify action has not expired (matches WorkResolver pattern)
        if (action.endTime < block.timestamp) {
            revert ActionExpired();
        }

        // CONFIDENCE VALIDATION: Must be within valid range (0-3)
        if (schema.confidence > 3) {
            revert InvalidConfidence();
        }

        // VERIFICATION METHOD VALIDATION: Must be valid 4-bit bitmask (0-15)
        if (schema.verificationMethod > 15) {
            revert InvalidVerificationMethod();
        }

        // GAP INTEGRATION: Create project impact if approved
        if (schema.approved && address(karmaGAPModule) != address(0)) {
            _createGAPProjectImpact(schema, workAttestation, workSchema);
        }

        return (true);
    }

    /// @notice Work approval decisions are permanent and cannot be revoked.
    /// @dev Operators submit a new attestation if they need to change a decision.
    /// @return Always false to reject revocation attempts.
    function onRevoke(Attestation calldata, uint256 /*value*/ ) internal pure override returns (bool) {
        return false;
    }

    /// @notice Creates GAP project impact securely via KarmaGAPModule
    /// @dev SECURITY: Only called after full validation in onAttest()
    /// @param schema Work approval schema data
    /// @param workAttestation The work attestation being approved
    /// @param workSchema The decoded work schema (already decoded in onAttest)
    function _createGAPProjectImpact(
        WorkApprovalSchema memory schema,
        Attestation memory workAttestation,
        WorkSchema memory workSchema
    )
        private
    {
        // Get action data
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
