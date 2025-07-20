// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { DeploymentHelper } from "./helpers/DeploymentHelper.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";

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
contract Deploy is Script, DeploymentHelper {
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
    bytes32 public constant SCHEMA_DESCRIPTION_SCHEMA =
        0x21cbc60aac46ba22125ff85dd01882ebe6e87eb4fc46628589931ccbef9b8c94;

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
        HOTFIX
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

    /// @notice Load deployment profile from environment variable
    function loadDeploymentProfile() internal view returns (DeploymentProfile) {
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
    function loadDeploymentFlags() internal view returns (DeploymentFlags memory flags) {
        DeploymentProfile profile = loadDeploymentProfile();

        // Load base flags from profile
        flags = _getFlagsForProfile(profile);

        // Override with specific environment variables if set
        _applyEnvironmentOverrides(flags);
    }

    /// @notice Get flags for a specific deployment profile
    function _getFlagsForProfile(DeploymentProfile profile) internal pure returns (DeploymentFlags memory) {
        if (profile == DeploymentProfile.METADATA_ONLY) {
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

        if (profile == DeploymentProfile.UPDATE) {
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

        if (profile == DeploymentProfile.CONTRACTS_ONLY) {
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

        if (profile == DeploymentProfile.SCHEMAS_ONLY) {
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

        if (profile == DeploymentProfile.TESTING) {
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

        if (profile == DeploymentProfile.PRODUCTION) {
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

        if (profile == DeploymentProfile.HOTFIX) {
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

        // Default FULL profile
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

    function run() external {
        // Load configuration and flags
        NetworkConfig memory config = loadNetworkConfig();
        DeploymentFlags memory flags = loadDeploymentFlags();
        (bytes32 salt, address factory, address tokenboundRegistry) = getDeploymentDefaults();

        // Get deployer and multisig addresses
        address deployer = msg.sender;
        address multisig = config.multisig;

        console.log("Deploying to chain:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Multisig:", multisig != address(0) ? vm.toString(multisig) : "Not configured");
        console.log("Salt:", vm.toString(salt));

        if (flags.verboseLogging) {
            _logDeploymentFlags(flags);
        }

        vm.startBroadcast();

        DeploymentResult memory result;

        // 1. Deploy DeploymentRegistry with proper ownership
        result.deploymentRegistry =
            deployDeploymentRegistryWithGovernance(multisig != address(0) ? multisig : deployer, deployer, flags);

        // 2. Deploy core infrastructure
        result.guardian = deployGuardian(config.greenGoodsSafe, salt, factory);
        result.gardenAccountImpl = deployGardenAccount(
            config.erc4337EntryPoint, config.multicallForwarder, tokenboundRegistry, result.guardian, salt, factory
        );
        result.accountProxy = deployAccountProxy(result.guardian, result.gardenAccountImpl, salt, factory);
        result.gardenToken = deployGardenToken(result.gardenAccountImpl, config.greenGoodsSafe, salt, factory);

        // 3. Deploy registries and resolvers
        result.actionRegistry = deployActionRegistry(config.greenGoodsSafe, salt, factory);
        result.workResolver =
            deployWorkResolver(config.eas, result.actionRegistry, config.greenGoodsSafe, salt, factory);
        result.workApprovalResolver =
            deployWorkApprovalResolver(config.eas, result.actionRegistry, config.greenGoodsSafe, salt, factory);

        // 4. Deploy EAS schemas (with skip flag)
        if (!flags.skipSchemas) {
            (result.gardenAssessmentSchemaUID, result.workSchemaUID, result.workApprovalSchemaUID) =
            deployEASSchemasWithFlags(config.easSchemaRegistry, result.workResolver, result.workApprovalResolver, flags);
        } else {
            console.log(">> Skipping schema deployment (SKIP_SCHEMAS=true)");
        }

        // 5. Configure DeploymentRegistry (with governance handling)
        if (!flags.skipConfiguration) {
            configureDeploymentRegistryWithGovernance(
                result.deploymentRegistry, config, result, deployer, multisig, flags
            );
        } else {
            console.log(">> Skipping deployment registry configuration (SKIP_CONFIGURATION=true)");
        }

        // 6. Initialize seed data (with enhanced flag logic)
        bool initSeedData = !flags.skipSeedData;
        if (!flags.skipSeedData) {
            try vm.envBool("INITIALIZE_SEED_DATA") returns (bool val) {
                initSeedData = val;
            } catch {
                // Check if it's a testnet or local deployment
                uint256 chainId = block.chainid;
                initSeedData = (chainId == 31_337 || chainId == 11_155_111 || chainId == 84_532);
            }
        }

        if (initSeedData) {
            console.log("Initializing seed data for testing...");
            deploySeedGardens(result.gardenToken, config.communityToken);
            deploySeedActions(result.actionRegistry);
        } else if (flags.skipSeedData) {
            console.log(">> Skipping seed data initialization (SKIP_SEED_DATA=true)");
        }

        vm.stopBroadcast();

        // Print summary and save deployment
        printDeploymentSummary(result);
        saveDeployment(result);

        if (!flags.skipVerification) {
            generateVerificationCommands(result);
        } else {
            console.log(">> Skipping verification command generation (SKIP_VERIFICATION=true)");
        }
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

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(DeploymentRegistry.initialize.selector, initialOwner);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        console.log("[OK] DeploymentRegistry deployed at:", address(proxy));
        console.log("   Initial owner:", initialOwner);

        // Add deployer to allowlist if requested and if owner is multisig
        if (flags.addDeployerToAllowlist && initialOwner != deployer) {
            try DeploymentRegistry(address(proxy)).addToAllowlist(deployer) {
                console.log("[OK] Added deployer to allowlist:", deployer);
            } catch {
                console.log("[WARN] Could not add deployer to allowlist (requires owner)");
            }
        }

        return address(proxy);
    }

    function configureDeploymentRegistry(
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

    function configureDeploymentRegistryWithGovernance(
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
            if (
                !flags.skipGovernanceTransfer && multisig != address(0) && reg.owner() == deployer
                    && multisig != deployer
            ) {
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

        if (!isDeployed(predicted)) {
            AccountGuardian guardian = new AccountGuardian{ salt: salt }(greenGoodsSafe);
            if (address(guardian) != predicted) {
                revert GuardianDeploymentAddressMismatch();
            }
            console.log("AccountGuardian deployed at:", predicted);
        } else {
            console.log("AccountGuardian already deployed at:", predicted);
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

        if (!isDeployed(predicted)) {
            GardenAccount account =
                new GardenAccount{ salt: salt }(entryPoint, multicallForwarder, tokenRegistry, guardian);
            if (address(account) != predicted) {
                revert GardenAccountDeploymentAddressMismatch();
            }
            console.log("GardenAccount deployed at:", predicted);
        } else {
            console.log("GardenAccount already deployed at:", predicted);
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

        if (!isDeployed(predicted)) {
            AccountProxy proxy = new AccountProxy{ salt: salt }(guardian, implementation);
            if (address(proxy) != predicted) {
                revert AccountProxyDeploymentAddressMismatch();
            }
            console.log("AccountProxy deployed at:", predicted);
        } else {
            console.log("AccountProxy already deployed at:", predicted);
        }

        return predicted;
    }

    function deployGardenToken(
        address implementation,
        address multisig,
        bytes32 salt,
        address factory
    )
        public
        returns (address)
    {
        bytes memory bytecode = abi.encodePacked(type(GardenToken).creationCode, abi.encode(implementation));

        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!isDeployed(predicted)) {
            GardenToken token = new GardenToken{ salt: salt }(implementation);
            token.initialize(multisig);
            if (address(token) != predicted) {
                revert GardenTokenDeploymentAddressMismatch();
            }
            console.log("GardenToken deployed at:", predicted);
        } else {
            console.log("GardenToken already deployed at:", predicted);
        }

        return predicted;
    }

    function deployActionRegistry(address multisig, bytes32 salt, address factory) public returns (address) {
        bytes memory bytecode = type(ActionRegistry).creationCode;

        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!isDeployed(predicted)) {
            ActionRegistry registry = new ActionRegistry{ salt: salt }();
            registry.initialize(multisig);
            if (address(registry) != predicted) {
                revert ActionRegistryDeploymentAddressMismatch();
            }
            console.log("ActionRegistry deployed at:", predicted);
        } else {
            console.log("ActionRegistry already deployed at:", predicted);
        }

        return predicted;
    }

    function deployWorkResolver(
        address eas,
        address actionRegistry,
        address multisig,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        bytes memory bytecode = abi.encodePacked(type(WorkResolver).creationCode, abi.encode(eas, actionRegistry));

        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!isDeployed(predicted)) {
            WorkResolver resolver = new WorkResolver{ salt: salt }(eas, actionRegistry);
            resolver.initialize(multisig);
            if (address(resolver) != predicted) {
                revert WorkResolverDeploymentAddressMismatch();
            }
            console.log("WorkResolver deployed at:", predicted);
        } else {
            console.log("WorkResolver already deployed at:", predicted);
        }

        return predicted;
    }

    function deployWorkApprovalResolver(
        address eas,
        address actionRegistry,
        address multisig,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        bytes memory bytecode =
            abi.encodePacked(type(WorkApprovalResolver).creationCode, abi.encode(eas, actionRegistry));

        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!isDeployed(predicted)) {
            WorkApprovalResolver resolver = new WorkApprovalResolver{ salt: salt }(eas, actionRegistry);
            resolver.initialize(multisig);
            if (address(resolver) != predicted) {
                revert WorkApprovalResolverDeploymentAddressMismatch();
            }
            console.log("WorkApprovalResolver deployed at:", predicted);
        } else {
            console.log("WorkApprovalResolver already deployed at:", predicted);
        }

        return predicted;
    }

    function deployEASSchemas(
        address schemaRegistry,
        address workResolver,
        address workApprovalResolver
    )
        internal
        returns (bytes32 gardenAssessmentUID, bytes32 workUID, bytes32 workApprovalUID)
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
        (bytes32 existingGardenUID, bytes32 existingWorkUID, bytes32 existingWorkApprovalUID) = _loadExistingSchemas();

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
        gardenAssessmentUID = _deploySchema(registry, schemaJson, existingGardenUID, "gardenAssessment", address(0));
        workUID = _deploySchema(registry, schemaJson, existingWorkUID, "work", workResolver);
        workApprovalUID =
            _deploySchema(registry, schemaJson, existingWorkApprovalUID, "workApproval", workApprovalResolver);

        // Create name and description attestations for all chains
        _createSchemaNameAndDescriptionAttestations(eas, schemaJson, gardenAssessmentUID, workUID, workApprovalUID);

        console.log("EAS Schemas deployed successfully:");
        console.log("Garden Assessment UID:", vm.toString(gardenAssessmentUID));
        console.log("Work UID:", vm.toString(workUID));
        console.log("Work Approval UID:", vm.toString(workApprovalUID));
        console.log("=================================================\n");
    }

    function deployEASSchemasWithFlags(
        address schemaRegistry,
        address workResolver,
        address workApprovalResolver,
        DeploymentFlags memory flags
    )
        internal
        returns (bytes32 gardenAssessmentUID, bytes32 workUID, bytes32 workApprovalUID)
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
        (bytes32 existingGardenUID, bytes32 existingWorkUID, bytes32 existingWorkApprovalUID) = _loadExistingSchemas();

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
        gardenAssessmentUID =
            _deploySchemaWithFlags(registry, schemaJson, existingGardenUID, "gardenAssessment", address(0), flags);
        workUID = _deploySchemaWithFlags(registry, schemaJson, existingWorkUID, "work", workResolver, flags);
        workApprovalUID = _deploySchemaWithFlags(
            registry, schemaJson, existingWorkApprovalUID, "workApproval", workApprovalResolver, flags
        );

        // Create name and description attestations for all chains
        _createSchemaNameAndDescriptionAttestations(eas, schemaJson, gardenAssessmentUID, workUID, workApprovalUID);

        console.log("EAS Schemas deployed successfully:");
        console.log("Garden Assessment UID:", vm.toString(gardenAssessmentUID));
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
        if (existingUID != bytes32(0)) {
            console.log("Schema already exists:", schemaName, "UID:", vm.toString(existingUID));
            console.log("Schema validation passed for:", schemaName);
            return existingUID;
        }

        console.log("Deploying new schema:", schemaName);

        // Deploy schema directly without retry
        bytes32 uid = _deploySchemaAttempt(registry, schemaJson, schemaName, resolver);
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
            bytes32 forceUID = _deploySchemaAttempt(registry, schemaJson, schemaName, resolver);
            console.log("[OK] Schema force deployed successfully:", schemaName, "UID:", vm.toString(forceUID));
            return forceUID;
        }

        if (existingUID != bytes32(0)) {
            console.log(">> Schema already exists:", schemaName, "UID:", vm.toString(existingUID));
            if (flags.verboseLogging) {
                console.log("   Use FORCE_SCHEMA_DEPLOYMENT=true to redeploy");
            }
            return existingUID;
        }

        console.log("Deploying new schema:", schemaName);

        // Deploy schema directly without retry
        bytes32 uid = _deploySchemaAttempt(registry, schemaJson, schemaName, resolver);
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

    /// @notice Helper function to get schema revocable flag from flat array by ID
    function _getSchemaRevocableFromArray(
        string memory schemaJson,
        string memory schemaId
    )
        internal
        pure
        returns (bool)
    {
        // Parse the array and find the schema with matching ID
        for (uint256 i = 0; i < 10; i++) {
            // Assume max 10 schemas
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
        bytes32 gardenAssessmentUID,
        bytes32 workUID,
        bytes32 workApprovalUID
    )
        internal
    {
        console.log("Creating schema name and description attestations...");

        if (gardenAssessmentUID != bytes32(0)) {
            string memory gardenName = _getSchemaNameFromArray(schemaJson, "gardenAssessment");
            string memory gardenDescription = _getSchemaDescriptionFromArray(schemaJson, "gardenAssessment");
            _createSchemaNameAttestation(eas, gardenAssessmentUID, gardenName);
            _createSchemaDescriptionAttestation(eas, gardenAssessmentUID, gardenDescription);
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
        for (uint256 i = 0; i < 10; i++) {
            // Assume max 10 schemas
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
        for (uint256 i = 0; i < 10; i++) {
            // Assume max 10 schemas
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
            console.log(
                "Failed to create description attestation for schema:", vm.toString(schemaUID), "(unknown error)"
            );
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
        returns (bytes32 gardenUID, bytes32 workUID, bytes32 workApprovalUID)
    {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");

        try vm.readFile(deploymentPath) returns (string memory deploymentJson) {
            try vm.parseJson(deploymentJson, ".schemas.gardenAssessmentSchemaUID") returns (bytes memory data) {
                gardenUID = abi.decode(data, (bytes32));
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

    function deploySeedGardens(address gardenToken, address communityToken) internal {
        string memory configPath = string.concat(vm.projectRoot(), "/config/garden.json");

        try vm.readFile(configPath) returns (string memory json) {
            string memory name = abi.decode(vm.parseJson(json, ".name"), (string));
            string memory description = abi.decode(vm.parseJson(json, ".description"), (string));
            string memory location = abi.decode(vm.parseJson(json, ".location"), (string));
            string memory bannerImage = abi.decode(vm.parseJson(json, ".bannerImage"), (string));
            address[] memory gardeners = abi.decode(vm.parseJson(json, ".gardeners"), (address[]));
            address[] memory operators = abi.decode(vm.parseJson(json, ".operators"), (address[]));

            GardenToken(gardenToken).mintGarden(
                communityToken, name, description, location, bannerImage, gardeners, operators
            );

            console.log("Seed garden deployed from config/garden.json");
        } catch {
            console.log("No garden.json found, skipping seed garden deployment");
        }
    }

    function deploySeedActions(address actionRegistry) internal {
        string memory configPath = string.concat(vm.projectRoot(), "/config/actions.json");

        try vm.readFile(configPath) returns (string memory json) {
            // Parse actions array
            uint256 actionsCount = 3; // Assume max 3 actions for simplicity

            for (uint256 i = 0; i < actionsCount; i++) {
                string memory basePath = string.concat(".actions[", vm.toString(i), "]");

                try vm.parseJson(json, string.concat(basePath, ".title")) returns (bytes memory) {
                    string memory title = abi.decode(vm.parseJson(json, string.concat(basePath, ".title")), (string));
                    string memory instructions =
                        abi.decode(vm.parseJson(json, string.concat(basePath, ".instructions")), (string));
                    uint256 startTime = block.timestamp;
                    uint256 endTime = block.timestamp + 365 days;

                    // Parse capitals
                    string[] memory capitalStrings =
                        abi.decode(vm.parseJson(json, string.concat(basePath, ".capitals")), (string[]));
                    Capital[] memory capitals = new Capital[](capitalStrings.length);
                    for (uint256 j = 0; j < capitalStrings.length; j++) {
                        capitals[j] = parseCapital(capitalStrings[j]);
                    }

                    // Parse media
                    string[] memory media =
                        abi.decode(vm.parseJson(json, string.concat(basePath, ".media")), (string[]));

                    ActionRegistry(actionRegistry).registerAction(
                        startTime, endTime, title, instructions, capitals, media
                    );

                    console.log("Deployed action:", title);
                } catch {
                    // No more actions
                    break;
                }
            }
        } catch {
            console.log("No actions.json found, using default sample action");
            initializeSeedData(actionRegistry);
        }
    }

    function parseCapital(string memory capitalStr) internal pure returns (Capital) {
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
