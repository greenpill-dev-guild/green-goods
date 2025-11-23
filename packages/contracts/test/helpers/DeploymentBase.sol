// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { DeployHelper } from "../../script/DeployHelper.sol";
import { DeploymentRegistry } from "../../src/DeploymentRegistry.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { Gardener } from "../../src/accounts/Gardener.sol";
import { ENSRegistrar } from "../../src/registries/ENSRegistrar.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { WorkResolver } from "../../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../../src/resolvers/Assessment.sol";
import { ResolverStub } from "../../src/resolvers/ResolverStub.sol";

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
    error ENSRegistrarDeploymentAddressMismatch();

    // ===== SCHEMA CONSTANTS =====
    bytes32 public constant SCHEMA_NAME_SCHEMA = 0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc;
    bytes32 public constant SCHEMA_DESCRIPTION_SCHEMA = 0x21cbc60aac46ba22125ff85dd01882ebe6e87eb4fc46628589931ccbef9b8c94;

    // ===== DEPLOYED CONTRACTS =====
    DeploymentRegistry public deploymentRegistry;
    GardenAccount public gardenAccountImpl;
    GardenToken public gardenToken;
    ActionRegistry public actionRegistry;
    WorkResolver public workResolver;
    WorkApprovalResolver public workApprovalResolver;
    AssessmentResolver public assessmentResolver;
    address public gardenerAccountLogic; // Gardener implementation for user smart accounts (Kernel v3)
    ENSRegistrar public ensRegistrar; // ENS Registrar (mainnet/sepolia only, null on L2s)

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

    /// @notice Check if chain is mainnet (supports ENS)
    function _isMainnetChain(uint256 chainId) internal pure returns (bool) {
        return chainId == 1 || chainId == 11_155_111; // Mainnet or Sepolia
    }

    /// @notice Log CREATE2 prediction details for clarity
    function _logCreate2Prediction(string memory label, bytes32 salt, address factory, address predicted) internal view {
        console.log("CREATE2 target:", label);
        console.log("  predicted", predicted);
    }

    /// @notice Deploy mainnet ENS infrastructure only
    function _deployMainnetENS(address owner, bytes32 salt, address factory) internal {
        (address entryPoint,,) = _getNetworkAddresses();

        // 1. Deploy ENSRegistrar (mainnet only)
        _deployENSRegistrar(owner, salt, factory);

        // 2. Deploy Gardener logic (same across all chains)
        gardenerAccountLogic = address(new Gardener(IEntryPoint(entryPoint)));
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

        // 1. Deploy DeploymentRegistry
        deploymentRegistry = DeploymentRegistry(deployDeploymentRegistryWithGovernance(owner, deployer));

        // 2. Deploy core protocol contracts
        _deployCoreContracts(communityToken, owner, eas, easSchemaRegistry, salt, factory, tokenboundRegistry);

        // 3. Register EAS schemas
        _registerSchemas(eas, easSchemaRegistry);

        // 4. Configure deployment registry
        _configureRegistry(communityToken, eas, easSchemaRegistry);
    }

    /// @notice Deploy L2 core contracts with FULL production features (CREATE2, UUPS, Guardian)
    /// @dev Only for L2 chains - mainnet uses _deployMainnetENS instead
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
        (address entryPoint, address multicallForwarder,) = _getNetworkAddresses();

        // 1. Deploy Guardian with CREATE2
        address guardian = deployGuardian(owner, salt, factory);

        // 2. Deploy Gardener logic (Kernel v3 smart account for users)
        // Same constructor across all chains (ENS registration handled separately)
        gardenerAccountLogic = address(new Gardener(IEntryPoint(entryPoint)));

        // 3. Deploy ActionRegistry with CREATE2 + proxy (owner will own it)
        actionRegistry = ActionRegistry(deployActionRegistry(owner, salt, factory));

        // 4. Deploy resolvers with UUPS proxies + CREATE2 (owner will own them)
        workResolver = WorkResolver(payable(_deployWorkResolver(eas, address(actionRegistry), owner, salt, factory)));
        workApprovalResolver =
            WorkApprovalResolver(payable(_deployWorkApprovalResolver(eas, address(actionRegistry), owner, salt, factory)));
        assessmentResolver = AssessmentResolver(payable(_deployAssessmentResolver(eas, owner, salt, factory)));

        // 5. Deploy GardenAccount (TBA) with CREATE2
        gardenAccountImpl = GardenAccount(
            payable(
                deployGardenAccount(
                    entryPoint,
                    multicallForwarder,
                    tokenboundRegistry,
                    guardian,
                    address(workApprovalResolver),
                    address(assessmentResolver),
                    salt,
                    factory
                )
            )
        );

        // 6. Deploy AccountProxy with CREATE2
        deployAccountProxy(guardian, address(gardenAccountImpl), salt, factory);

        // 7. Deploy GardenToken with CREATE2 + proxy (owner will own it)
        gardenToken =
            GardenToken(deployGardenToken(address(gardenAccountImpl), owner, address(deploymentRegistry), salt, factory));
    }

    /// @notice Deploy DeploymentRegistry with governance and proxy
    function deployDeploymentRegistryWithGovernance(address initialOwner, address _deployer) public returns (address) {
        DeploymentRegistry implementation = new DeploymentRegistry();
        // Initialize with initialOwner as the contract owner
        bytes memory initData = abi.encodeWithSelector(DeploymentRegistry.initialize.selector, initialOwner);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Add deployer to allowlist if different from owner
        if (_deployer != initialOwner) {
            // solhint-disable-next-line no-empty-blocks
            try DeploymentRegistry(address(proxy)).addToAllowlist(_deployer) {
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
            UUPSUpgradeable(deployed).upgradeTo(address(implementation));
        }

        return predicted;
    }

    /// @notice Deploy ENSRegistrar with CREATE2 (mainnet/sepolia only)
    /// @param owner The initial owner
    /// @param salt The CREATE2 salt
    /// @param factory The CREATE2 factory address
    /// @return The ENSRegistrar address (address(0) on L2 chains)
    function _deployENSRegistrar(address owner, bytes32 salt, address factory) internal returns (address) {
        // Only deploy on mainnet (1) or sepolia (11155111)
        uint256 chainId = block.chainid;
        if (chainId != 1 && chainId != 11_155_111) {
            return address(0);
        }

        // Load ENS configuration
        NetworkConfig memory config = loadNetworkConfig();
        if (config.ensRegistry == address(0)) {
            return address(0);
        }

        // Compute greengoods.eth base node
        // namehash("eth") = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
        bytes32 ethNode = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
        bytes32 baseNode = keccak256(abi.encodePacked(ethNode, keccak256(bytes("greengoods"))));

        // Deploy ENSRegistrar directly (non-upgradeable to avoid stack-too-deep)
        bytes32 ensRegistrarSalt = keccak256(abi.encodePacked(salt, "ENSRegistrar"));
        bytes memory bytecode = abi.encodePacked(
            type(ENSRegistrar).creationCode, abi.encode(config.ensRegistry, config.ensResolver, baseNode, owner)
        );

        address predicted = Create2.computeAddress(ensRegistrarSalt, keccak256(bytecode), factory);
        _logCreate2Prediction("ENSRegistrar", ensRegistrarSalt, factory, predicted);

        if (!_isDeployed(predicted)) {
            address deployed = _deployCreate2(bytecode, ensRegistrarSalt, factory);
            if (deployed != predicted) {
                revert ENSRegistrarDeploymentAddressMismatch();
            }
        }

        ensRegistrar = ENSRegistrar(predicted);
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

        console.log("Schemas registered:");
        console.log("  work");
        console.logBytes32(workSchemaUID);
        console.log("  workApproval");
        console.logBytes32(workApprovalSchemaUID);
        console.log("  assessment");
        console.logBytes32(assessmentSchemaUID);

        // Create name attestations (always)
        _createSchemaNameAttestation(easContract, workSchemaUID, _getSchemaName(schemaJson, "work"));
        _createSchemaNameAttestation(easContract, workApprovalSchemaUID, _getSchemaName(schemaJson, "workApproval"));
        _createSchemaNameAttestation(easContract, assessmentSchemaUID, _getSchemaName(schemaJson, "assessment"));

        // Description attestations: only on Base Sepolia
        // Schema description schema (0x21cbc6...) only exists on Base Sepolia, not other networks
        if (block.chainid == 84_532) {
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
        DeploymentRegistry.NetworkConfig memory config = DeploymentRegistry.NetworkConfig({
            eas: eas,
            easSchemaRegistry: easSchemaRegistry,
            communityToken: communityToken,
            actionRegistry: address(actionRegistry),
            gardenToken: address(gardenToken),
            workResolver: address(workResolver),
            workApprovalResolver: address(workApprovalResolver)
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

    /// @notice Get EAS addresses for a chain
    function _getEASForChain(uint256 chainId) internal pure virtual returns (address eas, address registry) {
        if (chainId == 84_532) {
            return (0x4200000000000000000000000000000000000021, 0x4200000000000000000000000000000000000020);
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
