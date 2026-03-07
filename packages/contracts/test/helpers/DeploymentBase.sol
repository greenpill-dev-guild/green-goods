// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { DeployHelper } from "../../script/DeployHelper.sol";
import { Deployment } from "../../src/registries/Deployment.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { WorkResolver } from "../../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../../src/resolvers/Assessment.sol";
import { ResolverStub } from "../../src/resolvers/ResolverStub.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { KarmaGAPModule } from "../../src/modules/Karma.sol";
import { OctantModule } from "../../src/modules/Octant.sol";
import { GardensModule } from "../../src/modules/Gardens.sol";
import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { CookieJarModule } from "../../src/modules/CookieJar.sol";
import { MockCookieJarFactory } from "./MockCookieJarFactory.sol";
import { YieldResolver } from "../../src/resolvers/Yield.sol";
import { HypercertsModule } from "../../src/modules/Hypercerts.sol";
import { HypercertMarketplaceAdapter } from "../../src/markets/HypercertMarketplaceAdapter.sol";
import { GreenGoodsENS } from "../../src/registries/ENS.sol";
import { GreenGoodsENSReceiver } from "../../src/registries/ENSReceiver.sol";
import { LocalCCIPRouter } from "../../src/mocks/CCIPRouter.sol";
import { IENS } from "../../src/interfaces/IENS.sol";
import { GoodsToken } from "../../src/tokens/Goods.sol";
import { HatsLib } from "../../src/lib/Hats.sol";

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

/// @title DeploymentBase
/// @notice FULL production deployment logic shared by Deploy.s.sol and E2E tests
/// @dev Contains ALL CREATE2, UUPS, Guardian, governance features - exact production deployment
abstract contract DeploymentBase is Test, DeployHelper {
    // ===== ERRORS =====
    error GuardianDeploymentAddressMismatch();
    error GardenAccountDeploymentAddressMismatch();
    error AccountProxyDeploymentAddressMismatch();
    error GardenTokenDeploymentAddressMismatch();
    error ActionRegistryDeploymentAddressMismatch();
    error WorkResolverDeploymentAddressMismatch();
    error WorkApprovalResolverDeploymentAddressMismatch();
    error SchemaNameAttestationFailed();
    error SchemaDescriptionAttestationFailed();
    error UnsupportedChain();

    // ===== SCHEMA CONSTANTS =====
    bytes32 public constant SCHEMA_NAME_SCHEMA = 0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc;
    bytes32 public constant SCHEMA_DESCRIPTION_SCHEMA = 0x21cbc60aac46ba22125ff85dd01882ebe6e87eb4fc46628589931ccbef9b8c94;

    // ===== DEPLOYED CONTRACTS =====
    Deployment public deploymentRegistry;
    GardenAccount public gardenAccountImpl;
    GardenToken public gardenToken;
    ActionRegistry public actionRegistry;
    WorkResolver public workResolver;
    WorkApprovalResolver public workApprovalResolver;
    AssessmentResolver public assessmentResolver;
    HatsModule public hatsModule;
    KarmaGAPModule public karmaGAPModule;
    OctantModule public octantModule;
    GardensModule public gardensModule;
    UnifiedPowerRegistry public unifiedPowerRegistry;
    CookieJarModule public cookieJarModule;
    YieldResolver public yieldSplitter;
    HypercertsModule public hypercertsModule;
    HypercertMarketplaceAdapter public marketplaceAdapter;
    GreenGoodsENS public greenGoodsENS;
    GreenGoodsENSReceiver public ensReceiver;
    GoodsToken public goodsTokenContract;
    address public guardianAddress;
    address public accountProxyAddress;
    // NOTE: gardenerAccountLogic removed — field kept in DeploymentResult for JSON compat

    // Schema UIDs
    bytes32 public workSchemaUID;
    bytes32 public workApprovalSchemaUID;
    bytes32 public assessmentSchemaUID;

    address public deployer;

    /// @notice Deploy stack based on chain type (mainnet ENS vs L2 protocol)
    /// @dev Mainnet: ENS infrastructure only. L2s: Full protocol.
    /// @param communityToken The community token address for the network
    /// @param owner The owner address (msg.sender in scripts, address(this) in tests)
    function deployFullStack(address communityToken, address owner) internal virtual {
        // Set deployer to msg.sender (the calling context)
        deployer = msg.sender;

        // Use owner for contract ownership (can be same as deployer or different)
        address contractOwner = owner != address(0) ? owner : msg.sender;

        uint256 chainId = block.chainid;
        (bytes32 salt, address factory, address tokenboundRegistry) = getDeploymentDefaults();

        // Chain-aware deployment
        if (_isMainnetChain(chainId)) {
            // MAINNET: Only ENS infrastructure
            _deployMainnetENS(contractOwner, salt, factory);
        } else {
            // L2: Full protocol deployment
            _deployL2Protocol(communityToken, contractOwner, salt, factory, tokenboundRegistry);
        }
    }

    /// @notice Check if chain is Ethereum mainnet-only ENS mode
    function _isMainnetChain(uint256 chainId) internal pure returns (bool) {
        return chainId == 1;
    }

    /// @notice Log CREATE2 prediction details for clarity
    function _logCreate2Prediction(string memory label, bytes32 salt, address factory, address predicted) internal view { }

    /// @notice Deploy mainnet ENS infrastructure (GreenGoodsENSReceiver)
    /// @dev Override in Deploy.s.sol when deploying on mainnet
    function _deployMainnetENS(address, bytes32, address) internal virtual {
        // No-op by default: GreenGoodsENSReceiver deployed via Deploy.s.sol override
    }

    /// @notice Deploy full L2 protocol
    function _deployL2Protocol(
        address communityToken,
        address owner,
        bytes32 salt,
        address factory,
        address tokenboundRegistry
    )
        internal
    {
        // Get EAS addresses for current L2 chain
        (address eas, address easSchemaRegistry) = _getEASForChain(block.chainid);

        // 1. Deploy Deployment
        deploymentRegistry = Deployment(deployDeploymentWithGovernance(owner, deployer));

        // 2. Deploy core protocol contracts
        _deployCoreContracts(communityToken, owner, eas, easSchemaRegistry, salt, factory, tokenboundRegistry);

        // 3. Register EAS schemas
        _registerSchemas(eas, easSchemaRegistry);

        // 4. Configure deployment registry
        _configureRegistry(communityToken, eas, easSchemaRegistry);
    }

    /// @notice Deploy L2 core contracts with FULL production features (CREATE2, UUPS, Guardian)
    /// @dev Only for L2 chains - mainnet uses _deployMainnetENS instead.
    ///      Split into three sub-functions to avoid Yul stack-too-deep in via_ir compilation.
    function _deployCoreContracts(
        address, /* communityToken */
        address owner,
        address eas,
        address, /* easSchemaRegistry */
        bytes32 salt,
        address factory,
        address tokenboundRegistry
    )
        internal
        virtual
    {
        _deployCorePart1(owner, eas, salt, factory, tokenboundRegistry);
        _deployCorePart2(owner, salt, factory);
        _wireModules();
    }

    /// @notice Deploy core infrastructure: Guardian, ActionRegistry, Resolvers, Hats, Account, Token
    function _deployCorePart1(
        address owner,
        address eas,
        bytes32 salt,
        address factory,
        address tokenboundRegistry
    )
        internal
        virtual
    {
        (address entryPoint, address multicallForwarder,) = _getNetworkAddresses();

        // 1. Deploy Guardian with CREATE2
        guardianAddress = deployGuardian(owner, salt, factory);

        // 2. Deploy ActionRegistry with CREATE2 + proxy (owner will own it)
        actionRegistry = ActionRegistry(deployActionRegistry(owner, salt, factory));

        // 4. Deploy resolvers with UUPS proxies + CREATE2 (owner will own them)
        workResolver = WorkResolver(payable(_deployWorkResolver(eas, address(actionRegistry), owner, salt, factory)));
        workApprovalResolver =
            WorkApprovalResolver(payable(_deployWorkApprovalResolver(eas, address(actionRegistry), owner, salt, factory)));
        assessmentResolver = AssessmentResolver(payable(_deployAssessmentResolver(eas, owner, salt, factory)));

        // 4.5 Deploy HatsModule (adapter)
        hatsModule = HatsModule(_deployHatsModule(owner, HatsLib.getHatsProtocol(), salt, factory));

        // 5. Deploy GardenAccount (TBA) with CREATE2
        gardenAccountImpl = GardenAccount(
            payable(
                deployGardenAccount(
                    entryPoint,
                    multicallForwarder,
                    tokenboundRegistry,
                    guardianAddress,
                    address(workApprovalResolver),
                    address(assessmentResolver),
                    salt,
                    factory
                )
            )
        );

        // 6. Deploy AccountProxy with CREATE2
        accountProxyAddress = deployAccountProxy(guardianAddress, address(gardenAccountImpl), salt, factory);

        // 7. Deploy GardenToken with CREATE2 + proxy (owner will own it)
        gardenToken =
            GardenToken(deployGardenToken(address(gardenAccountImpl), owner, address(deploymentRegistry), salt, factory));
    }

    /// @notice Deploy extension modules: Karma, Octant, Power, Gardens, Yield, CookieJar, Hypercerts, ENS, Goods
    function _deployCorePart2(address owner, bytes32 salt, address factory) internal virtual {
        // 8. Deploy KarmaGAPModule (after GardenToken exists)
        karmaGAPModule = KarmaGAPModule(
            _deployKarmaGAPModule(
                owner, address(gardenToken), address(workApprovalResolver), address(assessmentResolver), salt, factory
            )
        );

        // 9. Deploy OctantModule (factory configured post-deployment if available)
        octantModule = OctantModule(_deployOctantModule(owner, address(0), salt, factory));

        // 10a. Deploy UnifiedPowerRegistry with UUPS proxy
        unifiedPowerRegistry = UnifiedPowerRegistry(
            _deployUnifiedPowerRegistry(
                owner,
                HatsLib.getHatsProtocol(),
                address(0), // gardensModule — wired after GardensModule deployment
                salt,
                factory
            )
        );

        // 10b. Deploy GardensModule (registryFactory is address(0) for testnet, powerRegistry wired after)
        gardensModule = GardensModule(
            _deployGardensModule(
                owner,
                address(0), // registryFactory — Gardens V2 not deployed on all chains yet
                address(unifiedPowerRegistry), // unified power registry
                address(0), // goodsToken — configured post-deployment when available
                HatsLib.getHatsProtocol(),
                address(hatsModule),
                salt,
                factory
            )
        );

        // 11. Deploy YieldResolver ($7 threshold = 7e18 for 18-decimal stablecoins)
        yieldSplitter =
            YieldResolver(_deployYieldResolver(owner, address(octantModule), address(hatsModule), 7e18, salt, factory));

        // 12. Deploy CookieJarModule (prefer real CookieJarFactory on forked networks)
        address cookieJarFactory = _getCookieJarFactoryForChain(block.chainid);
        if (cookieJarFactory == address(0)) {
            MockCookieJarFactory mockJarFactory = new MockCookieJarFactory();
            cookieJarFactory = address(mockJarFactory);
        }
        cookieJarModule = CookieJarModule(
            _deployCookieJarModule(
                owner,
                address(hatsModule),
                address(yieldSplitter),
                cookieJarFactory,
                HatsLib.getHatsProtocol(),
                salt,
                factory
            )
        );

        // 13. Deploy HypercertMarketplaceAdapter (after YieldResolver)
        marketplaceAdapter =
            HypercertMarketplaceAdapter(_deployMarketplaceAdapter(owner, address(0), address(0), salt, factory));

        // 14. Deploy HypercertsModule (after adapter + GardensModule)
        hypercertsModule = HypercertsModule(
            _deployHypercertsModule(
                owner,
                address(0), // hypercertMinter — configured post-deployment
                address(marketplaceAdapter),
                address(gardensModule),
                address(hatsModule),
                address(gardenToken),
                salt,
                factory
            )
        );

        // 15. Deploy GreenGoodsENS (L2 CCIP sender) — graceful skip if CCIP not configured
        _deployAndWireENS(owner);

        // 15b. Deploy GoodsToken (standalone ERC-20 for community staking)
        // Owner starts as deployer, ownership transferred to GardensModule after wiring
        goodsTokenContract = new GoodsToken("Green Goods", "GOODS", owner, 0, 10_000_000e18);
    }

    /// @notice Wire all module cross-references after deployment
    function _wireModules() internal virtual {
        hatsModule.setGardenToken(address(gardenToken));
        hatsModule.setKarmaGAPModule(address(karmaGAPModule));
        gardenToken.setHatsModule(address(hatsModule));
        gardenToken.setKarmaGAPModule(address(karmaGAPModule));
        gardenToken.setOctantModule(address(octantModule));
        gardenToken.setGardensModule(address(gardensModule));
        gardenToken.setActionRegistry(address(actionRegistry));
        actionRegistry.setGardenToken(address(gardenToken));
        actionRegistry.setHatsModule(address(hatsModule));
        octantModule.setGardenToken(address(gardenToken));
        gardensModule.setGardenToken(address(gardenToken));
        // Wire GOODS token: set on GardensModule, then transfer ownership so it can mint
        gardensModule.setGoodsToken(address(goodsTokenContract));
        goodsTokenContract.transferOwnership(address(gardensModule));
        unifiedPowerRegistry.setGardensModule(address(gardensModule));
        hatsModule.setGardensModule(address(gardensModule));
        karmaGAPModule.setHatsModule(address(hatsModule));
        workApprovalResolver.setKarmaGAPModule(address(karmaGAPModule));
        assessmentResolver.setKarmaGAPModule(address(karmaGAPModule));
        // CookieJarModule wiring
        if (address(cookieJarModule) != address(0)) {
            cookieJarModule.setGardenToken(address(gardenToken));
            gardenToken.setCookieJarModule(address(cookieJarModule));
            yieldSplitter.setCookieJarModule(address(cookieJarModule));
        }
        // Wire OctantModule → YieldResolver (for share registration during harvest)
        octantModule.setYieldResolver(address(yieldSplitter));
        // HypercertMarketplaceAdapter wiring
        if (address(marketplaceAdapter) != address(0)) {
            yieldSplitter.setHypercertMarketplace(address(marketplaceAdapter));
            marketplaceAdapter.setAuthorizedModule(address(hypercertsModule), true);
        }
        // ENS module wiring (if deployed)
        if (address(greenGoodsENS) != address(0)) {
            gardenToken.setENSModule(address(greenGoodsENS));
            greenGoodsENS.setAuthorizedCaller(address(gardenToken), true);
        }
        // NOTE: Per-garden donation address is set by operators post-deployment:
        //   octantModule.setDonationAddress(garden, address(yieldSplitter));
        // The YieldResolver's octantModule address is set at initialization (step 11 above).
    }

    /// @notice Deploy Deployment with governance and proxy
    function deployDeploymentWithGovernance(address initialOwner, address _deployer) public returns (address) {
        Deployment implementation = new Deployment();
        // Initialize with initialOwner as the contract owner
        bytes memory initData = abi.encodeWithSelector(Deployment.initialize.selector, initialOwner);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Add deployer to allowlist if different from owner
        if (_deployer != initialOwner) {
            // solhint-disable-next-line no-empty-blocks
            try Deployment(address(proxy)).addToAllowlist(_deployer) {
                // Success - deployer added to allowlist
                // solhint-disable-next-line no-empty-blocks
            } catch {
                // Ignore failure - deployment continues
            }
        }

        return address(proxy);
    }

    /// @notice Deploy Guardian with CREATE2 deterministic deployment
    function deployGuardian(address greenGoodsSafe, bytes32 salt, address factory) public returns (address) {
        bytes memory bytecode = abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(greenGoodsSafe));
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);
        _logCreate2Prediction("Guardian", salt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(bytecode, salt, factory);
            if (deployed != predicted) {
                revert GuardianDeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy GardenAccount with CREATE2
    function deployGardenAccount(
        address entryPoint,
        address multicallForwarder,
        address tokenRegistry,
        address guardian,
        address _workApprovalResolver,
        address _assessmentResolver,
        bytes32 salt,
        address factory
    )
        public
        returns (address)
    {
        bytes memory bytecode = abi.encodePacked(
            type(GardenAccount).creationCode,
            abi.encode(entryPoint, multicallForwarder, tokenRegistry, guardian, _workApprovalResolver, _assessmentResolver)
        );
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);
        _logCreate2Prediction("GardenAccount implementation", salt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(bytecode, salt, factory);
            if (deployed != predicted) {
                revert GardenAccountDeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy AccountProxy with CREATE2
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
        _logCreate2Prediction("AccountProxy", salt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(bytecode, salt, factory);
            if (deployed != predicted) {
                revert AccountProxyDeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy GardenToken with CREATE2 + proxy
    function deployGardenToken(
        address implementation,
        address owner,
        address _deploymentRegistry,
        bytes32 salt,
        address factory
    )
        public
        returns (address)
    {
        GardenToken gardenTokenImpl = new GardenToken(implementation);
        // Initialize with owner so they can manage the token
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, owner, _deploymentRegistry);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(gardenTokenImpl), initData));
        address predicted = Create2.computeAddress(salt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("GardenToken proxy", salt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, salt, factory);
            if (deployed != predicted) {
                revert GardenTokenDeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy ActionRegistry with CREATE2 + proxy
    function deployActionRegistry(address owner, bytes32 salt, address factory) public returns (address) {
        ActionRegistry actionRegistryImpl = new ActionRegistry();
        // Initialize with owner so they can manage the registry
        bytes memory initData = abi.encodeWithSelector(ActionRegistry.initialize.selector, owner);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(actionRegistryImpl), initData));
        address predicted = Create2.computeAddress(salt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("ActionRegistry proxy", salt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, salt, factory);
            if (deployed != predicted) {
                revert ActionRegistryDeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy HatsModule with CREATE2 + proxy
    function _deployHatsModule(
        address owner,
        address hatsProtocol,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        HatsModule hatsImpl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, owner, hatsProtocol);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(hatsImpl), initData));
        bytes32 hatsSalt = keccak256(abi.encodePacked(salt, "HatsModuleProxy"));
        address predicted = Create2.computeAddress(hatsSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("HatsModule proxy", hatsSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, hatsSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy KarmaGAPModule with CREATE2 + proxy
    function _deployKarmaGAPModule(
        address owner,
        address _gardenToken,
        address _workApprovalResolver,
        address _assessmentResolver,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        KarmaGAPModule karmaImpl = new KarmaGAPModule();
        bytes memory initData = abi.encodeWithSelector(
            KarmaGAPModule.initialize.selector, owner, _gardenToken, _workApprovalResolver, _assessmentResolver
        );
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(karmaImpl), initData));
        bytes32 karmaSalt = keccak256(abi.encodePacked(salt, "KarmaGAPModuleProxy"));
        address predicted = Create2.computeAddress(karmaSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("KarmaGAPModule proxy", karmaSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, karmaSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy OctantModule with CREATE2 + proxy
    function _deployOctantModule(
        address owner,
        address octantFactoryAddress,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        OctantModule octantImpl = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, owner, octantFactoryAddress, 7 days);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(octantImpl), initData));
        bytes32 octantSalt = keccak256(abi.encodePacked(salt, "OctantModuleProxy"));
        address predicted = Create2.computeAddress(octantSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("OctantModule proxy", octantSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, octantSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy UnifiedPowerRegistry with CREATE2 + proxy
    function _deployUnifiedPowerRegistry(
        address owner,
        address _hatsProtocol,
        address _gardensModule,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        UnifiedPowerRegistry registryImpl = new UnifiedPowerRegistry();
        bytes memory initData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, owner, _hatsProtocol, _gardensModule);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(registryImpl), initData));
        bytes32 registrySalt = keccak256(abi.encodePacked(salt, "UnifiedPowerRegistryProxy"));
        address predicted = Create2.computeAddress(registrySalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("UnifiedPowerRegistry proxy", registrySalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, registrySalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy GardensModule with CREATE2 + proxy
    function _deployGardensModule(
        address owner,
        address _registryFactory,
        address _powerRegistry,
        address _goodsToken,
        address _hatsProtocol,
        address _hatsModule,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        GardensModule gardensImpl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            _registryFactory,
            _powerRegistry,
            _goodsToken,
            _hatsProtocol,
            _hatsModule
        );
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(gardensImpl), initData));
        bytes32 gardensSalt = keccak256(abi.encodePacked(salt, "GardensModuleProxy"));
        address predicted = Create2.computeAddress(gardensSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("GardensModule proxy", gardensSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, gardensSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy YieldResolver with CREATE2 + proxy
    function _deployYieldResolver(
        address owner,
        address _octantModule,
        address _hatsModule,
        uint256 _minYieldThreshold,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        YieldResolver yieldImpl = new YieldResolver();
        bytes memory initData =
            abi.encodeWithSelector(YieldResolver.initialize.selector, owner, _octantModule, _hatsModule, _minYieldThreshold);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(yieldImpl), initData));
        bytes32 yieldSalt = keccak256(abi.encodePacked(salt, "YieldResolverProxy"));
        address predicted = Create2.computeAddress(yieldSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("YieldResolver proxy", yieldSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, yieldSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy CookieJarModule with CREATE2 + proxy
    /// @dev Requires a pre-deployed CookieJarFactory address (from sibling cookie-jar repo)
    function _deployCookieJarModule(
        address owner,
        address _hatsModule,
        address _yieldSplitter,
        address _cookieJarFactory,
        address _hatsProtocol,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        // Deploy CookieJarModule with proxy
        CookieJarModule cookieJarImpl = new CookieJarModule();
        // Empty supported assets array — configured post-deployment per chain
        address[] memory emptyAssets = new address[](0);
        bytes memory initData = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            owner,
            _hatsModule,
            _yieldSplitter,
            _cookieJarFactory,
            _hatsProtocol,
            emptyAssets
        );
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(cookieJarImpl), initData));
        bytes32 cookieJarSalt = keccak256(abi.encodePacked(salt, "CookieJarModuleProxy"));
        address predicted = Create2.computeAddress(cookieJarSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("CookieJarModule proxy", cookieJarSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, cookieJarSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy HypercertMarketplaceAdapter with CREATE2 + proxy
    function _deployMarketplaceAdapter(
        address owner,
        address _exchange,
        address _hypercertMinter,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        HypercertMarketplaceAdapter adapterImpl = new HypercertMarketplaceAdapter();
        bytes memory initData =
            abi.encodeWithSelector(HypercertMarketplaceAdapter.initialize.selector, owner, _exchange, _hypercertMinter);
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(adapterImpl), initData));
        bytes32 adapterSalt = keccak256(abi.encodePacked(salt, "MarketplaceAdapterProxy"));
        address predicted = Create2.computeAddress(adapterSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("HypercertMarketplaceAdapter proxy", adapterSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, adapterSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy HypercertsModule with CREATE2 + proxy
    function _deployHypercertsModule(
        address owner,
        address _hypercertMinter,
        address _marketplaceAdapter,
        address _gardensModule,
        address _hatsModule,
        address _gardenToken,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        HypercertsModule hypercertsImpl = new HypercertsModule();
        bytes memory initData = abi.encodeWithSelector(
            HypercertsModule.initialize.selector,
            owner,
            _hypercertMinter,
            _marketplaceAdapter,
            _gardensModule,
            _hatsModule,
            _gardenToken
        );
        bytes memory proxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(hypercertsImpl), initData));
        bytes32 hypercertsSalt = keccak256(abi.encodePacked(salt, "HypercertsModuleProxy"));
        address predicted = Create2.computeAddress(hypercertsSalt, keccak256(proxyBytecode), factory);
        _logCreate2Prediction("HypercertsModule proxy", hypercertsSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(proxyBytecode, hypercertsSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
        }

        return predicted;
    }

    /// @notice Deploy WorkResolver with ResolverStub + UUPS + CREATE2
    function _deployWorkResolver(
        address eas,
        address _actionRegistry,
        address owner,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        WorkResolver implementation = new WorkResolver(eas, _actionRegistry);
        bytes32 stubSalt = keccak256(abi.encodePacked(salt, "ResolverStub"));
        bytes memory stubBytecode = type(ResolverStub).creationCode;
        address stubAddress = _deployCreate2(stubBytecode, stubSalt, factory);
        _logCreate2Prediction("WorkResolver stub", stubSalt, factory, stubAddress);

        bytes32 resolverSalt = keccak256(abi.encodePacked(salt, "WorkResolverProxy"));
        // Initialize with owner so they can manage the contract
        bytes memory stubInitData = abi.encodeWithSelector(ResolverStub.initialize.selector, owner);
        bytes memory fullProxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(stubAddress, stubInitData));
        address predicted = Create2.computeAddress(resolverSalt, keccak256(fullProxyBytecode), factory);
        _logCreate2Prediction("WorkResolver proxy", resolverSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(fullProxyBytecode, resolverSalt, factory);
            if (deployed != predicted) {
                revert WorkResolverDeploymentAddressMismatch();
            }
            UUPSUpgradeable(deployed).upgradeTo(address(implementation));
        }

        return predicted;
    }

    /// @notice Deploy WorkApprovalResolver with ResolverStub + UUPS + CREATE2
    function _deployWorkApprovalResolver(
        address eas,
        address _actionRegistry,
        address owner,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        WorkApprovalResolver implementation = new WorkApprovalResolver(eas, _actionRegistry);
        bytes32 stubSalt = keccak256(abi.encodePacked(salt, "ResolverStub"));
        bytes memory stubBytecode = type(ResolverStub).creationCode;
        address stubAddress = Create2.computeAddress(stubSalt, keccak256(stubBytecode), factory);

        if (!_isDeployed(stubAddress)) {
            _deployCreate2(stubBytecode, stubSalt, factory);
        }
        _logCreate2Prediction("WorkApprovalResolver stub", stubSalt, factory, stubAddress);

        bytes32 approvalResolverSalt = keccak256(abi.encodePacked(salt, "WorkApprovalResolverProxy"));
        // Initialize with owner so they can manage the contract
        bytes memory stubInitData = abi.encodeWithSelector(ResolverStub.initialize.selector, owner);
        bytes memory fullProxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(stubAddress, stubInitData));
        address predicted = Create2.computeAddress(approvalResolverSalt, keccak256(fullProxyBytecode), factory);
        _logCreate2Prediction("WorkApprovalResolver proxy", approvalResolverSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(fullProxyBytecode, approvalResolverSalt, factory);
            if (deployed != predicted) {
                revert WorkApprovalResolverDeploymentAddressMismatch();
            }
            UUPSUpgradeable(deployed).upgradeTo(address(implementation));
        }

        return predicted;
    }

    /// @notice Deploy AssessmentResolver with ResolverStub + UUPS + CREATE2
    function _deployAssessmentResolver(
        address eas,
        address owner,
        bytes32 salt,
        address factory
    )
        internal
        returns (address)
    {
        AssessmentResolver implementation = new AssessmentResolver(eas);
        bytes32 stubSalt = keccak256(abi.encodePacked(salt, "ResolverStub"));
        bytes memory stubBytecode = type(ResolverStub).creationCode;
        address stubAddress = Create2.computeAddress(stubSalt, keccak256(stubBytecode), factory);

        if (!_isDeployed(stubAddress)) {
            _deployCreate2(stubBytecode, stubSalt, factory);
        }
        _logCreate2Prediction("AssessmentResolver stub", stubSalt, factory, stubAddress);

        bytes32 assessmentResolverSalt = keccak256(abi.encodePacked(salt, "AssessmentResolverProxy"));
        // Initialize with owner so they can manage the contract
        bytes memory stubInitData = abi.encodeWithSelector(ResolverStub.initialize.selector, owner);
        bytes memory fullProxyBytecode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(stubAddress, stubInitData));
        address predicted = Create2.computeAddress(assessmentResolverSalt, keccak256(fullProxyBytecode), factory);
        _logCreate2Prediction("AssessmentResolver proxy", assessmentResolverSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(fullProxyBytecode, assessmentResolverSalt, factory);
            if (deployed != predicted) {
                revert DeploymentAddressMismatch();
            }
            UUPSUpgradeable(deployed).upgradeTo(address(implementation));
        }

        return predicted;
    }

    /// @notice Register EAS schemas with name/description attestations
    function _registerSchemas(address eas, address easSchemaRegistry) internal virtual {
        string memory schemaJson = _loadSchemaConfig();
        ISchemaRegistry registry = ISchemaRegistry(easSchemaRegistry);
        IEAS easContract = IEAS(eas);

        workSchemaUID =
            registry.register(_generateSchemaString("work"), address(workResolver), _getSchemaRevocable(schemaJson, "work"));

        workApprovalSchemaUID = registry.register(
            _generateSchemaString("workApproval"),
            address(workApprovalResolver),
            _getSchemaRevocable(schemaJson, "workApproval")
        );

        assessmentSchemaUID = registry.register(
            _generateSchemaString("assessment"), address(assessmentResolver), _getSchemaRevocable(schemaJson, "assessment")
        );

        // Create name attestations (always)
        _createSchemaNameAttestation(easContract, workSchemaUID, _getSchemaName(schemaJson, "work"));
        _createSchemaNameAttestation(easContract, workApprovalSchemaUID, _getSchemaName(schemaJson, "workApproval"));
        _createSchemaNameAttestation(easContract, assessmentSchemaUID, _getSchemaName(schemaJson, "assessment"));

        // Description attestations: only on Sepolia
        // Schema description schema (0x21cbc6...) only exists on Sepolia, not other networks
        if (block.chainid == 11_155_111) {
            _createSchemaDescriptionAttestation(easContract, workSchemaUID, _getSchemaDescription(schemaJson, "work"));
            _createSchemaDescriptionAttestation(
                easContract, workApprovalSchemaUID, _getSchemaDescription(schemaJson, "workApproval")
            );
            _createSchemaDescriptionAttestation(
                easContract, assessmentSchemaUID, _getSchemaDescription(schemaJson, "assessment")
            );
        }
    }

    /// @notice Check if a schema exists in the registry (lightweight check)
    /// @dev Uses low-level staticcall to avoid memory allocation issues during simulation
    function _schemaExists(address easSchemaRegistry, bytes32 schemaUID) internal view returns (bool) {
        // Use low-level staticcall to avoid memory allocation issues
        (bool success,) = easSchemaRegistry.staticcall(abi.encodeWithSignature("getSchema(bytes32)", schemaUID));
        return success;
    }

    /// @notice Configure deployment registry
    function _configureRegistry(address communityToken, address eas, address easSchemaRegistry) internal virtual {
        Deployment.NetworkConfig memory config = Deployment.NetworkConfig({
            eas: eas,
            easSchemaRegistry: easSchemaRegistry,
            communityToken: communityToken,
            actionRegistry: address(actionRegistry),
            gardenToken: address(gardenToken),
            workResolver: address(workResolver),
            workApprovalResolver: address(workApprovalResolver),
            assessmentResolver: address(assessmentResolver),
            integrationRouter: address(0), // Deployed separately in Phase 1
            hatsAccessControl: address(hatsModule),
            octantFactory: address(0), // Phase 3+
            unlockFactory: address(0), // Phase 3+
            hypercerts: address(0), // Phase 4+
            greenWillRegistry: address(0) // Phase 5+
         });

        deploymentRegistry.setNetworkConfig(block.chainid, config);
    }

    /// @notice Get network-specific addresses
    function _getNetworkAddresses()
        internal
        pure
        virtual
        returns (address entryPoint, address multicallForwarder, address tokenboundRegistry)
    {
        entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        multicallForwarder = 0xcA11bde05977b3631167028862bE2a173976CA11;
        tokenboundRegistry = 0x000000006551c19487814612e58FE06813775758;
    }

    /// @notice Deploy GreenGoodsENS L2 sender and wire to GardenToken
    /// @dev Sepolia: deploys both sender + receiver on same chain with LocalCCIPRouter.
    ///      L2 chains (Arbitrum): deploys sender only, receiver deployed separately on L1.
    ///      Gracefully skips if CCIP is not configured for this chain (ccipRouter == address(0)).
    function _deployAndWireENS(address owner) internal virtual {
        // Sepolia: deploy both sender + receiver on same chain with local CCIP router
        if (block.chainid == 11_155_111) {
            _deploySepoliaENS(owner);
            return;
        }

        (address ccipRouter, uint64 ethereumChainSelector) = _getCCIPForChain(block.chainid);

        // Skip if CCIP not configured (localhost, chains without ENS support)
        if (ccipRouter == address(0)) return;

        // Get protocolHatId for membership gating (0 if chain doesn't support Hats)
        uint256 protocolHatId = 0;
        if (HatsLib.isSupported()) {
            protocolHatId = HatsLib.getProtocolGardenersHatId();
        }

        // L1 receiver from env (cross-chain chicken-and-egg: set when deploying after L1)
        address l1Receiver = _getENSL1Receiver();

        greenGoodsENS = new GreenGoodsENS(
            ccipRouter, ethereumChainSelector, l1Receiver, HatsLib.getHatsProtocol(), protocolHatId, owner
        );

        // Fund for sponsored claims (passkey users). Default 0.01 ETH, overridable via env.
        _fundENSSponsor();
    }

    /// @notice Deploy full ENS stack on Sepolia (sender + receiver + local CCIP router)
    /// @dev Sepolia has real ENS registry support, but CCIP doesn't support same-chain lanes.
    ///      LocalCCIPRouter synchronously relays messages from sender → receiver within one tx.
    ///      Prerequisite: deployer must own greengoods.eth (or ENS_BASE_NODE) on Sepolia ENS.
    function _deploySepoliaENS(address owner) internal {
        uint64 chainSelector = 16_015_286_601_757_825_753; // Sepolia CCIP chain selector

        // 1. Deploy local CCIP router (same-chain synchronous relay)
        LocalCCIPRouter localRouter = new LocalCCIPRouter(chainSelector);

        // 2. Deploy ENS receiver with real Sepolia ENS registry
        (address ensRegistry, address ensResolver) = _getENSRegistryForChain(11_155_111);
        bytes32 baseNode = _getENSBaseNode();

        ensReceiver = new GreenGoodsENSReceiver(
            address(localRouter),
            chainSelector, // Expected source chain selector (same chain on Sepolia)
            address(0), // l2Sender — set after deploying sender below
            ensRegistry,
            ensResolver,
            baseNode,
            owner
        );

        // Approve receiver as ENS operator (deployer must own the base ENS name on Sepolia)
        IENS(ensRegistry).setApprovalForAll(address(ensReceiver), true);

        // 3. Deploy ENS sender
        uint256 protocolHatId = 0;
        if (HatsLib.isSupported()) {
            protocolHatId = HatsLib.getProtocolGardenersHatId();
        }

        greenGoodsENS = new GreenGoodsENS(
            address(localRouter),
            chainSelector,
            address(ensReceiver), // L1 receiver is on same chain
            HatsLib.getHatsProtocol(),
            protocolHatId,
            owner
        );

        // 4. Wire receiver ← sender (completes the bidirectional link)
        ensReceiver.setL2Sender(address(greenGoodsENS));

        // 5. Fund for sponsored claims
        _fundENSSponsor();
    }

    /// @notice Get ENS sponsor fund amount from env (default 0.01 ETH)
    function _getENSSponsorFund() internal view virtual returns (uint256) {
        try vm.envUint("ENS_SPONSOR_FUND") returns (uint256 fund) {
            return fund;
        } catch {
            return 0.01 ether;
        }
    }

    /// @notice Fund GreenGoodsENS for sponsored claims (passkey users)
    /// @dev Default 0.01 ETH, overridable via ENS_SPONSOR_FUND env var
    function _fundENSSponsor() internal {
        uint256 sponsorFund = _getENSSponsorFund();
        if (sponsorFund > 0 && address(this).balance >= sponsorFund) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool sent,) = address(greenGoodsENS).call{ value: sponsorFund }("");
            if (!sent) {
                // Non-blocking — log warning but don't fail deployment
            }
        }
    }

    /// @notice Get L1 ENS receiver address from env (default address(0) = wire later)
    function _getENSL1Receiver() internal view virtual returns (address) {
        try vm.envAddress("ENS_L1_RECEIVER") returns (address parsed) {
            return parsed;
        } catch {
            return address(0);
        }
    }

    /// @notice Get ENS registry and resolver addresses for a chain
    /// @dev Must stay in sync with deployments/networks.json ENS config.
    ///      ENS registry is the same on mainnet and Sepolia. Resolver differs.
    function _getENSRegistryForChain(uint256 chainId) internal pure virtual returns (address registry, address resolver) {
        address ensRegistry = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

        if (chainId == 1) {
            return (ensRegistry, 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63);
        } else if (chainId == 11_155_111) {
            return (ensRegistry, 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD);
        }
        // No ENS support on this chain
        return (address(0), address(0));
    }

    /// @notice Get ENS base node (namehash of the parent domain, e.g. greengoods.eth)
    /// @dev Override via ENS_BASE_NODE env var to test with a different domain
    function _getENSBaseNode() internal view virtual returns (bytes32) {
        try vm.envBytes32("ENS_BASE_NODE") returns (bytes32 node) {
            return node;
        } catch {
            // namehash("greengoods.eth")
            return 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;
        }
    }

    /// @notice Get CCIP router and Ethereum chain selector for a chain
    /// @dev Returns (address(0), 0) for chains without CCIP support (graceful skip)
    function _getCCIPForChain(uint256 chainId)
        internal
        pure
        virtual
        returns (address ccipRouter, uint64 ethereumChainSelector)
    {
        // Ethereum mainnet chain selector (destination for all L2 → L1 ENS registrations)
        uint64 ethMainnetSelector = 5_009_297_550_715_157_269;

        if (chainId == 42_161) {
            // Arbitrum One
            return (0x141fa059441E0ca23ce184B6A78bafD2A517DdE8, ethMainnetSelector);
        } else if (chainId == 11_155_111) {
            // Sepolia: real CCIP router (used by fork tests for fee estimation).
            // Deployment uses LocalCCIPRouter instead — see _deploySepoliaENS().
            return (0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59, 16_015_286_601_757_825_753);
        }
        // Celo, localhost, unknown chains: no CCIP support
        return (address(0), 0);
    }

    /// @notice Resolve CookieJarFactory for fork tests
    /// @dev Priority:
    ///      1) COOKIE_JAR_FACTORY_ADDRESS env override
    ///      2) chain defaults sourced from sibling cookie-jar repo broadcasts
    ///      3) address(0) => caller falls back to MockCookieJarFactory
    function _getCookieJarFactoryForChain(uint256 chainId) internal view returns (address factory) {
        try vm.envAddress("COOKIE_JAR_FACTORY_ADDRESS") returns (address envFactory) {
            if (envFactory != address(0)) return envFactory;
        } catch { }

        // Deployed addresses from ../cookie-jar/contracts/broadcast/Deploy.s.sol/{chainId}/run-latest.json
        if (chainId == 42_161) return 0x294d222eDE6DF6625B43544F1C634322467528Da; // Arbitrum (upgradeable proxy)
        if (chainId == 11_155_111) return 0x021368bf9958f4D535d39d571Bc45f74d20e4666; // Sepolia

        return address(0);
    }

    /// @notice Get EAS addresses for a chain
    /// @dev These addresses MUST stay in sync with deployments/networks.json.
    ///      The pure lookup avoids an extra vm.readFile in the hot path, but any
    ///      new chain added to networks.json must also be added here.
    function _getEASForChain(uint256 chainId) internal pure virtual returns (address eas, address registry) {
        if (chainId == 11_155_111) {
            return (0xC2679fBD37d54388Ce493F1DB75320D236e1815e, 0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0);
        } else if (chainId == 42_161) {
            return (0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458, 0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB);
        } else if (chainId == 42_220) {
            return (0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92, 0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34);
        }
        revert UnsupportedChain();
    }
    /// @notice Load schema config from file

    function _loadSchemaConfig() internal view virtual returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/config/schemas.json"));
    }

    /// @notice Get schema revocable flag
    function _getSchemaRevocable(string memory json, string memory schemaName) internal view virtual returns (bool) {
        bytes memory data = vm.parseJson(json, string.concat(".schemas.", schemaName, ".revocable"));
        return abi.decode(data, (bool));
    }

    /// @notice Get schema name
    function _getSchemaName(string memory json, string memory schemaName) internal view virtual returns (string memory) {
        bytes memory data = vm.parseJson(json, string.concat(".schemas.", schemaName, ".name"));
        return abi.decode(data, (string));
    }

    /// @notice Get schema description
    function _getSchemaDescription(
        string memory json,
        string memory schemaName
    )
        internal
        view
        virtual
        returns (string memory)
    {
        bytes memory data = vm.parseJson(json, string.concat(".schemas.", schemaName, ".description"));
        return abi.decode(data, (string));
    }

    /// @notice Create schema name attestation
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
            revert SchemaNameAttestationFailed();
        }
    }

    /// @notice Create schema description attestation
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
            revert SchemaDescriptionAttestationFailed();
        }
    }
}
