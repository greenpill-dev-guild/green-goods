// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.25;

// Global constants and enums used across Octant contracts
// Vendored from: https://github.com/golemfoundation/octant-v2-core
// Mainnet-specific addresses removed (USDC, Morpho factory, strategy singletons)

// ══════════════════════════════════════════════════════════════════════════════
// SENTINEL VALUES
// ══════════════════════════════════════════════════════════════════════════════

// Sentinel value representing native ETH (address(0) for ETH instead of ERC20)
address constant NATIVE_TOKEN = address(0);

// ══════════════════════════════════════════════════════════════════════════════
// EVM / PROTOCOL CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

// EIP-7825 per-transaction gas limit (2^24 = 16,777,216)
// Used for gas profiling DAO proposals to ensure they fit within limits
uint256 constant EIP_7825_TX_GAS_LIMIT = 16_777_216;

// ══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @notice Access control modes for address set validation
 * @dev Used by LinearAllowanceExecutor and RegenStaker
 */
enum AccessMode {
    NONE, // No access control (permissionless)
    ALLOWSET, // Only addresses in allowset are permitted
    BLOCKSET // All addresses except those in blockset are permitted

}
