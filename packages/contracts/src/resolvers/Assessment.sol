// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { AssessmentSchema } from "../Schemas.sol";
import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";

error NotGardenOperator();
error TitleRequired();
error ConfigCIDRequired();
error InvalidDomain(uint8 domain);
/// @notice Thrown when attestation uses wrong schema UID
error InvalidSchema();

/// @title AssessmentResolver
/// @notice A schema resolver for Garden Assessment attestations
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract AssessmentResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice The Karma GAP module for milestone creation
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Expected EAS schema UID for assessment attestations
    bytes32 public schemaUID;

    /// @notice Emitted when the KarmaGAPModule is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the KarmaGAPModule is intentionally disabled
    event KarmaGAPModuleDisabled(address indexed oldModule);

    /**
     * @dev Storage gap for future upgrades
     * Reserves 48 slots (50 total - 2 used: karmaGAPModule, schemaUID)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[48] private __gap;

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

    /// @notice Sets the expected schema UID for assessment attestations
    /// @param _schemaUID The schema UID to validate against
    function setSchemaUID(bytes32 _schemaUID) external onlyOwner {
        schemaUID = _schemaUID;
    }

    /// @notice Indicates whether the resolver is payable.
    /// @dev This is a pure function that always returns false.
    /// @return A boolean indicating that the resolver is not payable.
    function isPayable() public pure override returns (bool) {
        return false;
    }

    /// @notice Handles the logic to be executed when an attestation is made
    /// @dev Validates operator identity and assessment v2 data structure
    ///
    /// **Validation Order (Security Critical):**
    /// 1. SCHEMA DECODING: Decode assessment v2 data structure
    /// 2. IDENTITY: Verify attester is a garden evaluator or operator
    /// 3. REQUIRED FIELDS: Validate title and assessmentConfigCID exist
    /// 4. DOMAIN VALIDATION: Verify domain is valid (0-3)
    /// 5. GAP INTEGRATION: Create project milestone if KarmaGAPModule is configured
    ///
    /// @param attestation The attestation data structure
    /// @return bool True if attestation is valid
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal override returns (bool) {
        if (schemaUID != bytes32(0) && attestation.schema != schemaUID) revert InvalidSchema();

        // Decode the assessment v2 schema
        AssessmentSchema memory schema = abi.decode(attestation.data, (AssessmentSchema));

        // Use IGardenAccessControl interface for role verification
        IGardenAccessControl accessControl = IGardenAccessControl(attestation.recipient);

        // IDENTITY CHECK: Verify evaluator OR operator status FIRST
        bool isEvaluator = accessControl.isEvaluator(attestation.attester);
        bool isOperator = accessControl.isOperator(attestation.attester);
        if (!isEvaluator && !isOperator) {
            revert NotGardenOperator();
        }

        // REQUIRED FIELDS: Validate essential data
        if (bytes(schema.title).length == 0) {
            revert TitleRequired();
        }

        if (bytes(schema.assessmentConfigCID).length == 0) {
            revert ConfigCIDRequired();
        }

        // DOMAIN VALIDATION: domain must be 0-3 (SOLAR, AGRO, EDU, WASTE)
        if (schema.domain > 3) {
            revert InvalidDomain(schema.domain);
        }

        // GAP INTEGRATION: Create project milestone (assessment)
        if (address(karmaGAPModule) != address(0)) {
            _createGAPProjectMilestone(schema, attestation.recipient);
        }

        return true;
    }

    /// @notice Creates GAP project milestone securely via KarmaGAPModule
    /// @dev SECURITY: Only called after full validation in onAttest()
    /// @param schema Assessment schema data
    /// @param garden The garden address to create milestone for
    function _createGAPProjectMilestone(AssessmentSchema memory schema, address garden) private {
        // SECURITY: Use try/catch to prevent GAP failures from reverting assessment
        // solhint-disable-next-line no-empty-blocks
        try karmaGAPModule.createMilestone(
            garden,
            schema.title,
            schema.description,
            schema.startDate,
            schema.endDate,
            schema.domain,
            schema.location,
            schema.assessmentConfigCID
        ) {
            // Success - event emitted by module, no additional action needed
        } catch {
            // Intentionally ignore failures - assessment succeeds even if GAP integration fails
        }
    }

    // solhint-disable no-unused-vars
    /// @notice Handles the logic to be executed when an attestation is revoked.
    /// @dev Assessments are NOT revocable - always returns false.
    /// @return Always false - assessments cannot be revoked.
    function onRevoke(Attestation calldata, /*attestation*/ uint256 /*value*/ ) internal pure override returns (bool) {
        // Assessments are permanent and cannot be revoked
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
