/**
 * useHypercertContributorWeights Hook Tests
 * @vitest-environment jsdom
 *
 * Tests that contributor weights are correctly derived from
 * selected attestations via the buildContributorWeights function.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockBuildContributorWeights = vi.fn();

vi.mock("../../../lib/hypercerts", () => ({
  buildContributorWeights: (...args: unknown[]) => mockBuildContributorWeights(...args),
}));

import { useHypercertContributorWeights } from "../../../hooks/hypercerts/useHypercertContributorWeights";
import type { ContributorWeight } from "../../../lib/hypercerts";
import { createMockHypercertAttestation } from "../../test-utils/mock-factories";

// ============================================
// Test Suite
// ============================================

describe("useHypercertContributorWeights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes attestations to buildContributorWeights", () => {
    const attestations = [
      createMockHypercertAttestation({ id: "0xAtt1" }),
      createMockHypercertAttestation({ id: "0xAtt2" }),
    ];
    const expectedWeights: ContributorWeight[] = [
      { address: "0x1111111111111111111111111111111111111111", actionCount: 2 },
    ];
    mockBuildContributorWeights.mockReturnValue(expectedWeights);

    const { result } = renderHook(() => useHypercertContributorWeights(attestations));

    expect(mockBuildContributorWeights).toHaveBeenCalledWith(attestations);
    expect(result.current).toEqual(expectedWeights);
  });

  it("returns empty array for empty attestations", () => {
    mockBuildContributorWeights.mockReturnValue([]);

    const { result } = renderHook(() => useHypercertContributorWeights([]));

    expect(result.current).toEqual([]);
    expect(mockBuildContributorWeights).toHaveBeenCalledWith([]);
  });

  it("memoizes result for same attestation reference", () => {
    const attestations = [createMockHypercertAttestation()];
    const weights: ContributorWeight[] = [
      { address: "0x1111111111111111111111111111111111111111", actionCount: 1 },
    ];
    mockBuildContributorWeights.mockReturnValue(weights);

    const { result, rerender } = renderHook(({ atts }) => useHypercertContributorWeights(atts), {
      initialProps: { atts: attestations },
    });

    const firstResult = result.current;

    // Rerender with same reference - should not recalculate
    rerender({ atts: attestations });

    expect(result.current).toBe(firstResult);
    expect(mockBuildContributorWeights).toHaveBeenCalledTimes(1);
  });

  it("recalculates when attestation reference changes", () => {
    const att1 = [createMockHypercertAttestation({ id: "0xAtt1" })];
    const att2 = [
      createMockHypercertAttestation({ id: "0xAtt1" }),
      createMockHypercertAttestation({ id: "0xAtt2" }),
    ];

    const weights1: ContributorWeight[] = [
      { address: "0x1111111111111111111111111111111111111111", actionCount: 1 },
    ];
    const weights2: ContributorWeight[] = [
      { address: "0x1111111111111111111111111111111111111111", actionCount: 2 },
    ];

    mockBuildContributorWeights.mockReturnValueOnce(weights1).mockReturnValueOnce(weights2);

    const { result, rerender } = renderHook(({ atts }) => useHypercertContributorWeights(atts), {
      initialProps: { atts: att1 },
    });

    expect(result.current).toEqual(weights1);

    rerender({ atts: att2 });

    expect(result.current).toEqual(weights2);
    expect(mockBuildContributorWeights).toHaveBeenCalledTimes(2);
  });
});
