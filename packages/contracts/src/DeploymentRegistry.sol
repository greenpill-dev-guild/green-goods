// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title DeploymentRegistry
/// @notice A simplified registry for managing contract deployments across networks
/// @dev Provides a centralized way to access deployed contract addresses
contract DeploymentRegistry is OwnableUpgradeable, UUPSUpgradeable {
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

    /// @notice Mapping of chain IDs to network configurations
    mapping(uint256 chainId => NetworkConfig config) public networks;

    /// @notice Error thrown when trying to access unconfigured network
    error NetworkNotConfigured(uint256 chainId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the registry
    /// @param _owner The address that will own the registry
    function initialize(address _owner) external initializer {
        __Ownable_init();
        transferOwnership(_owner);
    }

    /// @notice Sets the network configuration for a specific chain
    /// @param chainId The chain ID to configure
    /// @param config The network configuration
    function setNetworkConfig(uint256 chainId, NetworkConfig calldata config) external onlyOwner {
        networks[chainId] = config;
        emit NetworkConfigUpdated(chainId, config);
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
    function updateActionRegistry(address contractAddress) external onlyOwner {
        networks[block.chainid].actionRegistry = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Updates the Garden Token address for the current chain
    /// @param contractAddress The new address
    function updateGardenToken(address contractAddress) external onlyOwner {
        networks[block.chainid].gardenToken = contractAddress;
        emit NetworkConfigUpdated(block.chainid, networks[block.chainid]);
    }

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
