// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { AssessmentSchema, AssessmentV3Schema } from "../Schemas.sol";
import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { InvalidSchema } from "../CommonErrors.sol";

/// @notice Thrown when attester is neither an evaluator nor an operator of the garden
error NotAuthorizedAttester();
error TitleRequired();
error ConfigCIDRequired();
error InvalidDomain(uint8 domain);
error AssessmentV2SchemaUIDRequired();
error AssessmentV3SchemaUIDRequired();
error SchemaUIDCollision(bytes32 uid);
error InvalidAssessmentKind(uint8 kind);
error BaselineRequired();
error BaselineForbidden();
error InvalidBaseline(bytes32 baselineUID);
error BaselineGardenMismatch(bytes32 baselineUID, address expectedGarden, address actualGarden);

/// @title AssessmentResolver
/// @notice A schema resolver for Garden Assessment attestations
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract AssessmentResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice The Karma GAP module for milestone creation
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Expected EAS schema UID for assessment attestations
    bytes32 public schemaUID;

    /// @notice Expected EAS schema UID for AssessmentV3 attestations
    bytes32 public assessmentV3SchemaUID;

    /// @notice Emitted when the KarmaGAPModule is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the KarmaGAPModule is intentionally disabled
    event KarmaGAPModuleDisabled(address indexed oldModule);

    /// @notice Emitted when the expected schema UID is updated
    event SchemaUIDUpdated(bytes32 indexed schemaUID);

    /// @notice Emitted when the AssessmentV3 schema UID changes
    event AssessmentV3SchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);

    /**
     * @dev Storage gap for future upgrades
     * Reserves 47 slots (50 total - 3 used: karmaGAPModule, schemaUID, assessmentV3SchemaUID)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[47] private __gap;

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
    /// @dev When schemaUID is bytes32(0), schema validation is bypassed. This is intentional
    ///      during the deployment window before EAS schemas are registered.
    /// @param _schemaUID The schema UID to validate against
    function setSchemaUID(bytes32 _schemaUID) external onlyOwner {
        if (assessmentV3SchemaUID != bytes32(0)) {
            if (_schemaUID == bytes32(0)) revert AssessmentV2SchemaUIDRequired();
            if (_schemaUID == assessmentV3SchemaUID) revert SchemaUIDCollision(_schemaUID);
        }
        schemaUID = _schemaUID;
        emit SchemaUIDUpdated(_schemaUID);
    }

    /// @notice Sets the distinct non-zero AssessmentV3 schema UID after v2 is pinned.
    function setAssessmentV3SchemaUID(bytes32 _schemaUID) external onlyOwner {
        if (_schemaUID == bytes32(0)) revert AssessmentV3SchemaUIDRequired();
        if (schemaUID == bytes32(0)) revert AssessmentV2SchemaUIDRequired();
        if (_schemaUID == schemaUID) revert SchemaUIDCollision(_schemaUID);

        bytes32 oldUID = assessmentV3SchemaUID;
        assessmentV3SchemaUID = _schemaUID;
        emit AssessmentV3SchemaUIDUpdated(oldUID, _schemaUID);
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
        if (assessmentV3SchemaUID != bytes32(0) && attestation.schema == assessmentV3SchemaUID) {
            return _onAttestV3(attestation);
        }
        if (schemaUID != bytes32(0) && attestation.schema != schemaUID) revert InvalidSchema();

        // Decode as tuple — struct decode reverts because EAS stores data in flat-tuple
        // ABI format. See Work.sol for detailed explanation.
        AssessmentSchema memory schema;
        (
            schema.title,
            schema.description,
            schema.assessmentConfigCID,
            schema.domain,
            schema.startDate,
            schema.endDate,
            schema.location
        ) = abi.decode(attestation.data, (string, string, string, uint8, uint256, uint256, string));

        // Use IGardenAccessControl interface for role verification
        IGardenAccessControl accessControl = IGardenAccessControl(attestation.recipient);

        // IDENTITY CHECK: Verify evaluator OR operator status FIRST
        bool isEvaluator = accessControl.isEvaluator(attestation.attester);
        bool isOperator = accessControl.isOperator(attestation.attester);
        if (!isEvaluator && !isOperator) {
            revert NotAuthorizedAttester();
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

    function _onAttestV3(Attestation calldata attestation) private returns (bool) {
        AssessmentV3Schema memory schema = _decodeAssessmentV3(attestation.data);

        IGardenAccessControl accessControl = IGardenAccessControl(attestation.recipient);
        bool authorized = schema.assessmentKind == 0
            ? accessControl.isEvaluator(attestation.attester) || accessControl.isOperator(attestation.attester)
            : accessControl.isEvaluator(attestation.attester);
        if (!authorized) revert NotAuthorizedAttester();

        if (bytes(schema.title).length == 0) revert TitleRequired();
        if (bytes(schema.assessmentConfigCID).length == 0) revert ConfigCIDRequired();
        if (schema.domain > 3) revert InvalidDomain(schema.domain);
        if (schema.assessmentKind > 2) revert InvalidAssessmentKind(schema.assessmentKind);

        if (schema.assessmentKind == 1) {
            _validateBaseline(schema.baselineUID, attestation.recipient);
        } else if (schema.baselineUID != bytes32(0)) {
            revert BaselineForbidden();
        }

        if (address(karmaGAPModule) != address(0)) {
            AssessmentSchema memory legacyShape = AssessmentSchema({
                title: schema.title,
                description: schema.description,
                assessmentConfigCID: schema.assessmentConfigCID,
                domain: schema.domain,
                startDate: schema.startDate,
                endDate: schema.endDate,
                location: schema.location
            });
            _createGAPProjectMilestone(legacyShape, attestation.recipient);
        }

        return true;
    }

    /// @dev EAS stores flat tuple data rather than an ABI-wrapped struct. Decode each head word
    ///      directly to preserve that encoding without a ten-value stack assignment.
    function _decodeAssessmentV3(bytes calldata data) private pure returns (AssessmentV3Schema memory schema) {
        schema.title = _decodeString(data, 0);
        schema.description = _decodeString(data, 32);
        schema.assessmentConfigCID = _decodeString(data, 64);
        schema.domain = uint8(_decodeWord(data, 96));
        schema.startDate = _decodeWord(data, 128);
        schema.endDate = _decodeWord(data, 160);
        schema.location = _decodeString(data, 192);
        schema.assessmentKind = uint8(_decodeWord(data, 224));
        schema.cycleId = _decodeWord(data, 256);
        schema.baselineUID = bytes32(_decodeWord(data, 288));
    }

    function _decodeString(bytes calldata data, uint256 headOffset) private pure returns (string memory) {
        uint256 dynamicOffset = _decodeWord(data, headOffset);
        uint256 length = _decodeWord(data, dynamicOffset);
        return string(data[dynamicOffset + 32:dynamicOffset + 32 + length]);
    }

    function _decodeWord(bytes calldata data, uint256 offset) private pure returns (uint256 value) {
        assembly ("memory-safe") {
            value := calldataload(add(data.offset, offset))
        }
    }

    function _validateBaseline(bytes32 baselineUID, address expectedGarden) private view {
        if (baselineUID == bytes32(0)) revert BaselineRequired();
        Attestation memory baseline = _eas.getAttestation(baselineUID);
        if (baseline.uid == bytes32(0) || (baseline.schema != schemaUID && baseline.schema != assessmentV3SchemaUID)) {
            revert InvalidBaseline(baselineUID);
        }
        if (baseline.recipient != expectedGarden) {
            revert BaselineGardenMismatch(baselineUID, expectedGarden, baseline.recipient);
        }
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
