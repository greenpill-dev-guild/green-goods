// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { RebalancePolicy, BpsSumMismatch } from "../../src/lib/RebalancePolicy.sol";
import { ArrayLengthMismatch } from "../../src/errors/CommonErrors.sol";

/// @title RebalancePolicyHarness
/// @notice Thin external wrapper so library reverts surface at a deeper call depth
///         than the test cheatcode, satisfying vm.expectRevert semantics.
contract RebalancePolicyHarness {
    function computeTargetDebt(
        uint16[] memory targetBps,
        uint16 bufferBps,
        uint256 totalAssets,
        uint256[] memory currentDebt
    )
        external
        pure
        returns (uint256[] memory, uint256)
    {
        return RebalancePolicy.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);
    }

    function computeDriftBps(
        uint256[] memory targetDebt,
        uint256[] memory currentDebt
    )
        external
        pure
        returns (int256[] memory)
    {
        return RebalancePolicy.computeDriftBps(targetDebt, currentDebt);
    }
}

/// @title RebalancePolicyTest
/// @notice Unit tests for the stateless RebalancePolicy library.
/// @dev Covers INV-1 (bps sum), INV-2 (target + buffer == totalAssets), array
///      length validation, and drift calculation. Drift denominator uses
///      `max(targetDebt[i], currentDebt[i])` to avoid div-by-zero when a
///      strategy has a zero target or zero current balance.
contract RebalancePolicyTest is Test {
    RebalancePolicyHarness private harness;

    function setUp() public {
        harness = new RebalancePolicyHarness();
    }

    // =========================================================================
    // computeTargetDebt — happy paths
    // =========================================================================

    function test_computeTargetDebt_twoStrategyNoDrift() public {
        uint16[] memory targetBps = new uint16[](2);
        targetBps[0] = 8000; // 80%
        targetBps[1] = 2000; // 20%
        uint16 bufferBps = 0;
        uint256 totalAssets = 100e6;
        uint256[] memory currentDebt = new uint256[](2);

        (uint256[] memory targetDebt, uint256 bufferTarget) =
            RebalancePolicy.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);

        assertEq(targetDebt[0], 80e6, "targetDebt[0] should be 80e6");
        assertEq(targetDebt[1], 20e6, "targetDebt[1] should be 20e6");
        assertEq(bufferTarget, 0, "bufferTarget should be 0");
        assertEq(targetDebt[0] + targetDebt[1] + bufferTarget, totalAssets, "INV-2 violated");
    }

    function test_computeTargetDebt_withBuffer() public {
        uint16[] memory targetBps = new uint16[](2);
        targetBps[0] = 6500; // 65%
        targetBps[1] = 2000; // 20%
        uint16 bufferBps = 1500; // 15%
        uint256 totalAssets = 100e6;
        uint256[] memory currentDebt = new uint256[](2);

        (uint256[] memory targetDebt, uint256 bufferTarget) =
            RebalancePolicy.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);

        assertEq(targetDebt[0], 65e6, "targetDebt[0] should be 65e6");
        assertEq(targetDebt[1], 20e6, "targetDebt[1] should be 20e6");
        assertEq(bufferTarget, 15e6, "bufferTarget should be 15e6");
        assertEq(targetDebt[0] + targetDebt[1] + bufferTarget, totalAssets, "INV-2 violated");
    }

    function test_computeTargetDebt_threeStrategyBalanced() public {
        uint16[] memory targetBps = new uint16[](3);
        targetBps[0] = 4500; // 45%
        targetBps[1] = 2500; // 25%
        targetBps[2] = 1500; // 15%
        uint16 bufferBps = 1500; // 15%
        uint256 totalAssets = 100e6;
        uint256[] memory currentDebt = new uint256[](3);

        (uint256[] memory targetDebt, uint256 bufferTarget) =
            RebalancePolicy.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);

        assertEq(targetDebt[0], 45e6, "targetDebt[0] should be 45e6");
        assertEq(targetDebt[1], 25e6, "targetDebt[1] should be 25e6");
        assertEq(targetDebt[2], 15e6, "targetDebt[2] should be 15e6");
        assertEq(bufferTarget, 15e6, "bufferTarget should be 15e6");
        assertEq(targetDebt[0] + targetDebt[1] + targetDebt[2] + bufferTarget, totalAssets, "INV-2 violated");
    }

    function test_computeTargetDebt_roundingGoesToBuffer() public {
        // totalAssets=123, 50/50 split, 0% buffer.
        // Floor division: 123 * 5000 / 10_000 = 61 (x2 = 122)
        // Remaining 1 wei of dust absorbs into bufferTarget.
        uint16[] memory targetBps = new uint16[](2);
        targetBps[0] = 5000;
        targetBps[1] = 5000;
        uint16 bufferBps = 0;
        uint256 totalAssets = 123;
        uint256[] memory currentDebt = new uint256[](2);

        (uint256[] memory targetDebt, uint256 bufferTarget) =
            RebalancePolicy.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);

        assertEq(targetDebt[0], 61, "targetDebt[0] should floor to 61");
        assertEq(targetDebt[1], 61, "targetDebt[1] should floor to 61");
        assertEq(bufferTarget, 1, "bufferTarget should absorb 1 wei of dust");
        assertEq(targetDebt[0] + targetDebt[1] + bufferTarget, totalAssets, "INV-2 violated");
    }

    // =========================================================================
    // computeTargetDebt — reverts
    // =========================================================================

    function test_computeTargetDebt_revertsBpsSumMismatch() public {
        // targetBps [5000, 4000] + bufferBps 500 sums to 9500, not 10_000.
        uint16[] memory targetBps = new uint16[](2);
        targetBps[0] = 5000;
        targetBps[1] = 4000;
        uint16 bufferBps = 500;
        uint256 totalAssets = 100e6;
        uint256[] memory currentDebt = new uint256[](2);

        vm.expectRevert(abi.encodeWithSelector(BpsSumMismatch.selector, uint256(9500), uint256(10_000)));
        harness.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);
    }

    function test_computeTargetDebt_revertsArrayLengthMismatch() public {
        // targetBps has 2 entries, currentDebt has 3.
        uint16[] memory targetBps = new uint16[](2);
        targetBps[0] = 8000;
        targetBps[1] = 2000;
        uint16 bufferBps = 0;
        uint256 totalAssets = 100e6;
        uint256[] memory currentDebt = new uint256[](3);

        vm.expectRevert(ArrayLengthMismatch.selector);
        harness.computeTargetDebt(targetBps, bufferBps, totalAssets, currentDebt);
    }

    // =========================================================================
    // computeDriftBps
    // =========================================================================

    /// @notice Drift calculation uses max(targetDebt[i], currentDebt[i]) as denominator.
    /// @dev target [50e6, 50e6], current [60e6, 40e6]:
    ///      i=0: (60e6 - 50e6) * 10_000 / max(50e6, 60e6) = 10e6 * 10_000 / 60e6 = 1666 (floor)
    ///      i=1: (40e6 - 50e6) * 10_000 / max(50e6, 40e6) = -10e6 * 10_000 / 50e6 = -2000
    function test_computeDriftBps_overAllocated() public {
        uint256[] memory targetDebt = new uint256[](2);
        targetDebt[0] = 50e6;
        targetDebt[1] = 50e6;
        uint256[] memory currentDebt = new uint256[](2);
        currentDebt[0] = 60e6; // over-allocated by 10e6
        currentDebt[1] = 40e6; // under-allocated by 10e6

        int256[] memory driftBps = RebalancePolicy.computeDriftBps(targetDebt, currentDebt);

        assertEq(driftBps[0], int256(1666), "over-allocated drift should be +1666 bps (floor)");
        assertEq(driftBps[1], int256(-2000), "under-allocated drift should be -2000 bps");
    }

    /// @notice Verifies no div-by-zero when a strategy has zero target.
    /// @dev target [0, 100e6], current [10e6, 90e6]:
    ///      i=0: (10e6 - 0) * 10_000 / max(0, 10e6) = 10e6 * 10_000 / 10e6 = +10_000 bps
    ///      i=1: (90e6 - 100e6) * 10_000 / max(100e6, 90e6) = -10e6 * 10_000 / 100e6 = -1000 bps
    function test_computeDriftBps_zeroTarget() public {
        uint256[] memory targetDebt = new uint256[](2);
        targetDebt[0] = 0;
        targetDebt[1] = 100e6;
        uint256[] memory currentDebt = new uint256[](2);
        currentDebt[0] = 10e6;
        currentDebt[1] = 90e6;

        int256[] memory driftBps = RebalancePolicy.computeDriftBps(targetDebt, currentDebt);

        assertEq(driftBps[0], int256(10_000), "zero-target with non-zero current should be +10_000 bps");
        assertEq(driftBps[1], int256(-1000), "slightly under-allocated should be -1000 bps");
    }

    /// @notice Verifies drift is zero when both target and current are zero (no div-by-zero).
    function test_computeDriftBps_bothZero() public {
        uint256[] memory targetDebt = new uint256[](2);
        targetDebt[0] = 0;
        targetDebt[1] = 100e6;
        uint256[] memory currentDebt = new uint256[](2);
        currentDebt[0] = 0; // both zero for i=0
        currentDebt[1] = 100e6;

        int256[] memory driftBps = RebalancePolicy.computeDriftBps(targetDebt, currentDebt);

        assertEq(driftBps[0], int256(0), "both zero should produce zero drift (no div-by-zero)");
        assertEq(driftBps[1], int256(0), "target==current should produce zero drift");
    }

    /// @notice Drift helper must revert on array length mismatch.
    function test_computeDriftBps_revertsArrayLengthMismatch() public {
        uint256[] memory targetDebt = new uint256[](2);
        uint256[] memory currentDebt = new uint256[](3);

        vm.expectRevert(ArrayLengthMismatch.selector);
        harness.computeDriftBps(targetDebt, currentDebt);
    }

    // =========================================================================
    // Fuzz: INV-2 invariant (sum(targetDebt) + bufferTarget == totalAssets)
    // =========================================================================

    /// @notice Fuzz test asserting INV-2 holds for any valid (totalAssets, targetBps, bufferBps) tuple.
    /// @dev Bounds ensure bps sum == 10_000 and totalAssets stays within a sane range.
    ///      `bound()` is sufficient — we do not need vm.assume since bounding guarantees validity.
    /// forge-config: default.fuzz.runs = 10000
    /// forge-config: test.fuzz.runs = 10000
    function testFuzz_targetDebtPlusBufferEqualsTotalAssets(
        uint256 totalAssets,
        uint16 targetBps1,
        uint16 targetBps2
    )
        public
    {
        totalAssets = bound(totalAssets, 1, type(uint128).max);
        targetBps1 = uint16(bound(uint256(targetBps1), 0, 10_000));
        targetBps2 = uint16(bound(uint256(targetBps2), 0, 10_000 - uint256(targetBps1)));
        uint16 bufferBps = uint16(10_000 - uint256(targetBps1) - uint256(targetBps2));

        uint16[] memory tBps = new uint16[](2);
        tBps[0] = targetBps1;
        tBps[1] = targetBps2;

        uint256[] memory cur = new uint256[](2);

        (uint256[] memory targetDebt, uint256 bufferTarget) =
            RebalancePolicy.computeTargetDebt(tBps, bufferBps, totalAssets, cur);

        assertEq(targetDebt[0] + targetDebt[1] + bufferTarget, totalAssets, "INV-2 violated");
    }
}
