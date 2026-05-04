/**
 * percent-points utility tests
 *
 * Pinning tests for the percent ↔ points translation that drives every
 * WeightAllocator save. Silently-wrong math here = silently-wrong on-chain
 * votes (the file's own header is explicit about that).
 *
 * Cleanup item A1 from .plans/active/admin-design-revamp/handoffs/claude-cleanup.md.
 */

import { describe, expect, it } from "vitest";

import {
  allocationsToPercentMap,
  percentMapToSignedDeltas,
  percentToPoints,
  pointsToPercent,
} from "../../../utils/conviction/percent-points";
import type { ConvictionAllocations, VoterAllocation } from "../../../types/conviction";

describe("pointsToPercent", () => {
  it("returns 0 when budget is zero", () => {
    expect(pointsToPercent(500n, 0n)).toBe(0);
  });

  it("returns 0 when budget is negative", () => {
    expect(pointsToPercent(500n, -1n)).toBe(0);
  });

  it("returns 0 when amount is zero", () => {
    expect(pointsToPercent(0n, 1000n)).toBe(0);
  });

  it("returns 50 when amount is half of budget", () => {
    expect(pointsToPercent(500n, 1000n)).toBe(50);
  });

  it("returns 100 when amount equals budget", () => {
    expect(pointsToPercent(1000n, 1000n)).toBe(100);
  });

  it("preserves 2 decimal places of precision", () => {
    // 333 / 1000 → 33.30%
    expect(pointsToPercent(333n, 1000n)).toBeCloseTo(33.3, 2);
  });

  it("handles large bigint budgets without precision loss for round numbers", () => {
    expect(pointsToPercent(10n ** 18n, 4n * 10n ** 18n)).toBe(25);
  });
});

describe("percentToPoints", () => {
  it("returns 0n when budget is zero", () => {
    expect(percentToPoints(50, 0n)).toBe(0n);
  });

  it("returns 0n when budget is negative", () => {
    expect(percentToPoints(50, -1n)).toBe(0n);
  });

  it("returns 0n when percent is NaN", () => {
    expect(percentToPoints(Number.NaN, 1000n)).toBe(0n);
  });

  it("returns 0n when percent is 0", () => {
    expect(percentToPoints(0, 1000n)).toBe(0n);
  });

  it("returns budget when percent is 100", () => {
    expect(percentToPoints(100, 1000n)).toBe(1000n);
  });

  it("returns half budget when percent is 50", () => {
    expect(percentToPoints(50, 1000n)).toBe(500n);
  });

  it("clamps percents above 100 to budget", () => {
    expect(percentToPoints(110, 1000n)).toBe(1000n);
  });

  it("clamps negative percents to 0", () => {
    expect(percentToPoints(-10, 1000n)).toBe(0n);
  });

  it("rounds fractional percents to nearest 0.01% (slider drag jitter)", () => {
    // 33.335 → rounds to 3334 hundredths → 333.4 of 1000
    expect(percentToPoints(33.335, 1000n)).toBe(333n); // (3334 * 1000) / 10000 = 333
  });
});

describe("pointsToPercent ↔ percentToPoints round-trip", () => {
  it("round-trips integers within precision", () => {
    const budget = 1000n;
    for (const pct of [0, 25, 50, 75, 100]) {
      const points = percentToPoints(pct, budget);
      expect(pointsToPercent(points, budget)).toBe(pct);
    }
  });

  it("round-trips fractional percents within 0.01% precision", () => {
    const budget = 10_000n;
    const pct = 12.34;
    const points = percentToPoints(pct, budget);
    expect(pointsToPercent(points, budget)).toBeCloseTo(pct, 2);
  });
});

describe("allocationsToPercentMap", () => {
  const budget = 1000n;

  it("returns empty map for empty allocations", () => {
    expect(allocationsToPercentMap([], budget)).toEqual({});
  });

  it("keys the map by hypercertId.toString() to match ConvictionProposal.id", () => {
    const allocations: VoterAllocation[] = [
      { hypercertId: 1n, amount: 250n },
      { hypercertId: 42n, amount: 500n },
    ];
    const map = allocationsToPercentMap(allocations, budget);
    expect(Object.keys(map).sort()).toEqual(["1", "42"]);
    expect(map["1"]).toBe(25);
    expect(map["42"]).toBe(50);
  });

  it("returns 0 percent for every entry when budget is zero", () => {
    const allocations: VoterAllocation[] = [
      { hypercertId: 1n, amount: 250n },
      { hypercertId: 2n, amount: 500n },
    ];
    expect(allocationsToPercentMap(allocations, 0n)).toEqual({ "1": 0, "2": 0 });
  });
});

describe("percentMapToSignedDeltas", () => {
  const budget = 1000n;

  it("returns an empty array when budget is zero", () => {
    expect(percentMapToSignedDeltas({ "1": 50 }, { "1": 0 }, 0n)).toEqual([]);
  });

  it("returns an empty array when budget is negative", () => {
    expect(percentMapToSignedDeltas({ "1": 50 }, { "1": 0 }, -1n)).toEqual([]);
  });

  it("returns an empty array when old and new are identical", () => {
    const allocations: ConvictionAllocations = { "1": 50, "2": 25 };
    expect(percentMapToSignedDeltas(allocations, allocations, budget)).toEqual([]);
  });

  it("emits a positive delta for an id that appears only in the new map", () => {
    const deltas = percentMapToSignedDeltas({}, { "1": 50 }, budget);
    expect(deltas).toEqual([{ hypercertId: 1n, deltaSupport: 500n }]);
  });

  it("emits a negative delta for an id that appears only in the old map", () => {
    const deltas = percentMapToSignedDeltas({ "1": 50 }, {}, budget);
    expect(deltas).toEqual([{ hypercertId: 1n, deltaSupport: -500n }]);
  });

  it("emits a signed delta for an id present in both maps with a different percent", () => {
    const deltas = percentMapToSignedDeltas({ "1": 50 }, { "1": 75 }, budget);
    expect(deltas).toEqual([{ hypercertId: 1n, deltaSupport: 250n }]);
  });

  it("skips ids whose percent is unchanged across both maps", () => {
    const deltas = percentMapToSignedDeltas({ "1": 50, "2": 25 }, { "1": 50, "2": 50 }, budget);
    expect(deltas).toEqual([{ hypercertId: 2n, deltaSupport: 250n }]);
  });

  it("converts each id key back to a bigint in deltaSupport math", () => {
    const deltas = percentMapToSignedDeltas({}, { "100": 10 }, budget);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({ hypercertId: 100n });
    // 10% of 1000 budget = 100 points
    expect(deltas[0]?.deltaSupport).toBe(100n);
  });

  it("handles add + remove + change in the same diff", () => {
    const deltas = percentMapToSignedDeltas({ "1": 50, "2": 25 }, { "2": 50, "3": 10 }, budget);
    const sorted = deltas.slice().sort((a, b) => Number(a.hypercertId - b.hypercertId));
    expect(sorted).toEqual([
      { hypercertId: 1n, deltaSupport: -500n },
      { hypercertId: 2n, deltaSupport: 250n },
      { hypercertId: 3n, deltaSupport: 100n },
    ]);
  });
});
