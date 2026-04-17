// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ArrayLengthMismatch } from "../errors/CommonErrors.sol";

/// @notice Thrown when the sum of target allocation bps plus buffer bps does not equal 10_000.
/// @param actual The observed sum of targetBps entries plus bufferBps.
/// @param expected The required sum (always 10_000).
error BpsSumMismatch(uint256 actual, uint256 expected);

/// @title RebalancePolicy
/// @notice Stateless pure-math library computing target debt distribution for vault rebalancing.
/// @dev Called by the vault on deposit/withdraw flows and by the Gelato keeper on a schedule.
///      The library is deliberately stateless so the same function can be consumed from both
///      write paths (rebalance execution) and read paths (drift monitoring) without storage
///      coupling. Invariants enforced here:
///      - INV-1: sum(targetBps) + bufferBps == 10_000
///      - INV-2: sum(targetDebt) + bufferTarget == totalAssets (rounding dust absorbs into buffer)
///      - Array-length parity: targetBps.length == currentDebt.length
library RebalancePolicy {
    /// @notice Basis points denominator (10_000 bps == 100%).
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Compute the target USDC debt per strategy and the idle buffer target.
    /// @dev Floor division is used for each per-strategy target; the remainder is absorbed
    ///      into `bufferTarget` so that INV-2 holds exactly. Reverts if INV-1 is violated or
    ///      if input arrays have mismatched lengths. Pure — no state, no external calls.
    /// @param targetBps Per-strategy target allocation in basis points (length == currentDebt.length).
    /// @param bufferBps Bps kept as idle USDC inside the vault.
    /// @param totalAssets The vault's totalAssets() at call time (deploy + idle).
    /// @param currentDebt Current debt per strategy (unused here but length-checked so callers can
    ///        pass the same array they use for drift calculation without re-validating lengths).
    /// @return targetDebt Per-strategy target debt in USDC base units (floor division).
    /// @return bufferTarget Idle USDC target — absorbs any rounding dust to preserve INV-2.
    function computeTargetDebt(
        uint16[] memory targetBps,
        uint16 bufferBps,
        uint256 totalAssets,
        uint256[] memory currentDebt
    )
        internal
        pure
        returns (uint256[] memory targetDebt, uint256 bufferTarget)
    {
        uint256 n = targetBps.length;
        if (n != currentDebt.length) revert ArrayLengthMismatch();

        // INV-1: validate bps sum before any arithmetic. Using uint256 accumulator avoids
        // uint16 overflow when a malformed preset passes large values.
        uint256 bpsSum = uint256(bufferBps);
        for (uint256 i = 0; i < n; ++i) {
            bpsSum += uint256(targetBps[i]);
        }
        if (bpsSum != BPS_DENOMINATOR) revert BpsSumMismatch(bpsSum, BPS_DENOMINATOR);

        // Floor-divide totalAssets by each bps entry. Track the running sum so dust
        // (totalAssets - sum(targetDebt)) can be absorbed into bufferTarget.
        targetDebt = new uint256[](n);
        uint256 allocated;
        for (uint256 i = 0; i < n; ++i) {
            uint256 alloc = (totalAssets * uint256(targetBps[i])) / BPS_DENOMINATOR;
            targetDebt[i] = alloc;
            allocated += alloc;
        }

        // INV-2: remainder (including rounding dust) goes to the buffer.
        bufferTarget = totalAssets - allocated;
    }

    /// @notice Compute signed drift bps between current and target per-strategy debt.
    /// @dev Positive values mean the strategy is over-allocated (current > target); negative
    ///      values mean under-allocated. The denominator is `max(targetDebt[i], currentDebt[i])`
    ///      so a zero target does not cause a division-by-zero; when both are zero, drift is 0.
    ///      Pure — no state, no external calls.
    /// @param targetDebt Per-strategy target debt (from computeTargetDebt).
    /// @param currentDebt Per-strategy observed debt.
    /// @return driftBps Signed per-strategy drift in basis points.
    function computeDriftBps(
        uint256[] memory targetDebt,
        uint256[] memory currentDebt
    )
        internal
        pure
        returns (int256[] memory driftBps)
    {
        uint256 n = targetDebt.length;
        if (n != currentDebt.length) revert ArrayLengthMismatch();

        driftBps = new int256[](n);
        for (uint256 i = 0; i < n; ++i) {
            uint256 tgt = targetDebt[i];
            uint256 cur = currentDebt[i];
            uint256 denom = tgt >= cur ? tgt : cur;

            // Both zero -> no drift, skip the arithmetic to avoid div-by-zero.
            if (denom == 0) {
                driftBps[i] = 0;
                continue;
            }

            // Signed delta = current - target. Compute in uint256 then widen to int256
            // with the correct sign to avoid mid-expression underflow.
            if (cur >= tgt) {
                uint256 delta = cur - tgt;
                driftBps[i] = int256((delta * BPS_DENOMINATOR) / denom);
            } else {
                uint256 delta = tgt - cur;
                driftBps[i] = -int256((delta * BPS_DENOMINATOR) / denom);
            }
        }
    }
}
