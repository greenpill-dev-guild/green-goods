// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { DeploymentBase } from "../test/helpers/DeploymentBase.sol";
import { Deployment } from "../src/registries/Deployment.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { Capital, Domain } from "../src/registries/Action.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { IGardensModule } from "../src/interfaces/IGardensModule.sol";
import { GreenGoodsENS } from "../src/registries/ENS.sol";
import { IENS } from "../src/interfaces/IENS.sol";

import { IOctantFactory } from "../src/interfaces/IOctantFactory.sol";
import { GreenGoodsENSReceiver } from "../src/registries/ENSReceiver.sol";
// GardensModule and YieldResolver deployed via inherited DeploymentBase
import { AaveV3 } from "../src/strategies/AaveV3.sol";
import { MockYDSStrategy } from "../src/mocks/YDSStrategy.sol";

/// @title Deploy
/// @notice Production deployment script - orchestrates DeploymentBase + seed data
/// @dev Inherits FULL production deployment from DeploymentBase
contract Deploy is Script, DeploymentBase {
    // ===== ERRORS =====
    error ActionIPFSUploadFailed();
    error ActionDeploymentFailed();
    error InvalidCapitalType();
    error InvalidDomainType();

    // ===== STATE =====
    address[] private gardenAddresses;
    uint256[] private gardenTokenIds;

    // Arbitrum mainnet defaults for Octant phase-1 assets/strategy
    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;
    address private constant ARBITRUM_AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address private constant ARBITRUM_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address private constant ARBITRUM_DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address private constant ARBITRUM_AWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;
    address private constant ARBITRUM_ADAI = 0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE;

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
            // 1. Deploy stack based on chain (ENS infra for mainnet, protocol for L2)
            // Deployer (msg.sender) is the owner for all contracts
            deployFullStack(config.communityToken, msg.sender);

            // 1b. Set community token on GardenToken (state variable, not per-config)
            gardenToken.setCommunityToken(config.communityToken);

            // 2. Add production-specific governance features (L2 only)
            if (!_isMainnetChain(block.chainid)) {
                _configureOctant();
                _addProductionFeatures(config);

                // 3. Deploy seed data (gardens + actions) on broadcast runs.
                // Simulations often run under non-admin senders that cannot mint Hats roles.
                if (_isBroadcasting()) {
                    _deploySeedData(config);
                }
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
    // MAINNET ENS DEPLOYMENT
    // ============================================

    /// @notice Deploy GreenGoodsENSReceiver on Ethereum mainnet
    /// @dev Requires: ENS Registry, ENS Resolver, CCIP Router configured in networks.json
    ///      Deployer must own greengoods.eth — setApprovalForAll is called automatically
    function _deployMainnetENS(address owner, bytes32, address) internal override {
        NetworkConfig memory config = loadNetworkConfig();

        if (config.ensRegistry == address(0) || config.ccipRouter == address(0)) {
            console.log("SKIP: ENS or CCIP not configured for mainnet");
            return;
        }

        // L2 sender address set post-deploy (cross-chain chicken-and-egg)
        address l2Sender = _envAddressOrZero("ENS_L2_SENDER");

        // namehash("greengoods.eth")
        bytes32 baseNode = 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;

        // Arbitrum chain selector (source chain for CCIP messages)
        uint64 arbitrumChainSelector = 4_949_039_107_694_359_620;

        GreenGoodsENSReceiver receiver = new GreenGoodsENSReceiver(
            config.ccipRouter, arbitrumChainSelector, l2Sender, config.ensRegistry, config.ensResolver, baseNode, owner
        );

        // Deployer owns greengoods.eth — approve receiver as ENS operator
        IENS(config.ensRegistry).setApprovalForAll(address(receiver), true);

        console.log("GreenGoodsENSReceiver deployed:", address(receiver));
        console.log("  ENS Registry:", config.ensRegistry);
        console.log("  ENS operator approval: granted");
        console.log("  CCIP Router:", config.ccipRouter);
        console.log("  L2 Sender:", l2Sender);
        if (l2Sender == address(0)) {
            console.log("  WARNING: L2 sender not set. Call setL2Sender() after deploying GreenGoodsENS on Arbitrum.");
        }
    }

    // ============================================
    // PRODUCTION-SPECIFIC FEATURES
    // ============================================

    /// @notice Add production-specific features (governance, allowlist, etc.)
    function _addProductionFeatures(NetworkConfig memory config) internal {
        // Add deployer to allowlist for minting during setup
        // solhint-disable-next-line no-empty-blocks
        try Deployment(address(deploymentRegistry)).addToAllowlist(msg.sender) {
            // Success - deployer allowlisted
        } catch {
            console.log("WARNING: Failed to add deployer to allowlist - manual action required");
        }

        // Add multisig to allowlist if configured
        if (config.multisig != address(0) && config.multisig != msg.sender) {
            // solhint-disable-next-line no-empty-blocks
            try Deployment(address(deploymentRegistry)).addToAllowlist(config.multisig) {
                // Success - multisig allowlisted
            } catch {
                console.log("WARNING: Failed to add multisig to allowlist - manual action required");
            }
            _initiateGovernanceTransfer(config.multisig);
        }
    }

    /// @notice Configure Octant factory/assets/strategies for vault creation on mint
    /// @dev Uses environment-driven overrides; safe no-op when OCTANT_FACTORY_ADDRESS is unset.
    function _configureOctant() internal {
        if (address(octantModule) == address(0) || address(gardenToken) == address(0)) {
            return;
        }

        address octantFactoryAddress = _envAddressOrZero("OCTANT_FACTORY_ADDRESS");
        if (octantFactoryAddress == address(0)) {
            return;
        }

        octantModule.setOctantFactory(octantFactoryAddress);
        octantModule.setGardenToken(address(gardenToken));

        if (block.chainid == ARBITRUM_CHAIN_ID) {
            _configureArbitrumOctantAssets();
            return;
        }

        if (block.chainid == SEPOLIA_CHAIN_ID) {
            // Sepolia uses explicit env-driven assets (same as generic path)
            _configureExplicitOctantAssets();
            return;
        }

        _configureExplicitOctantAssets();
    }

    /// @notice Configure Arbitrum defaults (WETH + DAI) with AaveV3 instances
    function _configureArbitrumOctantAssets() internal {
        address wethAsset = _envAddressOrDefault("OCTANT_WETH_ASSET", ARBITRUM_WETH);
        address daiAsset = _envAddressOrDefault("OCTANT_DAI_ASSET", ARBITRUM_DAI);
        address strategyOwner = _envAddressOrDefault("OCTANT_STRATEGY_OWNER", msg.sender);

        address wethStrategy = _envAddressOrZero("OCTANT_WETH_STRATEGY");
        if (wethStrategy == address(0)) {
            address wethAToken = _envAddressOrDefault("OCTANT_WETH_ATOKEN", ARBITRUM_AWETH);
            wethStrategy = address(new AaveV3(wethAsset, ARBITRUM_AAVE_V3_POOL, wethAToken, strategyOwner));
        }

        address daiStrategy = _envAddressOrZero("OCTANT_DAI_STRATEGY");
        if (daiStrategy == address(0)) {
            address daiAToken = _envAddressOrDefault("OCTANT_DAI_ATOKEN", ARBITRUM_ADAI);
            daiStrategy = address(new AaveV3(daiAsset, ARBITRUM_AAVE_V3_POOL, daiAToken, strategyOwner));
        }

        octantModule.setSupportedAsset(wethAsset, wethStrategy);
        octantModule.setSupportedAsset(daiAsset, daiStrategy);
    }

    /// @notice Configure supported assets entirely from explicit env variables
    /// @dev If strategy is omitted but asset is provided, deploys MockYDSStrategy.
    function _configureExplicitOctantAssets() internal {
        address wethAsset = _envAddressOrZero("OCTANT_WETH_ASSET");
        address daiAsset = _envAddressOrZero("OCTANT_DAI_ASSET");

        address wethStrategy = _envAddressOrZero("OCTANT_WETH_STRATEGY");
        address daiStrategy = _envAddressOrZero("OCTANT_DAI_STRATEGY");

        if (wethAsset != address(0)) {
            if (wethStrategy == address(0)) {
                wethStrategy = address(new MockYDSStrategy());
            }
            octantModule.setSupportedAsset(wethAsset, wethStrategy);
        }

        if (daiAsset != address(0)) {
            if (daiStrategy == address(0)) {
                daiStrategy = address(new MockYDSStrategy());
            }
            octantModule.setSupportedAsset(daiAsset, daiStrategy);
        }
    }

    /// @notice Read optional env var as address; returns zero when unset/invalid
    function _envAddressOrZero(string memory key) internal view returns (address value) {
        try vm.envAddress(key) returns (address parsed) {
            value = parsed;
        } catch {
            value = address(0);
        }
    }

    /// @notice Read optional env var with fallback default
    function _envAddressOrDefault(string memory key, address fallbackValue) internal view returns (address value) {
        address parsed = _envAddressOrZero(key);
        return parsed == address(0) ? fallbackValue : parsed;
    }

    /// @notice Estimate CCIP fee for ENS garden registration (0 if ENS not configured)
    function _estimateENSFee(string memory slug) internal view returns (uint256) {
        if (bytes(slug).length == 0) return 0;
        if (address(greenGoodsENS) == address(0)) return 0;
        try greenGoodsENS.getRegistrationFee(slug, address(0), GreenGoodsENS.NameType.Garden) returns (uint256 fee) {
            return fee;
        } catch {
            return 0;
        }
    }

    /// @notice Deploy seed data (gardens from config + core actions)
    function _deploySeedData(NetworkConfig memory config) internal {
        // 1. Mint gardens from config
        string memory gardensJson = _loadGardensConfig();
        _deployGardensFromConfig(gardensJson);

        // 2. Deploy core actions
        string memory actionsJson = _loadActionsConfig();
        uint256 actionsCount = _getActionsCount(actionsJson);
        string[] memory actionIPFSHashes = _uploadActionsToIPFS(actionsCount);
        _deployCoreActions(actionsJson, actionIPFSHashes, actionsCount);
    }

    /// @notice Deploy gardens from config/gardens.json
    function _deployGardensFromConfig(string memory gardensJson) internal {
        for (uint256 i = 0; i < 50; i++) {
            string memory basePath = string.concat(".gardens[", vm.toString(i), "]");

            try vm.parseJson(gardensJson, string.concat(basePath, ".name")) returns (bytes memory nameBytes) {
                if (nameBytes.length == 0) break;

                GardenToken.GardenConfig memory gardenConfig = _parseGardenConfigFromJson(gardensJson, basePath, nameBytes);

                uint256 ensFee = _estimateENSFee(gardenConfig.slug);
                address gardenAddress = gardenToken.mintGarden{ value: ensFee }(gardenConfig);
                gardenAddresses.push(gardenAddress);
                gardenTokenIds.push(i + 1);
            } catch {
                break;
            }
        }
    }

    /// @notice Parse a single garden config from JSON (separate stack frame to avoid stack-too-deep)
    function _parseGardenConfigFromJson(
        string memory gardensJson,
        string memory basePath,
        bytes memory nameBytes
    )
        internal
        returns (GardenToken.GardenConfig memory)
    {
        string memory name = abi.decode(nameBytes, (string));
        string memory description = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".description")), (string));
        string memory location = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".location")), (string));
        string memory bannerImage = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".bannerImage")), (string));

        string memory slug = "";
        try vm.parseJson(gardensJson, string.concat(basePath, ".slug")) returns (bytes memory slugBytes) {
            slug = abi.decode(slugBytes, (string));
        } catch { }

        string memory metadata = "";
        try vm.parseJson(gardensJson, string.concat(basePath, ".metadata")) returns (bytes memory metadataBytes) {
            metadata = abi.decode(metadataBytes, (string));
        } catch { }

        bool openJoining = false;
        try vm.parseJson(gardensJson, string.concat(basePath, ".openJoining")) returns (bytes memory openJoiningBytes) {
            openJoining = abi.decode(openJoiningBytes, (bool));
        } catch { }

        return GardenToken.GardenConfig({
            name: name,
            slug: slug,
            description: description,
            location: location,
            bannerImage: bannerImage,
            metadata: metadata,
            openJoining: openJoining,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });
    }

    /// @notice Upload actions to IPFS and return hashes
    // solhint-disable-next-line code-complexity
    function _uploadActionsToIPFS(uint256 expectedCount) internal returns (string[] memory) {
        string[] memory inputs = new string[](3);
        inputs[0] = "bun";
        inputs[1] = "run";
        inputs[2] = "script/utils/ipfs-uploader.ts";

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
    /// @dev Uses a simple last-`]` / nearest-`[` heuristic. This works for flat
    ///      string arrays (IPFS hashes) but does NOT handle nested arrays or
    ///      bracket characters inside JSON string values.
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
        string memory slug = abi.decode(vm.parseJson(json, string.concat(basePath, ".slug")), (string));
        string memory domainStr = abi.decode(vm.parseJson(json, string.concat(basePath, ".domain")), (string));
        Domain domain = _parseDomain(domainStr);

        // Use dynamic timestamps: start = now, end = now + 3 months (ignoring config values)
        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp + 90 days; // ~3 months

        string[] memory capitalStrings = abi.decode(vm.parseJson(json, string.concat(basePath, ".capitals")), (string[]));
        Capital[] memory capitals = new Capital[](capitalStrings.length);
        for (uint256 j = 0; j < capitalStrings.length; j++) {
            capitals[j] = _parseCapital(capitalStrings[j]);
        }

        string[] memory media = abi.decode(vm.parseJson(json, string.concat(basePath, ".media")), (string[]));

        actionRegistry.registerAction(startTime, endTime, title, slug, ipfsHash, capitals, media, domain);
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
        if (!Deployment(address(deploymentRegistry)).isInAllowlist(multisig)) {
            // solhint-disable-next-line no-empty-blocks
            try Deployment(address(deploymentRegistry)).addToAllowlist(multisig) {
                // Success - multisig added to allowlist
            } catch {
                console.log("WARNING: Failed to add multisig to allowlist before governance transfer");
            }
        }

        // solhint-disable-next-line no-empty-blocks
        try Deployment(address(deploymentRegistry)).initiateGovernanceTransfer(multisig) {
            console.log("Governance transfer initiated to:", multisig);
        } catch {
            console.log("WARNING: Failed to initiate governance transfer - manual action required post-deployment");
            console.log("  Target multisig:", multisig);
        }
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

    /// @notice Parse domain type from string
    function _parseDomain(string memory domainStr) internal pure returns (Domain) {
        bytes32 hash = keccak256(bytes(domainStr));

        if (hash == keccak256(bytes("SOLAR"))) return Domain.SOLAR;
        if (hash == keccak256(bytes("AGRO"))) return Domain.AGRO;
        if (hash == keccak256(bytes("EDU"))) return Domain.EDU;
        if (hash == keccak256(bytes("WASTE"))) return Domain.WASTE;

        revert InvalidDomainType();
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
    function _printDeploymentSummary() internal view {
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", block.chainid);
        console.log("GardenToken:", address(gardenToken));
        console.log("ActionRegistry:", address(actionRegistry));
        console.log("Deployment:", address(deploymentRegistry));
        console.log("HatsModule:", address(hatsModule));
        console.log("OctantModule:", address(octantModule));
        console.log("GardensModule:", address(gardensModule));
        console.log("YieldResolver:", address(yieldSplitter));
        console.log("WorkResolver:", address(workResolver));
        console.log("WorkApprovalResolver:", address(workApprovalResolver));
        console.log("AssessmentResolver:", address(assessmentResolver));
        if (address(greenGoodsENS) != address(0)) {
            console.log("GreenGoodsENS:", address(greenGoodsENS));
            console.log("  L1 Receiver:", greenGoodsENS.l1Receiver());
            if (greenGoodsENS.l1Receiver() == address(0)) {
                console.log("  WARNING: L1 receiver not set. Set ENS_L1_RECEIVER or call setL1Receiver()");
            }
        }
        if (gardenAddresses.length > 0) {
            console.log("Gardens minted:", gardenAddresses.length);
        }
        console.log("==========================\n");
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
    /// @dev Uses field-by-field assignment to avoid stack-too-deep with 17+ field struct literal
    function _buildDeploymentResult() private view returns (DeploymentResult memory result) {
        result.deploymentRegistry = address(deploymentRegistry);
        result.gardenAccountImpl = address(gardenAccountImpl);
        result.gardenToken = address(gardenToken);
        result.actionRegistry = address(actionRegistry);
        result.assessmentResolver = address(assessmentResolver);
        result.workResolver = address(workResolver);
        result.workApprovalResolver = address(workApprovalResolver);
        result.hatsModule = address(hatsModule);
        result.karmaGAPModule = address(karmaGAPModule);
        result.octantModule = address(octantModule);
        result.octantFactory = _getOctantFactoryAddress();
        result.gardensModule = address(gardensModule);
        result.unifiedPowerRegistry = address(unifiedPowerRegistry);
        result.yieldSplitter = address(yieldSplitter);
        result.cookieJarModule = address(cookieJarModule);
        result.hypercertsModule = address(hypercertsModule);
        result.marketplaceAdapter = address(marketplaceAdapter);
        result.greenGoodsENS = address(greenGoodsENS);
        result.gardenerAccountLogic = address(0); // DEPRECATED: field kept for JSON compat
        result.gardenerRegistry = address(0); // DEPRECATED: replaced by GreenGoodsENS (CCIP)
        result.guardian = guardianAddress;
        result.accountProxy = accountProxyAddress;
        result.assessmentSchemaUID = assessmentSchemaUID;
        result.workSchemaUID = workSchemaUID;
        result.workApprovalSchemaUID = workApprovalSchemaUID;
        result.rootGardenAddress = gardenAddresses.length > 0 ? gardenAddresses[0] : address(0);
        result.rootGardenTokenId = gardenTokenIds.length > 0 ? gardenTokenIds[0] : 0;
    }

    /// @notice Resolve configured Octant factory from module (if deployed)
    function _getOctantFactoryAddress() private view returns (address) {
        if (address(octantModule) == address(0)) {
            return address(0);
        }

        try octantModule.octantFactory() returns (IOctantFactory factory) {
            return address(factory);
        } catch {
            return address(0);
        }
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

    /// @notice Generate verification commands for deployed contracts
    function _generateVerificationCommands() internal view {
        if (address(gardenToken) == address(0)) return;
        console.log("\n=== Verification Commands ===");
        console.log("Run these if auto-verification failed:\n");
        string memory cid = vm.toString(block.chainid);
        string memory gt = vm.toString(address(gardenToken));
        string memory ar = vm.toString(address(actionRegistry));
        console.log(string.concat("forge verify-contract ", gt, " src/tokens/Garden.sol:GardenToken --chain ", cid));
        console.log(string.concat("forge verify-contract ", ar, " src/registries/Action.sol:ActionRegistry --chain ", cid));
        console.log("=============================\n");
    }
}
