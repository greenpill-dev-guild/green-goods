// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICVSyncPowerFacet
/// @notice Minimal interface for Gardens V2 conviction power sync
/// @dev Called by HatsModule to trigger power rebalancing on role revocation.
///      This interface targets Gardens V2 diamond facets that maintain per-member
///      voting power state. HypercertSignalPool does NOT implement this — it uses
///      lazy eligibility evaluation (isEligibleVoter checks Hats at read time).
///      Strategies that need explicit sync on role changes should implement this.
interface ICVSyncPowerFacet {
    /// @notice Sync a member's voting power with the live registry value
    /// @param member The address whose power should be synced
    function syncPower(address member) external;

    /// @notice Batch sync power for multiple members
    /// @param members Array of addresses to sync
    function batchSyncPower(address[] calldata members) external;
}
