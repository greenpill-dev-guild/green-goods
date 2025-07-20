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

    /// @notice Schema deployment retry configuration
    struct RetryConfig {
        uint256 maxRetries;
        uint256 retryDelay;
        bool skipOnFailure;
    }

    /// @notice Standard EAS Schema UID for naming
    bytes32 public constant SCHEMA_NAME_SCHEMA = 0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc;

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

    function run() external {
        // Load configuration
        NetworkConfig memory config = loadNetworkConfig();
        (bytes32 salt, address factory, address tokenboundRegistry) = getDeploymentDefaults();

        // Get deployer
        address deployer;
        try vm.envAddress("MULTISIG_ADDRESS") returns (address addr) {
            deployer = addr;
        } catch {
            deployer = msg.sender;
        }

        console.log("Deploying to chain:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Salt:", vm.toString(salt));

        vm.startBroadcast();

        DeploymentResult memory result;

        // 1. Deploy DeploymentRegistry
        result.deploymentRegistry = deployDeploymentRegistry(deployer);

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

        // 4. Deploy EAS schemas with enhanced error recovery
        (result.gardenAssessmentSchemaUID, result.workSchemaUID, result.workApprovalSchemaUID) =
            deployEASSchemasWithRetry(config.easSchemaRegistry, result.workResolver, result.workApprovalResolver);

        // 5. Configure DeploymentRegistry with deployed addresses
        configureDeploymentRegistry(result.deploymentRegistry, config, result);

        // 6. Initialize sample data if requested
        bool initSampleData;
        try vm.envBool("INITIALIZE_SAMPLE_DATA") returns (bool val) {
            initSampleData = val;
        } catch {
            initSampleData = false;
        }

        if (initSampleData) {
            initializeSampleData(result.actionRegistry);
        }

        vm.stopBroadcast();

        // Print summary and save deployment
        printDeploymentSummary(result);
        saveDeployment(result);
        generateVerificationCommands(result);
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

    function deployEASSchemasWithRetry(
        address schemaRegistry,
        address workResolver,
        address workApprovalResolver
    )
        internal
        returns (bytes32 gardenAssessmentUID, bytes32 workUID, bytes32 workApprovalUID)
    {
        console.log("\n=== Deploying EAS Schemas with Enhanced Error Recovery ===");

        // Load retry configuration
        RetryConfig memory retryConfig = RetryConfig({
            maxRetries: 3,
            retryDelay: 1000, // 1 second delay between retries
            skipOnFailure: false
        });

        // Try to load custom retry config from environment
        try vm.envUint("SCHEMA_DEPLOYMENT_MAX_RETRIES") returns (uint256 maxRetries) {
            retryConfig.maxRetries = maxRetries;
        } catch { }

        try vm.envBool("SCHEMA_DEPLOYMENT_SKIP_ON_FAILURE") returns (bool skipOnFailure) {
            retryConfig.skipOnFailure = skipOnFailure;
        } catch { }

        // Load network config to get EAS address
        NetworkConfig memory config = loadNetworkConfig();

        // Enhanced validation with detailed error messages
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

        // Deploy schemas with retry logic
        gardenAssessmentUID =
            _deploySchemaWithRetry(registry, schemaJson, existingGardenUID, "gardenAssessment", address(0), retryConfig);

        workUID = _deploySchemaWithRetry(registry, schemaJson, existingWorkUID, "work", workResolver, retryConfig);

        workApprovalUID = _deploySchemaWithRetry(
            registry, schemaJson, existingWorkApprovalUID, "workApproval", workApprovalResolver, retryConfig
        );

        // Create name attestations for Celo with error recovery
        if (block.chainid == 42_220) {
            _createSchemaNameAttestationsWithRetry(
                eas, schemaJson, gardenAssessmentUID, workUID, workApprovalUID, retryConfig
            );
        }

        console.log("EAS Schemas deployed successfully:");
        console.log("Garden Assessment UID:", vm.toString(gardenAssessmentUID));
        console.log("Work UID:", vm.toString(workUID));
        console.log("Work Approval UID:", vm.toString(workApprovalUID));
        console.log("=================================================\n");
    }

    function _deploySchemaWithRetry(
        ISchemaRegistry registry,
        string memory schemaJson,
        bytes32 existingUID,
        string memory schemaName,
        address resolver,
        RetryConfig memory retryConfig
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

        // Retry loop for schema deployment
        for (uint256 attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try this._deploySchemaAttemptWrapper(registry, schemaJson, schemaName, resolver) returns (bytes32 uid) {
                console.log("Schema deployed successfully:", schemaName, "UID:", vm.toString(uid));
                return uid;
            } catch (bytes memory reason) {
                console.log("Schema deployment attempt", attempt + 1, "failed for:", schemaName);
                console.log("Error:", string(reason));

                if (attempt == retryConfig.maxRetries) {
                    console.log("Max retries reached for schema:", schemaName);

                    if (retryConfig.skipOnFailure) {
                        console.log("Skipping schema deployment due to configuration");
                        return bytes32(0);
                    } else {
                        revert SchemaDeploymentFailed(schemaName, string(reason));
                    }
                }

                // Wait before retry
                if (retryConfig.retryDelay > 0) {
                    console.log("Waiting", retryConfig.retryDelay, "ms before retry...");
                    // Note: vm.sleep is not available in Foundry, so we'll use a computational delay
                    _computationalDelay(retryConfig.retryDelay);
                }
            }
        }

        revert SchemaDeploymentFailed(schemaName, "Unexpected error in retry loop");
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
        bool revocable =
            abi.decode(vm.parseJson(schemaJson, string.concat(".schemas.", schemaName, ".revocable")), (bool));

        bytes32 uid = registry.register(schemaString, resolver, revocable);

        // Schema deployed successfully - basic validation only
        console.log("Schema deployed with UID:", vm.toString(uid));

        return uid;
    }

    function _deploySchemaAttemptWrapper(
        ISchemaRegistry registry,
        string memory schemaJson,
        string memory schemaName,
        address resolver
    )
        external
        returns (bytes32)
    {
        if (msg.sender != address(this)) revert OnlySelfCanCall();
        return _deploySchemaAttempt(registry, schemaJson, schemaName, resolver);
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

    function _createSchemaNameAttestationsWithRetry(
        IEAS eas,
        string memory schemaJson,
        bytes32 gardenAssessmentUID,
        bytes32 workUID,
        bytes32 workApprovalUID,
        RetryConfig memory retryConfig
    )
        internal
    {
        console.log("Creating schema name attestations with retry logic...");

        if (gardenAssessmentUID != bytes32(0)) {
            string memory gardenName = abi.decode(vm.parseJson(schemaJson, ".schemas.gardenAssessment.name"), (string));
            _createSchemaNameAttestationWithRetry(eas, gardenAssessmentUID, gardenName, retryConfig);
        }

        if (workUID != bytes32(0)) {
            string memory workName = abi.decode(vm.parseJson(schemaJson, ".schemas.work.name"), (string));
            _createSchemaNameAttestationWithRetry(eas, workUID, workName, retryConfig);
        }

        if (workApprovalUID != bytes32(0)) {
            string memory workApprovalName =
                abi.decode(vm.parseJson(schemaJson, ".schemas.workApproval.name"), (string));
            _createSchemaNameAttestationWithRetry(eas, workApprovalUID, workApprovalName, retryConfig);
        }
    }

    function _createSchemaNameAttestationWithRetry(
        IEAS eas,
        bytes32 schemaUID,
        string memory name,
        RetryConfig memory retryConfig
    )
        internal
    {
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

        for (uint256 attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try eas.attest(request) returns (bytes32 attestationUID) {
                console.log("Name attestation created successfully for:", name);
                console.log("Attestation UID:", vm.toString(attestationUID));
                return;
            } catch (bytes memory reason) {
                console.log("Name attestation attempt", attempt + 1, "failed for:", name);
                console.log("Error:", string(reason));

                if (attempt == retryConfig.maxRetries) {
                    console.log("Max retries reached for name attestation:", name);
                    if (!retryConfig.skipOnFailure) {
                        console.log("Continuing deployment despite attestation failure");
                    }
                    return;
                }

                if (retryConfig.retryDelay > 0) {
                    _computationalDelay(retryConfig.retryDelay);
                }
            }
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

    function initializeSampleData(address actionRegistry) public {
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

        console.log("Sample data initialized");
    }
}
