// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

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
        // Integration endpoints (Phase 1+)
        address assessmentResolver;
        address integrationRouter;
        // Future integration addresses (Phase 2+)
        address hatsAccessControl; // Hats Protocol adapter
        address octantFactory; // Octant vault factory
        address unlockFactory; // Unlock Protocol lock factory
        address hypercerts; // Hypercerts contract
        address greenWillRegistry; // GreenWill artifact registry
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

    /// @notice Mapping of chain IDs to network configurations
    mapping(uint256 chainId => NetworkConfig config) public networks;

    /// @notice Set of addresses allowed to update network configurations
    EnumerableSetUpgradeable.AddressSet private _allowlist;

    /// @notice Pending owner for governance transfer
    address public pendingOwner;

    /// @notice Emergency pause state
    bool public emergencyPaused;

    /**
     * @dev Storage gap for future upgrades
     * Reserves 46 slots (50 total - 4 used: networks, _allowlist, pendingOwner, emergencyPaused)
     * Note: EnumerableSetUpgradeable uses internal storage that counts in this calculation
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[46] private __gap;

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

    /// @notice Error thrown when trying to add zero address
    error CannotAddZeroAddress();

    /// @notice Error thrown when new owner is current owner
    error NewOwnerCannotBeCurrentOwner();

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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the registry
    /// @param _owner The address that will own the registry
    function initialize(address _owner) external initializer {
        __Ownable_init();
        transferOwnership(_owner);
        emergencyPaused = false;
    }

    /// @notice Sets the network configuration for a specific chain
    /// @param chainId The chain ID to configure
    /// @param config The network configuration
    function setNetworkConfig(uint256 chainId, NetworkConfig calldata config)
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
        if (account == address(0)) revert CannotAddZeroAddress();
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
        if (newOwner == address(0)) revert CannotAddZeroAddress();
        if (newOwner == owner()) revert NewOwnerCannotBeCurrentOwner();

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
            if (accounts[i] == address(0)) revert CannotAddZeroAddress();
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

    /// @notice Gets the Assessment Resolver address for the current chain
    /// @return The Assessment Resolver address
    function getAssessmentResolver() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).assessmentResolver;
    }

    /// @notice Gets the Integration Router address for the current chain
    /// @return The Integration Router address
    function getIntegrationRouter() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).integrationRouter;
    }

    /// @notice Gets the Hats Access Control address for the current chain
    /// @return The Hats Access Control address (zero if not configured)
    function getHatsAccessControl() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).hatsAccessControl;
    }

    /// @notice Gets the Octant Factory address for the current chain
    /// @return The Octant Factory address (zero if not configured)
    function getOctantFactory() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).octantFactory;
    }

    /// @notice Gets the Unlock Factory address for the current chain
    /// @return The Unlock Factory address (zero if not configured)
    function getUnlockFactory() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).unlockFactory;
    }

    /// @notice Gets the Hypercerts contract address for the current chain
    /// @return The Hypercerts address (zero if not configured)
    function getHypercerts() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).hypercerts;
    }

    /// @notice Gets the GreenWill Registry address for the current chain
    /// @return The GreenWill Registry address (zero if not configured)
    function getGreenWillRegistry() external view returns (address) {
        return getNetworkConfigForChain(block.chainid).greenWillRegistry;
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

    /// @notice Updates the Assessment Resolver address for the current chain
    /// @param contractAddress The new address
    function updateAssessmentResolver(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].assessmentResolver = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Integration Router address for the current chain
    /// @param contractAddress The new address
    function updateIntegrationRouter(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].integrationRouter = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Hats Access Control address for the current chain
    /// @param contractAddress The new address
    function updateHatsAccessControl(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].hatsAccessControl = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Octant Factory address for the current chain
    /// @param contractAddress The new address
    function updateOctantFactory(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].octantFactory = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Unlock Factory address for the current chain
    /// @param contractAddress The new address
    function updateUnlockFactory(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].unlockFactory = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Hypercerts contract address for the current chain
    /// @param contractAddress The new address
    function updateHypercerts(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].hypercerts = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the GreenWill Registry address for the current chain
    /// @param contractAddress The new address
    function updateGreenWillRegistry(address contractAddress) external onlyOwnerOrAllowlist whenNotPaused {
        networks[block.chainid].greenWillRegistry = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
