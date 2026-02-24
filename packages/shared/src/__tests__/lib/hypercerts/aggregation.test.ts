import { describe, it, expect } from "vitest";
import {
  aggregateOutcomeMetrics,
  buildContributorStats,
  deriveWorkTimeframe,
} from "../../../lib/hypercerts/aggregation";
import type { HypercertAttestation } from "../../../types/hypercerts";

// ============================================
// Test Helpers
// ============================================

function createMockAttestation(
  overrides: Partial<HypercertAttestation> = {}
): HypercertAttestation {
  return {
    id: `attestation-${Math.random().toString(36).slice(2)}`,
    workUid: `work-${Math.random().toString(36).slice(2)}`,
    gardenId: "garden-1",
    title: "Test Work",
    workScope: ["gardening"],
    gardenerAddress: "0x0000000000000000000000000000000000000001",
    mediaUrls: [],
    createdAt: 1704067200, // 2024-01-01
    approvedAt: 1704153600, // 2024-01-02
    ...overrides,
  };
}

// ============================================
// aggregateOutcomeMetrics Tests
// ============================================

describe("aggregateOutcomeMetrics", () => {
  it("returns empty predefined and custom for empty attestations", () => {
    const result = aggregateOutcomeMetrics([]);

    expect(result.predefined).toEqual({
      attestation_count: {
        value: 0,
        unit: "count",
        aggregation: "count",
        label: "Attestation count",
      },
    });
    expect(result.custom).toEqual({});
  });

  it("sums metric values across attestations", () => {
    const attestations = [
      createMockAttestation({
        metrics: {
          trees_planted: { value: 10, unit: "trees" },
          area_covered: { value: 100, unit: "sqm" },
        },
      }),
      createMockAttestation({
        metrics: {
          trees_planted: { value: 15, unit: "trees" },
          area_covered: { value: 50, unit: "sqm" },
        },
      }),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    expect(result.predefined.trees_planted).toEqual({
      value: 25,
      unit: "trees",
      aggregation: "sum",
      label: "Trees Planted",
    });
    expect(result.predefined.area_covered).toEqual({
      value: 150,
      unit: "sqm",
      aggregation: "sum",
      label: "Area Covered",
    });
  });

  it("always includes attestation_count", () => {
    const attestations = [
      createMockAttestation(),
      createMockAttestation(),
      createMockAttestation(),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    expect(result.predefined.attestation_count).toEqual({
      value: 3,
      unit: "count",
      aggregation: "count",
      label: "Attestation count",
    });
  });

  it("handles attestations with no metrics", () => {
    const attestations = [
      createMockAttestation({ metrics: null }),
      createMockAttestation({ metrics: undefined }),
      createMockAttestation({
        metrics: { trees_planted: { value: 5, unit: "trees" } },
      }),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    expect(result.predefined.trees_planted.value).toBe(5);
    expect(result.predefined.attestation_count.value).toBe(3);
  });

  it("ignores invalid metric values (NaN)", () => {
    const attestations = [
      createMockAttestation({
        metrics: {
          valid_metric: { value: 10, unit: "units" },
          invalid_metric: { value: NaN, unit: "units" },
        },
      }),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    expect(result.predefined.valid_metric).toBeDefined();
    expect(result.predefined.invalid_metric).toBeUndefined();
  });

  it("ignores metrics with non-number values", () => {
    const attestations = [
      createMockAttestation({
        metrics: {
          valid_metric: { value: 10, unit: "units" },
          // @ts-expect-error - testing runtime behavior with invalid data
          string_metric: { value: "ten", unit: "units" },
        },
      }),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    expect(result.predefined.valid_metric).toBeDefined();
    expect(result.predefined.string_metric).toBeUndefined();
  });

  it("titleizes metric keys for labels", () => {
    const attestations = [
      createMockAttestation({
        metrics: {
          trees_planted_in_park: { value: 10, unit: "trees" },
        },
      }),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    expect(result.predefined.trees_planted_in_park.label).toBe(
      "Trees Planted In Park"
    );
  });

  it("preserves unit from first occurrence", () => {
    const attestations = [
      createMockAttestation({
        metrics: { distance: { value: 100, unit: "meters" } },
      }),
      createMockAttestation({
        metrics: { distance: { value: 50, unit: "km" } }, // Different unit
      }),
    ];

    const result = aggregateOutcomeMetrics(attestations);

    // Should use first unit encountered
    expect(result.predefined.distance.unit).toBe("meters");
    expect(result.predefined.distance.value).toBe(150);
  });
});

// ============================================
// buildContributorStats Tests
// ============================================

describe("buildContributorStats", () => {
  it("returns empty array for no attestations", () => {
    const result = buildContributorStats([]);
    expect(result).toEqual([]);
  });

  it("builds stats for single contributor", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
        metrics: { value: { value: 100, unit: "units" } },
      }),
    ];

    const result = buildContributorStats(attestations);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      address: "0x0000000000000000000000000000000000000001",
      actionCount: 1,
      actionValue: 100,
      label: "Alice",
    });
  });

  it("aggregates stats for same contributor across multiple attestations", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
        metrics: {
          metric1: { value: 50, unit: "units" },
          metric2: { value: 30, unit: "other" },
        },
      }),
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
        metrics: { metric1: { value: 20, unit: "units" } },
      }),
    ];

    const result = buildContributorStats(attestations);

    expect(result).toHaveLength(1);
    expect(result[0].actionCount).toBe(2);
    expect(result[0].actionValue).toBe(100); // 50 + 30 + 20
  });

  it("separates stats for different contributors", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
        metrics: { value: { value: 100, unit: "units" } },
      }),
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000002",
        gardenerName: "Bob",
        metrics: { value: { value: 200, unit: "units" } },
      }),
    ];

    const result = buildContributorStats(attestations);

    expect(result).toHaveLength(2);
    const alice = result.find(
      (c) => c.address === "0x0000000000000000000000000000000000000001"
    );
    const bob = result.find(
      (c) => c.address === "0x0000000000000000000000000000000000000002"
    );
    expect(alice?.actionCount).toBe(1);
    expect(alice?.actionValue).toBe(100);
    expect(bob?.actionCount).toBe(1);
    expect(bob?.actionValue).toBe(200);
  });

  it("handles attestations with no metrics (0 action value)", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        metrics: null,
      }),
    ];

    const result = buildContributorStats(attestations);

    expect(result[0].actionCount).toBe(1);
    expect(result[0].actionValue).toBe(0);
  });

  it("handles null gardenerName", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: null,
      }),
    ];

    const result = buildContributorStats(attestations);

    expect(result[0].label).toBeUndefined();
  });

  it("preserves first encountered label for same address", () => {
    const attestations = [
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice",
      }),
      createMockAttestation({
        gardenerAddress: "0x0000000000000000000000000000000000000001",
        gardenerName: "Alice Updated",
      }),
    ];

    const result = buildContributorStats(attestations);

    expect(result[0].label).toBe("Alice");
  });
});

// ============================================
// deriveWorkTimeframe Tests
// ============================================

describe("deriveWorkTimeframe", () => {
  it("returns null for start and end with empty attestations", () => {
    const result = deriveWorkTimeframe([]);

    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });

  it("derives timeframe from single attestation", () => {
    const attestations = [
      createMockAttestation({
        createdAt: 1704067200, // 2024-01-01
        approvedAt: 1704153600, // 2024-01-02
      }),
    ];

    const result = deriveWorkTimeframe(attestations);

    expect(result.start).toBe(1704067200);
    expect(result.end).toBe(1704153600);
  });

  it("finds earliest start and latest end across multiple attestations", () => {
    const attestations = [
      createMockAttestation({
        createdAt: 1704067200, // 2024-01-01
        approvedAt: 1704153600, // 2024-01-02
      }),
      createMockAttestation({
        createdAt: 1703980800, // 2023-12-31 (earlier)
        approvedAt: 1704240000, // 2024-01-03 (later)
      }),
      createMockAttestation({
        createdAt: 1704100000,
        approvedAt: 1704200000,
      }),
    ];

    const result = deriveWorkTimeframe(attestations);

    expect(result.start).toBe(1703980800); // Earliest createdAt
    expect(result.end).toBe(1704240000); // Latest approvedAt
  });

  it("uses approvedAt as fallback for createdAt", () => {
    const attestations = [
      createMockAttestation({
        createdAt: undefined as unknown as number,
        approvedAt: 1704153600,
      }),
    ];

    const result = deriveWorkTimeframe(attestations);

    expect(result.start).toBe(1704153600);
    expect(result.end).toBe(1704153600);
  });

  it("uses createdAt as fallback for approvedAt", () => {
    const attestations = [
      createMockAttestation({
        createdAt: 1704067200,
        approvedAt: undefined as unknown as number,
      }),
    ];

    const result = deriveWorkTimeframe(attestations);

    expect(result.start).toBe(1704067200);
    expect(result.end).toBe(1704067200);
  });

  it("returns null for non-finite timestamps", () => {
    const attestations = [
      createMockAttestation({
        createdAt: NaN,
        approvedAt: NaN,
      }),
    ];

    const result = deriveWorkTimeframe(attestations);

    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
  });

  it("handles mix of valid and invalid timestamps", () => {
    const attestations = [
      createMockAttestation({
        createdAt: NaN,
        approvedAt: 1704153600,
      }),
      createMockAttestation({
        createdAt: 1704067200,
        approvedAt: NaN,
      }),
    ];

    const result = deriveWorkTimeframe(attestations);

    expect(result.start).toBe(1704067200);
    expect(result.end).toBe(1704153600);
  });
});
