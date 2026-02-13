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
    /// @dev Called by HatsModule._syncConvictionPower AFTER the hat has been transferred away
    ///      from the member in _revokeRole. This means the member no longer wears the hat when
    ///      syncPower fires. Implementors MUST handle the post-revocation state -- e.g., by
    ///      reading the member's current hat status from IHats.isWearerOfHat rather than assuming
    ///      the member still holds the role. If the implementation needs to know the previous
    ///      state, it should maintain its own snapshot before the hat transfer.
    /// @param member The address whose power should be synced
    function syncPower(address member) external;

    /// @notice Batch sync power for multiple members
    /// @param members Array of addresses to sync
    function batchSyncPower(address[] calldata members) external;
}
