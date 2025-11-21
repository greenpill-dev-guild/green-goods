// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Kernel } from "@kernel/Kernel.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title Gardener
/// @notice Custom Kernel v3 compatible smart account for Green Goods protocol
/// @dev Extends ZeroDev's Kernel v3 with minimal overhead
/// @dev Works across all chains; ENS registration handled separately on mainnet via ENSRegistrar
contract Gardener is Kernel {
    // ============================================================================
    // ERRORS
    // ============================================================================

    error NotAuthorized();
    error NotInitialized();
    error AlreadyInitialized();

    // ============================================================================
    // EVENTS
    // ============================================================================

    /// @notice Emitted when a new Gardener account is deployed
    /// @param account The address of the deployed account
    /// @param owner The initial owner address
    /// @param timestamp The deployment timestamp
    event AccountDeployed(address indexed account, address indexed owner, uint256 timestamp);

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    // Minimal state - only track initialization
    uint256 public deployedAt; // Timestamp when account was initialized

    // ============================================================================
    // MODIFIERS
    // ============================================================================

    /// @notice Restricts function to owner EOA or account itself (via UserOp)
    /// @dev Uses Kernel's storage for owner tracking
    modifier onlyOwner() {
        address accountOwner = getKernelStorage().owner;
        if (msg.sender != accountOwner && msg.sender != address(this)) {
            revert NotAuthorized();
        }
        _;
    }

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /// @notice Construct the Gardener account
    /// @param _entryPoint The ERC-4337 EntryPoint address
    /// @dev Constructor sets up Kernel base with no additional configuration
    /// @dev Same constructor across all chains (mainnet + L2s)
    constructor(IEntryPoint _entryPoint) Kernel(_entryPoint) {
        // No additional setup needed
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// @notice Initialize Gardener account (call after Kernel initialize)
    /// @dev Emits AccountDeployed event for indexer tracking
    /// @dev This should be called once after calling the inherited initialize()
    function initializeGardener() external {
        // Only allow if already initialized (owner is set)
        address accountOwner = getKernelStorage().owner;
        if (accountOwner == address(0)) revert NotInitialized();

        // Only emit once (check if already initialized)
        if (deployedAt != 0) revert AlreadyInitialized();

        // Mark as initialized
        deployedAt = block.timestamp;

        // Emit custom event for indexer
        emit AccountDeployed(address(this), accountOwner, block.timestamp);
    }

    /// @notice Get the owner of this account
    /// @return The owner address
    /// @dev Exposes Kernel's internal owner storage for convenience
    function owner() external view returns (address) {
        return getKernelStorage().owner;
    }

    // ============================================================================
    // ERC-165 SUPPORT
    // ============================================================================

    /// @notice Check interface support
    /// @param interfaceId Interface identifier
    /// @return True if interface is supported
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}
