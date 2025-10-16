// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { DeploymentBase } from "../test/helpers/DeploymentBase.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";
import { Capital } from "../src/registries/Action.sol";
import { TBALib } from "../src/lib/TBA.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";

/// @title Deploy
/// @notice Production deployment script - orchestrates DeploymentBase + seed data
/// @dev Inherits FULL production deployment from DeploymentBase
contract Deploy is Script, DeploymentBase {
    // ===== ERRORS =====
    error ActionIPFSUploadFailed();
    error ActionDeploymentFailed();
    error InvalidCapitalType();

    // ===== STATE =====
    address[] private gardenAddresses;
    uint256[] private gardenTokenIds;
    address private guardian;
    address private accountProxy;

    /// @notice Deployment mode flags
    struct DeploymentMode {
        bool updateSchemasOnly;
        bool forceRedeploy;
    }

    /// @notice Main entry point - orchestrates production deployment
    function run() external {
        DeploymentMode memory mode = _parseDeploymentMode();
        NetworkConfig memory config = loadNetworkConfig();

        vm.startBroadcast();

        if (!mode.updateSchemasOnly) {
            // 1. Deploy FULL production stack (from DeploymentBase)
            // Deployer (msg.sender) is the owner for all contracts
            deployFullStack(config.communityToken, msg.sender);

            // 2. Add production-specific governance features
            _addProductionFeatures(config);

            // 3. Deploy seed data (gardens + actions)
            _deploySeedData(config);
        } else {
            // Schema-only update mode - load existing deployment
            string memory chainIdStr = vm.toString(block.chainid);
            string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
            string memory json = vm.readFile(deploymentPath);

            // Load existing resolver addresses
            workResolver = WorkResolver(payable(abi.decode(vm.parseJson(json, ".workResolver"), (address))));
            workApprovalResolver =
                WorkApprovalResolver(payable(abi.decode(vm.parseJson(json, ".workApprovalResolver"), (address))));
            assessmentResolver =
                AssessmentResolver(payable(abi.decode(vm.parseJson(json, ".assessmentResolver"), (address))));

            // Now register schemas with existing resolvers
            (address eas, address easSchemaRegistry) = _getEASForChain(block.chainid);
            _registerSchemas(eas, easSchemaRegistry);
        }

        vm.stopBroadcast();

        // 4. Post-deployment reporting
        _printDeploymentSummary();
        if (_isBroadcasting()) {
            // Only save full deployment results, not for schema-only updates
            if (!mode.updateSchemasOnly) {
                _saveDeploymentResults();
            } else {
                // Schema-only mode: Update only schema UIDs in existing file
                _updateSchemaUIDsOnly();
            }
        }
        _generateVerificationCommands();
    }

    // ============================================
    // DEPLOYMENT OVERRIDES
    // ============================================

    /// @notice Override to capture guardian and accountProxy addresses
    function _deployCoreContracts(
        address communityToken,
        address owner,
        address eas,
        address easSchemaRegistry,
        bytes32 salt,
        address factory,
        address tokenboundRegistry
    )
        internal
        override
    {
        // Call parent implementation
        super._deployCoreContracts(communityToken, owner, eas, easSchemaRegistry, salt, factory, tokenboundRegistry);

        // Capture guardian and accountProxy addresses using deterministic CREATE2
        bytes memory guardianBytecode = abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(owner));
        guardian = Create2.computeAddress(salt, keccak256(guardianBytecode), factory);

        bytes memory proxyBytecode =
            abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, address(gardenAccountImpl)));
        accountProxy = Create2.computeAddress(salt, keccak256(proxyBytecode), factory);
    }

    // ============================================
    // PRODUCTION-SPECIFIC FEATURES
    // ============================================

    /// @notice Add production-specific features (governance, allowlist, etc.)
    function _addProductionFeatures(NetworkConfig memory config) internal {
        // Add deployer to allowlist for minting during setup
        // solhint-disable-next-line no-empty-blocks
        try DeploymentRegistry(address(deploymentRegistry)).addToAllowlist(msg.sender) {
            // Success - deployer allowlisted
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Ignore failure - deployment continues
        }

        // Add multisig to allowlist if configured
        if (config.multisig != address(0) && config.multisig != msg.sender) {
            // solhint-disable-next-line no-empty-blocks
            try DeploymentRegistry(address(deploymentRegistry)).addToAllowlist(config.multisig) {
                // Success - multisig allowlisted
                // solhint-disable-next-line no-empty-blocks
            } catch {
                // Ignore failure - deployment continues
            }
            _initiateGovernanceTransfer(config.multisig);
        }
    }

    /// @notice Deploy seed data (gardens from config + core actions)
    function _deploySeedData(NetworkConfig memory config) internal {
        // 1. Mint gardens from config
        _deployGardens(config.communityToken);

        // 2. Deploy core actions
        string[] memory actionIPFSHashes = _uploadActionsToIPFS();
        _deployCoreActions(actionIPFSHashes);
    }

    /// @notice Deploy the root garden with hardcoded values (no JSON parsing)
    function _deployGardens(address communityToken) internal {
        string memory name = "Green Goods Community Garden";
        string memory description =
            "The global community garden for all Green Goods participants. This is the root garden that serves as the entry point for new users and community activities. All participants start here and can join specialized gardens as they engage with the platform.";
        string memory location = "Mama Earth";
        string memory bannerImage = "QmS8mL4x9fnNutV63pSfwRhhVgoVpw4gaDCCGaTpv6oMGW";

        address[] memory gardeners = new address[](5);
        gardeners[0] = 0xa9d20b435A85fAAa002f32d66F7D21564130E9cf;
        gardeners[1] = 0x6166E1964447E0959bC7c8d543DB3ab82dB65044;
        gardeners[2] = 0x476E2651BF97dE8a26e4A05a9c8e00A6EFa1390c;
        gardeners[3] = 0x23fBb98BBa894b2de086350bD60ef39860e92e43;
        gardeners[4] = 0x3f649DbFAFBE454940B8a82c5058b8d176dD3871;

        address[] memory operators = new address[](6);
        operators[0] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e;
        operators[1] = 0xAcD59e854adf632d2322404198624F757C868C97;
        operators[2] = 0xED47B5f719eA74405Eb96ff700C11D1685b953B1;
        operators[3] = 0x5c79d252F458b3720f7f230f8490fd1eE81d32FB;
        operators[4] = 0xbaD8bcc9Eb5749829cF12189fDD5c1230D6C85e8;
        operators[5] = 0x5F56E995e8D3bd05a70a63f0d7531437e873772e;

        gardenToken.mintGarden(communityToken, name, description, location, bannerImage, gardeners, operators);

        uint256 tokenId = 1;
        address gardenAddress = TBALib.getAccount(address(gardenAccountImpl), address(gardenToken), tokenId);

        gardenAddresses.push(gardenAddress);
        gardenTokenIds.push(tokenId);
    }

    /// @notice Upload actions to IPFS and return hashes
    function _uploadActionsToIPFS() internal returns (string[] memory) {
        string[] memory inputs = new string[](2);
        inputs[0] = "node";
        inputs[1] = "script/utils/ipfs-uploader.js";

        try vm.ffi(inputs) returns (bytes memory result) {
            // Check if result is empty or just whitespace
            if (result.length == 0) {
                return _getPlaceholderIPFSHashes();
            }

            string memory resultJson = string(result);

            // Try to parse as JSON
            try vm.parseJson(resultJson) returns (bytes memory parsed) {
                return abi.decode(parsed, (string[]));
            } catch {
                return _getPlaceholderIPFSHashes();
            }
        } catch {
            return _getPlaceholderIPFSHashes();
        }
    }

    /// @notice Get placeholder IPFS hashes for dry-runs
    function _getPlaceholderIPFSHashes() internal pure returns (string[] memory) {
        string[] memory hashes = new string[](3);
        hashes[0] = "Qmcw9vnuChG1X88zomB6Xrot5jCFRdbEsvscHzi2sJvto8";
        hashes[1] = "QmPHfYyqUC8T5aKwR4b3xsb1EjNiVgZ7uWti8voKCB7sGK";
        hashes[2] = "QmZxTqtJKBwRM1i2ACdH7YJyGjwcWzEfGVKW9DKUWkjNfo";
        return hashes;
    }

    /// @notice Deploy core actions from config
    function _deployCoreActions(string[] memory ipfsHashes) internal {
        string memory configPath = string.concat(vm.projectRoot(), "/config/actions.json");

        try vm.readFile(configPath) returns (string memory json) {
            for (uint256 i = 0; i < ipfsHashes.length && i < 50; i++) {
                string memory basePath = string.concat(".actions[", vm.toString(i), "]");

                try vm.parseJson(json, string.concat(basePath, ".title")) returns (bytes memory titleBytes) {
                    if (titleBytes.length == 0) break;

                    _registerSingleAction(json, basePath, ipfsHashes[i]);
                } catch {
                    break;
                }
            }
        } catch {
            revert ActionDeploymentFailed();
        }
    }

    /// @notice Register a single action
    function _registerSingleAction(string memory json, string memory basePath, string memory ipfsHash) internal {
        string memory title = abi.decode(vm.parseJson(json, string.concat(basePath, ".title")), (string));
        uint256 startTime =
            _parseISOTimestamp(abi.decode(vm.parseJson(json, string.concat(basePath, ".startTime")), (string)));
        uint256 endTime = _parseISOTimestamp(abi.decode(vm.parseJson(json, string.concat(basePath, ".endTime")), (string)));

        string[] memory capitalStrings = abi.decode(vm.parseJson(json, string.concat(basePath, ".capitals")), (string[]));
        Capital[] memory capitals = new Capital[](capitalStrings.length);
        for (uint256 j = 0; j < capitalStrings.length; j++) {
            capitals[j] = _parseCapital(capitalStrings[j]);
        }

        string[] memory media = abi.decode(vm.parseJson(json, string.concat(basePath, ".media")), (string[]));

        actionRegistry.registerAction(startTime, endTime, title, ipfsHash, capitals, media);
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /// @notice Parse deployment mode from environment
    function _parseDeploymentMode() internal view returns (DeploymentMode memory) {
        DeploymentMode memory mode;

        try vm.envBool("UPDATE_SCHEMAS_ONLY") returns (bool value) {
            mode.updateSchemasOnly = value;
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Env var not set - defaults to false
        }

        try vm.envBool("FORCE_REDEPLOY") returns (bool value) {
            mode.forceRedeploy = value;
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Env var not set - defaults to false
        }

        return mode;
    }

    /// @notice Check if broadcasting (not simulation)
    function _isBroadcasting() internal view returns (bool) {
        try vm.envBool("FORGE_BROADCAST") returns (bool isBroadcast) {
            return isBroadcast;
        } catch {
            return false;
        }
    }

    /// @notice Initiate governance transfer to multisig
    function _initiateGovernanceTransfer(address multisig) internal {
        if (!DeploymentRegistry(address(deploymentRegistry)).isInAllowlist(multisig)) {
            // solhint-disable-next-line no-empty-blocks
            try DeploymentRegistry(address(deploymentRegistry)).addToAllowlist(multisig) {
                // Success - multisig added to allowlist
                // solhint-disable-next-line no-empty-blocks
            } catch {
                // Ignore failure - governance transfer may still work
            }
        }

        // solhint-disable-next-line no-empty-blocks
        try DeploymentRegistry(address(deploymentRegistry)).initiateGovernanceTransfer(multisig) {
            // Success - governance transfer initiated
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Ignore failure - can be done manually post-deployment
        }
    }

    /// @notice Parse ISO timestamp (simplified)
    function _parseISOTimestamp(string memory isoTimestamp) internal view returns (uint256) {
        bytes memory timestampBytes = bytes(isoTimestamp);

        if (
            timestampBytes.length >= 10 && timestampBytes[0] == "2" && timestampBytes[1] == "0" && timestampBytes[2] == "2"
                && timestampBytes[3] == "4"
        ) {
            return 1_704_067_200; // 2024-01-01
        }

        if (
            timestampBytes.length >= 10 && timestampBytes[0] == "2" && timestampBytes[1] == "0" && timestampBytes[2] == "2"
                && timestampBytes[3] == "5"
        ) {
            return 1_767_225_599; // 2025-12-31
        }

        return block.timestamp;
    }

    /// @notice Parse capital type from string
    function _parseCapital(string memory capitalStr) internal pure returns (Capital) {
        bytes32 hash = keccak256(bytes(capitalStr));

        if (hash == keccak256(bytes("SOCIAL"))) return Capital.SOCIAL;
        if (hash == keccak256(bytes("LIVING"))) return Capital.LIVING;
        if (hash == keccak256(bytes("CULTURAL"))) return Capital.CULTURAL;
        if (hash == keccak256(bytes("MATERIAL"))) return Capital.MATERIAL;
        if (hash == keccak256(bytes("FINANCIAL"))) return Capital.FINANCIAL;
        if (hash == keccak256(bytes("INTELLECTUAL"))) return Capital.INTELLECTUAL;
        if (hash == keccak256(bytes("EXPERIENTIAL"))) return Capital.EXPERIENTIAL;
        if (hash == keccak256(bytes("SPIRITUAL"))) return Capital.SPIRITUAL;

        revert InvalidCapitalType();
    }

    // ============================================
    // REPORTING & VERIFICATION
    // ============================================

    /// @notice Print deployment summary
    // solhint-disable-next-line no-empty-blocks
    function _printDeploymentSummary() internal view {
        // TODO: Implement deployment summary logging
    }

    /// @notice Update only schema UIDs in existing deployment file (schema-only mode)
    function _updateSchemaUIDsOnly() internal {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");

        // Update only the schema UID fields within the schemas object
        vm.writeJson(vm.toString(workSchemaUID), deploymentPath, ".schemas.workSchemaUID");
        vm.writeJson(vm.toString(workApprovalSchemaUID), deploymentPath, ".schemas.workApprovalSchemaUID");
        vm.writeJson(vm.toString(assessmentSchemaUID), deploymentPath, ".schemas.assessmentSchemaUID");
    }

    /// @notice Load schema configuration from file
    function _loadSchemaConfig() internal view override returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/config/schemas.json"));
    }

    /// @notice Save deployment results to JSON
    function _saveDeploymentResults() internal {
        // Build comprehensive deployment result
        // Use first garden as "root" for backward compatibility
        address rootGardenAddress = gardenAddresses.length > 0 ? gardenAddresses[0] : address(0);
        uint256 rootGardenTokenId = gardenTokenIds.length > 0 ? gardenTokenIds[0] : 0;

        DeploymentResult memory result = DeploymentResult({
            deploymentRegistry: address(deploymentRegistry),
            guardian: guardian,
            gardenAccountImpl: address(gardenAccountImpl),
            accountProxy: accountProxy,
            gardenToken: address(gardenToken),
            actionRegistry: address(actionRegistry),
            assessmentResolver: address(assessmentResolver),
            workResolver: address(workResolver),
            workApprovalResolver: address(workApprovalResolver),
            assessmentSchemaUID: assessmentSchemaUID,
            workSchemaUID: workSchemaUID,
            workApprovalSchemaUID: workApprovalSchemaUID,
            rootGardenAddress: rootGardenAddress,
            rootGardenTokenId: rootGardenTokenId
        });

        // Use DeployHelper's comprehensive save method
        _saveDeployment(result);

        // Also save all garden addresses and token IDs to a separate file for reference
        if (gardenAddresses.length > 0) {
            string memory chainIdStr = vm.toString(block.chainid);
            string memory gardensPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-gardens.json");

            // Build JSON manually for array of gardens
            string memory gardensJson = "{\"gardens\":[";
            for (uint256 i = 0; i < gardenAddresses.length; i++) {
                if (i > 0) gardensJson = string.concat(gardensJson, ",");
                gardensJson = string.concat(
                    gardensJson,
                    "{\"tokenId\":",
                    vm.toString(gardenTokenIds[i]),
                    ",\"address\":\"",
                    vm.toString(gardenAddresses[i]),
                    "\"}"
                );
            }
            gardensJson = string.concat(gardensJson, "]}");

            vm.writeFile(gardensPath, gardensJson);
        }
    }

    /// @notice Generate verification commands
    // solhint-disable-next-line no-empty-blocks
    function _generateVerificationCommands() internal view {
        // TODO: Generate verification commands for deployment
    }
}
