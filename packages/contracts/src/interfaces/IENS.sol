// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Import from @ensdomains/ens-contracts npm package
import { ENS } from "@ens/registry/ENS.sol";

// Re-export ENS registry interface
interface IENS is ENS { }

/// @title INameWrapper
/// @notice Minimal ENS NameWrapper interface for wrapped subdomain management
/// @dev Only includes methods needed by GreenGoodsENSReceiver.
///      Full interface in ens-contracts/wrapper/INameWrapper.sol (too heavy — inherits IERC1155).
interface INameWrapper {
    /// @notice Create a wrapped subdomain under a parent node
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    )
        external
        returns (bytes32);

    /// @notice Set the owner of a wrapped subdomain
    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    )
        external
        returns (bytes32);

    /// @notice Get the owner of a wrapped name (ERC1155 token ID = uint256(node))
    function ownerOf(uint256 id) external view returns (address);

    /// @notice Approve an operator for all wrapped names
    function setApprovalForAll(address operator, bool approved) external;
}

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
