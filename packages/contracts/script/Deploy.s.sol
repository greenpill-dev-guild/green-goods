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
import { IHats } from "../src/interfaces/IHats.sol";
import { IHatsModule } from "../src/interfaces/IHatsModule.sol";
import { GreenGoodsENS } from "../src/registries/ENS.sol";
import { IENS } from "../src/interfaces/IENS.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantFactory } from "../src/interfaces/IOctantFactory.sol";
import { GreenGoodsENSReceiver } from "../src/registries/ENSReceiver.sol";
// GardensModule and YieldResolver deployed via inherited DeploymentBase
import { AaveV3 } from "../src/strategies/AaveV3.sol";
import { MockYDSStrategy } from "../src/mocks/YDSStrategy.sol";
import { MockRegistryFactory } from "../src/mocks/GardensV2.sol";
import { GardensV2Addresses } from "../test/fork/helpers/GardensV2Addresses.sol";
import { MultistrategyVault } from "@octant/core/MultistrategyVault.sol";
import { MultistrategyVaultFactory } from "@octant/factories/MultistrategyVaultFactory.sol";

/// @title Deploy
/// @notice Production deployment script - orchestrates DeploymentBase + seed data
/// @dev Inherits FULL production deployment from DeploymentBase
contract Deploy is Script, DeploymentBase {
    // ===== ERRORS =====
    error ActionIPFSUploadFailed();
    error ActionDeploymentFailed();
    error InvalidCapitalType();
    error InvalidDomainType();
    error InvalidSeedGardenDomainMask(uint256 index, uint256 provided);
    error CriticalDependencyMissing(string dependency);
    error HatsModuleNotAdmin();
    error MissingArbitrumL1Receiver();
    error ENSRegistrationSendFailed();
    error ENSRegistrationVerificationFailed();
    error RootGardenCommunityNotCreated();
    error RootGardenPoolNotCreated();
    error RootGardenVaultMissing(address asset);
    error RootGardenJarMissing(address asset);
    error RootGardenGoodsNotSeeded();
    error RootGardenDomainMaskInvalid(uint8 domainMask);
    error NoSeedGardensConfigured();

    // ===== STATE =====
    address[] private gardenAddresses;
    uint256[] private gardenTokenIds;
    address private rootGardenAddress;
    uint256 private rootGardenTokenId;

    // Arbitrum mainnet defaults for Octant phase-1 assets/strategy
    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint256 private constant MAX_CONFIG_ENTRIES = 50;
    uint8 private constant MAX_DOMAIN_MASK = 0x0F;
    address private constant GARDENS_ALLO_PROXY = 0x1133eA7Af70876e64665ecD07C0A0476d09465a1;
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

            // 1b. Set community token on GardenToken (L2 protocol deployments only).
            // Mainnet deploy path is ENS-only and does not deploy GardenToken.
            if (!_isMainnetChain(block.chainid)) {
                gardenToken.setCommunityToken(config.communityToken);
            }

            // 2. Add production-specific governance features (L2 only)
            if (!_isMainnetChain(block.chainid)) {
                _configureOctant();
                _configureGardensModule(config);
                _configureCookieJar();
                _addProductionFeatures(config);

                // 3. Deploy seed data and run readiness checks in operational runs.
                // Operational runs include on-chain broadcast and dry-run RPC simulations.
                if (_shouldRunRuntimeChecks()) {
                    if (_isReleaseHardeningChain()) {
                        _runPreSeedCriticalChecks();
                        _deploySeedData();
                        _runPostSeedReadinessChecks();
                    } else {
                        _deploySeedData();
                    }
                }
            }
        } else {
            // Schema-only update mode - load existing deployment
            string memory chainIdStr = vm.toString(block.chainid);
            string memory deploymentPath = _chainDeploymentPath(chainIdStr, "-latest.json");
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

    /// @notice Configure Octant factory/assets/strategies for vault creation on mint.
    /// @dev Factory resolution priority:
    ///      1) OCTANT_FACTORY_ADDRESS env override
    ///      2) Existing module factory (if already configured)
    ///      3) Auto-deploy (AUTO_DEPLOY_OCTANT_FACTORY=true, default)
    function _configureOctant() internal {
        if (address(octantModule) == address(0) || address(gardenToken) == address(0)) {
            return;
        }

        address octantFactoryAddress = _envAddressOrZero("OCTANT_FACTORY_ADDRESS");
        if (octantFactoryAddress == address(0)) {
            octantFactoryAddress = address(octantModule.octantFactory());
        }
        if (octantFactoryAddress == address(0) && _envBoolOrDefault("AUTO_DEPLOY_OCTANT_FACTORY", true)) {
            octantFactoryAddress = _deployOctantFactory();
        }
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
    /// @dev If no explicit assets are provided, falls back to community token.
    function _configureExplicitOctantAssets() internal {
        address wethAsset = _envAddressOrZero("OCTANT_WETH_ASSET");
        address daiAsset = _envAddressOrZero("OCTANT_DAI_ASSET");

        address wethStrategy = _envAddressOrZero("OCTANT_WETH_STRATEGY");
        address daiStrategy = _envAddressOrZero("OCTANT_DAI_STRATEGY");
        bool configuredAny;

        if (wethAsset != address(0)) {
            if (wethStrategy == address(0)) {
                wethStrategy = address(new MockYDSStrategy());
            }
            octantModule.setSupportedAsset(wethAsset, wethStrategy);
            configuredAny = true;
        }

        if (daiAsset != address(0)) {
            if (daiStrategy == address(0)) {
                daiStrategy = address(new MockYDSStrategy());
            }
            octantModule.setSupportedAsset(daiAsset, daiStrategy);
            configuredAny = true;
        }

        if (!configuredAny) {
            address fallbackAsset = _envAddressOrZero("OCTANT_FALLBACK_ASSET");
            if (fallbackAsset == address(0)) {
                fallbackAsset = gardenToken.communityToken();
            }
            if (fallbackAsset == address(0)) {
                return;
            }

            address fallbackStrategy = _envAddressOrZero("OCTANT_FALLBACK_STRATEGY");
            if (fallbackStrategy == address(0)) {
                fallbackStrategy = address(new MockYDSStrategy());
            }

            octantModule.setSupportedAsset(fallbackAsset, fallbackStrategy);
        }
    }

    /// @notice Deploy Octant factory inline when external factory is not supplied.
    function _deployOctantFactory() internal returns (address factoryAddress) {
        MultistrategyVault implementation = new MultistrategyVault();
        MultistrategyVaultFactory factory =
            new MultistrategyVaultFactory("Green Goods Vault Factory", address(implementation), msg.sender);
        return address(factory);
    }

    /// @notice Configure GardensModule dependencies required for community + pool creation.
    function _configureGardensModule(NetworkConfig memory config) internal {
        if (address(gardensModule) == address(0)) return;

        address desiredRegistryFactory =
            _envAddressOrDefault("GARDENS_REGISTRY_FACTORY", GardensV2Addresses.getRegistryFactory(block.chainid));
        if (desiredRegistryFactory != address(0) && address(gardensModule.registryFactory()) != desiredRegistryFactory) {
            gardensModule.setRegistryFactory(desiredRegistryFactory);
        }

        address desiredAllo = _envAddressOrDefault("GARDENS_ALLO_ADDRESS", GARDENS_ALLO_PROXY);
        if (desiredAllo != address(0) && gardensModule.alloAddress() != desiredAllo) {
            gardensModule.setAlloAddress(desiredAllo);
        }

        address defaultCouncilSafe = config.multisig != address(0) ? config.multisig : msg.sender;
        address desiredCouncilSafe = _envAddressOrDefault("GARDENS_COUNCIL_SAFE", defaultCouncilSafe);
        if (desiredCouncilSafe != address(0) && gardensModule.communityCouncilSafe() != desiredCouncilSafe) {
            gardensModule.setCommunityCouncilSafe(desiredCouncilSafe);
        }

        if (!gardensModule.requireFullSetup()) {
            gardensModule.setRequireFullSetup(true);
        }
    }

    /// @notice Align CookieJar supported assets with active Octant assets.
    function _configureCookieJar() internal {
        if (address(cookieJarModule) == address(0) || address(octantModule) == address(0)) {
            return;
        }

        address[] memory octantAssets = octantModule.getSupportedAssets();
        for (uint256 i = 0; i < octantAssets.length; i++) {
            address asset = octantAssets[i];
            if (asset == address(0)) continue;
            if (octantModule.supportedAssets(asset) == address(0)) continue;
            if (_addressInArray(cookieJarModule.getSupportedAssets(), asset)) continue;

            cookieJarModule.addSupportedAsset(asset);
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

    /// @notice Read optional env var as bool with fallback default.
    function _envBoolOrDefault(string memory key, bool fallbackValue) internal view returns (bool value) {
        try vm.envBool(key) returns (bool parsed) {
            value = parsed;
        } catch {
            value = fallbackValue;
        }
    }

    /// @notice Resolve community garden slug (default: "community").
    function _getCommunityGardenSlug() internal view returns (string memory slug) {
        try vm.envString("COMMUNITY_GARDEN_SLUG") returns (string memory configured) {
            if (bytes(configured).length > 0) return configured;
        } catch { }
        return "community";
    }

    /// @notice String equality helper for slug comparisons.
    function _slugMatches(string memory left, string memory right) internal pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    /// @notice Parse optional JSON string value.
    function _parseOptionalString(string memory json, string memory path) internal view returns (string memory value) {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (string));
        } catch {
            return "";
        }
    }

    /// @notice Parse optional JSON bool value with fallback.
    function _parseOptionalBool(
        string memory json,
        string memory path,
        bool fallbackValue
    )
        internal
        view
        returns (bool value)
    {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (bool));
        } catch {
            return fallbackValue;
        }
    }

    /// @notice Parse optional JSON address[] value (empty array when missing).
    function _parseOptionalAddressArray(
        string memory json,
        string memory path
    )
        internal
        view
        returns (address[] memory addresses)
    {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (address[]));
        } catch {
            return new address[](0);
        }
    }

    /// @notice Returns true when address is present in array.
    function _addressInArray(address[] memory addresses, address account) internal pure returns (bool) {
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == account) return true;
        }
        return false;
    }

    /// @notice Return currently active Octant assets (non-zero strategy only).
    function _getActiveOctantAssets() internal view returns (address[] memory activeAssets) {
        if (address(octantModule) == address(0)) {
            return new address[](0);
        }

        address[] memory allAssets = octantModule.getSupportedAssets();
        uint256 activeCount;
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (octantModule.supportedAssets(allAssets[i]) != address(0)) {
                activeCount++;
            }
        }

        activeAssets = new address[](activeCount);
        uint256 cursor;
        for (uint256 i = 0; i < allAssets.length; i++) {
            if (octantModule.supportedAssets(allAssets[i]) != address(0)) {
                activeAssets[cursor++] = allAssets[i];
            }
        }
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

    /// @notice Critical pre-seed checks that must pass before minting gardens/actions.
    function _runPreSeedCriticalChecks() internal {
        _ensureHatsReadiness();
        _requireGardensReadiness();

        if (_envBoolOrDefault("REQUIRE_OCTANT_READY", true)) {
            _requireOctantReadiness();
        }

        if (_envBoolOrDefault("REQUIRE_COOKIEJAR_READY", true)) {
            _requireCookieJarReadiness();
        }

        if (block.chainid == ARBITRUM_CHAIN_ID && _envAddressOrZero("ENS_L1_RECEIVER") == address(0)) {
            revert MissingArbitrumL1Receiver();
        }
    }

    /// @notice Post-seed release-readiness checks.
    function _runPostSeedReadinessChecks() internal {
        if (rootGardenAddress == address(0)) revert RootGardenCommunityNotCreated();
        _ensureRootGardenCommunityAndPoolsReady();

        uint8 domainMask = actionRegistry.gardenDomains(rootGardenAddress);
        if (domainMask != MAX_DOMAIN_MASK) revert RootGardenDomainMaskInvalid(domainMask);

        if (_envBoolOrDefault("REQUIRE_OCTANT_READY", true)) {
            address[] memory activeOctantAssets = _getActiveOctantAssets();
            for (uint256 i = 0; i < activeOctantAssets.length; i++) {
                if (octantModule.getVaultForAsset(rootGardenAddress, activeOctantAssets[i]) == address(0)) {
                    revert RootGardenVaultMissing(activeOctantAssets[i]);
                }
            }
        }

        if (_envBoolOrDefault("REQUIRE_COOKIEJAR_READY", true)) {
            address[] memory cookieJarAssets = cookieJarModule.getSupportedAssets();
            for (uint256 i = 0; i < cookieJarAssets.length; i++) {
                if (cookieJarModule.getGardenJar(rootGardenAddress, cookieJarAssets[i]) == address(0)) {
                    revert RootGardenJarMissing(cookieJarAssets[i]);
                }
            }
        }

        address goodsToken = address(gardensModule.goodsToken());
        if (goodsToken == address(0)) revert RootGardenGoodsNotSeeded();
        if (IERC20(goodsToken).balanceOf(rootGardenAddress) == 0) revert RootGardenGoodsNotSeeded();

        _verifyCommunityENSRegistration();
    }

    /// @notice Ensure Hats module can create garden hat trees.
    /// @dev If module is not yet admin of gardensHatId, this attempts one-time minting of
    ///      required ancestor admin hats from the deployer account.
    function _ensureHatsReadiness() internal {
        if (address(hatsModule) == address(0)) revert CriticalDependencyMissing("hatsModule");
        if (hatsModule.gardenToken() != address(gardenToken)) revert CriticalDependencyMissing("hatsModule.gardenToken");

        uint256 gardensHatId = hatsModule.gardensHatId();
        if (gardensHatId == 0) revert CriticalDependencyMissing("hatsModule.gardensHatId");

        address hatsProtocol = address(hatsModule.hats());
        if (hatsProtocol == address(0)) revert CriticalDependencyMissing("hatsModule.hats");
        IHats hats = IHats(hatsProtocol);

        if (hats.isAdminOfHat(address(hatsModule), gardensHatId)) {
            return;
        }

        // Fresh deployments need the module to wear/admin the protocol Gardens hat.
        // Auto-grant when deployer can administer that hat, else fail fast.
        if (!hats.isAdminOfHat(msg.sender, gardensHatId)) revert HatsModuleNotAdmin();

        uint32 hatLevel = hats.getHatLevel(gardensHatId);
        for (uint32 level = 0; level < hatLevel; level++) {
            if (hats.isAdminOfHat(address(hatsModule), gardensHatId)) {
                return;
            }

            uint256 adminHatId = hats.getAdminAtLevel(gardensHatId, level);
            if (adminHatId == 0 || hats.isWearerOfHat(address(hatsModule), adminHatId)) {
                continue;
            }
            if (!hats.isAdminOfHat(msg.sender, adminHatId)) {
                continue;
            }

            (, uint32 maxSupply, uint32 supply,,,,,, bool active) = hats.viewHat(adminHatId);
            if (!active) {
                continue;
            }
            if (maxSupply > 0 && supply >= maxSupply) {
                continue;
            }

            // Best effort per ancestor; final readiness check below enforces success.
            try hats.mintHat(adminHatId, address(hatsModule)) returns (bool) { } catch { }
        }

        if (!hats.isAdminOfHat(address(hatsModule), gardensHatId)) revert HatsModuleNotAdmin();
    }

    /// @notice Validate GardensModule is fully wired for community/pool creation.
    function _requireGardensReadiness() internal view {
        if (address(gardensModule) == address(0)) revert CriticalDependencyMissing("gardensModule");

        (bool wired, string memory missing) = gardensModule.isWiringComplete();
        if (!wired) revert CriticalDependencyMissing(string.concat("gardensModule.", missing));
        if (address(gardensModule.registryFactory()) == address(0)) {
            revert CriticalDependencyMissing("gardensModule.registryFactory");
        }
        if (gardensModule.alloAddress() == address(0)) {
            revert CriticalDependencyMissing("gardensModule.alloAddress");
        }
    }

    /// @notice Validate Octant prerequisites required for seed vault creation.
    function _requireOctantReadiness() internal view {
        if (address(octantModule) == address(0)) revert CriticalDependencyMissing("octantModule");

        address octantFactory = address(octantModule.octantFactory());
        if (octantFactory == address(0)) revert CriticalDependencyMissing("octantModule.octantFactory");
        if (octantFactory.code.length == 0) revert CriticalDependencyMissing("octantModule.octantFactory.code");
        if (octantModule.gardenToken() != address(gardenToken)) {
            revert CriticalDependencyMissing("octantModule.gardenToken");
        }

        if (_getActiveOctantAssets().length == 0) revert CriticalDependencyMissing("octantModule.supportedAssets");
    }

    /// @notice Validate CookieJar prerequisites required for seed jar creation.
    function _requireCookieJarReadiness() internal view {
        if (address(cookieJarModule) == address(0)) revert CriticalDependencyMissing("cookieJarModule");

        address cookieJarFactory = address(cookieJarModule.cookieJarFactory());
        if (cookieJarFactory == address(0)) revert CriticalDependencyMissing("cookieJarModule.cookieJarFactory");
        if (cookieJarFactory.code.length == 0) revert CriticalDependencyMissing("cookieJarModule.cookieJarFactory.code");
        if (cookieJarModule.gardenToken() != address(gardenToken)) {
            revert CriticalDependencyMissing("cookieJarModule.gardenToken");
        }

        if (cookieJarModule.getSupportedAssets().length == 0) {
            revert CriticalDependencyMissing("cookieJarModule.supportedAssets");
        }
    }

    /// @notice Verify ENS guarantees for the configured community garden slug.
    function _verifyCommunityENSRegistration() internal view {
        if (block.chainid != ARBITRUM_CHAIN_ID && block.chainid != SEPOLIA_CHAIN_ID) {
            return;
        }

        if (address(greenGoodsENS) == address(0)) revert ENSRegistrationVerificationFailed();
        string memory communitySlug = _getCommunityGardenSlug();

        if (block.chainid == ARBITRUM_CHAIN_ID) {
            _verifyArbitrumCommunityENSSend(communitySlug);
            return;
        }

        if (block.chainid == SEPOLIA_CHAIN_ID) {
            _verifySepoliaCommunityENSRegistration(communitySlug);
        }
    }

    /// @notice Sepolia requires full in-flow ENS registration verification.
    function _verifySepoliaCommunityENSRegistration(string memory communitySlug) internal view {
        if (!_slugMatches(greenGoodsENS.ownerToSlug(rootGardenAddress), communitySlug)) {
            revert ENSRegistrationVerificationFailed();
        }

        address receiver = greenGoodsENS.l1Receiver();
        if (receiver == address(0)) revert ENSRegistrationVerificationFailed();
        if (GreenGoodsENSReceiver(receiver).resolve(communitySlug) != rootGardenAddress) {
            revert ENSRegistrationVerificationFailed();
        }
    }

    /// @notice Arbitrum requires ENS send success only (no L1 settlement confirmation).
    function _verifyArbitrumCommunityENSSend(string memory communitySlug) internal view {
        address requiredReceiver = _envAddressOrZero("ENS_L1_RECEIVER");
        if (requiredReceiver == address(0)) revert MissingArbitrumL1Receiver();
        if (greenGoodsENS.l1Receiver() != requiredReceiver) revert ENSRegistrationSendFailed();
        if (!_slugMatches(greenGoodsENS.ownerToSlug(rootGardenAddress), communitySlug)) {
            revert ENSRegistrationSendFailed();
        }
    }

    /// @notice Deploy seed data (gardens from config + core actions).
    function _deploySeedData() internal {
        // 1. Mint gardens from config
        string memory gardensJson = _loadGardensConfig();
        _deployGardensFromConfig(gardensJson);
        _ensureRootGardenCommunityAndPoolsReady();

        // 2. Deploy core actions
        string memory actionsJson = _loadActionsConfig();
        uint256 actionsCount = _getActionsCount(actionsJson);
        string[] memory actionIPFSHashes = _uploadActionsToIPFS(actionsCount);
        _deployCoreActions(actionsJson, actionIPFSHashes, actionsCount);
    }

    /// @notice Ensure root garden has a community and at least one signaling pool.
    /// @dev Retries creation via GardensModule owner recovery functions.
    ///      On Sepolia by default, can auto-fallback to a mock RegistryFactory when
    ///      the configured Gardens V2 factory is deployed but lacks community facets.
    function _ensureRootGardenCommunityAndPoolsReady() internal {
        if (rootGardenAddress == address(0)) revert RootGardenCommunityNotCreated();

        address community = gardensModule.getGardenCommunity(rootGardenAddress);
        if (community == address(0)) {
            if (_shouldAutoDeployMockGardensFactory()) {
                _deployAndSetMockGardensFactory();
            }

            // solhint-disable-next-line no-empty-blocks
            try gardensModule.retryCreateCommunity(rootGardenAddress) returns (address retriedCommunity) {
                community = retriedCommunity;
            } catch { }

            community = gardensModule.getGardenCommunity(rootGardenAddress);
            if (community == address(0)) revert RootGardenCommunityNotCreated();
        }

        address[] memory pools = gardensModule.getGardenSignalPools(rootGardenAddress);
        if (pools.length == 0) {
            // solhint-disable-next-line no-empty-blocks
            try gardensModule.retryCreatePools(rootGardenAddress) returns (address[] memory retriedPools) {
                pools = retriedPools;
            } catch { }

            pools = gardensModule.getGardenSignalPools(rootGardenAddress);
            if (pools.length == 0) {
                if (_requireRootGardenPool()) {
                    revert RootGardenPoolNotCreated();
                }
                console.log("WARNING: root garden has no signal pools; continuing (REQUIRE_ROOT_GARDEN_POOL=false)");
            }
        }

        // Recovery path: if community/pools were created via retry helpers, treasury seeding
        // from the original onGardenMinted() may have been skipped. Attempt owner-only reseed.
        address goodsTokenAddress = address(gardensModule.goodsToken());
        if (goodsTokenAddress != address(0) && IERC20(goodsTokenAddress).balanceOf(rootGardenAddress) == 0) {
            // solhint-disable-next-line no-empty-blocks
            try gardensModule.seedGardenTreasury(rootGardenAddress) { } catch { }
        }
    }

    /// @notice Whether root-garden pool creation is a hard deployment gate.
    /// @dev Arbitrum defaults to non-blocking because community council-safe policy and
    ///      Gardens V2 permissions may require post-deploy council transactions for pools.
    function _requireRootGardenPool() internal view returns (bool) {
        bool defaultValue = block.chainid != ARBITRUM_CHAIN_ID;
        return _envBoolOrDefault("REQUIRE_ROOT_GARDEN_POOL", defaultValue);
    }

    /// @notice Should we auto-deploy a mock Gardens registry factory for recovery.
    /// @dev Sepolia defaults to true because public Gardens V2 factory frequently lacks
    ///      configured community facets. Override with AUTO_DEPLOY_MOCK_GARDENS_FACTORY.
    function _shouldAutoDeployMockGardensFactory() internal view returns (bool) {
        bool fallbackDefault = block.chainid == SEPOLIA_CHAIN_ID;
        return _envBoolOrDefault("AUTO_DEPLOY_MOCK_GARDENS_FACTORY", fallbackDefault);
    }

    /// @notice Deploy and set a mock registry factory used only as a recovery fallback.
    function _deployAndSetMockGardensFactory() internal {
        if (address(gardensModule) == address(0)) return;
        MockRegistryFactory mockFactory = new MockRegistryFactory();
        gardensModule.setRegistryFactory(address(mockFactory));
    }

    /// @notice Deploy gardens from config/gardens.json.
    function _deployGardensFromConfig(string memory gardensJson) internal {
        uint256 gardensCount = _getGardensCount(gardensJson);
        if (gardensCount == 0) revert NoSeedGardensConfigured();

        string memory communitySlug = _getCommunityGardenSlug();

        for (uint256 i = 0; i < gardensCount; i++) {
            string memory basePath = string.concat(".gardens[", vm.toString(i), "]");
            GardenToken.GardenConfig memory gardenConfig =
                _parseGardenConfigFromJson(gardensJson, basePath, i, communitySlug);

            uint256 ensFee = _estimateENSFee(gardenConfig.slug);
            address gardenAddress = gardenToken.mintGarden{ value: ensFee }(gardenConfig);

            gardenAddresses.push(gardenAddress);
            uint256 tokenId = i + 1;
            gardenTokenIds.push(tokenId);

            if (_slugMatches(gardenConfig.slug, communitySlug)) {
                rootGardenAddress = gardenAddress;
                rootGardenTokenId = tokenId;
            }
        }

        if (rootGardenAddress == address(0)) {
            revert RootGardenCommunityNotCreated();
        }
    }

    /// @notice Count gardens defined in the JSON.
    function _getGardensCount(string memory gardensJson) internal view returns (uint256) {
        for (uint256 i = 0; i < MAX_CONFIG_ENTRIES; i++) {
            string memory basePath = string.concat(".gardens[", vm.toString(i), "]");
            try vm.parseJson(gardensJson, basePath) returns (bytes memory gardenBytes) {
                if (gardenBytes.length == 0) {
                    return i;
                }
            } catch {
                return i;
            }
        }
        return MAX_CONFIG_ENTRIES;
    }

    /// @notice Parse a single garden entry from JSON.
    function _parseGardenConfigFromJson(
        string memory gardensJson,
        string memory basePath,
        uint256 gardenIndex,
        string memory communitySlug
    )
        internal
        view
        returns (GardenToken.GardenConfig memory gardenConfig)
    {
        string memory name = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".name")), (string));
        string memory description = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".description")), (string));
        string memory location = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".location")), (string));
        string memory bannerImage = abi.decode(vm.parseJson(gardensJson, string.concat(basePath, ".bannerImage")), (string));

        string memory slug = _parseOptionalString(gardensJson, string.concat(basePath, ".slug"));
        string memory metadata = _parseOptionalString(gardensJson, string.concat(basePath, ".metadata"));
        bool openJoining = _parseOptionalBool(gardensJson, string.concat(basePath, ".openJoining"), false);

        uint8 domainMask = _slugMatches(slug, communitySlug) ? MAX_DOMAIN_MASK : 0;
        try vm.parseJson(gardensJson, string.concat(basePath, ".domainMask")) returns (bytes memory domainMaskBytes) {
            uint256 parsedDomainMask = abi.decode(domainMaskBytes, (uint256));
            if (parsedDomainMask > MAX_DOMAIN_MASK) {
                revert InvalidSeedGardenDomainMask(gardenIndex, parsedDomainMask);
            }
            domainMask = uint8(parsedDomainMask);
        } catch { }

        address[] memory operators = _parseOptionalAddressArray(gardensJson, string.concat(basePath, ".operators"));
        address[] memory gardeners = _parseOptionalAddressArray(gardensJson, string.concat(basePath, ".gardeners"));

        gardenConfig = GardenToken.GardenConfig({
            name: name,
            slug: slug,
            description: description,
            location: location,
            bannerImage: bannerImage,
            metadata: metadata,
            openJoining: openJoining,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: domainMask,
            gardeners: gardeners,
            operators: operators
        });
    }

    /// @notice Upload actions to IPFS and return hashes
    // solhint-disable-next-line code-complexity
    function _uploadActionsToIPFS(uint256 expectedCount) internal returns (string[] memory) {
        string[] memory inputs = new string[](3);
        inputs[0] = "npx";
        inputs[1] = "tsx";
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
        if (_shouldRunRuntimeChecks() && !_allowActionIPFSFallback()) {
            revert ActionIPFSUploadFailed();
        }

        if (_shouldRunRuntimeChecks()) {
            console.log("WARNING: action IPFS upload mismatch; using fallback instruction CIDs");
        }

        // For simulations and explicitly-enabled broadcast fallback, return placeholders
        // matching the expected count so the loop runs fully.
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

    /// @notice Whether broadcast deploys can fallback when action IPFS upload fails.
    /// @dev Keep strict by default; enable with ALLOW_ACTION_IPFS_FALLBACK=true.
    function _allowActionIPFSFallback() internal view returns (bool) {
        return _envBoolOrDefault("ALLOW_ACTION_IPFS_FALLBACK", false);
    }

    /// @notice Deploy core actions from config
    function _deployCoreActions(string memory json, string[] memory ipfsHashes, uint256 actionsCount) internal {
        if (ipfsHashes.length < actionsCount) revert ActionIPFSUploadFailed();

        for (uint256 i = 0; i < actionsCount && i < MAX_CONFIG_ENTRIES; i++) {
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

    /// @notice Check if dry-run runtime checks are enabled.
    /// @dev Enabled by deploy wrapper for --dry-run runs (no broadcast).
    function _isDryRunChecksEnabled() internal view returns (bool) {
        try vm.envBool("FORGE_DRY_RUN_CHECKS") returns (bool enabled) {
            return enabled;
        } catch {
            return false;
        }
    }

    /// @notice True when full operational checks should execute.
    /// @dev Includes broadcast deployments and explicit dry-run simulations.
    function _shouldRunRuntimeChecks() internal view returns (bool) {
        return _isBroadcasting() || _isDryRunChecksEnabled();
    }

    /// @notice Chains where release-hardening checks are enforced.
    function _isReleaseHardeningChain() internal view returns (bool) {
        return block.chainid == SEPOLIA_CHAIN_ID || block.chainid == ARBITRUM_CHAIN_ID;
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
        for (uint256 i = 0; i < MAX_CONFIG_ENTRIES; i++) {
            string memory basePath = string.concat(".actions[", vm.toString(i), "].title");
            try vm.parseJson(json, basePath) returns (bytes memory titleBytes) {
                if (titleBytes.length == 0) {
                    return i;
                }
            } catch {
                return i;
            }
        }
        return MAX_CONFIG_ENTRIES;
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
        string memory deploymentPath = _chainDeploymentPath(chainIdStr, "-latest.json");

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
        result.ensReceiver = address(ensReceiver);
        result.gardenerAccountLogic = address(0); // DEPRECATED: field kept for JSON compat
        result.gardenerRegistry = address(0); // DEPRECATED: replaced by GreenGoodsENS (CCIP)
        result.guardian = guardianAddress;
        result.accountProxy = accountProxyAddress;
        result.assessmentSchemaUID = assessmentSchemaUID;
        result.workSchemaUID = workSchemaUID;
        result.workApprovalSchemaUID = workApprovalSchemaUID;
        result.rootGardenAddress = rootGardenAddress != address(0)
            ? rootGardenAddress
            : (gardenAddresses.length > 0 ? gardenAddresses[0] : address(0));
        result.rootGardenTokenId =
            rootGardenTokenId != 0 ? rootGardenTokenId : (gardenTokenIds.length > 0 ? gardenTokenIds[0] : 0);
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
            string memory gardensPath = _chainDeploymentPath(chainIdStr, "-gardens.json");

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

        // Core contracts (always deployed)
        _verifyCmd(address(deploymentRegistry), "src/registries/Deployment.sol:Deployment", cid);
        _verifyCmd(address(gardenAccountImpl), "src/accounts/Garden.sol:GardenAccount", cid);
        _verifyCmd(address(gardenToken), "src/tokens/Garden.sol:GardenToken", cid);
        _verifyCmd(address(actionRegistry), "src/registries/Action.sol:ActionRegistry", cid);
        _verifyCmd(address(workResolver), "src/resolvers/Work.sol:WorkResolver", cid);
        _verifyCmd(address(workApprovalResolver), "src/resolvers/WorkApproval.sol:WorkApprovalResolver", cid);
        _verifyCmd(address(assessmentResolver), "src/resolvers/Assessment.sol:AssessmentResolver", cid);
        _verifyCmd(address(hatsModule), "src/modules/Hats.sol:HatsModule", cid);

        // Optional modules (may be zero on some chains)
        _verifyCmd(address(karmaGAPModule), "src/modules/Karma.sol:KarmaGAPModule", cid);
        _verifyCmd(address(octantModule), "src/modules/Octant.sol:OctantModule", cid);
        _verifyCmd(address(gardensModule), "src/modules/Gardens.sol:GardensModule", cid);
        _verifyCmd(address(unifiedPowerRegistry), "src/registries/Power.sol:UnifiedPowerRegistry", cid);
        _verifyCmd(address(yieldSplitter), "src/resolvers/Yield.sol:YieldResolver", cid);
        _verifyCmd(address(cookieJarModule), "src/modules/CookieJar.sol:CookieJarModule", cid);
        _verifyCmd(address(hypercertsModule), "src/modules/Hypercerts.sol:HypercertsModule", cid);
        _verifyCmd(
            address(marketplaceAdapter), "src/markets/HypercertMarketplaceAdapter.sol:HypercertMarketplaceAdapter", cid
        );
        _verifyCmd(address(greenGoodsENS), "src/registries/ENS.sol:GreenGoodsENS", cid);

        console.log("=============================\n");
    }

    /// @notice Emit a single forge verify-contract command, skipping zero addresses
    function _verifyCmd(address addr, string memory sourcePath, string memory chainId) internal view {
        if (addr == address(0)) return;
        console.log(string.concat("forge verify-contract ", vm.toString(addr), " ", sourcePath, " --chain ", chainId));
    }
}
