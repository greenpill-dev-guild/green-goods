// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { EnumerableSetUpgradeable } from
    "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

/// @title DeploymentRegistry
/// @notice A governance-controlled registry for managing contract deployments across networks
/// @dev Provides a centralized way to access deployed contract addresses with allowlist mechanism
contract DeploymentRegistry is OwnableUpgradeable, UUPSUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /// @notice Core contract addresses for each network
    struct NetworkConfig {
        address eas;
        address easSchemaRegistry;
        address communityToken;
        address actionRegistry;
        address gardenToken;
        address workResolver;
        address workApprovalResolver;
    }

    /// @notice Emitted when a network configuration is updated
    event NetworkConfigUpdated(uint256 indexed chainId, NetworkConfig config);

    /// @notice Emitted when an address is added to the allowlist
    event AllowlistAdded(address indexed account);

    /// @notice Emitted when an address is removed from the allowlist
    event AllowlistRemoved(address indexed account);

    /// @notice Emitted when governance transfer is initiated
    event GovernanceTransferInitiated(address indexed currentOwner, address indexed pendingOwner);

    /// @notice Emitted when governance transfer is completed
    event GovernanceTransferCompleted(address indexed previousOwner, address indexed newOwner);

    /// @notice Emitted when emergency pause is activated
    event EmergencyPauseActivated(address indexed activator);

    /// @notice Emitted when emergency pause is deactivated
    event EmergencyPauseDeactivated(address indexed deactivator);

    /// @notice Emitted when a template is registered
    event TemplateRegistered(bytes32 indexed templateHash, uint256 expirationTime);

    /// @notice Emitted when a contract is deployed via factory
    event ContractDeployedViaFactory(
        bytes32 indexed templateHash, address indexed deployed, bytes32 salt, address indexed deployer
    );

    /// @notice Emitted when emergency template is approved
    event EmergencyTemplateApproved(bytes32 indexed templateHash, address indexed guardian);

    /// @notice Emitted when Gnosis Safe is updated
    event GnosisSafeUpdated(address indexed gnosisSafe);

    /// @notice Emitted when emergency guardian is updated
    event EmergencyGuardianUpdated(address indexed emergencyGuardian);

    /// @notice Mapping of chain IDs to network configurations
    mapping(uint256 chainId => NetworkConfig config) public networks;

    /// @notice Set of addresses allowed to update network configurations
    EnumerableSetUpgradeable.AddressSet private _allowlist;

    /// @notice Pending owner for governance transfer
    address public pendingOwner;

    /// @notice Emergency pause state
    bool public emergencyPaused;

    /// @notice Gnosis Safe for multi-sig approvals
    address public gnosisSafe;

    /// @notice Emergency guardian (afo.eth)
    address public emergencyGuardian;

    /// @notice Template metadata structure
    struct TemplateMetadata {
        string name;
        string version;
        string description;
        address deployer;
        uint256 registeredAt;
        uint256 expirationTime;
        bool approved;
        uint256 deploymentCount;
    }

    /// @notice Template expiration times
    mapping(bytes32 templateHash => uint256 expirationTime) public templateExpirations;

    /// @notice Approved deployment templates
    mapping(bytes32 templateHash => bool approved) public approvedTemplates;

    /// @notice Template metadata storage
    mapping(bytes32 templateHash => TemplateMetadata metadata) public templateMetadata;

    /// @notice Template deployment counters
    mapping(bytes32 templateHash => uint256 count) public templateDeploymentCount;

    /// @notice Error thrown when trying to access unconfigured network
    error NetworkNotConfigured(uint256 chainId);

    /// @notice Error thrown when caller is not authorized
    error UnauthorizedCaller(address caller);

    /// @notice Error thrown when contract is emergency paused
    error EmergencyPaused();

    /// @notice Error thrown when no pending governance transfer exists
    error NoPendingTransfer();

    /// @notice Error thrown when caller is not pending owner
    error NotPendingOwner();

    /// @notice Error thrown when template is expired
    error TemplateExpired(bytes32 templateHash);

    /// @notice Error thrown when template is not approved
    error TemplateNotApproved(bytes32 templateHash);

    /// @notice Error thrown when caller is not emergency guardian
    error NotEmergencyGuardian();

    /// @notice Error thrown when expiration time is invalid
    error InvalidExpirationTime();

    /// @notice Error thrown when template hash mismatch
    error TemplateHashMismatch();

    /// @notice Error thrown when initialization fails
    error InitializationFailed();

    /// @notice Error thrown when zero address provided
    error ZeroAddress();

    /// @notice Modifier to check if caller is owner or in allowlist
    modifier onlyOwnerOrAllowlist() {
        if (owner() != msg.sender && !_allowlist.contains(msg.sender)) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    /// @notice Modifier to check if contract is not emergency paused
    modifier whenNotPaused() {
        if (emergencyPaused) {
            revert EmergencyPaused();
        }
        _;
    }

    /// @notice Modifier to check if caller is emergency guardian or owner
    modifier onlyEmergencyGuardian() {
        if (msg.sender != emergencyGuardian && msg.sender != owner()) {
            revert NotEmergencyGuardian();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the registry
    /// @param _owner The address that will own the registry
    function initialize(address _owner) external initializer {
        __Ownable_init();
        _transferOwnership(_owner);
        emergencyPaused = false;
    }

    /// @notice Initializes the registry with Gnosis Safe and emergency guardian
    /// @param _owner The address that will own the registry
    /// @param _gnosisSafe The Gnosis Safe address for multi-sig approvals
    /// @param _emergencyGuardian The emergency guardian address (afo.eth)
    function initializeWithSafe(address _owner, address _gnosisSafe, address _emergencyGuardian) external initializer {
        __Ownable_init();
        _transferOwnership(_owner);
        emergencyPaused = false;
        gnosisSafe = _gnosisSafe;
        emergencyGuardian = _emergencyGuardian;
    }

    /// @notice Sets the network configuration for a specific chain
    /// @param chainId The chain ID to configure
    /// @param config The network configuration
    function setNetworkConfig(
        uint256 chainId,
        NetworkConfig calldata config
    )
        external
        onlyOwnerOrAllowlist
        whenNotPaused
    {
        networks[chainId] = config;
        emit NetworkConfigUpdated(chainId, config);
    }

    /// @notice Adds an address to the allowlist (owner only)
    /// @param account The address to add
    function addToAllowlist(address account) external onlyOwner {
        if (account == address(0)) {
            revert ZeroAddress();
        }
        if (_allowlist.add(account)) {
            emit AllowlistAdded(account);
        }
    }

    /// @notice Removes an address from the allowlist (owner only)
    /// @param account The address to remove
    function removeFromAllowlist(address account) external onlyOwner {
        if (_allowlist.remove(account)) {
            emit AllowlistRemoved(account);
        }
    }

    /// @notice Checks if an address is in the allowlist
    /// @param account The address to check
    /// @return True if address is in allowlist
    function isInAllowlist(address account) external view returns (bool) {
        return _allowlist.contains(account);
    }

    /// @notice Gets all addresses in the allowlist
    /// @return Array of allowlisted addresses
    function getAllowlist() external view returns (address[] memory) {
        return _allowlist.values();
    }

    /// @notice Gets the number of addresses in the allowlist
    /// @return Number of allowlisted addresses
    function allowlistLength() external view returns (uint256) {
        return _allowlist.length();
    }

    /// @notice Initiates a governance transfer to a new owner
    /// @param newOwner The address of the new owner
    function initiateGovernanceTransfer(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert ZeroAddress();
        }
        if (newOwner == owner()) {
            revert UnauthorizedCaller(newOwner);
        }

        pendingOwner = newOwner;
        emit GovernanceTransferInitiated(owner(), newOwner);
    }

    /// @notice Completes the governance transfer (must be called by pending owner)
    function acceptGovernanceTransfer() external {
        if (pendingOwner == address(0)) {
            revert NoPendingTransfer();
        }
        if (msg.sender != pendingOwner) {
            revert NotPendingOwner();
        }

        address previousOwner = owner();
        address newOwner = pendingOwner;

        pendingOwner = address(0);
        _transferOwnership(newOwner);

        emit GovernanceTransferCompleted(previousOwner, newOwner);
    }

    /// @notice Cancels a pending governance transfer (owner only)
    function cancelGovernanceTransfer() external onlyOwner {
        if (pendingOwner == address(0)) {
            revert NoPendingTransfer();
        }

        pendingOwner = address(0);
    }

    /// @notice Emergency pause function (owner only)
    function emergencyPause() external onlyOwner {
        emergencyPaused = true;
        emit EmergencyPauseActivated(msg.sender);
    }

    /// @notice Emergency unpause function (owner only)
    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        emit EmergencyPauseDeactivated(msg.sender);
    }

    /// @notice Batch add multiple addresses to allowlist (owner only)
    /// @param accounts Array of addresses to add
    function batchAddToAllowlist(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) {
                revert ZeroAddress();
            }
            if (_allowlist.add(accounts[i])) {
                emit AllowlistAdded(accounts[i]);
            }
        }
    }

    /// @notice Gets the network configuration for the current chain
    /// @return The network configuration
    function getNetworkConfig() external view returns (NetworkConfig memory) {
        return getNetworkConfigForChain(block.chainid);
    }

    /// @notice Gets the network configuration for a specific chain
    /// @param chainId The chain ID to get configuration for
    /// @return The network configuration
    function getNetworkConfigForChain(uint256 chainId) public view returns (NetworkConfig memory) {
        NetworkConfig memory config = networks[chainId];

        // Check if network has been configured
        if (config.eas == address(0) && config.communityToken == address(0)) {
            revert NetworkNotConfigured(chainId);
        }

        return config;
    }

    /// @notice Gets the EAS address for the current chain
    /// @return The EAS address
    function getEAS() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).eas;
    }

    /// @notice Gets the EAS Schema Registry address for the current chain
    /// @return The EAS Schema Registry address
    function getEASSchemaRegistry() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).easSchemaRegistry;
    }

    /// @notice Gets the Community Token address for the current chain
    /// @return The Community Token address
    function getCommunityToken() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).communityToken;
    }

    /// @notice Gets the Action Registry address for the current chain
    /// @return The Action Registry address
    function getActionRegistry() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).actionRegistry;
    }

    /// @notice Gets the Garden Token address for the current chain
    /// @return The Garden Token address
    function getGardenToken() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).gardenToken;
    }

    /// @notice Gets the Work Resolver address for the current chain
    /// @return The Work Resolver address
    function getWorkResolver() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).workResolver;
    }

    /// @notice Gets the Work Approval Resolver address for the current chain
    /// @return The Work Approval Resolver address
    function getWorkApprovalResolver() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).workApprovalResolver;
    }

    /// @notice Updates the Action Registry address for the current chain
    /// @param contractAddress The new address
    function updateActionRegistry(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].actionRegistry = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Garden Token address for the current chain
    /// @param contractAddress The new address
    function updateGardenToken(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].gardenToken = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Register a deployment template with expiration
    /// @param templateHash The hash of the template bytecode
    /// @param expirationTime When the template expires (unix timestamp)
    function registerTemplate(bytes32 templateHash, uint256 expirationTime) external onlyOwner {
        if (expirationTime <= block.timestamp) {
            revert InvalidExpirationTime();
        }
        templateExpirations[templateHash] = expirationTime;
        approvedTemplates[templateHash] = true;
        emit TemplateRegistered(templateHash, expirationTime);
    }

    /// @notice Register a deployment template with metadata
    /// @param templateHash The hash of the template bytecode
    /// @param name Template name (e.g., "ActionRegistry")
    /// @param version Template version (e.g., "v1.0.0")
    /// @param description Template description
    /// @param expirationTime When the template expires (unix timestamp)
    function registerTemplateWithMetadata(
        bytes32 templateHash,
        string calldata name,
        string calldata version,
        string calldata description,
        uint256 expirationTime
    )
        external
        onlyOwner
    {
        if (expirationTime <= block.timestamp) {
            revert InvalidExpirationTime();
        }

        // Store in existing mappings for compatibility
        templateExpirations[templateHash] = expirationTime;
        approvedTemplates[templateHash] = true;

        // Store enhanced metadata
        templateMetadata[templateHash] = TemplateMetadata({
            name: name,
            version: version,
            description: description,
            deployer: msg.sender,
            registeredAt: block.timestamp,
            expirationTime: expirationTime,
            approved: true,
            deploymentCount: 0
        });

        emit TemplateRegistered(templateHash, expirationTime);
    }

    /// @notice Deploy contract via factory using approved template
    /// @param templateHash The hash of the approved template
    /// @param creationCode The contract creation bytecode
    /// @param salt The salt for deterministic deployment
    /// @param initData The initialization data
    /// @return deployed The address of the deployed contract
    function deployViaFactory(
        bytes32 templateHash,
        bytes memory creationCode,
        bytes32 salt,
        bytes memory initData
    )
        external
        onlyOwnerOrAllowlist
        whenNotPaused
        returns (address deployed)
    {
        if (!approvedTemplates[templateHash]) {
            revert TemplateNotApproved(templateHash);
        }

        if (block.timestamp >= templateExpirations[templateHash]) {
            revert TemplateExpired(templateHash);
        }

        // Verify template hash matches bytecode
        if (keccak256(creationCode) != templateHash) {
            revert TemplateHashMismatch();
        }

        // Deploy using CREATE2
        deployed = Create2.deploy(0, salt, creationCode);

        // Initialize if init data provided
        if (initData.length > 0) {
            (bool success,) = deployed.call(initData);
            if (!success) {
                revert InitializationFailed();
            }
        }

        // Update deployment tracking
        unchecked {
            ++templateDeploymentCount[templateHash];
            ++templateMetadata[templateHash].deploymentCount;
        }

        emit ContractDeployedViaFactory(templateHash, deployed, salt, msg.sender);
    }

    /// @notice Emergency deployment approval (guardian only)
    /// @param templateHash The template to approve for emergency deployment
    function emergencyApproveTemplate(bytes32 templateHash) external onlyEmergencyGuardian {
        approvedTemplates[templateHash] = true;
        // Emergency templates expire in 24 hours
        templateExpirations[templateHash] = block.timestamp + 24 hours;
        emit EmergencyTemplateApproved(templateHash, msg.sender);
    }

    /// @notice Revoke deployer access (emergency guardian)
    /// @param deployer The address to revoke
    function emergencyRevokeDeployer(address deployer) external onlyEmergencyGuardian {
        if (_allowlist.remove(deployer)) {
            emit AllowlistRemoved(deployer);
        }
    }

    /// @notice Set Gnosis Safe address
    /// @param _gnosisSafe The Gnosis Safe address
    function setGnosisSafe(address _gnosisSafe) external onlyOwner {
        gnosisSafe = _gnosisSafe;
        emit GnosisSafeUpdated(_gnosisSafe);
    }

    /// @notice Set emergency guardian
    /// @param _emergencyGuardian The emergency guardian address
    function setEmergencyGuardian(address _emergencyGuardian) external onlyOwner {
        emergencyGuardian = _emergencyGuardian;
        emit EmergencyGuardianUpdated(_emergencyGuardian);
    }

    /// @notice Get template metadata by hash
    /// @param templateHash The template hash
    /// @return metadata The template metadata
    function getTemplateMetadata(bytes32 templateHash) external view returns (TemplateMetadata memory metadata) {
        return templateMetadata[templateHash];
    }

    /// @notice Get multiple templates metadata
    /// @param templateHashes Array of template hashes
    /// @return metadataArray Array of template metadata
    function getBatchTemplateMetadata(bytes32[] calldata templateHashes)
        external
        view
        returns (TemplateMetadata[] memory metadataArray)
    {
        uint256 length = templateHashes.length;
        metadataArray = new TemplateMetadata[](length);

        for (uint256 i = 0; i < length;) {
            metadataArray[i] = templateMetadata[templateHashes[i]];
            unchecked {
                ++i;
            }
        }

        return metadataArray;
    }

    /// @notice Get template deployment statistics
    /// @param templateHash The template hash
    /// @return count Total deployments
    /// @return approved Whether template is approved
    /// @return expiration Template expiration time
    function getTemplateStats(bytes32 templateHash)
        external
        view
        returns (uint256 count, bool approved, uint256 expiration)
    {
        return
            (templateDeploymentCount[templateHash], approvedTemplates[templateHash], templateExpirations[templateHash]);
    }

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
