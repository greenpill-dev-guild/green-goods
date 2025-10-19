// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Kernel } from "@kernel/Kernel.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IENSRegistrar } from "../interfaces/IENSRegistrar.sol";

/// @title Gardener
/// @notice Custom Kernel v3 compatible smart account with ENS identity
/// @dev Extends ZeroDev's Kernel v3 with ENS identity and passkey recovery
/// @dev Supports multi-L2: mainnet for ENS, L2s for operations (ENS_REGISTRAR = 0x0)
contract Gardener is Kernel {
    // ============================================================================
    // ERRORS
    // ============================================================================

    error NotAuthorized();
    error AlreadyClaimed();
    error InvalidENSName();
    error InvalidCredentialId();
    error NameNotAvailable();
    error ENSNotSupportedOnChain();
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

    /// @notice Emitted when ENS name is claimed
    /// @param account The Gardener account address
    /// @param ensName The full ENS name (e.g., "alice.greengoods.eth")
    /// @param credentialId The passkey credential ID for recovery
    /// @param timestamp The claim timestamp
    event ENSClaimed(
        address indexed account,
        string indexed ensName,
        bytes32 indexed credentialId,
        uint256 timestamp
    );

    /// @notice Emitted when ENS name is updated
    /// @param account The Gardener account address
    /// @param oldName The previous ENS name
    /// @param newName The new ENS name
    /// @param timestamp The update timestamp
    event ENSUpdated(address indexed account, string oldName, string newName, uint256 timestamp);

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    // ENS identity (stored on mainnet)
    string public ensName; // Full ENS name (e.g., "alice.greengoods.eth")
    bytes32 public passkeyCredentialId; // WebAuthn credential ID for recovery
    uint256 public claimedAt; // Timestamp of ENS claim

    // ENS Registrar reference (immutable)
    // address(0) on L2 chains (Arbitrum, Celo, Base Sepolia)
    // Non-zero on mainnet only
    address public immutable ENS_REGISTRAR;

    // Validation limits
    uint256 private constant MAX_NAME_LENGTH = 50;

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
    /// @param _ensRegistrar The ENS Registrar address (address(0) on L2 chains)
    /// @dev Constructor sets up Kernel base and ENS registrar reference
    /// @dev For multi-L2 support: mainnet has real ENS registrar, L2s have address(0)
    constructor(IEntryPoint _entryPoint, address _ensRegistrar) Kernel(_entryPoint) {
        ENS_REGISTRAR = _ensRegistrar;
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
        if (claimedAt != 0) revert AlreadyInitialized();

        // Mark as initialized
        claimedAt = 1;

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
    // ENS MANAGEMENT
    // ============================================================================

    /// @notice Claim ENS subdomain for this Gardener account
    /// @param _ensName The subdomain name (e.g., "alice" for alice.greengoods.eth)
    /// @param _credentialId The passkey credential ID for recovery
    /// @dev Only works on mainnet where ENS_REGISTRAR != address(0)
    /// @dev Gracefully reverts on L2 chains with clear error message
    function claimENSName(string calldata _ensName, bytes32 _credentialId) external onlyOwner {
        // Gracefully handle L2 chains where ENS is not supported
        if (ENS_REGISTRAR == address(0)) revert ENSNotSupportedOnChain();

        // Validate not already claimed
        if (bytes(ensName).length > 0) revert AlreadyClaimed();

        // Validate input
        if (bytes(_ensName).length == 0 || bytes(_ensName).length > MAX_NAME_LENGTH) revert InvalidENSName();
        if (_credentialId == bytes32(0)) revert InvalidCredentialId();

        // Check name availability
        if (!IENSRegistrar(ENS_REGISTRAR).available(_ensName)) revert NameNotAvailable();

        // Register subdomain (ENSRegistrar will set ENS records)
        IENSRegistrar(ENS_REGISTRAR).register(_ensName, address(this));

        // Store data
        string memory fullName = string(abi.encodePacked(_ensName, ".greengoods.eth"));
        ensName = fullName;
        passkeyCredentialId = _credentialId;
        claimedAt = block.timestamp;

        emit ENSClaimed(address(this), fullName, _credentialId, block.timestamp);
    }

    /// @notice Verify if a credential ID matches the stored one
    /// @param _credentialId The credential ID to verify
    /// @return True if matches, false otherwise
    /// @dev Used during recovery to validate passkey
    function verifyCredentialId(bytes32 _credentialId) external view returns (bool) {
        return passkeyCredentialId == _credentialId;
    }

    /// @notice Get recovery data for this account
    /// @return _ensName The ENS name
    /// @return _credentialId The passkey credential ID
    /// @return _owner Current owner address
    /// @dev Used during account recovery flow
    function getRecoveryData()
        external
        view
        returns (string memory _ensName, bytes32 _credentialId, address _owner)
    {
        return (ensName, passkeyCredentialId, getKernelStorage().owner);
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

