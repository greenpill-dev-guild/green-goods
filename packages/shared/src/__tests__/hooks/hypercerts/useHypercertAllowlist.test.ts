/**
 * useHypercertAllowlist Hook Tests
 * @vitest-environment jsdom
 *
 * Tests allowlist distribution sync: recalculates when contributors
 * or distribution mode change, respects custom mode, and avoids
 * infinite update loops via deep comparison.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockCalculateDistribution = vi.fn();

vi.mock("../../../lib/hypercerts", () => ({
  calculateDistribution: (...args: unknown[]) => mockCalculateDistribution(...args),
}));

import { useHypercertAllowlist } from "../../../hooks/hypercerts/useHypercertAllowlist";
import type { ContributorWeight, DistributionMode } from "../../../lib/hypercerts";
import type { AllowlistEntry } from "../../../types/hypercerts";

// ============================================
// Test Suite
// ============================================

describe("useHypercertAllowlist", () => {
  const mockOnChange = vi.fn();

  const defaultContributors: ContributorWeight[] = [
    { address: "0x1111111111111111111111111111111111111111", actionCount: 5 },
    { address: "0x2222222222222222222222222222222222222222", actionCount: 3 },
  ];

  const calculatedAllowlist: AllowlistEntry[] = [
    { address: "0x1111111111111111111111111111111111111111", units: 6250000000000000n },
    { address: "0x2222222222222222222222222222222222222222", units: 3750000000000000n },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateDistribution.mockReturnValue(calculatedAllowlist);
  });

  it("does nothing when no attestations are selected", () => {
    renderHook(() =>
      useHypercertAllowlist({
        allowlist: [],
        contributorWeights: defaultContributors,
        distributionMode: "equal",
        hasSelectedAttestations: false,
        onAllowlistChange: mockOnChange,
      })
    );

    expect(mockCalculateDistribution).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("calculates distribution when attestations are selected", () => {
    renderHook(() =>
      useHypercertAllowlist({
        allowlist: [],
        contributorWeights: defaultContributors,
        distributionMode: "equal",
        hasSelectedAttestations: true,
        onAllowlistChange: mockOnChange,
      })
    );

    expect(mockCalculateDistribution).toHaveBeenCalledWith(defaultContributors, "equal", []);
    expect(mockOnChange).toHaveBeenCalledWith(calculatedAllowlist);
  });

  it("maps 'proportional' distribution mode to 'count'", () => {
    renderHook(() =>
      useHypercertAllowlist({
        allowlist: [],
        contributorWeights: defaultContributors,
        distributionMode: "proportional",
        hasSelectedAttestations: true,
        onAllowlistChange: mockOnChange,
      })
    );

    // "proportional" maps to "count" internally
    expect(mockCalculateDistribution).toHaveBeenCalledWith(defaultContributors, "count", []);
  });

  it("skips custom mode when allowlist already has entries", () => {
    const existingAllowlist: AllowlistEntry[] = [
      { address: "0x1111111111111111111111111111111111111111", units: 5000000000000000n },
      { address: "0x2222222222222222222222222222222222222222", units: 5000000000000000n },
    ];

    renderHook(() =>
      useHypercertAllowlist({
        allowlist: existingAllowlist,
        contributorWeights: defaultContributors,
        distributionMode: "custom",
        hasSelectedAttestations: true,
        onAllowlistChange: mockOnChange,
      })
    );

    // Custom mode with existing entries should not recalculate
    expect(mockCalculateDistribution).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("does not call onChange when distribution is identical", () => {
    // Return the same data that's already in the allowlist
    mockCalculateDistribution.mockReturnValue(calculatedAllowlist);

    renderHook(() =>
      useHypercertAllowlist({
        allowlist: calculatedAllowlist, // Same as what would be calculated
        contributorWeights: defaultContributors,
        distributionMode: "equal",
        hasSelectedAttestations: true,
        onAllowlistChange: mockOnChange,
      })
    );

    // Deep comparison should detect no change
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("calls onChange when distribution differs", () => {
    const differentAllowlist: AllowlistEntry[] = [
      { address: "0x1111111111111111111111111111111111111111", units: 1000n },
      { address: "0x2222222222222222222222222222222222222222", units: 2000n },
    ];

    renderHook(() =>
      useHypercertAllowlist({
        allowlist: differentAllowlist,
        contributorWeights: defaultContributors,
        distributionMode: "equal",
        hasSelectedAttestations: true,
        onAllowlistChange: mockOnChange,
      })
    );

    expect(mockOnChange).toHaveBeenCalledWith(calculatedAllowlist);
  });

  it("recalculates when distribution mode changes", () => {
    const { rerender } = renderHook(
      ({ mode }: { mode: DistributionMode }) =>
        useHypercertAllowlist({
          allowlist: [],
          contributorWeights: defaultContributors,
          distributionMode: mode,
          hasSelectedAttestations: true,
          onAllowlistChange: mockOnChange,
        }),
      { initialProps: { mode: "equal" as DistributionMode } }
    );

    vi.clearAllMocks();
    mockCalculateDistribution.mockReturnValue(calculatedAllowlist);

    rerender({ mode: "count" });

    expect(mockCalculateDistribution).toHaveBeenCalledWith(
      defaultContributors,
      "count",
      expect.anything()
    );
  });
});
