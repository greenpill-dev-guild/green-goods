// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Kernel } from "@kernel/Kernel.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { StorageSlot } from "@openzeppelin/contracts/utils/StorageSlot.sol";

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

    /// @dev Storage slot for Gardener storage
    /// keccak256("greengoods.gardener.storage")
    bytes32 private constant GARDENER_STORAGE_SLOT = 0x5074774145180348193468478435513382878818585518818188181818181818;

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

        // Check if already initialized using assembly to avoid stack depth issues
        bytes32 slot = GARDENER_STORAGE_SLOT;
        uint256 existing;
        assembly {
            existing := sload(slot)
        }
        if (existing != 0) revert AlreadyInitialized();

        // Mark as initialized
        uint256 ts = block.timestamp;
        assembly {
            sstore(slot, ts)
        }

        // Emit custom event for indexer
        emit AccountDeployed(address(this), accountOwner, ts);
    }

    /// @notice Get the owner of this account
    /// @return The owner address
    /// @dev Exposes Kernel's internal owner storage for convenience
    function owner() external view returns (address) {
        return getKernelStorage().owner;
    }

    /// @notice Get the deployment timestamp
    function deployedAt() external view returns (uint256) {
        bytes32 slot = GARDENER_STORAGE_SLOT;
        uint256 value;
        assembly {
            value := sload(slot)
        }
        return value;
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
