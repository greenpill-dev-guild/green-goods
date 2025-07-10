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

/// @title Deploy
/// @notice Main deployment script for Green Goods contracts
contract Deploy is Script, DeploymentHelper {
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
        result.gardenToken = deployGardenToken(result.gardenAccountImpl, salt, factory);

        // 3. Deploy registries and resolvers
        result.actionRegistry = deployActionRegistry(salt, factory);
        result.workResolver = deployWorkResolver(config.eas, result.actionRegistry, salt, factory);
        result.workApprovalResolver = deployWorkApprovalResolver(config.eas, result.actionRegistry, salt, factory);

        // 4. Configure DeploymentRegistry with deployed addresses
        configureDeploymentRegistry(result.deploymentRegistry, config, result);

        // 5. Initialize sample data if requested
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

    function deployGardenToken(address implementation, bytes32 salt, address factory) public returns (address) {
        bytes memory bytecode = abi.encodePacked(type(GardenToken).creationCode, abi.encode(implementation));

        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!isDeployed(predicted)) {
            GardenToken token = new GardenToken{ salt: salt }(implementation);
            token.initialize();
            if (address(token) != predicted) {
                revert GardenTokenDeploymentAddressMismatch();
            }
            console.log("GardenToken deployed at:", predicted);
        } else {
            console.log("GardenToken already deployed at:", predicted);
        }

        return predicted;
    }

    function deployActionRegistry(bytes32 salt, address factory) public returns (address) {
        bytes memory bytecode = type(ActionRegistry).creationCode;

        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (!isDeployed(predicted)) {
            ActionRegistry registry = new ActionRegistry{ salt: salt }();
            registry.initialize();
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
            resolver.initialize();
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
            resolver.initialize();
            if (address(resolver) != predicted) {
                revert WorkApprovalResolverDeploymentAddressMismatch();
            }
            console.log("WorkApprovalResolver deployed at:", predicted);
        } else {
            console.log("WorkApprovalResolver already deployed at:", predicted);
        }

        return predicted;
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
