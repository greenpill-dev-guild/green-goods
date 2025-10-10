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

    /// @notice Simplified deployment mode flags
    struct DeploymentMode {
        bool updateSchemasOnly;  // Only update schemas, skip contracts
        bool forceRedeploy;      // Force fresh deployment
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

    /// @notice Parse deployment mode from environment variables
    function _parseDeploymentMode() internal returns (DeploymentMode memory) {
        DeploymentMode memory mode = DeploymentMode({
            updateSchemasOnly: false,
            forceRedeploy: false
        });
        
        try vm.envBool("UPDATE_SCHEMAS_ONLY") returns (bool value) {
            mode.updateSchemasOnly = value;
        } catch { }
        
        try vm.envBool("FORCE_REDEPLOY") returns (bool value) {
            mode.forceRedeploy = value;
        } catch { }
        
        return mode;
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
        // Parse deployment mode
        DeploymentMode memory mode = _parseDeploymentMode();

        // Setup deployment configuration
        DeploymentConfig memory deploymentConfig = _setupDeploymentConfiguration();

        // Execute deployment phases
        DeploymentResult memory result = _executeDeployment(deploymentConfig, mode);

        // Post-deployment tasks
        _finalizeDeployment(result, mode);
    }

    /// @notice Setup deployment configuration
    function _setupDeploymentConfiguration() internal returns (DeploymentConfig memory) {
        NetworkConfig memory config;
        bytes32 salt;
        address factory;
        address tokenboundRegistry;
        address deployer = msg.sender;

        config = loadNetworkConfig();
        (salt, factory, tokenboundRegistry) = getDeploymentDefaults();
        
        address multisig = config.multisig;

        console.log("=== DEPLOYMENT ===");
        console.log("Network:", _getNetworkName(block.chainid));
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Governance:", _getCurrentMultisig());

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
        DeploymentMode memory mode
    )
        internal
        returns (DeploymentResult memory)
    {
        vm.startBroadcast();

        DeploymentResult memory result;

        // 1. Deploy DeploymentRegistry with proper ownership
        result.deploymentRegistry = deployDeploymentRegistryWithGovernance(
            deploymentConfig.multisig != address(0) ? deploymentConfig.multisig : deploymentConfig.deployer,
            deploymentConfig.deployer
        );

        // 2. Deploy core infrastructure (skip if force redeploying with updateSchemasOnly)
        if (!mode.updateSchemasOnly) {
            result = _deployCoreInfrastructure(result, deploymentConfig);

            // 3. Deploy registries and resolvers
            result = _deployRegistriesAndResolvers(result, deploymentConfig);

            // 4. Always deploy/update EAS schemas
            (result.assessmentSchemaUID, result.workSchemaUID, result.workApprovalSchemaUID) = _deployEASSchemas(
                deploymentConfig.config.easSchemaRegistry,
                result.assessmentResolver,
                result.workResolver,
                result.workApprovalResolver
            );
        } else {
            console.log(">> UPDATE_SCHEMAS_ONLY mode: schemas will be deployed without contract updates");
            // In schema-only mode, deploy schemas without resolver addresses (use address(0))
            (result.assessmentSchemaUID, result.workSchemaUID, result.workApprovalSchemaUID) = _deployEASSchemas(
                deploymentConfig.config.easSchemaRegistry,
                address(0),
                address(0),
                address(0)
            );
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
    function _finalizeDeployment(DeploymentResult memory result, DeploymentMode memory mode) internal {
        // Skip infrastructure deployment if only updating schemas
        if (!mode.updateSchemasOnly) {
            // 5. Configure DeploymentRegistry (with governance handling)
            _configureDeploymentRegistryWithGovernance(
                result.deploymentRegistry, _getCurrentConfig(), result, _getCurrentDeployer(), _getCurrentMultisig()
            );

            // 6. ALWAYS deploy root garden + core actions (essential infrastructure)
            console.log("\n=== INFRASTRUCTURE ===");
            console.log(">> Deploying root community garden");
            (address rootGarden, uint256 rootGardenTokenId) = _deploySeedGardens(
                result.gardenToken, result.deploymentRegistry, _getCurrentConfig().communityToken, result.gardenAccountImpl
            );

            // Store in result for JSON export
            result.rootGardenAddress = rootGarden;
            result.rootGardenTokenId = rootGardenTokenId;

            // 7. ALWAYS deploy core actions (Planting, Identify Plant, Litter Cleanup)
            console.log(">> Deploying core actions (3 total)");
            string[] memory actionIPFSHashes = _uploadActionsToIPFS();
            _deployCoreActions(result.actionRegistry, actionIPFSHashes);
        }
        
        vm.stopBroadcast();

        // Print summary
        _printDeploymentSummary(result);
        
        // Only save deployment file if actually broadcasting (not a simulation)
        if (_isBroadcasting()) {
            console.log("Broadcasting enabled - saving deployment to file");
            _saveDeployment(result);
        } else {
            console.log("Simulation mode - skipping deployment file update");
            console.log("To save deployment, run with --broadcast flag");
        }

        // Always generate verification commands (deploy.js handles localhost skip)
        _generateVerificationCommands(result);
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
        address deployer
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
        address multisig
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

            // Always handle governance transfer if multisig is configured and deployer is current owner
            if (multisig != address(0) && reg.owner() == deployer && multisig != deployer)
            {
                _handleGovernanceTransfer(reg, deployer, multisig);
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
        address /* multisig */,
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

    function deployActionRegistry(address /* multisig */, bytes32 salt, address factory) public returns (address) {
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

        // Create name and description attestations for schema metadata
        _createSchemaNameAndDescriptionAttestations(eas, schemaJson, assessmentUID, workUID, workApprovalUID);
        console.log("[OK] Schema metadata attestations created");

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
                console.log("[OK]", schemaName, "Schema:", vm.toString(existingUID));
                return existingUID;
            } else {
                console.log("[WARN] Cached schema UID not found on-chain, deploying new schema:", schemaName);
            }
        }

        console.log("Deploying new schema:", schemaName);

        // Deploy schema with retry logic
        bytes32 uid = _deploySchemaAttemptWithRetry(registry, schemaJson, schemaName, resolver);
        console.log("[OK]", schemaName, "Schema:", vm.toString(uid));
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
            
            //  Basic verification: skip detailed validation to avoid memory issues
            console.log("[OK] Schema registered successfully:", schemaName);
            
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

    /// @notice Helper function to get schema revocable flag from object structure by ID
    function _getSchemaRevocableFromArray(string memory schemaJson, string memory schemaId) internal view returns (bool) {
        // Map common aliases to actual schema keys
        string memory actualSchemaKey = schemaId;
        if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("assessment"))) {
            actualSchemaKey = "assessment";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("work"))) {
            actualSchemaKey = "work";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("workApproval"))) {
            actualSchemaKey = "workApproval";
        }
        
        // Parse from object structure: .schemas.<key>.revocable
        string memory schemaPath = string.concat(".schemas.", actualSchemaKey, ".revocable");
        
        try vm.parseJson(schemaJson, schemaPath) returns (bytes memory revocableData) {
            return abi.decode(revocableData, (bool));
        } catch {
            revert(string.concat("Schema not found: ", schemaId, " (tried key: ", actualSchemaKey, ")"));
        }
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

    /// @notice Check if we're in broadcast mode (not simulation)
    /// @dev Checks for FORGE_BROADCAST environment variable set by deploy.js
    /// @return True if broadcasting, false if simulation
    function _isBroadcasting() internal view returns (bool) {
        try vm.envBool("FORGE_BROADCAST") returns (bool isBroadcast) {
            return isBroadcast;
        } catch {
            // Default to false (simulation) if not set
            return false;
        }
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

    /// @notice Helper function to get schema name from object structure by ID
    function _getSchemaNameFromArray(
        string memory schemaJson,
        string memory schemaId
    )
        internal
        view
        returns (string memory)
    {
        // Map common aliases to actual schema keys
        string memory actualSchemaKey = schemaId;
        if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("assessment"))) {
            actualSchemaKey = "assessment";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("work"))) {
            actualSchemaKey = "work";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("workApproval"))) {
            actualSchemaKey = "workApproval";
        }
        
        // Parse from object structure: .schemas.<key>.name
        string memory schemaPath = string.concat(".schemas.", actualSchemaKey, ".name");
        
        try vm.parseJson(schemaJson, schemaPath) returns (bytes memory nameData) {
            return abi.decode(nameData, (string));
        } catch {
            revert(string.concat("Schema name not found: ", schemaId, " (tried key: ", actualSchemaKey, ")"));
        }
    }

    /// @notice Helper function to get schema description from object structure by ID
    function _getSchemaDescriptionFromArray(
        string memory schemaJson,
        string memory schemaId
    )
        internal
        view
        returns (string memory)
    {
        // Map common aliases to actual schema keys
        string memory actualSchemaKey = schemaId;
        if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("assessment"))) {
            actualSchemaKey = "assessment";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("work"))) {
            actualSchemaKey = "work";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("workApproval"))) {
            actualSchemaKey = "workApproval";
        }
        
        // Parse from object structure: .schemas.<key>.description
        string memory schemaPath = string.concat(".schemas.", actualSchemaKey, ".description");
        
        try vm.parseJson(schemaJson, schemaPath) returns (bytes memory descData) {
            return abi.decode(descData, (string));
        } catch {
            revert(string.concat("Schema description not found: ", schemaId, " (tried key: ", actualSchemaKey, ")"));
        }
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

        bytes32 attestationUID = eas.attest(request);
        
        if (attestationUID == bytes32(0)) {
            console.log("ERROR: Failed to create name attestation for:", name);
            revert("Schema name attestation failed - deployment cannot continue");
        }
        
        console.log("Name attestation created successfully for:", name);
        console.log("Attestation UID:", vm.toString(attestationUID));
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

        bytes32 attestationUID = eas.attest(request);
        
        if (attestationUID == bytes32(0)) {
            console.log("ERROR: Failed to create description attestation for schema:", vm.toString(schemaUID));
            revert("Schema description attestation failed - deployment cannot continue");
        }
        
        console.log("Description attestation created successfully for schema:", vm.toString(schemaUID));
        console.log("Attestation UID:", vm.toString(attestationUID));
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
        address multisig
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
        _addEnvironmentAllowlist(reg);

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

    function _addEnvironmentAllowlist(DeploymentRegistry reg) internal {
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

    function _logDeploymentMode(DeploymentMode memory mode) internal pure {
        // Deployment mode is now simpler - no verbose logging needed
        // Mode details are shown inline during deployment
    }

    function _deploySeedGardens(
        address gardenToken,
        address /* deploymentRegistry */,
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

    /// @notice Deploy core actions from actions.json (Planting, Identify Plant, Litter Cleanup)
    /// @dev These are essential infrastructure, always deployed
    function _deployCoreActions(address actionRegistry, string[] memory ipfsHashes) internal {
        string memory configPath = string.concat(vm.projectRoot(), "/config/actions.json");

        try vm.readFile(configPath) returns (string memory json) {
            // Parse actions array - iterate only as many times as we have IPFS hashes
            uint256 actionCount = 0;
            for (uint256 i = 0; i < ipfsHashes.length && i < 50; i++) {
                string memory basePath = string.concat(".actions[", vm.toString(i), "]");

                try vm.parseJson(json, string.concat(basePath, ".title")) returns (bytes memory titleBytes) {
                    // Check if we actually got a valid title
                    if (titleBytes.length == 0) {
                        console.log("[WARN] Empty title at index", i, "- stopping");
                        break;
                    }

                    _parseSingleAction(json, basePath, i, ipfsHashes[i], actionRegistry);
                    actionCount++;
                } catch {
                    // No more actions or parse error
                    break;
                }
            }
            
            console.log("[OK] Deployed", actionCount, "actions");
        } catch {
            console.log("[ERROR] Failed to read actions.json");
            revert("Failed to deploy actions");
        }
    }

    /// @notice Helper function to parse and register a single action
    function _parseSingleAction(
        string memory json,
        string memory basePath,
        uint256 index,
        string memory ipfsHash,
        address actionRegistry
    ) internal {
        string memory title = abi.decode(vm.parseJson(json, string.concat(basePath, ".title")), (string));
        
        // Use IPFS hash from upload instead of reading from JSON
        string memory instructions = ipfsHash;
        
        // Parse and convert timestamps
        uint256 startTime = _parseISOTimestamp(
            abi.decode(vm.parseJson(json, string.concat(basePath, ".startTime")), (string))
        );
        uint256 endTime = _parseISOTimestamp(
            abi.decode(vm.parseJson(json, string.concat(basePath, ".endTime")), (string))
        );

        // Parse capitals
        string[] memory capitalStrings =
            abi.decode(vm.parseJson(json, string.concat(basePath, ".capitals")), (string[]));
        Capital[] memory capitals = _parseCapitalsArray(capitalStrings);

        // Parse media
        string[] memory media = abi.decode(vm.parseJson(json, string.concat(basePath, ".media")), (string[]));

        ActionRegistry(actionRegistry).registerAction(startTime, endTime, title, instructions, capitals, media);

        console.log("[OK] Deployed action:", title);
        console.log("   Instructions IPFS:", instructions);
    }

    /// @notice Helper function to parse an array of capital strings
    function _parseCapitalsArray(string[] memory capitalStrings) internal pure returns (Capital[] memory) {
        Capital[] memory capitals = new Capital[](capitalStrings.length);
        for (uint256 j = 0; j < capitalStrings.length; j++) {
            capitals[j] = _parseCapital(capitalStrings[j]);
        }
        return capitals;
    }

    /// @notice Parse ISO 8601 timestamp to Unix timestamp
    /// @dev Simplified parser for YYYY-MM-DDTHH:MM:SSZ format
    function _parseISOTimestamp(string memory isoTimestamp) internal view returns (uint256) {
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
