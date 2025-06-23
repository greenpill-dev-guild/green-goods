// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {EAS} from "../src/mocks/EAS.sol";
// For now, we'll use a simple mock for SchemaRegistry in local development
interface ISchemaRegistry {
    function register(string memory schema, address resolver, bool revocable) external returns (bytes32);
}
import {GardenToken} from "../src/tokens/Garden.sol";
import {ActionRegistry} from "../src/registries/Action.sol";
import {WorkResolver} from "../src/resolvers/Work.sol";
import {WorkApprovalResolver} from "../src/resolvers/WorkApproval.sol";

contract DeployLocalFull is Script {
    // EAS Schemas
    string constant GARDEN_ASSESSMENT_SCHEMA =
        "uint8 soilMoisturePercentage, uint256 carbonTonStock, uint256 carbonTonPotential, uint256 gardenSquareMeters, string biome, string remoteReportPDF, string speciesRegistryJSON, string[] polygonCoordinates, string[] treeGenusesObserved, string[] weedGenusesObserved, string[] issues, string[] tags";
    string constant WORK_SCHEMA = "uint256 actionUID, string title, string feedback, string metadata, string[] media";
    string constant WORK_APPROVAL_SCHEMA = "uint256 actionUID, bytes32 workUID, bool approved, string feedback";

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Starting Green Goods Local Deployment");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy EAS Infrastructure (if not forking)
        EAS eas;
        ISchemaRegistry schemaRegistry;
        
        address existingEAS = address(0);
        address existingSchemaRegistry = address(0);
        
        // Try to read from environment if available
        try vm.envAddress("EAS_ADDRESS") returns (address _eas) {
            existingEAS = _eas;
        } catch {}
        
        try vm.envAddress("SCHEMA_REGISTRY_ADDRESS") returns (address _registry) {
            existingSchemaRegistry = _registry;
        } catch {}
        
        if (existingEAS == address(0) || existingEAS.code.length == 0) {
            console.log("Deploying new EAS infrastructure...");
            // For local development, we'll use mock EAS
            eas = new EAS();
            console.log("EAS deployed at:", address(eas));
            console.log("Note: Using mock EAS for local development");
        } else {
            console.log("Using existing EAS infrastructure...");
            eas = EAS(existingEAS);
            schemaRegistry = ISchemaRegistry(existingSchemaRegistry);
            console.log("EAS at:", address(eas));
            console.log("SchemaRegistry at:", address(schemaRegistry));
        }
        
        // 2. Deploy Green Goods Contracts
        console.log("Deploying Green Goods contracts...");
        
        ActionRegistry actionRegistry = new ActionRegistry();
        console.log("ActionRegistry deployed at:", address(actionRegistry));
        
        WorkResolver workResolver = new WorkResolver(address(eas), address(actionRegistry));
        WorkApprovalResolver workApprovalResolver = new WorkApprovalResolver(address(eas), address(actionRegistry));
        console.log("WorkResolver deployed at:", address(workResolver));
        console.log("WorkApprovalResolver deployed at:", address(workApprovalResolver));
        
        // Deploy GardenToken (simplified for local testing)
        // For local testing, we'll use a dummy implementation address
        address gardenAccountImpl = address(0x1234567890123456789012345678901234567890);
        GardenToken gardenToken = new GardenToken(gardenAccountImpl);
        console.log("GardenToken deployed at:", address(gardenToken));
        
        // 3. Register EAS Schemas (skip for mock)
        console.log("Registering EAS schemas...");
        
        bytes32 gardenAssessmentUID = bytes32(uint256(1));
        bytes32 workUID = bytes32(uint256(2));
        bytes32 workApprovalUID = bytes32(uint256(3));
        
        console.log("Garden Assessment Schema UID:", vm.toString(gardenAssessmentUID));
        console.log("Work Schema UID:", vm.toString(workUID));
        console.log("Work Approval Schema UID:", vm.toString(workApprovalUID));
        
        vm.stopBroadcast();
        
        // 4. Generate configuration files
        console.log("Generating configuration files...");
        
        _generateContractAddresses(
            address(eas),
            address(schemaRegistry),
            address(actionRegistry), 
            address(gardenToken),
            address(workResolver),
            address(workApprovalResolver),
            gardenAssessmentUID,
            workUID,
            workApprovalUID
        );
        
        _generateIndexerConfig(
            address(actionRegistry),
            address(gardenToken),
            address(eas)
        );
        
        console.log("\nLocal deployment complete!");
        console.log("Generated configuration files:");
        console.log("   - packages/contracts/deployments/local.json");
        console.log("   - packages/indexer/config.local.yaml");
        console.log("\nContract addresses:");
        console.log("   EAS:", address(eas));
        console.log("   ActionRegistry:", address(actionRegistry));
        console.log("   GardenToken:", address(gardenToken));
        console.log("\nReady for development!");
        console.log("   Local RPC: http://localhost:8545");
        console.log("   Chain ID: 31337");
    }
    
    function _generateContractAddresses(
        address eas,
        address schemaRegistry,
        address actionRegistry,
        address gardenToken,
        address workResolver,
        address workApprovalResolver,
        bytes32 gardenAssessmentUID,
        bytes32 workUID,
        bytes32 workApprovalUID
    ) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": 31337,\n',
            '  "name": "Local Development",\n',
            '  "rpcUrl": "http://localhost:8545",\n',
            '  "contracts": {\n',
            '    "eas": "', vm.toString(eas), '",\n',
            '    "schemaRegistry": "', vm.toString(schemaRegistry), '",\n',
            '    "actionRegistry": "', vm.toString(actionRegistry), '",\n',
            '    "gardenToken": "', vm.toString(gardenToken), '",\n',
            '    "workResolver": "', vm.toString(workResolver), '",\n',
            '    "workApprovalResolver": "', vm.toString(workApprovalResolver), '"\n',
            '  },\n',
            '  "schemas": {\n',
            '    "gardenAssessment": {\n',
            '      "uid": "', vm.toString(gardenAssessmentUID), '",\n',
            '      "schema": "', GARDEN_ASSESSMENT_SCHEMA, '"\n',
            '    },\n',
            '    "work": {\n',
            '      "uid": "', vm.toString(workUID), '",\n',
            '      "schema": "', WORK_SCHEMA, '"\n',
            '    },\n',
            '    "workApproval": {\n',
            '      "uid": "', vm.toString(workApprovalUID), '",\n',
            '      "schema": "', WORK_APPROVAL_SCHEMA, '"\n',
            '    }\n',
            '  }\n',
            '}'
        );
        
        // Ensure deployments directory exists
        string[] memory mkdirInputs = new string[](3);
        mkdirInputs[0] = "mkdir";
        mkdirInputs[1] = "-p";
        mkdirInputs[2] = "deployments";
        vm.ffi(mkdirInputs);
        
        vm.writeFile("deployments/local.json", json);
    }
    
    function _generateIndexerConfig(
        address actionRegistry,
        address gardenToken,
        address eas
    ) internal {
        // Generate optimized indexer configuration based on Envio best practices
        string memory yaml = string.concat(
            "# yaml-language-server: $schema=./node_modules/envio/evm.schema.json\n",
            "name: Green Goods Local\n",
            "description: Green Goods Local Development Indexer\n",
            "version: 1.0.0\n\n",
            "# Performance optimizations\n",
            "options:\n",
            "  batchSize: 100\n",
            "  maxParallelism: 4\n",
            "  confirmations: 3\n",
            "  logLevel: debug\n\n"
        );
        
        yaml = string.concat(yaml,
            "# Contract configurations\n",
            "contracts:\n",
            "  - name: ActionRegistry\n",
            "    abi_file_path: abis/ActionRegistry.json\n",
            "    handler: src/EventHandlers.ts\n",
            "    events:\n",
            "      - event: ActionRegistered\n",
            "      - event: ActionStartTimeUpdated\n",
            "      - event: ActionEndTimeUpdated\n",
            "      - event: ActionTitleUpdated\n",
            "      - event: ActionInstructionsUpdated\n",
            "      - event: ActionMediaUpdated\n"
        );
        
        yaml = string.concat(yaml,
            "  - name: GardenToken\n",
            "    abi_file_path: abis/GardenToken.json\n",
            "    handler: src/EventHandlers.ts\n",
            "    events:\n",
            "      - event: GardenMinted\n",
            "  - name: GardenAccount\n",
            "    abi_file_path: abis/GardenAccount.json\n",
            "    handler: src/EventHandlers.ts\n",
            "    events:\n",
            "      - event: NameUpdated\n",
            "      - event: DescriptionUpdated\n",
            "      - event: GardenerAdded\n",
            "      - event: GardenerRemoved\n",
            "      - event: GardenOperatorAdded\n",
            "      - event: GardenOperatorRemoved\n"
        );
        
        yaml = string.concat(yaml,
            "  - name: EAS\n",
            "    abi_file_path: abis/EAS.json\n",
            "    handler: src/EASEventHandlers.ts\n",
            "    events:\n",
            "      - event: Attested\n",
            "      - event: Revoked\n\n",
            "# Network configuration\n",
            "networks:\n",
            "  - id: 31337\n",
            "    start_block: 0\n",
            "    rpc_config:\n",
            "      url: http://localhost:8545\n",
            "      retry:\n",
            "        maxAttempts: 3\n",
            "        delay: 1000\n",
            "      timeout: 30000\n"
        );
        
        yaml = string.concat(yaml,
            "    contracts:\n",
            "      - name: ActionRegistry\n",
            "        address: ", vm.toString(actionRegistry), "\n",
            "      - name: GardenToken\n",
            "        address: ", vm.toString(gardenToken), "\n", 
            "      - name: GardenAccount\n",
            "        address: ", vm.toString(gardenToken), "\n",
            "      - name: EAS\n",
            "        address: ", vm.toString(eas), "\n"
        );
        
        vm.writeFile("../../indexer/config.local.yaml", yaml);
        console.log("Indexer config generated with optimizations");
    }
} 