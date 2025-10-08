// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { DeployHelper } from "./DeployHelper.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { ResolverStub } from "../src/resolvers/ResolverStub.sol";
import { TBALib } from "../src/lib/TBA.sol";

/// @notice Schema registry interface
interface ISchemaRegistry {
    function register(string calldata schema, address resolverAddress, bool revocable) external returns (bytes32);
    function getSchema(bytes32 uid) external view returns (string memory schema, address resolver, bool revocable);
}

/// @notice EAS interface for attestations
interface IEAS {
    struct AttestationRequest {
        bytes32 schema;
        AttestationRequestData data;
    }

    struct AttestationRequestData {
        address recipient;
        uint64 expirationTime;
        bool revocable;
        bytes32 refUID;
        bytes data;
        uint256 value;
    }

    function attest(AttestationRequest calldata request) external payable returns (bytes32);
}

/// @title Deploy
/// @notice Main deployment script for Green Goods contracts
contract Deploy is Script, DeployHelper {
    // ===== DETERMINISTIC DEPLOYMENT CONSTANTS =====
    // (for cross-chain consistency when using optimized profile)
    bytes32 public constant DETERMINISTIC_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
    address public constant DETERMINISTIC_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address public constant MANAGER = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address public constant MULTISIG = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    address public constant TOKENBOUND_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    /// @notice Schema configuration

    struct SchemaConfig {
        string name;
        string description;
        string schema;
        address resolver;
        bool revocable;
    }

    /// @notice Standard EAS Schema UID for naming
    bytes32 public constant SCHEMA_NAME_SCHEMA = 0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc;

    /// @notice Standard EAS Schema UID for descriptions
    bytes32 public constant SCHEMA_DESCRIPTION_SCHEMA = 0x21cbc60aac46ba22125ff85dd01882ebe6e87eb4fc46628589931ccbef9b8c94;

    /// @notice Error thrown when Guardian deployment address doesn't match predicted
    error GuardianDeploymentAddressMismatch();

    /// @notice Error thrown when GardenAccount deployment address doesn't match predicted
    error GardenAccountDeploymentAddressMismatch();

    /// @notice Error thrown when AccountProxy deployment address doesn't match predicted
    error AccountProxyDeploymentAddressMismatch();

    /// @notice Error thrown when GardenToken deployment address doesn't match predicted
    error GardenTokenDeploymentAddressMismatch();

    /// @notice Error thrown when ActionRegistry deployment address doesn't match predicted
    error ActionRegistryDeploymentAddressMismatch();

    /// @notice Error thrown when WorkResolver deployment address doesn't match predicted
    error WorkResolverDeploymentAddressMismatch();

    /// @notice Error thrown when WorkApprovalResolver deployment address doesn't match predicted
    error WorkApprovalResolverDeploymentAddressMismatch();

    /// @notice Error thrown when schema registry address is zero
    error SchemaRegistryAddressZero();

    /// @notice Error thrown when EAS contract address is zero
    error EASAddressZero();

    /// @notice Error thrown when work resolver address is zero
    error WorkResolverAddressZero();

    /// @notice Error thrown when work approval resolver address is zero
    error WorkApprovalResolverAddressZero();

    /// @notice Error thrown when schema deployment fails after retries
    error SchemaDeploymentFailed(string schemaName, string reason);

    /// @notice Error thrown when schema generation fails
    error SchemaGenerationFailed(string schemaName);

    /// @notice Error thrown when schema validation fails
    error SchemaValidationFailed(string schemaName, string expectedSchema, string actualSchema);

    /// @notice Error thrown when unauthorized caller attempts to call internal function
    error OnlySelfCanCall();

    /// @notice Error thrown when invalid capital type is provided
    error InvalidCapitalType();

    /// @notice Deployment profile types
    enum DeploymentProfile {
        FULL,
        UPDATE,
        METADATA_ONLY,
        CONTRACTS_ONLY,
        SCHEMAS_ONLY,
        TESTING,
        PRODUCTION,
        HOTFIX,
        OPTIMIZED
    }

    /// @notice Contract deployment flags
    struct ContractFlags {
        bool skipExisting;
        bool forceRedeploy;
        bool skipVerification;
    }

    /// @notice Schema deployment flags
    struct SchemaFlags {
        bool skip;
        bool forceRedeploy;
        bool metadataOnly;
    }

    /// @notice Configuration flags
    struct ConfigurationFlags {
        bool skipConfiguration;
        bool skipSeedData;
        bool skipGovernanceTransfer;
        bool addDeployerToAllowlist;
    }

    /// @notice Logging flags
    struct LoggingFlags {
        bool verbose;
    }

    /// @notice Deployment control flags
    struct DeploymentFlags {
        ContractFlags contracts;
        SchemaFlags schemas;
        ConfigurationFlags config;
        LoggingFlags logging;
        // Legacy flags for backward compatibility
        bool skipExistingContracts;
        bool forceRedeploy;
        bool skipSchemas;
        bool forceSchemaDeployment;
        bool skipVerification;
        bool skipSeedData;
        bool skipConfiguration;
        bool verboseLogging;
        bool skipGovernanceTransfer;
        bool addDeployerToAllowlist;
        bool metadataOnly;
    }

    /// @notice Deployment configuration struct for cleaner code organization
    struct DeploymentConfig {
        NetworkConfig config;
        bytes32 salt;
        address factory;
        address tokenboundRegistry;
        address deployer;
        address multisig;
    }

    /// @notice Load deployment profile from environment variable
    function _loadDeploymentProfile() internal view returns (DeploymentProfile) {
        try vm.envString("DEPLOYMENT_PROFILE") returns (string memory profileStr) {
            return _getProfileFromString(profileStr);
        } catch { }

        return DeploymentProfile.FULL; // Default
    }

    /// @notice Helper function to convert profile string to enum
    function _getProfileFromString(string memory profileStr) internal pure returns (DeploymentProfile) {
        bytes32 profileHash = keccak256(abi.encodePacked(profileStr));

        // First check common profiles
        if (profileHash == keccak256("full")) return DeploymentProfile.FULL;
        if (profileHash == keccak256("update")) return DeploymentProfile.UPDATE;
        if (profileHash == keccak256("production")) return DeploymentProfile.PRODUCTION;
        if (profileHash == keccak256("testing")) return DeploymentProfile.TESTING;
        if (profileHash == keccak256("optimized")) return DeploymentProfile.OPTIMIZED;

        // Then check specialized profiles
        return _getSpecializedProfile(profileHash);
    }

    /// @notice Helper function to get specialized profiles
    function _getSpecializedProfile(bytes32 profileHash) internal pure returns (DeploymentProfile) {
        if (profileHash == keccak256("metadata-only")) return DeploymentProfile.METADATA_ONLY;
        if (profileHash == keccak256("contracts-only")) return DeploymentProfile.CONTRACTS_ONLY;
        if (profileHash == keccak256("schemas-only")) return DeploymentProfile.SCHEMAS_ONLY;
        if (profileHash == keccak256("hotfix")) return DeploymentProfile.HOTFIX;

        return DeploymentProfile.FULL; // Default for unknown profiles
    }

    /// @notice Load deployment flags from environment variables
    function _loadDeploymentFlags() internal view returns (DeploymentFlags memory flags) {
        DeploymentProfile profile = _loadDeploymentProfile();

        // Load base flags from profile
        flags = _getFlagsForProfile(profile);

        // Override with specific environment variables if set
        _applyEnvironmentOverrides(flags);
    }

    /// @notice Get flags for a specific deployment profile
    function _getFlagsForProfile(DeploymentProfile profile) internal pure returns (DeploymentFlags memory) {
        // Use a more efficient pattern to reduce complexity
        if (profile == DeploymentProfile.METADATA_ONLY) return _getMetadataOnlyFlags();
        if (profile == DeploymentProfile.UPDATE) return _getUpdateFlags();
        if (profile == DeploymentProfile.CONTRACTS_ONLY) return _getContractsOnlyFlags();
        if (profile == DeploymentProfile.SCHEMAS_ONLY) return _getSchemasOnlyFlags();

        // Group remaining profiles to reduce branching
        if (profile == DeploymentProfile.TESTING || profile == DeploymentProfile.PRODUCTION) {
            return profile == DeploymentProfile.TESTING ? _getTestingFlags() : _getProductionFlags();
        }

        if (profile == DeploymentProfile.HOTFIX || profile == DeploymentProfile.OPTIMIZED) {
            return profile == DeploymentProfile.HOTFIX ? _getHotfixFlags() : _getOptimizedFlags();
        }

        // Default FULL profile
        return _getDefaultFlags();
    }

    /// @notice Get metadata-only deployment flags
    function _getMetadataOnlyFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: true }),
            schemas: SchemaFlags({ skip: true, forceRedeploy: false, metadataOnly: true }),
            config: ConfigurationFlags({
                skipConfiguration: true,
                skipSeedData: true,
                skipGovernanceTransfer: true,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: true }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: true,
            forceSchemaDeployment: false,
            skipVerification: true,
            skipSeedData: true,
            skipConfiguration: true,
            verboseLogging: true,
            skipGovernanceTransfer: true,
            addDeployerToAllowlist: false,
            metadataOnly: true
        });
    }

    /// @notice Get update deployment flags
    function _getUpdateFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: true }),
            schemas: SchemaFlags({ skip: false, forceRedeploy: true, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: false,
                skipSeedData: true,
                skipGovernanceTransfer: true,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: false }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: false,
            forceSchemaDeployment: true,
            skipVerification: true,
            skipSeedData: true,
            skipConfiguration: false,
            verboseLogging: false,
            skipGovernanceTransfer: true,
            addDeployerToAllowlist: false,
            metadataOnly: false
        });
    }

    /// @notice Get contracts-only deployment flags
    function _getContractsOnlyFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: false, forceRedeploy: false, skipVerification: false }),
            schemas: SchemaFlags({ skip: true, forceRedeploy: false, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: true,
                skipSeedData: true,
                skipGovernanceTransfer: true,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: false }),
            skipExistingContracts: false,
            forceRedeploy: false,
            skipSchemas: true,
            forceSchemaDeployment: false,
            skipVerification: false,
            skipSeedData: true,
            skipConfiguration: true,
            verboseLogging: false,
            skipGovernanceTransfer: true,
            addDeployerToAllowlist: false,
            metadataOnly: false
        });
    }

    /// @notice Get schemas-only deployment flags
    function _getSchemasOnlyFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: true }),
            schemas: SchemaFlags({ skip: false, forceRedeploy: false, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: true,
                skipSeedData: true,
                skipGovernanceTransfer: true,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: false }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: false,
            forceSchemaDeployment: false,
            skipVerification: true,
            skipSeedData: true,
            skipConfiguration: true,
            verboseLogging: false,
            skipGovernanceTransfer: true,
            addDeployerToAllowlist: false,
            metadataOnly: false
        });
    }

    /// @notice Get testing deployment flags
    function _getTestingFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: false }),
            schemas: SchemaFlags({ skip: false, forceRedeploy: false, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: false,
                skipSeedData: false,
                skipGovernanceTransfer: false,
                addDeployerToAllowlist: true
            }),
            logging: LoggingFlags({ verbose: true }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: false,
            forceSchemaDeployment: false,
            skipVerification: false,
            skipSeedData: false,
            skipConfiguration: false,
            verboseLogging: true,
            skipGovernanceTransfer: false,
            addDeployerToAllowlist: true,
            metadataOnly: false
        });
    }

    /// @notice Get production deployment flags
    function _getProductionFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: false }),
            schemas: SchemaFlags({ skip: false, forceRedeploy: false, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: false,
                skipSeedData: true,
                skipGovernanceTransfer: false,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: false }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: false,
            forceSchemaDeployment: false,
            skipVerification: false,
            skipSeedData: true,
            skipConfiguration: false,
            verboseLogging: false,
            skipGovernanceTransfer: false,
            addDeployerToAllowlist: false,
            metadataOnly: false
        });
    }

    /// @notice Get hotfix deployment flags
    function _getHotfixFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: true }),
            schemas: SchemaFlags({ skip: true, forceRedeploy: false, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: false,
                skipSeedData: true,
                skipGovernanceTransfer: true,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: true }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: true,
            forceSchemaDeployment: false,
            skipVerification: true,
            skipSeedData: true,
            skipConfiguration: false,
            verboseLogging: true,
            skipGovernanceTransfer: true,
            addDeployerToAllowlist: false,
            metadataOnly: false
        });
    }

    /// @notice Get optimized deployment flags
    function _getOptimizedFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: false }),
            schemas: SchemaFlags({ skip: false, forceRedeploy: true, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: false,
                skipSeedData: true,
                skipGovernanceTransfer: true,
                addDeployerToAllowlist: false
            }),
            logging: LoggingFlags({ verbose: true }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: false,
            forceSchemaDeployment: true,
            skipVerification: false,
            skipSeedData: true,
            skipConfiguration: false,
            verboseLogging: true,
            skipGovernanceTransfer: true,
            addDeployerToAllowlist: false,
            metadataOnly: false
        });
    }

    /// @notice Get default deployment flags
    function _getDefaultFlags() internal pure returns (DeploymentFlags memory) {
        return DeploymentFlags({
            contracts: ContractFlags({ skipExisting: true, forceRedeploy: false, skipVerification: false }),
            schemas: SchemaFlags({ skip: false, forceRedeploy: false, metadataOnly: false }),
            config: ConfigurationFlags({
                skipConfiguration: false,
                skipSeedData: false,
                skipGovernanceTransfer: false,
                addDeployerToAllowlist: true
            }),
            logging: LoggingFlags({ verbose: false }),
            skipExistingContracts: true,
            forceRedeploy: false,
            skipSchemas: false,
            forceSchemaDeployment: false,
            skipVerification: false,
            skipSeedData: false,
            skipConfiguration: false,
            verboseLogging: false,
            skipGovernanceTransfer: false,
            addDeployerToAllowlist: true,
            metadataOnly: false
        });
    }

    /// @notice Apply environment variable overrides to flags
    function _applyEnvironmentOverrides(DeploymentFlags memory flags) internal view {
        try vm.envBool("SKIP_EXISTING_CONTRACTS") returns (bool value) {
            flags.skipExistingContracts = value;
        } catch { }

        try vm.envBool("FORCE_REDEPLOY") returns (bool value) {
            flags.forceRedeploy = value;
            if (value) {
                flags.skipExistingContracts = false; // Force redeploy overrides skip
            }
        } catch { }

        try vm.envBool("SKIP_SCHEMAS") returns (bool value) {
            flags.skipSchemas = value;
        } catch { }

        try vm.envBool("FORCE_SCHEMA_DEPLOYMENT") returns (bool value) {
            flags.forceSchemaDeployment = value;
        } catch { }

        try vm.envBool("SKIP_VERIFICATION") returns (bool value) {
            flags.skipVerification = value;
        } catch { }

        try vm.envBool("SKIP_SEED_DATA") returns (bool value) {
            flags.skipSeedData = value;
        } catch { }

        try vm.envBool("SKIP_CONFIGURATION") returns (bool value) {
            flags.skipConfiguration = value;
        } catch { }

        try vm.envBool("VERBOSE_LOGGING") returns (bool value) {
            flags.verboseLogging = value;
        } catch { }

        try vm.envBool("SKIP_GOVERNANCE_TRANSFER") returns (bool value) {
            flags.skipGovernanceTransfer = value;
        } catch { }

        try vm.envBool("ADD_DEPLOYER_TO_ALLOWLIST") returns (bool value) {
            flags.addDeployerToAllowlist = value;
        } catch { }

        try vm.envBool("METADATA_ONLY") returns (bool value) {
            flags.metadataOnly = value;
        } catch { }
    }

    /// @notice Get network configuration for deterministic deployment
    function _getDeterministicNetworkConfig() internal view returns (NetworkConfig memory) {
        uint256 chainId = block.chainid;

        if (chainId == 84_532) {
            // Base Sepolia
            return NetworkConfig({
                eas: 0x4200000000000000000000000000000000000021,
                easSchemaRegistry: 0x4200000000000000000000000000000000000020,
                communityToken: 0x4cB67033da4FD849a552A4C5553E7F532B93E516,
                safe: address(0),
                safeFactory: address(0),
                safe4337Module: address(0),
                erc4337EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789,
                multicallForwarder: 0xcA11bde05977b3631167028862bE2a173976CA11,
                greenGoodsSafe: MULTISIG,
                multisig: MULTISIG
            });
        } else if (chainId == 42_220) {
            // Celo
            return NetworkConfig({
                eas: 0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92,
                easSchemaRegistry: 0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34,
                communityToken: 0x4cB67033da4FD849a552A4C5553E7F532B93E516,
                safe: address(0),
                safeFactory: address(0),
                safe4337Module: address(0),
                erc4337EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789,
                multicallForwarder: 0xcA11bde05977b3631167028862bE2a173976CA11,
                greenGoodsSafe: MULTISIG,
                multisig: MULTISIG
            });
        } else {
            // Fall back to regular network config loading
            return loadNetworkConfig();
        }
    }

    function run() external {
        // Load configuration and flags
        DeploymentFlags memory flags = _loadDeploymentFlags();

        // Setup deployment configuration
        DeploymentConfig memory deploymentConfig = _setupDeploymentConfiguration(flags);

        // Execute deployment phases
        DeploymentResult memory result = _executeDeployment(deploymentConfig, flags);

        // Post-deployment tasks
        _finalizeDeployment(result, flags);
    }

    /// @notice Setup deployment configuration based on profile and flags
    function _setupDeploymentConfiguration(DeploymentFlags memory flags) internal returns (DeploymentConfig memory) {
        NetworkConfig memory config;
        bytes32 salt;
        address factory;
        address tokenboundRegistry;
        address deployer = msg.sender;

        // Use deterministic config for optimized profile
        bool useDeterministic = (_loadDeploymentProfile() == DeploymentProfile.OPTIMIZED);

        if (useDeterministic) {
            config = _getDeterministicNetworkConfig();
            salt = DETERMINISTIC_SALT;
            factory = DETERMINISTIC_FACTORY;
            tokenboundRegistry = TOKENBOUND_REGISTRY;

            console.log("=== DETERMINISTIC CROSS-CHAIN DEPLOYMENT ===");
            console.log("Using deterministic addresses for cross-chain consistency");
            console.log("Manager:", MANAGER);
            console.log("Multisig:", MULTISIG);
            console.log("Salt:", vm.toString(DETERMINISTIC_SALT));
        } else {
            config = loadNetworkConfig();
            (salt, factory, tokenboundRegistry) = getDeploymentDefaults();
            console.log("=== STANDARD DEPLOYMENT ===");
        }

        address multisig = config.multisig;

        console.log("Deploying to chain:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Multisig:", multisig != address(0) ? vm.toString(multisig) : "Not configured");
        console.log("Salt:", vm.toString(salt));

        if (flags.verboseLogging) {
            _logDeploymentFlags(flags);
        }

        return DeploymentConfig({
            config: config,
            salt: salt,
            factory: factory,
            tokenboundRegistry: tokenboundRegistry,
            deployer: deployer,
            multisig: multisig
        });
    }

    /// @notice Execute the main deployment phases
    function _executeDeployment(
        DeploymentConfig memory deploymentConfig,
        DeploymentFlags memory flags
    )
        internal
        returns (DeploymentResult memory)
    {
        vm.startBroadcast();

        DeploymentResult memory result;

        // 1. Deploy DeploymentRegistry with proper ownership
        result.deploymentRegistry = deployDeploymentRegistryWithGovernance(
            deploymentConfig.multisig != address(0) ? deploymentConfig.multisig : deploymentConfig.deployer,
            deploymentConfig.deployer,
            flags
        );

        // 2. Deploy core infrastructure
        result = _deployCoreInfrastructure(result, deploymentConfig);

        // 3. Deploy registries and resolvers
        result = _deployRegistriesAndResolvers(result, deploymentConfig);

        // 4. Deploy EAS schemas (with skip flag)
        if (!flags.skipSchemas) {
            (result.assessmentSchemaUID, result.workSchemaUID, result.workApprovalSchemaUID) = _deployEASSchemasWithFlags(
                deploymentConfig.config.easSchemaRegistry,
                result.assessmentResolver,
                result.workResolver,
                result.workApprovalResolver,
                flags
            );
        } else {
            console.log(">> Skipping schema deployment (SKIP_SCHEMAS=true)");
        }


        return result;
    }

    /// @notice Deploy core infrastructure contracts
    function _deployCoreInfrastructure(
        DeploymentResult memory result,
        DeploymentConfig memory deploymentConfig
    )
        internal
        returns (DeploymentResult memory)
    {
        result.guardian =
            deployGuardian(deploymentConfig.config.greenGoodsSafe, deploymentConfig.salt, deploymentConfig.factory);
        result.gardenAccountImpl = deployGardenAccount(
            deploymentConfig.config.erc4337EntryPoint,
            deploymentConfig.config.multicallForwarder,
            deploymentConfig.tokenboundRegistry,
            result.guardian,
            deploymentConfig.salt,
            deploymentConfig.factory
        );
        result.accountProxy =
            deployAccountProxy(result.guardian, result.gardenAccountImpl, deploymentConfig.salt, deploymentConfig.factory);
        result.gardenToken = deployGardenToken(
            result.gardenAccountImpl,
            deploymentConfig.config.greenGoodsSafe,
            result.deploymentRegistry,
            deploymentConfig.salt,
            deploymentConfig.factory
        );

        return result;
    }

    /// @notice Deploy registries and resolvers
    function _deployRegistriesAndResolvers(
        DeploymentResult memory result,
        DeploymentConfig memory deploymentConfig
    )
        internal
        returns (DeploymentResult memory)
    {
        result.actionRegistry =
            deployActionRegistry(deploymentConfig.config.greenGoodsSafe, deploymentConfig.salt, deploymentConfig.factory);
        result.workResolver = _deployWorkResolver(
            deploymentConfig.config.eas, result.actionRegistry, deploymentConfig.salt, deploymentConfig.factory
        );
        result.workApprovalResolver = _deployWorkApprovalResolver(
            deploymentConfig.config.eas, result.actionRegistry, deploymentConfig.salt, deploymentConfig.factory
        );
        result.assessmentResolver =
            _deployAssessmentResolver(deploymentConfig.config.eas, deploymentConfig.salt, deploymentConfig.factory);

        return result;
    }

    /// @notice Finalize deployment with configuration and seed data
    function _finalizeDeployment(DeploymentResult memory result, DeploymentFlags memory flags) internal {
        // 5. Configure DeploymentRegistry (with governance handling)
        if (!flags.skipConfiguration) {
            _configureDeploymentRegistryWithGovernance(
                result.deploymentRegistry, _getCurrentConfig(), result, _getCurrentDeployer(), _getCurrentMultisig(), flags
            );
        } else {
            console.log(">> Skipping deployment registry configuration (SKIP_CONFIGURATION=true)");
        }

        // 6. ALWAYS initialize root garden (required for all deployments)
        console.log(">> Deploying root community garden");
        (address rootGarden, uint256 rootGardenTokenId) = _deploySeedGardens(
            result.gardenToken, result.deploymentRegistry, _getCurrentConfig().communityToken, result.gardenAccountImpl
        );

        // Store in result for JSON export
        result.rootGardenAddress = rootGarden;
        result.rootGardenTokenId = rootGardenTokenId;

        // 7. Deploy seed actions if not skipped
        if (!flags.skipSeedData) {
            console.log(">> Uploading and deploying seed actions");
            string[] memory actionIPFSHashes = _uploadActionsToIPFS();
            _deploySeedActions(result.actionRegistry, actionIPFSHashes);
        } else {
            console.log(">> Skipping seed actions (SKIP_SEED_DATA=true)");
        }
        vm.stopBroadcast();


        // Print summary and save deployment
        _printDeploymentSummary(result);
        _saveDeployment(result);

        if (!flags.skipVerification) {
            _generateVerificationCommands(result);
        } else {
            console.log(">> Skipping verification command generation (SKIP_VERIFICATION=true)");
        }
    }

    /// @notice Get current deployment configuration (helper for cleaner code)
    function _getCurrentConfig() internal view returns (NetworkConfig memory) {
        return loadNetworkConfig();
    }

    /// @notice Get current deployer address (helper for cleaner code)
    function _getCurrentDeployer() internal view returns (address) {
        return msg.sender;
    }

    /// @notice Get current multisig address (helper for cleaner code)
    function _getCurrentMultisig() internal view returns (address) {
        return _getCurrentConfig().multisig;
    }

    function deployDeploymentRegistry(address owner) public returns (address) {
        // Deploy implementation
        DeploymentRegistry implementation = new DeploymentRegistry();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(DeploymentRegistry.initialize.selector, owner);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        console.log("DeploymentRegistry deployed at:", address(proxy));
        return address(proxy);
    }

    function deployDeploymentRegistryWithGovernance(
        address initialOwner,
        address deployer,
        DeploymentFlags memory flags
    )
        public
        returns (address)
    {
        // Deploy implementation
        DeploymentRegistry implementation = new DeploymentRegistry();

        // SIMPLIFIED: Always use deployer as initial owner for easier management
        // Multisig will be added to allowlist for co-management
        bytes memory initData = abi.encodeWithSelector(DeploymentRegistry.initialize.selector, deployer);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        console.log("[OK] DeploymentRegistry deployed at:", address(proxy));
        console.log("   Initial owner:", deployer);

        // Add deployer to allowlist for minting permissions during deployment
        try DeploymentRegistry(address(proxy)).addToAllowlist(deployer) {
            console.log("[OK] Added deployer to allowlist:", deployer);
        } catch {
            console.log("[WARN] Could not add deployer to allowlist");
        }

        // Add multisig to allowlist if it's different from deployer
        if (initialOwner != address(0) && initialOwner != deployer) {
            try DeploymentRegistry(address(proxy)).addToAllowlist(initialOwner) {
                console.log("[OK] Added multisig to allowlist:", initialOwner);
            } catch {
                console.log("[WARN] Could not add multisig to allowlist");
            }
        }

        return address(proxy);
    }

    function _configureDeploymentRegistry(
        address registry,
        NetworkConfig memory config,
        DeploymentResult memory result
    )
        internal
    {
        DeploymentRegistry reg = DeploymentRegistry(registry);

        // Set network configuration with all deployed addresses
        DeploymentRegistry.NetworkConfig memory netConfig = DeploymentRegistry.NetworkConfig({
            eas: config.eas,
            easSchemaRegistry: config.easSchemaRegistry,
            communityToken: config.communityToken,
            actionRegistry: result.actionRegistry,
            gardenToken: result.gardenToken,
            workResolver: result.workResolver,
            workApprovalResolver: result.workApprovalResolver
        });

        reg.setNetworkConfig(block.chainid, netConfig);

        console.log("DeploymentRegistry configured for chain:", block.chainid);
    }

    function _configureDeploymentRegistryWithGovernance(
        address registry,
        NetworkConfig memory config,
        DeploymentResult memory result,
        address deployer,
        address multisig,
        DeploymentFlags memory flags
    )
        internal
    {
        DeploymentRegistry reg = DeploymentRegistry(registry);

        // Set network configuration with governance-aware error handling
        DeploymentRegistry.NetworkConfig memory netConfig = DeploymentRegistry.NetworkConfig({
            eas: config.eas,
            easSchemaRegistry: config.easSchemaRegistry,
            communityToken: config.communityToken,
            actionRegistry: result.actionRegistry,
            gardenToken: result.gardenToken,
            workResolver: result.workResolver,
            workApprovalResolver: result.workApprovalResolver
        });

        try reg.setNetworkConfig(block.chainid, netConfig) {
            console.log("[OK] DeploymentRegistry configured for chain:", block.chainid);

            // Handle governance transfer if multisig is configured and deployer is current owner
            if (!flags.skipGovernanceTransfer && multisig != address(0) && reg.owner() == deployer && multisig != deployer)
            {
                _handleGovernanceTransfer(reg, deployer, multisig, flags);
            }
        } catch (bytes memory reason) {
            console.log("[WARN] Failed to configure DeploymentRegistry:");
            console.log("   Reason:", string(reason));
            console.log("   Current owner:", reg.owner());
            console.log("   Caller:", deployer);
            console.log("   Is in allowlist:", reg.isInAllowlist(deployer));

            if (reg.owner() != deployer && !reg.isInAllowlist(deployer)) {
                console.log("[INFO] To enable deployment configuration:");
                console.log("   1. Add deployer to allowlist: DeploymentRegistry.addToAllowlist(", deployer, ")");
                console.log("   2. Or transfer ownership back temporarily");
                console.log("   3. Or use SKIP_CONFIGURATION=true flag");
            }
        }
    }

    function deployGuardian(address greenGoodsSafe, bytes32 salt, address factory) public returns (address) {
        bytes memory bytecode = abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(greenGoodsSafe));
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!_isDeployed(predicted)) {
            AccountGuardian guardian = new AccountGuardian{ salt: salt }(greenGoodsSafe);
            if (address(guardian) != predicted) {
                revert GuardianDeploymentAddressMismatch();
            }
            console.log("Guardian deployed:", predicted);
        } else {
            console.log("Guardian already deployed:", predicted);
        }

        return predicted;
    }

    function deployGardenAccount(
        address entryPoint,
        address multicallForwarder,
        address tokenRegistry,
        address guardian,
        bytes32 salt,
        address factory
    )
        public
        returns (address)
    {
        bytes memory bytecode = abi.encodePacked(
            type(GardenAccount).creationCode, abi.encode(entryPoint, multicallForwarder, tokenRegistry, guardian)
        );
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!_isDeployed(predicted)) {
            GardenAccount account = new GardenAccount{ salt: salt }(entryPoint, multicallForwarder, tokenRegistry, guardian);
            if (address(account) != predicted) {
                revert GardenAccountDeploymentAddressMismatch();
            }
            console.log("GardenAccount impl deployed:", predicted);
        } else {
            console.log("GardenAccount impl already deployed:", predicted);
        }

        return predicted;
    }

    function deployAccountProxy(
        address guardian,
        address implementation,
        bytes32 salt,
        address factory
    )
        public
        returns (address)
    {
        bytes memory bytecode = abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, implementation));
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!_isDeployed(predicted)) {
            AccountProxy proxy = new AccountProxy{ salt: salt }(guardian, implementation);
            if (address(proxy) != predicted) {
                revert AccountProxyDeploymentAddressMismatch();
            }
            console.log("AccountProxy deployed:", predicted);
        } else {
            console.log("AccountProxy already deployed:", predicted);
        }

        return predicted;
    }

    function deployGardenToken(
        address implementation,
        address multisig,
        address deploymentRegistry,
        bytes32 salt,
        address factory
    )
        public
        returns (address)
    {
        // Deploy implementation (not deterministic)
        GardenToken gardenTokenImpl = new GardenToken(implementation);

        // SIMPLIFIED: Use deployer as owner, multisig added to allowlist via DeploymentRegistry
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, msg.sender, deploymentRegistry);

        // Calculate deterministic proxy address
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(gardenTokenImpl), initData));
        address predicted = Create2.computeAddress(salt, keccak256(proxyBytecode), factory);

        if (!_isDeployed(predicted)) {
            // Deploy proxy with initialization
            ERC1967Proxy proxy = new ERC1967Proxy{ salt: salt }(address(gardenTokenImpl), initData);

            if (address(proxy) != predicted) {
                revert GardenTokenDeploymentAddressMismatch();
            }
            console.log("GardenToken proxy deployed:", predicted);
            console.log("GardenToken implementation:", address(gardenTokenImpl));
            console.log("GardenToken owner: deployer (", msg.sender, ")");
        } else {
            console.log("GardenToken proxy already deployed:", predicted);
        }

        return predicted;
    }

    function deployActionRegistry(address multisig, bytes32 salt, address factory) public returns (address) {
        // Deploy implementation (not deterministic)
        ActionRegistry actionRegistryImpl = new ActionRegistry();

        // SIMPLIFIED: Use deployer as owner
        bytes memory initData = abi.encodeWithSelector(ActionRegistry.initialize.selector, msg.sender);

        // Calculate deterministic proxy address
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(actionRegistryImpl), initData));
        address predicted = Create2.computeAddress(salt, keccak256(proxyBytecode), factory);

        if (!_isDeployed(predicted)) {
            // Deploy proxy with initialization
            ERC1967Proxy proxy = new ERC1967Proxy{ salt: salt }(address(actionRegistryImpl), initData);

            if (address(proxy) != predicted) {
                revert ActionRegistryDeploymentAddressMismatch();
            }
            console.log("ActionRegistry proxy deployed:", predicted);
            console.log("ActionRegistry implementation:", address(actionRegistryImpl));
            console.log("ActionRegistry owner: deployer (", msg.sender, ")");
        } else {
            console.log("ActionRegistry proxy already deployed:", predicted);
        }

        return predicted;
    }

    function _deployWorkResolver(
        address eas,
        address actionRegistry,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        // Deploy implementation (address can vary across chains)
        WorkResolver implementation = new WorkResolver(eas, actionRegistry);

        // Deploy stub implementation deterministically (same address across chains)
        bytes32 stubSalt = keccak256(abi.encodePacked(salt, "ResolverStub"));
        ResolverStub stub = new ResolverStub{ salt: stubSalt }();

        // Calculate deterministic proxy address using ResolverStub as placeholder implementation
        bytes32 resolverSalt = keccak256(abi.encodePacked(salt, "WorkResolverProxy"));

        bytes memory baseProxyBytecode = type(ERC1967Proxy).creationCode;
        // Initialize stub with deployer as temporary owner for upgrade permissions
        bytes memory stubInitData = abi.encodeWithSelector(ResolverStub.initialize.selector, msg.sender);
        bytes memory proxyConstructorArgs = abi.encode(address(stub), stubInitData);
        bytes memory fullProxyBytecode = abi.encodePacked(baseProxyBytecode, proxyConstructorArgs);

        address predicted = Create2.computeAddress(resolverSalt, keccak256(fullProxyBytecode), factory);

        if (!_isDeployed(predicted)) {
            // Deploy proxy with stub implementation
            ERC1967Proxy proxy = new ERC1967Proxy{ salt: resolverSalt }(address(stub), stubInitData);
            if (address(proxy) != predicted) {
                revert WorkResolverDeploymentAddressMismatch();
            }

            // Upgrade to real implementation
            UUPSUpgradeable(address(proxy)).upgradeTo(address(implementation));

            // NOTE: Ownership transfer skipped - can be done post-deployment by multisig
            // The resolver proxy is functional for schema deployment

            console.log("WorkResolver proxy deployed:", predicted);
            console.log("WorkResolver implementation:", address(implementation));
            console.log("WorkResolver stub:", address(stub));
        } else {
            console.log("WorkResolver proxy already deployed:", predicted);
        }

        return predicted;
    }

    function _deployWorkApprovalResolver(
        address eas,
        address actionRegistry,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        // Deploy implementation (address can vary across chains)
        WorkApprovalResolver implementation = new WorkApprovalResolver(eas, actionRegistry);

        // Use the same deterministic stub implementation
        bytes32 stubSalt = keccak256(abi.encodePacked(salt, "ResolverStub"));
        address stubAddress = Create2.computeAddress(stubSalt, keccak256(type(ResolverStub).creationCode), factory);

        // Deploy stub if not already deployed
        if (!_isDeployed(stubAddress)) {
            new ResolverStub{ salt: stubSalt }();
        }

        // Calculate deterministic proxy address using ResolverStub as placeholder implementation
        bytes32 approvalResolverSalt = keccak256(abi.encodePacked(salt, "WorkApprovalResolverProxy"));

        bytes memory baseProxyBytecode = type(ERC1967Proxy).creationCode;
        // Initialize stub with deployer as temporary owner for upgrade permissions
        bytes memory stubInitData = abi.encodeWithSelector(ResolverStub.initialize.selector, msg.sender);
        bytes memory proxyConstructorArgs = abi.encode(stubAddress, stubInitData);
        bytes memory fullProxyBytecode = abi.encodePacked(baseProxyBytecode, proxyConstructorArgs);

        address predicted = Create2.computeAddress(approvalResolverSalt, keccak256(fullProxyBytecode), factory);

        if (!_isDeployed(predicted)) {
            // Deploy proxy with stub implementation
            ERC1967Proxy proxy = new ERC1967Proxy{ salt: approvalResolverSalt }(stubAddress, stubInitData);
            if (address(proxy) != predicted) {
                revert WorkApprovalResolverDeploymentAddressMismatch();
            }

            // Upgrade to real implementation
            UUPSUpgradeable(address(proxy)).upgradeTo(address(implementation));

            // NOTE: Ownership transfer skipped - can be done post-deployment by multisig
            // The resolver proxy is functional for schema deployment

            console.log("WorkApprovalResolver proxy deployed:", predicted);
            console.log("WorkApprovalResolver implementation:", address(implementation));
            console.log("WorkApprovalResolver stub:", stubAddress);
        } else {
            console.log("WorkApprovalResolver proxy already deployed:", predicted);
        }

        return predicted;
    }

    function _deployAssessmentResolver(address eas, bytes32 salt, address factory) internal returns (address) {
        // Deploy implementation (address can vary across chains)
        AssessmentResolver implementation = new AssessmentResolver(eas);

        // Use the same deterministic stub implementation
        bytes32 stubSalt = keccak256(abi.encodePacked(salt, "ResolverStub"));
        address stubAddress = Create2.computeAddress(stubSalt, keccak256(type(ResolverStub).creationCode), factory);

        // Deploy stub if not already deployed
        if (!_isDeployed(stubAddress)) {
            new ResolverStub{ salt: stubSalt }();
        }

        // Calculate deterministic proxy address using ResolverStub as placeholder implementation
        bytes32 assessmentResolverSalt = keccak256(abi.encodePacked(salt, "AssessmentResolverProxy"));

        bytes memory baseProxyBytecode = type(ERC1967Proxy).creationCode;
        // Initialize stub with deployer as temporary owner for upgrade permissions
        bytes memory stubInitData = abi.encodeWithSelector(ResolverStub.initialize.selector, msg.sender);
        bytes memory proxyConstructorArgs = abi.encode(stubAddress, stubInitData);
        bytes memory fullProxyBytecode = abi.encodePacked(baseProxyBytecode, proxyConstructorArgs);

        address predicted = Create2.computeAddress(assessmentResolverSalt, keccak256(fullProxyBytecode), factory);

        if (!_isDeployed(predicted)) {
            // Deploy proxy with stub implementation
            ERC1967Proxy proxy = new ERC1967Proxy{ salt: assessmentResolverSalt }(stubAddress, stubInitData);

            // Upgrade to real implementation
            UUPSUpgradeable(address(proxy)).upgradeTo(address(implementation));

            // NOTE: Ownership transfer skipped - can be done post-deployment by multisig
            // The resolver proxy is functional for schema deployment

            console.log("AssessmentResolver proxy deployed:", predicted);
            console.log("AssessmentResolver implementation:", address(implementation));
            console.log("AssessmentResolver stub:", stubAddress);
        } else {
            console.log("AssessmentResolver proxy already deployed:", predicted);
        }

        return predicted;
    }

    function _deployEASSchemas(
        address schemaRegistry,
        address assessmentResolver,
        address workResolver,
        address workApprovalResolver
    )
        internal
        returns (bytes32 assessmentUID, bytes32 workUID, bytes32 workApprovalUID)
    {
        console.log("\n=== Deploying EAS Schemas ===");

        // Load network config to get EAS address
        NetworkConfig memory config = loadNetworkConfig();

        // Validation with detailed error messages
        if (schemaRegistry == address(0)) {
            console.log("ERROR: Schema registry address is zero for chain", block.chainid);
            console.log("Please check your networks.json configuration");
            revert SchemaRegistryAddressZero();
        }

        if (config.eas == address(0)) {
            console.log("ERROR: EAS contract address is zero for chain", block.chainid);
            console.log("Please check your networks.json configuration");
            revert EASAddressZero();
        }

        if (workResolver == address(0)) {
            console.log("ERROR: Work resolver address is zero");
            console.log("This indicates a failure in resolver deployment");
            revert WorkResolverAddressZero();
        }

        if (workApprovalResolver == address(0)) {
            console.log("ERROR: Work approval resolver address is zero");
            console.log("This indicates a failure in work approval resolver deployment");
            revert WorkApprovalResolverAddressZero();
        }

        // Load existing deployment and schema config
        (bytes32 existingAssessmentUID, bytes32 existingWorkUID, bytes32 existingWorkApprovalUID) = _loadExistingSchemas();

        string memory schemaJson;
        try vm.readFile(string.concat(vm.projectRoot(), "/config/schemas.json")) returns (string memory schemaConfig) {
            schemaJson = schemaConfig;
        } catch {
            console.log("ERROR: Failed to load schemas.json configuration file");
            console.log("Please ensure config/schemas.json exists and is readable");
            revert SchemaDeploymentFailed("ALL", "Configuration file not found");
        }

        ISchemaRegistry registry = ISchemaRegistry(schemaRegistry);
        IEAS eas = IEAS(config.eas);

        // Deploy schemas
        assessmentUID = _deploySchema(registry, schemaJson, existingAssessmentUID, "assessment", assessmentResolver);
        workUID = _deploySchema(registry, schemaJson, existingWorkUID, "work", workResolver);
        workApprovalUID = _deploySchema(registry, schemaJson, existingWorkApprovalUID, "workApproval", workApprovalResolver);

        // Create name and description attestations for all chains
        _createSchemaNameAndDescriptionAttestations(eas, schemaJson, assessmentUID, workUID, workApprovalUID);

        console.log("EAS Schemas deployed successfully:");
        console.log("Assessment UID:", vm.toString(assessmentUID));
        console.log("Work UID:", vm.toString(workUID));
        console.log("Work Approval UID:", vm.toString(workApprovalUID));
        console.log("=================================================\n");
    }

    function _deployEASSchemasWithFlags(
        address schemaRegistry,
        address assessmentResolver,
        address workResolver,
        address workApprovalResolver,
        DeploymentFlags memory flags
    )
        internal
        returns (bytes32 assessmentUID, bytes32 workUID, bytes32 workApprovalUID)
    {
        console.log("\n=== Deploying EAS Schemas ===");

        // Load network config to get EAS address
        NetworkConfig memory config = loadNetworkConfig();

        // Validation with detailed error messages
        if (schemaRegistry == address(0)) {
            console.log("ERROR: Schema registry address is zero for chain", block.chainid);
            console.log("Please check your networks.json configuration");
            revert SchemaRegistryAddressZero();
        }

        if (config.eas == address(0)) {
            console.log("ERROR: EAS contract address is zero for chain", block.chainid);
            console.log("Please check your networks.json configuration");
            revert EASAddressZero();
        }

        if (workResolver == address(0)) {
            console.log("ERROR: Work resolver address is zero");
            console.log("This indicates a failure in resolver deployment");
            revert WorkResolverAddressZero();
        }

        if (workApprovalResolver == address(0)) {
            console.log("ERROR: Work approval resolver address is zero");
            console.log("This indicates a failure in work approval resolver deployment");
            revert WorkApprovalResolverAddressZero();
        }

        // Load existing deployment and schema config
        (bytes32 existingAssessmentUID, bytes32 existingWorkUID, bytes32 existingWorkApprovalUID) = _loadExistingSchemas();

        string memory schemaJson;
        try vm.readFile(string.concat(vm.projectRoot(), "/config/schemas.json")) returns (string memory schemaConfig) {
            schemaJson = schemaConfig;
        } catch {
            console.log("ERROR: Failed to load schemas.json configuration file");
            console.log("Please ensure config/schemas.json exists and is readable");
            revert SchemaDeploymentFailed("ALL", "Configuration file not found");
        }

        ISchemaRegistry registry = ISchemaRegistry(schemaRegistry);
        IEAS eas = IEAS(config.eas);

        // Deploy schemas with force deployment flag
        assessmentUID =
            _deploySchemaWithFlags(registry, schemaJson, existingAssessmentUID, "assessment", assessmentResolver, flags);
        workUID = _deploySchemaWithFlags(registry, schemaJson, existingWorkUID, "work", workResolver, flags);
        workApprovalUID = _deploySchemaWithFlags(
            registry, schemaJson, existingWorkApprovalUID, "workApproval", workApprovalResolver, flags
        );

        // Create name and description attestations for all chains
        _createSchemaNameAndDescriptionAttestations(eas, schemaJson, assessmentUID, workUID, workApprovalUID);

        console.log("EAS Schemas deployed successfully:");
        console.log("Assessment UID:", vm.toString(assessmentUID));
        console.log("Work UID:", vm.toString(workUID));
        console.log("Work Approval UID:", vm.toString(workApprovalUID));
        console.log("=================================================\n");
    }

    function _deploySchema(
        ISchemaRegistry registry,
        string memory schemaJson,
        bytes32 existingUID,
        string memory schemaName,
        address resolver
    )
        internal
        returns (bytes32)
    {
        // Verify existing UID actually exists on-chain
        if (existingUID != bytes32(0)) {
            bool schemaExists = _verifySchemaExists(registry, existingUID, resolver);
            
            if (schemaExists) {
                console.log("Schema already exists:", schemaName, "UID:", vm.toString(existingUID));
                console.log("Schema validation passed for:", schemaName);
                return existingUID;
            } else {
                console.log("[WARN] Cached schema UID not found on-chain, deploying new schema:", schemaName);
            }
        }

        console.log("Deploying new schema:", schemaName);

        // Deploy schema with retry logic
        bytes32 uid = _deploySchemaAttemptWithRetry(registry, schemaJson, schemaName, resolver);
        console.log("Schema deployed successfully:", schemaName, "UID:", vm.toString(uid));
        return uid;
    }

    function _deploySchemaWithFlags(
        ISchemaRegistry registry,
        string memory schemaJson,
        bytes32 existingUID,
        string memory schemaName,
        address resolver,
        DeploymentFlags memory flags
    )
        internal
        returns (bytes32)
    {
        // Force schema deployment overrides existing check
        if (flags.forceSchemaDeployment) {
            console.log("[FORCE] Force deploying schema:", schemaName, "(FORCE_SCHEMA_DEPLOYMENT=true)");
            bytes32 forceUID = _deploySchemaAttemptWithRetry(registry, schemaJson, schemaName, resolver);
            console.log("[OK] Schema force deployed successfully:", schemaName, "UID:", vm.toString(forceUID));
            return forceUID;
        }

        // Verify existing UID actually exists on-chain
        if (existingUID != bytes32(0)) {
            bool schemaExists = _verifySchemaExists(registry, existingUID, resolver);
            
            if (schemaExists) {
                console.log(">> Schema already exists:", schemaName, "UID:", vm.toString(existingUID));
                if (flags.verboseLogging) {
                    console.log("   Use FORCE_SCHEMA_DEPLOYMENT=true to redeploy");
                }
                return existingUID;
            } else {
                console.log("[WARN] Cached schema UID not found on-chain, deploying new schema:", schemaName);
            }
        }

        console.log("Deploying new schema:", schemaName);

        // Deploy schema with better error handling
        bytes32 uid = _deploySchemaAttemptWithRetry(registry, schemaJson, schemaName, resolver);
        console.log("[OK] Schema deployed successfully:", schemaName, "UID:", vm.toString(uid));
        return uid;
    }

    function _deploySchemaAttempt(
        ISchemaRegistry registry,
        string memory schemaJson,
        string memory schemaName,
        address resolver
    )
        internal
        returns (bytes32)
    {
        string memory schemaString = _generateSchemaStringWithValidation(schemaName);
        bool revocable = _getSchemaRevocableFromArray(schemaJson, schemaName);

        bytes32 uid = registry.register(schemaString, resolver, revocable);

        // Schema deployed successfully - basic validation only
        console.log("Schema deployed with UID:", vm.toString(uid));

        return uid;
    }

    /// @notice Verify that a schema exists on-chain and has the expected resolver
    function _verifySchemaExists(
        ISchemaRegistry registry,
        bytes32 schemaUID,
        address expectedResolver
    )
        internal
        view
        returns (bool)
    {
        try registry.getSchema(schemaUID) returns (
            string memory schema,
            address resolver,
            bool /* revocable */
        ) {
            // Schema exists if it has non-empty schema string and correct resolver
            bool hasSchema = bytes(schema).length > 0;
            bool hasCorrectResolver = resolver == expectedResolver;
            
            if (hasSchema && !hasCorrectResolver) {
                console.log("[WARN] Schema exists but resolver mismatch:");
                console.log("   Expected:", expectedResolver);
                console.log("   Actual:", resolver);
            }
            
            return hasSchema && hasCorrectResolver;
        } catch {
            // Schema doesn't exist or call failed
            return false;
        }
    }

    /// @notice Deploy schema with retry logic and better error handling
    function _deploySchemaAttemptWithRetry(
        ISchemaRegistry registry,
        string memory schemaJson,
        string memory schemaName,
        address resolver
    )
        internal
        returns (bytes32)
    {
        string memory schemaString = _generateSchemaStringWithValidation(schemaName);
        bool revocable = _getSchemaRevocableFromArray(schemaJson, schemaName);

        console.log("   Schema string:", schemaString);
        console.log("   Resolver:", resolver);
        console.log("   Revocable:", revocable);

        try registry.register(schemaString, resolver, revocable) returns (bytes32 uid) {
            console.log("   Schema deployed with UID:", vm.toString(uid));
            
            // Verify the schema was actually created
            try registry.getSchema(uid) returns (string memory deployedSchema, address deployedResolver, bool) {
                if (bytes(deployedSchema).length == 0) {
                    revert SchemaDeploymentFailed(schemaName, "Schema registered but not found on-chain");
                }
                if (deployedResolver != resolver) {
                    revert SchemaDeploymentFailed(
                        schemaName, 
                        string.concat("Resolver mismatch - expected: ", vm.toString(resolver), " got: ", vm.toString(deployedResolver))
                    );
                }
            } catch {
                revert SchemaDeploymentFailed(schemaName, "Cannot verify deployed schema");
            }
            
            return uid;
        } catch Error(string memory reason) {
            console.log("[ERROR] Schema registration failed:", schemaName);
            console.log("   Reason:", reason);
            revert SchemaDeploymentFailed(schemaName, reason);
        } catch (bytes memory reason) {
            console.log("[ERROR] Schema registration failed:", schemaName);
            console.log("   Raw reason:", string(reason));
            revert SchemaDeploymentFailed(schemaName, "Registration call reverted");
        }
    }

    /// @notice Helper function to get schema revocable flag from flat array by ID
    function _getSchemaRevocableFromArray(string memory schemaJson, string memory schemaId) internal pure returns (bool) {
        // Parse the array and find the schema with matching ID
        for (uint256 i = 0; i < 100; i++) {
            string memory indexPath = string.concat("[", vm.toString(i), "]");

            try vm.parseJson(schemaJson, string.concat(indexPath, ".id")) returns (bytes memory idData) {
                string memory currentId = abi.decode(idData, (string));

                if (keccak256(abi.encodePacked(currentId)) == keccak256(abi.encodePacked(schemaId))) {
                    return abi.decode(vm.parseJson(schemaJson, string.concat(indexPath, ".revocable")), (bool));
                }
            } catch {
                // Index doesn't exist, continue
                break;
            }
        }

        revert(string.concat("Schema not found: ", schemaId));
    }

    function _generateSchemaStringWithValidation(string memory schemaName) internal returns (string memory) {
        string memory schemaString = _generateSchemaString(schemaName);
        if (bytes(schemaString).length == 0) {
            revert SchemaGenerationFailed(schemaName);
        }
        return schemaString;
    }

    function _generateSchemaString(string memory schemaName) internal override returns (string memory) {
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = "script/utils/generateSchemas.js";
        inputs[2] = schemaName;

        bytes memory result = vm.ffi(inputs);
        return string(result);
    }

    function _createSchemaNameAndDescriptionAttestations(
        IEAS eas,
        string memory schemaJson,
        bytes32 assessmentUID,
        bytes32 workUID,
        bytes32 workApprovalUID
    )
        internal
    {
        console.log("Creating schema name and description attestations...");

        if (assessmentUID != bytes32(0)) {
            string memory assessmentName = _getSchemaNameFromArray(schemaJson, "assessment");
            string memory assessmentDescription = _getSchemaDescriptionFromArray(schemaJson, "assessment");
            _createSchemaNameAttestation(eas, assessmentUID, assessmentName);
            _createSchemaDescriptionAttestation(eas, assessmentUID, assessmentDescription);
        }

        if (workUID != bytes32(0)) {
            string memory workName = _getSchemaNameFromArray(schemaJson, "work");
            string memory workDescription = _getSchemaDescriptionFromArray(schemaJson, "work");
            _createSchemaNameAttestation(eas, workUID, workName);
            _createSchemaDescriptionAttestation(eas, workUID, workDescription);
        }

        if (workApprovalUID != bytes32(0)) {
            string memory workApprovalName = _getSchemaNameFromArray(schemaJson, "workApproval");
            string memory workApprovalDescription = _getSchemaDescriptionFromArray(schemaJson, "workApproval");
            _createSchemaNameAttestation(eas, workApprovalUID, workApprovalName);
            _createSchemaDescriptionAttestation(eas, workApprovalUID, workApprovalDescription);
        }
    }

    /// @notice Helper function to get schema name from flat array by ID
    function _getSchemaNameFromArray(
        string memory schemaJson,
        string memory schemaId
    )
        internal
        pure
        returns (string memory)
    {
        // Parse the array and find the schema with matching ID
        for (uint256 i = 0; i < 100; i++) {
            string memory indexPath = string.concat("[", vm.toString(i), "]");

            try vm.parseJson(schemaJson, string.concat(indexPath, ".id")) returns (bytes memory idData) {
                string memory currentId = abi.decode(idData, (string));

                if (keccak256(abi.encodePacked(currentId)) == keccak256(abi.encodePacked(schemaId))) {
                    return abi.decode(vm.parseJson(schemaJson, string.concat(indexPath, ".name")), (string));
                }
            } catch {
                // Index doesn't exist, continue
                break;
            }
        }

        revert(string.concat("Schema not found: ", schemaId));
    }

    /// @notice Helper function to get schema description from flat array by ID
    function _getSchemaDescriptionFromArray(
        string memory schemaJson,
        string memory schemaId
    )
        internal
        pure
        returns (string memory)
    {
        // Parse the array and find the schema with matching ID
        for (uint256 i = 0; i < 100; i++) {
            string memory indexPath = string.concat("[", vm.toString(i), "]");

            try vm.parseJson(schemaJson, string.concat(indexPath, ".id")) returns (bytes memory idData) {
                string memory currentId = abi.decode(idData, (string));

                if (keccak256(abi.encodePacked(currentId)) == keccak256(abi.encodePacked(schemaId))) {
                    return abi.decode(vm.parseJson(schemaJson, string.concat(indexPath, ".description")), (string));
                }
            } catch {
                // Index doesn't exist, continue
                break;
            }
        }

        revert(string.concat("Schema description not found: ", schemaId));
    }

    function _createSchemaNameAttestation(IEAS eas, bytes32 schemaUID, string memory name) internal {
        bytes memory encodedData = abi.encode(schemaUID, name);

        IEAS.AttestationRequest memory request = IEAS.AttestationRequest({
            schema: SCHEMA_NAME_SCHEMA,
            data: IEAS.AttestationRequestData({
                recipient: address(0),
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: encodedData,
                value: 0
            })
        });

        try eas.attest(request) returns (bytes32 attestationUID) {
            console.log("Name attestation created successfully for:", name);
            console.log("Attestation UID:", vm.toString(attestationUID));
        } catch Error(string memory reason) {
            console.log("Failed to create name attestation for:", name);
            console.log("Reason:", reason);
        } catch {
            console.log("Failed to create name attestation for:", name, "(unknown error)");
        }
    }

    function _createSchemaDescriptionAttestation(IEAS eas, bytes32 schemaUID, string memory description) internal {
        bytes memory encodedData = abi.encode(schemaUID, description);

        IEAS.AttestationRequest memory request = IEAS.AttestationRequest({
            schema: SCHEMA_DESCRIPTION_SCHEMA,
            data: IEAS.AttestationRequestData({
                recipient: address(0),
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: encodedData,
                value: 0
            })
        });

        try eas.attest(request) returns (bytes32 attestationUID) {
            console.log("Description attestation created successfully for schema:", vm.toString(schemaUID));
            console.log("Attestation UID:", vm.toString(attestationUID));
        } catch Error(string memory reason) {
            console.log("Failed to create description attestation for schema:", vm.toString(schemaUID));
            console.log("Reason:", reason);
        } catch {
            console.log("Failed to create description attestation for schema:", vm.toString(schemaUID), "(unknown error)");
        }
    }

    /// @notice Simple delay counter to prevent compiler optimization
    uint256 private _delayCounter;

    function _computationalDelay(uint256 milliseconds) internal {
        // Reduced iterations to prevent excessive gas usage while maintaining observable side effect
        // Using a more reasonable 100 iterations per millisecond instead of 1000
        uint256 iterations = milliseconds * 100;

        for (uint256 i = 0; i < iterations; i++) {
            // Store result in state variable to prevent compiler optimization
            _delayCounter += i;
        }

        // Additional simple computation to ensure delay is not optimized away
        _delayCounter = _delayCounter % type(uint256).max;
    }

    function _loadExistingSchemas()
        private
        view
        returns (bytes32 assessmentUID, bytes32 workUID, bytes32 workApprovalUID)
    {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");

        try vm.readFile(deploymentPath) returns (string memory deploymentJson) {
            try vm.parseJson(deploymentJson, ".schemas.assessmentSchemaUID") returns (bytes memory data) {
                assessmentUID = abi.decode(data, (bytes32));
            } catch { }

            try vm.parseJson(deploymentJson, ".schemas.workSchemaUID") returns (bytes memory data) {
                workUID = abi.decode(data, (bytes32));
            } catch { }

            try vm.parseJson(deploymentJson, ".schemas.workApprovalSchemaUID") returns (bytes memory data) {
                workApprovalUID = abi.decode(data, (bytes32));
            } catch { }
        } catch {
            // No existing deployment
        }
    }

    function initializeSeedData(address actionRegistry) public {
        ActionRegistry registry = ActionRegistry(actionRegistry);

        // Initialize sample actions
        Capital[] memory capitals = new Capital[](3);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.CULTURAL;
        capitals[2] = Capital.SOCIAL;

        string[] memory observeMedia = new string[](3);
        observeMedia[0] = "QmVvKqpnfJm8UwRq9SF15V2jgJ86yCBsmMBmpEaoQU92bD";
        observeMedia[1] = "QmXeV9zWpXHzTGFS3jJRBRYBTHkcVE23qpdhhtQKX1uC4L";
        observeMedia[2] = "QmXp5fEnjHbsLniCE5BD1LyjoGgvoHKuajqQnDCPAZih2X";

        registry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Identify Plants",
            "QmX8rLExs7TDGPNAg9w22R8iYeRUYsrkkLg6LUUK8oNDUJ",
            capitals,
            observeMedia
        );

        console.log("Seed data initialized");
    }

    function _handleGovernanceTransfer(
        DeploymentRegistry reg,
        address, /* deployer */
        address multisig,
        DeploymentFlags memory flags
    )
        internal
    {
        console.log("\n[GOV] Initiating governance transfer...");

        // Add multisig to allowlist first (if not already)
        if (!reg.isInAllowlist(multisig)) {
            try reg.addToAllowlist(multisig) {
                console.log("[OK] Added multisig to allowlist:", multisig);
            } catch {
                console.log("[WARN] Could not add multisig to allowlist");
            }
        }

        // Load additional allowlist addresses from environment
        _addEnvironmentAllowlist(reg, flags);

        // Initiate governance transfer
        try reg.initiateGovernanceTransfer(multisig) {
            console.log("[OK] Governance transfer initiated to:", multisig);
            console.log("[INFO] Multisig must call acceptGovernanceTransfer() to complete");
            console.log("[INFO] Current owner can call cancelGovernanceTransfer() to cancel");
        } catch (bytes memory reason) {
            console.log("[WARN] Could not initiate governance transfer:");
            console.log("   Reason:", string(reason));
        }
    }

    function _addEnvironmentAllowlist(DeploymentRegistry reg, DeploymentFlags memory /* flags */ ) internal {
        // Check for comma-separated allowlist in environment variable
        try vm.envString("DEPLOYMENT_REGISTRY_ALLOWLIST") returns (string memory allowlistStr) {
            if (bytes(allowlistStr).length > 0) {
                console.log("[ALLOWLIST] Processing allowlist from environment...");

                // Note: This is a simplified parser - in production you'd want more robust CSV parsing
                // For now, assumes single address or you can call multiple times with different env vars
                address allowlistAddr = vm.parseAddress(allowlistStr);

                try reg.addToAllowlist(allowlistAddr) {
                    console.log("[OK] Added to allowlist from env:", allowlistAddr);
                } catch {
                    console.log("[WARN] Could not add address to allowlist:", allowlistAddr);
                }
            }
        } catch {
            // No allowlist configured in environment
        }

        // Check for individual allowlist addresses
        for (uint256 i = 0; i < 10; i++) {
            string memory envVar = string.concat("ALLOWLIST_ADDRESS_", vm.toString(i));
            try vm.envAddress(envVar) returns (address addr) {
                try reg.addToAllowlist(addr) {
                    console.log("[OK] Added to allowlist:", addr);
                } catch {
                    console.log("[WARN] Could not add address to allowlist:", addr);
                }
            } catch {
                // No more allowlist addresses
                break;
            }
        }
    }

    function _logDeploymentFlags(DeploymentFlags memory flags) internal view {
        console.log("\n=== Deployment Flags ===");
        console.log("Skip Existing Contracts:", flags.skipExistingContracts);
        console.log("Force Redeploy:", flags.forceRedeploy);
        console.log("Skip Schemas:", flags.skipSchemas);
        console.log("Force Schema Deployment:", flags.forceSchemaDeployment);
        console.log("Skip Verification:", flags.skipVerification);
        console.log("Skip Seed Data:", flags.skipSeedData);
        console.log("Skip Configuration:", flags.skipConfiguration);
        console.log("Skip Governance Transfer:", flags.skipGovernanceTransfer);
        console.log("Add Deployer to Allowlist:", flags.addDeployerToAllowlist);
        console.log("Verbose Logging:", flags.verboseLogging);
        console.log("Metadata Only:", flags.metadataOnly);
        console.log("========================\n");
    }

    function _deploySeedGardens(
        address gardenToken,
        address deploymentRegistry,
        address communityToken,
        address gardenAccountImpl
    )
        internal
        returns (address rootGardenAddress, uint256 rootGardenTokenId)
    {
        string memory configPath = string.concat(vm.projectRoot(), "/config/garden.json");

        string memory json = vm.readFile(configPath);
        string memory name = abi.decode(vm.parseJson(json, ".name"), (string));
        string memory description = abi.decode(vm.parseJson(json, ".description"), (string));
        string memory location = abi.decode(vm.parseJson(json, ".location"), (string));
        string memory bannerImage = abi.decode(vm.parseJson(json, ".bannerImage"), (string));
        address[] memory gardeners = abi.decode(vm.parseJson(json, ".gardeners"), (address[]));
        address[] memory operators = abi.decode(vm.parseJson(json, ".operators"), (address[]));

        // Mint root garden (will be tokenId 1)
        // Note: msg.sender (deployer) is already in the allowlist via deployDeploymentRegistryWithGovernance
        GardenToken(gardenToken).mintGarden(communityToken, name, description, location, bannerImage, gardeners, operators);

        // Calculate root garden address using TBALib
        rootGardenTokenId = 1;
        rootGardenAddress = TBALib.getAccount(gardenAccountImpl, gardenToken, rootGardenTokenId);

        console.log("Root garden deployed at:", rootGardenAddress);
        console.log("Root garden tokenId:", rootGardenTokenId);

        return (rootGardenAddress, rootGardenTokenId);
    }

    /// @notice Upload actions to IPFS via Pinata and return their hashes
    function _uploadActionsToIPFS() internal returns (string[] memory) {
        console.log(">> Uploading actions to IPFS...");
        
        string[] memory inputs = new string[](2);
        inputs[0] = "node";
        inputs[1] = "script/utils/ipfs-uploader.js";
        
        try vm.ffi(inputs) returns (bytes memory result) {
            string memory resultJson = string(result);
            
            // Parse JSON array of IPFS hashes
            string[] memory hashes = abi.decode(vm.parseJson(resultJson), (string[]));
            
            console.log("[OK] Uploaded", hashes.length, "actions to IPFS");
            for (uint256 i = 0; i < hashes.length; i++) {
                console.log("   Action", i + 1, ":", hashes[i]);
            }
            
            return hashes;
        } catch (bytes memory reason) {
            console.log("[ERROR] Failed to upload actions to IPFS:");
            console.log("   Reason:", string(reason));
            console.log("[INFO] Ensure PINATA_JWT environment variable is set");
            revert("Action IPFS upload failed");
        }
    }

    function _deploySeedActions(address actionRegistry, string[] memory ipfsHashes) internal {
        string memory configPath = string.concat(vm.projectRoot(), "/config/actions.json");

        try vm.readFile(configPath) returns (string memory json) {
            // Parse actions array
            uint256 actionCount = 0;
            for (uint256 i = 0; i < 50; i++) {
                string memory basePath = string.concat(".actions[", vm.toString(i), "]");

                try vm.parseJson(json, string.concat(basePath, ".title")) returns (bytes memory) {
                    // Verify we have an IPFS hash for this action
                    if (i >= ipfsHashes.length) {
                        console.log("[ERROR] Missing IPFS hash for action", i);
                        revert("Missing IPFS hash for action");
                    }

                    string memory title = abi.decode(vm.parseJson(json, string.concat(basePath, ".title")), (string));
                    
                    // Use IPFS hash from upload instead of reading from JSON
                    string memory instructions = ipfsHashes[i];
                    
                    // Parse timestamps
                    string memory startTimeStr = abi.decode(vm.parseJson(json, string.concat(basePath, ".startTime")), (string));
                    string memory endTimeStr = abi.decode(vm.parseJson(json, string.concat(basePath, ".endTime")), (string));
                    
                    // Convert ISO timestamps to Unix timestamps
                    uint256 startTime = _parseISOTimestamp(startTimeStr);
                    uint256 endTime = _parseISOTimestamp(endTimeStr);

                    // Parse capitals
                    string[] memory capitalStrings =
                        abi.decode(vm.parseJson(json, string.concat(basePath, ".capitals")), (string[]));
                    Capital[] memory capitals = new Capital[](capitalStrings.length);
                    for (uint256 j = 0; j < capitalStrings.length; j++) {
                        capitals[j] = _parseCapital(capitalStrings[j]);
                    }

                    // Parse media (empty for now, can be updated later)
                    string[] memory media = abi.decode(vm.parseJson(json, string.concat(basePath, ".media")), (string[]));

                    ActionRegistry(actionRegistry).registerAction(startTime, endTime, title, instructions, capitals, media);

                    console.log("[OK] Deployed action:", title);
                    console.log("   Instructions IPFS:", instructions);
                    actionCount++;
                } catch {
                    // No more actions
                    break;
                }
            }
            
            console.log("[OK] Deployed", actionCount, "actions");
        } catch {
            console.log("[ERROR] Failed to read actions.json");
            revert("Failed to deploy actions");
        }
    }

    /// @notice Parse ISO 8601 timestamp to Unix timestamp
    /// @dev Simplified parser for YYYY-MM-DDTHH:MM:SSZ format
    function _parseISOTimestamp(string memory isoTimestamp) internal pure returns (uint256) {
        // For simplicity, use fixed timestamps for now
        // TODO: Implement proper ISO 8601 parsing if needed
        // For 2024-01-01T00:00:00Z -> 1704067200
        // For 2025-12-31T23:59:59Z -> 1767225599
        
        bytes memory timestampBytes = bytes(isoTimestamp);
        
        // Check if it starts with "2024-01-01"
        if (timestampBytes.length >= 10 && timestampBytes[0] == "2" && timestampBytes[1] == "0" && timestampBytes[2] == "2" && timestampBytes[3] == "4") {
            return 1704067200; // 2024-01-01T00:00:00Z
        }
        
        // Check if it starts with "2025-12-31"  
        if (timestampBytes.length >= 10 && timestampBytes[0] == "2" && timestampBytes[1] == "0" && timestampBytes[2] == "2" && timestampBytes[3] == "5") {
            return 1767225599; // 2025-12-31T23:59:59Z
        }
        
        // Default to current timestamp
        return block.timestamp;
    }

    function _parseCapital(string memory capitalStr) internal pure returns (Capital) {
        return _parseCapitalFromString(capitalStr);
    }

    function _parseCapitalFromString(string memory capitalStr) internal pure returns (Capital) {
        bytes32 capitalHash = keccak256(bytes(capitalStr));

        // First check common capital types
        if (capitalHash == keccak256(bytes("SOCIAL"))) return Capital.SOCIAL;
        if (capitalHash == keccak256(bytes("LIVING"))) return Capital.LIVING;
        if (capitalHash == keccak256(bytes("CULTURAL"))) return Capital.CULTURAL;
        if (capitalHash == keccak256(bytes("MATERIAL"))) return Capital.MATERIAL;

        // Then check remaining capital types
        return _parseRemainingCapitalTypes(capitalHash);
    }

    /// @notice Helper function to parse remaining capital types
    function _parseRemainingCapitalTypes(bytes32 capitalHash) internal pure returns (Capital) {
        if (capitalHash == keccak256(bytes("FINANCIAL"))) return Capital.FINANCIAL;
        if (capitalHash == keccak256(bytes("INTELLECTUAL"))) return Capital.INTELLECTUAL;
        if (capitalHash == keccak256(bytes("EXPERIENTIAL"))) return Capital.EXPERIENTIAL;
        if (capitalHash == keccak256(bytes("SPIRITUAL"))) return Capital.SPIRITUAL;

        revert InvalidCapitalType();
    }
}
