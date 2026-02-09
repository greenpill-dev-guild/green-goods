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
error AssessmentTypeRequired();
error AtLeastOneCapitalRequired();
error InvalidCapital(string invalidCapital);

/// @title AssessmentResolver
/// @notice A schema resolver for Garden Assessment attestations
/// @dev This contract is upgradable using the UUPS pattern and requires initialization.
contract AssessmentResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice The Karma GAP module for milestone creation
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Emitted when the KarmaGAPModule is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /**
     * @dev Storage gap for future upgrades
     * Reserves 49 slots (50 total - 1 used: karmaGAPModule)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[49] private __gap;

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

    /// @notice Sets the KarmaGAPModule address
    /// @param _module The new KarmaGAPModule address
    function setKarmaGAPModule(address _module) external onlyOwner {
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_module);
        emit KarmaGAPModuleUpdated(oldModule, _module);
    }

    /// @notice Indicates whether the resolver is payable.
    /// @dev This is a pure function that always returns true.
    /// @return A boolean indicating that the resolver is payable.
    function isPayable() public pure override returns (bool) {
        return true;
    }

    /// @notice Handles the logic to be executed when an attestation is made
    /// @dev Validates operator identity and assessment data structure
    ///
    /// **Validation Order (Security Critical):**
    /// 1. SCHEMA DECODING: Decode assessment data structure
    /// 2. IDENTITY: Verify attester is a garden operator (can create assessments)
    /// 3. REQUIRED FIELDS: Validate title, assessmentType, capitals exist
    /// 4. CAPITAL VALIDATION: Verify each capital is one of 8 valid types
    /// 5. GAP INTEGRATION: Create project milestone if KarmaGAPModule is configured
    ///
    /// **8 Forms of Capital:**
    /// - social, material, financial, living
    /// - intellectual, experiential, spiritual, cultural
    ///
    /// @param attestation The attestation data structure
    /// @return bool True if attestation is valid
    function onAttest(Attestation calldata attestation, uint256 /*value*/ ) internal override returns (bool) {
        // Decode the assessment schema to validate structure
        AssessmentSchema memory schema = abi.decode(attestation.data, (AssessmentSchema));

        // Use IGardenAccessControl interface for role verification
        IGardenAccessControl accessControl = IGardenAccessControl(attestation.recipient);

        // IDENTITY CHECK: Verify evaluator OR operator status FIRST
        // Uses IGardenAccessControl interface for swappable access control backends
        bool isEvaluator = accessControl.isEvaluator(attestation.attester);
        bool isOperator = accessControl.isOperator(attestation.attester);
        if (!isEvaluator && !isOperator) {
            revert NotGardenOperator();
        }

        // REQUIRED FIELDS: Validate essential data
        if (bytes(schema.title).length == 0) {
            revert TitleRequired();
        }

        if (bytes(schema.assessmentType).length == 0) {
            revert AssessmentTypeRequired();
        }

        if (schema.capitals.length == 0) {
            revert AtLeastOneCapitalRequired();
        }

        // CAPITAL VALIDATION: Verify capitals are valid
        // Ensures data quality for assessment attestations
        for (uint256 i = 0; i < schema.capitals.length; i++) {
            string memory capital = schema.capitals[i];
            if (!_isValidCapital(capital)) {
                revert InvalidCapital(capital);
            }
        }

        // GAP INTEGRATION: Create project milestone (assessment)
        if (address(karmaGAPModule) != address(0)) {
            _createGAPProjectMilestone(schema, attestation.recipient);
        }

        return true;
    }

    /// @notice Validates if a capital name is one of the 8 forms of capital
    /// @param capital The capital name to validate
    /// @return True if the capital is valid, false otherwise
    function _isValidCapital(string memory capital) internal pure returns (bool) {
        bytes32 capitalHash;
        // JUSTIFICATION: Gas optimization for string hashing - saves ~200 gas per validation
        // Safe because we control the capital string and only read its length and data
        // solhint-disable-next-line no-inline-assembly
        assembly {
            capitalHash := keccak256(add(capital, 32), mload(capital))
        }

        return capitalHash == keccak256("social") || capitalHash == keccak256("material")
            || capitalHash == keccak256("financial") || capitalHash == keccak256("living")
            || capitalHash == keccak256("intellectual") || capitalHash == keccak256("experiential")
            || capitalHash == keccak256("spiritual") || capitalHash == keccak256("cultural");
    }

    /// @notice Creates GAP project milestone securely via KarmaGAPModule
    /// @dev SECURITY: Only called after full validation in onAttest()
    /// @param schema Assessment schema data
    /// @param garden The garden address to create milestone for
    function _createGAPProjectMilestone(AssessmentSchema memory schema, address garden) private {
        // Build milestone metadata JSON
        string memory metaJSON = _buildMilestoneMetadata(schema);

        // SECURITY: Use try/catch to prevent GAP failures from reverting assessment
        // solhint-disable-next-line no-empty-blocks
        try karmaGAPModule.createMilestone(garden, schema.title, schema.description, metaJSON) {
            // Success - event emitted by module, no additional action needed
        } catch {
            // Intentionally ignore failures - assessment succeeds even if GAP integration fails
        }
    }

    /// @notice Builds milestone metadata JSON from assessment schema
    /// @param schema Assessment schema data
    /// @return JSON string with assessment metadata
    function _buildMilestoneMetadata(AssessmentSchema memory schema) private pure returns (string memory) {
        // Build capitals array JSON - capitals are validated so no escaping needed
        string memory capitalsJSON = "[";
        for (uint256 i = 0; i < schema.capitals.length; i++) {
            if (i > 0) capitalsJSON = string(abi.encodePacked(capitalsJSON, ","));
            capitalsJSON = string(abi.encodePacked(capitalsJSON, "\"", schema.capitals[i], "\""));
        }
        capitalsJSON = string(abi.encodePacked(capitalsJSON, "]"));

        // Build full metadata JSON with escaped strings
        return string(
            abi.encodePacked(
                "{\"capitals\":",
                capitalsJSON,
                ",",
                "\"assessmentType\":\"",
                _escapeJSON(schema.assessmentType),
                "\",",
                "\"metricsJSON\":\"",
                _escapeJSON(schema.metricsJSON),
                "\"}"
            )
        );
    }

    /// @notice Escapes double quotes in JSON strings
    /// @param str The string to escape
    /// @return Escaped string safe for JSON embedding
    function _escapeJSON(string memory str) private pure returns (string memory) {
        bytes memory b = bytes(str);
        uint256 quoteCount = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "\"") quoteCount++;
        }

        if (quoteCount == 0) return str;

        bytes memory escaped = new bytes(b.length + quoteCount);
        uint256 j = 0;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "\"") {
                escaped[j++] = "\\";
            }
            escaped[j++] = b[i];
        }

        return string(escaped);
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
