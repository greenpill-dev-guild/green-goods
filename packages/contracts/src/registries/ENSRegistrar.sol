// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IENSRegistrar } from "../interfaces/IENSRegistrar.sol";
import { IENS, IENSResolver } from "../interfaces/IENS.sol";

error NameNotAvailable();
error InvalidName();
error UnauthorizedCaller();
error ENSNotConfigured();

/// @title ENSRegistrar
/// @notice Manages greengoods.eth subdomain registration for Gardener accounts
/// @dev Deployed only on mainnet, coordinates with ENS Registry and Resolver
/// @dev Simplified non-upgradeable version to avoid stack-too-deep errors
contract ENSRegistrar is IENSRegistrar, Ownable {
    /// @notice ENS Registry contract address
    address public immutable ENS_REGISTRY;

    /// @notice ENS Public Resolver contract address
    address public immutable ENS_RESOLVER;

    /// @notice Base node (namehash of "greengoods.eth")
    bytes32 public immutable BASE_NODE;

    /// @notice Subdomain name → Gardener account address
    mapping(string => address) public subdomains;

    /// @notice Gardener account address → subdomain name
    mapping(address => string) public accountToName;

    /// @notice Constructor sets immutable ENS configuration
    /// @param _registry ENS Registry contract address
    /// @param _resolver ENS Public Resolver contract address
    /// @param _baseNode Base node (namehash of "greengoods.eth")
    /// @param _owner Initial owner address
    constructor(address _registry, address _resolver, bytes32 _baseNode, address _owner) Ownable() {
        if (_registry == address(0) || _resolver == address(0) || _baseNode == bytes32(0)) {
            revert ENSNotConfigured();
        }
        
        ENS_REGISTRY = _registry;
        ENS_RESOLVER = _resolver;
        BASE_NODE = _baseNode;
        
        _transferOwnership(_owner);
    }

    /// @notice Check if a subdomain name is available
    /// @param name The subdomain name to check
    /// @return True if available, false if taken
    function available(string calldata name) external view returns (bool) {
        return subdomains[name] == address(0);
    }

    /// @notice Register a subdomain for a Gardener account
    /// @dev Only the Gardener account itself can call this (msg.sender == owner)
    /// @param name The subdomain name (e.g., "alice" for alice.greengoods.eth)
    /// @param owner The Gardener account address
    function register(string calldata name, address owner) external {
        // Validate input
        if (msg.sender != owner) revert UnauthorizedCaller();
        if (subdomains[name] != address(0)) revert NameNotAvailable();
        
        uint256 nameLength = bytes(name).length;
        if (nameLength == 0 || nameLength > 50) revert InvalidName();

        // Store mappings
        subdomains[name] = owner;
        accountToName[owner] = name;

        // Register with ENS
        bytes32 label = keccak256(bytes(name));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));

        // Set subnode owner (this contract)
        IENS(ENS_REGISTRY).setSubnodeOwner(BASE_NODE, label, address(this));
        
        // Set resolver for the node
        IENS(ENS_REGISTRY).setResolver(node, ENS_RESOLVER);
        
        // Set address in resolver (points to Gardener account)
        IENSResolver(ENS_RESOLVER).setAddr(node, owner);

        emit SubdomainRegistered(name, owner, block.timestamp);
    }

    /// @notice Get the owner of a subdomain
    /// @param name The subdomain name
    /// @return The Gardener account address that owns this subdomain
    function ownerOf(string calldata name) external view returns (address) {
        return subdomains[name];
    }

    /// @notice Resolve a subdomain name to an address
    /// @param name The subdomain name
    /// @return The Gardener account address
    function resolve(string calldata name) external view returns (address) {
        return subdomains[name];
    }
}

