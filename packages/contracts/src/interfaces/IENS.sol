// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Import from @ensdomains/ens-contracts npm package
import { ENS } from "@ens/registry/ENS.sol";

// Re-export ENS registry interface
interface IENS is ENS {}

/// @title IENSResolver
/// @notice Minimal ENS Public Resolver interface for Green Goods usage
/// @dev Only includes methods we actually need (setAddr, setText, addr, text)
/// @dev Full resolver interface is too complex and causes stack-too-deep errors
interface IENSResolver {
    /// @notice Sets the address for an ENS node
    /// @param node The node to update
    /// @param addr The address to set
    function setAddr(bytes32 node, address addr) external;
    
    /// @notice Gets the address for an ENS node
    /// @param node The node to query
    /// @return The associated address
    function addr(bytes32 node) external view returns (address payable);
    
    /// @notice Sets text data for an ENS node
    /// @param node The node to update
    /// @param key The key to set
    /// @param value The text data to set
    function setText(bytes32 node, string calldata key, string calldata value) external;
    
    /// @notice Gets text data for an ENS node
    /// @param node The node to query
    /// @param key The text data key to query
    /// @return The associated text data
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

