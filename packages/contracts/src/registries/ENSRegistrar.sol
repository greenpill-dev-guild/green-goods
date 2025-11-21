// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IENSRegistrar} from "../interfaces/IENSRegistrar.sol";
import {IENS, IENSResolver} from "../interfaces/IENS.sol";

error NameNotAvailable();
error InvalidName();
error UnauthorizedCaller();
error ENSNotConfigured();
error InvalidCredentialId();

/// @title ENSRegistrar
/// @notice Manages greengoods.eth subdomain registration for Gardener accounts with passkey recovery
/// @dev Deployed only on mainnet, coordinates with ENS Registry and Resolver
/// @dev Stores all ENS identity data to eliminate need for storage in Gardener contract
contract ENSRegistrar is IENSRegistrar, Ownable {
    /// @notice ENS Registry contract address
    address public immutable ENS_REGISTRY;

    /// @notice ENS Public Resolver contract address
    address public immutable ENS_RESOLVER;

    /// @notice Base node (namehash of "greengoods.eth")
    bytes32 public immutable BASE_NODE;

    /// @notice ENS profile data with recovery information
    struct EnsProfile {
        address owner; // Gardener account address
        bytes32 credentialId; // WebAuthn credential for recovery
        uint256 claimedAt; // Registration timestamp
    }

    /// @notice Subdomain name → ENS profile data
    mapping(string name => EnsProfile profile) public profiles;

    /// @notice Subdomain name → Gardener account address (for backwards compatibility)
    mapping(string name => address owner) public subdomains;

    /// @notice Gardener account address → subdomain name
    mapping(address account => string name) public accountToName;

    /// @notice Constructor sets immutable ENS configuration
    /// @param _registry ENS Registry contract address
    /// @param _resolver ENS Public Resolver contract address
    /// @param _baseNode Base node (namehash of "greengoods.eth")
    /// @param _owner Initial owner address
    constructor(address _registry, address _resolver, bytes32 _baseNode, address _owner) {
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
        return profiles[name].owner == address(0);
    }

    /// @notice Register a subdomain for a Gardener account with passkey recovery data
    /// @dev Only the Gardener account itself can call this (msg.sender == owner)
    /// @dev Stores all ENS identity data here to avoid storage costs in Gardener contract
    /// @param name The subdomain name (e.g., "alice" for alice.greengoods.eth)
    /// @param owner The Gardener account address
    /// @param credentialId WebAuthn credential ID for passkey recovery
    function register(string calldata name, address owner, bytes32 credentialId) external {
        // Validate input
        if (msg.sender != owner) revert UnauthorizedCaller();
        if (profiles[name].owner != address(0)) revert NameNotAvailable();
        if (credentialId == bytes32(0)) revert InvalidCredentialId();

        uint256 nameLength = bytes(name).length;
        if (nameLength == 0 || nameLength > 50) revert InvalidName();

        // Store profile data (single storage location)
        profiles[name] = EnsProfile({owner: owner, credentialId: credentialId, claimedAt: block.timestamp});

        // Store mappings for compatibility
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

        emit SubdomainRegistered(name, owner, credentialId, block.timestamp);
    }

    /// @notice Get the owner of a subdomain
    /// @param name The subdomain name
    /// @return The Gardener account address that owns this subdomain
    function ownerOf(string calldata name) external view returns (address) {
        return profiles[name].owner;
    }

    /// @notice Resolve a subdomain name to an address
    /// @param name The subdomain name
    /// @return The Gardener account address
    function resolve(string calldata name) external view returns (address) {
        return profiles[name].owner;
    }

    /// @notice Get recovery data for a subdomain
    /// @param name The subdomain name
    /// @return owner The Gardener account address
    /// @return credentialId The passkey credential ID for recovery
    /// @return claimedAt The timestamp when the subdomain was claimed
    function getRecoveryData(string calldata name)
        external
        view
        returns (address owner, bytes32 credentialId, uint256 claimedAt)
    {
        EnsProfile memory profile = profiles[name];
        return (profile.owner, profile.credentialId, profile.claimedAt);
    }
}
