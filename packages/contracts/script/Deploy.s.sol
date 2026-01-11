// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";

import { DeploymentBase } from "../test/helpers/DeploymentBase.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { Capital } from "../src/registries/Action.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";

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

    /// @notice Deployment mode flags
    struct DeploymentMode {
        bool updateSchemasOnly;
        bool forceRedeploy;
    }

    /// @notice Main entry point - orchestrates production deployment
    function run() external {
        DeploymentMode memory mode = _parseDeploymentMode();
        NetworkConfig memory config = loadNetworkConfig();

        // Log chain-aware deployment strategy
        _logDeploymentStrategy();

        vm.startBroadcast();

        if (!mode.updateSchemasOnly) {
            // 1. Deploy stack based on chain (ENS infra for mainnet, protocol for L2)
            // Deployer (msg.sender) is the owner for all contracts
            deployFullStack(config.communityToken, msg.sender);

            // 2. Add production-specific governance features (L2 only)
            if (!_isMainnetChain(block.chainid)) {
                _addProductionFeatures(config);

                // 3. Deploy seed data (gardens + actions) (L2 only)
                _deploySeedData(config);
            }
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
        string memory gardensJson = _loadGardensConfig();
        _deployGardensFromConfig(gardensJson, config.communityToken);

        // 2. Deploy core actions
        string memory actionsJson = _loadActionsConfig();
        uint256 actionsCount = _getActionsCount(actionsJson);
        string[] memory actionIPFSHashes = _uploadActionsToIPFS(actionsCount);
        _deployCoreActions(actionsJson, actionIPFSHashes, actionsCount);
    }

    /// @notice Deploy gardens from config/gardens.json
    function _deployGardensFromConfig(string memory gardensJson, address communityToken) internal {
        for (uint256 i = 0; i < 50; i++) {
            string memory basePath = string.concat(".gardens[", vm.toString(i), "]");

            try vm.parseJson(gardensJson, string.concat(basePath, ".name")) returns (bytes memory nameBytes) {
                if (nameBytes.length == 0) break;

                string memory name = abi.decode(nameBytes, (string));
                string memory description =
                    abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".description")), (string));
                string memory location =
                    abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".location")), (string));
                string memory bannerImage =
                    abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".bannerImage")), (string));

                string memory metadata = "";
                try vm.parseJson(gardensJson, string.concat(basePath, ".metadata")) returns (bytes memory metadataBytes) {
                    metadata = abi.decode(metadataBytes, (string));
                } catch { }

                bool openJoining = false;
                try vm.parseJson(gardensJson, string.concat(basePath, ".openJoining")) returns (
                    bytes memory openJoiningBytes
                ) {
                    openJoining = abi.decode(openJoiningBytes, (bool));
                } catch { }

                address[] memory gardeners =
                    abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".gardeners")), (address[]));
                address[] memory operators =
                    abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".operators")), (address[]));

                GardenToken.GardenConfig memory gardenConfig = GardenToken.GardenConfig({
                    communityToken: communityToken,
                    name: name,
                    description: description,
                    location: location,
                    bannerImage: bannerImage,
                    metadata: metadata,
                    openJoining: openJoining,
                    gardeners: gardeners,
                    gardenOperators: operators
                });

                address gardenAddress = gardenToken.mintGarden(gardenConfig);
                gardenAddresses.push(gardenAddress);
                gardenTokenIds.push(i + 1);
            } catch {
                break;
            }
        }
    }

    /// @notice Upload actions to IPFS and return hashes
    // solhint-disable-next-line code-complexity
    function _uploadActionsToIPFS(uint256 expectedCount) internal returns (string[] memory) {
        string[] memory inputs = new string[](2);
        inputs[0] = "bun";
        inputs[1] = "script/utils/ipfs-uploader.ts";

        try vm.ffi(inputs) returns (bytes memory result) {
            if (result.length == 0) {
                return _handleIPFSMismatch(expectedCount, 0);
            }

            (bool success, bytes memory parsed) = _tryParseIPFSResult(result);
            if (!success) {
                return _handleIPFSMismatch(expectedCount, 0);
            }

            string[] memory hashes = abi.decode(parsed, (string[]));
            if (hashes.length != expectedCount) {
                return _handleIPFSMismatch(expectedCount, hashes.length);
            }
            return hashes;
        } catch {
            return _handleIPFSMismatch(expectedCount, 0);
        }
    }

    /// @notice Try to parse IPFS result JSON, handling prefix/suffix noise
    function _tryParseIPFSResult(bytes memory result) internal returns (bool success, bytes memory parsed) {
        string memory resultJson = string(result);

        // Try to parse as JSON directly
        try vm.parseJson(resultJson) returns (bytes memory directParsed) {
            return (true, directParsed);
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Fall through to extraction logic
        }

        // Extract JSON array from noisy output
        (int256 start, int256 end) = _findJsonArrayBounds(bytes(resultJson));
        if (start < 0 || end <= start) {
            return (false, "");
        }

        bytes memory sliced = new bytes(uint256(end - start));
        for (uint256 i = uint256(start); i < uint256(end); i++) {
            sliced[i - uint256(start)] = bytes(resultJson)[i];
        }

        try vm.parseJson(string(sliced)) returns (bytes memory cleanedParsed) {
            return (true, cleanedParsed);
        } catch {
            return (false, "");
        }
    }

    /// @notice Find bounds of JSON array in potentially noisy output
    function _findJsonArrayBounds(bytes memory resultBytes) internal pure returns (int256 start, int256 end) {
        start = -1;
        end = -1;

        // Find LAST ']'
        for (uint256 i = resultBytes.length; i > 0; i--) {
            if (resultBytes[i - 1] == "]") {
                end = int256(i);
                break;
            }
        }

        // Find matching '[' before end
        if (end > 0) {
            for (uint256 i = uint256(end); i > 0; i--) {
                if (resultBytes[i - 1] == "[") {
                    start = int256(i - 1);
                    break;
                }
            }
        }

        return (start, end);
    }

    /// @notice Handle IPFS upload mismatch scenarios
    function _handleIPFSMismatch(
        uint256 expectedCount,
        uint256 /* actualCount */
    )
        internal
        view
        returns (string[] memory)
    {
        if (_isBroadcasting()) {
            revert ActionIPFSUploadFailed();
        }

        // For simulations, return placeholders matching the expected count so the loop runs fully.
        string[] memory hashes = new string[](expectedCount);
        string[3] memory defaults = [
            string("Qmcw9vnuChG1X88zomB6Xrot5jCFRdbEsvscHzi2sJvto8"),
            string("QmPHfYyqUC8T5aKwR4b3xsb1EjNiVgZ7uWti8voKCB7sGK"),
            string("QmZxTqtJKBwRM1i2ACdH7YJyGjwcWzEfGVKW9DKUWkjNfo")
        ];
        for (uint256 i = 0; i < expectedCount; i++) {
            hashes[i] = defaults[i % defaults.length];
        }
        return hashes;
    }

    /// @notice Deploy core actions from config
    function _deployCoreActions(string memory json, string[] memory ipfsHashes, uint256 actionsCount) internal {
        if (ipfsHashes.length < actionsCount) revert ActionIPFSUploadFailed();

        for (uint256 i = 0; i < actionsCount && i < 50; i++) {
            string memory basePath = string.concat(".actions[", vm.toString(i), "]");
            try vm.parseJson(json, string.concat(basePath, ".title")) returns (bytes memory titleBytes) {
                if (titleBytes.length == 0) break;
                _registerSingleAction(json, basePath, ipfsHashes[i]);
            } catch {
                revert ActionDeploymentFailed();
            }
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

    /// @notice Log deployment strategy based on chain
    // solhint-disable-next-line no-console
    function _logDeploymentStrategy() internal view {
        uint256 chainId = block.chainid;

        if (_isMainnetChain(chainId)) { } else { }
    }

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

    /// @notice Load gardens config JSON
    function _loadGardensConfig() internal view returns (string memory) {
        string memory configPath = string.concat(vm.projectRoot(), "/config/gardens.json");
        return vm.readFile(configPath);
    }

    /// @notice Load actions config JSON
    function _loadActionsConfig() internal view returns (string memory) {
        string memory configPath = string.concat(vm.projectRoot(), "/config/actions.json");
        return vm.readFile(configPath);
    }

    /// @notice Count actions defined in the JSON
    function _getActionsCount(string memory json) internal view returns (uint256) {
        for (uint256 i = 0; i < 50; i++) {
            string memory basePath = string.concat(".actions[", vm.toString(i), "].title");
            try vm.parseJson(json, basePath) returns (bytes memory titleBytes) {
                if (titleBytes.length == 0) {
                    return i;
                }
            } catch {
                return i;
            }
        }
        return 50;
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

    /// @notice Build deployment result structure
    /// @dev Guardian and accountProxy addresses can be computed via CREATE2 post-deployment
    function _buildDeploymentResult() private view returns (DeploymentResult memory) {
        return DeploymentResult({
            deploymentRegistry: address(deploymentRegistry),
            guardian: address(0), // Computed via CREATE2, populated post-deployment
            gardenAccountImpl: address(gardenAccountImpl),
            accountProxy: address(0), // Computed via CREATE2, populated post-deployment
            gardenToken: address(gardenToken),
            actionRegistry: address(actionRegistry),
            assessmentResolver: address(assessmentResolver),
            workResolver: address(workResolver),
            workApprovalResolver: address(workApprovalResolver),
            gardenerAccountLogic: gardenerAccountLogic,
            gardenerRegistry: address(gardenerRegistry),
            assessmentSchemaUID: assessmentSchemaUID,
            workSchemaUID: workSchemaUID,
            workApprovalSchemaUID: workApprovalSchemaUID,
            rootGardenAddress: gardenAddresses.length > 0 ? gardenAddresses[0] : address(0),
            rootGardenTokenId: gardenTokenIds.length > 0 ? gardenTokenIds[0] : 0
        });
    }

    /// @notice Save deployment results to JSON
    function _saveDeploymentResults() internal {
        // Build result with core addresses
        DeploymentResult memory result = _buildDeploymentResult();

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
