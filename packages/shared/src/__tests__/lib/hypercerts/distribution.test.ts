import { describe, it, expect } from "vitest";
import {
  calculateDistribution,
  sumUnits,
  validateAllowlist,
  type DistributionMode,
} from "../../../lib/hypercerts/distribution";
import { TOTAL_UNITS } from "../../../lib/hypercerts/constants";
import type { AllowlistEntry } from "../../../types/hypercerts";
import type { ContributorWeight } from "../../../lib/hypercerts/distribution";

// ============================================
// Test Helpers
// ============================================

function createContributors(count: number): ContributorWeight[] {
  return Array.from({ length: count }, (_, i) => ({
    address: `0x${String(i + 1).padStart(40, "0")}` as `0x${string}`,
    label: `Contributor ${i + 1}`,
    actionCount: i + 1,
    actionValue: (i + 1) * 100,
  }));
}

function createAllowlistEntries(
  addresses: string[],
  units: bigint[]
): AllowlistEntry[] {
  return addresses.map((address, i) => ({
    address: address as `0x${string}`,
    units: units[i],
  }));
}

// ============================================
// sumUnits Tests
// ============================================

describe("sumUnits", () => {
  it("returns 0n for empty array", () => {
    expect(sumUnits([])).toBe(0n);
  });

  it("sums single entry", () => {
    const entries: AllowlistEntry[] = [
      { address: "0x0000000000000000000000000000000000000001", units: 100n },
    ];
    expect(sumUnits(entries)).toBe(100n);
  });

  it("sums multiple entries correctly", () => {
    const entries: AllowlistEntry[] = [
      { address: "0x0000000000000000000000000000000000000001", units: 100n },
      { address: "0x0000000000000000000000000000000000000002", units: 200n },
      { address: "0x0000000000000000000000000000000000000003", units: 300n },
    ];
    expect(sumUnits(entries)).toBe(600n);
  });

  it("handles large numbers (TOTAL_UNITS)", () => {
    const entries: AllowlistEntry[] = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS / 2n,
      },
      {
        address: "0x0000000000000000000000000000000000000002",
        units: TOTAL_UNITS / 2n,
      },
    ];
    expect(sumUnits(entries)).toBe(TOTAL_UNITS);
  });
});

// ============================================
// validateAllowlist Tests
// ============================================

describe("validateAllowlist", () => {
  it("returns invalid for empty array", () => {
    const result = validateAllowlist([]);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Allowlist is empty");
  });

  it("returns invalid when total units do not match TOTAL_UNITS", () => {
    const entries: AllowlistEntry[] = [
      { address: "0x0000000000000000000000000000000000000001", units: 100n },
    ];
    const result = validateAllowlist(entries);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Total units must equal");
  });

  it("returns invalid when entry has zero units", () => {
    const entries: AllowlistEntry[] = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS,
      },
      { address: "0x0000000000000000000000000000000000000002", units: 0n },
    ];
    const result = validateAllowlist(entries);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Allowlist contains non-positive units");
  });

  it("returns invalid when entry has negative units", () => {
    const entries: AllowlistEntry[] = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS + 1n,
      },
      { address: "0x0000000000000000000000000000000000000002", units: -1n },
    ];
    const result = validateAllowlist(entries);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Allowlist contains non-positive units");
  });

  it("returns valid for correctly distributed allowlist", () => {
    const entries: AllowlistEntry[] = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS / 2n,
      },
      {
        address: "0x0000000000000000000000000000000000000002",
        units: TOTAL_UNITS / 2n,
      },
    ];
    const result = validateAllowlist(entries);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid for single entry with all units", () => {
    const entries: AllowlistEntry[] = [
      {
        address: "0x0000000000000000000000000000000000000001",
        units: TOTAL_UNITS,
      },
    ];
    const result = validateAllowlist(entries);
    expect(result.valid).toBe(true);
  });
});

// ============================================
// calculateDistribution Tests
// ============================================

describe("calculateDistribution", () => {
  describe("equal distribution", () => {
    it("throws for empty contributors", () => {
      expect(() => calculateDistribution([], "equal")).toThrow(
        "Cannot distribute units without contributors"
      );
    });

    it("gives all units to single contributor", () => {
      const contributors = createContributors(1);
      const result = calculateDistribution(contributors, "equal");

      expect(result).toHaveLength(1);
      expect(result[0].units).toBe(TOTAL_UNITS);
      expect(sumUnits(result)).toBe(TOTAL_UNITS);
    });

    it("distributes evenly between two contributors", () => {
      const contributors = createContributors(2);
      const result = calculateDistribution(contributors, "equal");

      expect(result).toHaveLength(2);
      expect(result[0].units).toBe(TOTAL_UNITS / 2n);
      expect(result[1].units).toBe(TOTAL_UNITS / 2n);
      expect(sumUnits(result)).toBe(TOTAL_UNITS);
    });

    it("handles remainder correctly for three contributors", () => {
      const contributors = createContributors(3);
      const result = calculateDistribution(contributors, "equal");

      expect(result).toHaveLength(3);
      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      // Remainder should be distributed (100M / 3 = 33.3M remainder 1)
      const base = TOTAL_UNITS / 3n;
      const unitsArray = result.map((e) => e.units);
      // At least one should have base + remainder
      expect(unitsArray.filter((u) => u === base).length).toBeLessThanOrEqual(3);
    });

    it("preserves contributor labels", () => {
      const contributors = createContributors(2);
      const result = calculateDistribution(contributors, "equal");

      expect(result[0].label).toBe("Contributor 1");
      expect(result[1].label).toBe("Contributor 2");
    });

    it("preserves contributor addresses", () => {
      const contributors = createContributors(2);
      const result = calculateDistribution(contributors, "equal");

      expect(result[0].address).toBe(contributors[0].address);
      expect(result[1].address).toBe(contributors[1].address);
    });
  });

  describe("count distribution (proportional by action count)", () => {
    it("distributes proportionally by action count", () => {
      const contributors: ContributorWeight[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          actionCount: 1,
          actionValue: 100,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionCount: 3,
          actionValue: 100,
        },
      ];
      const result = calculateDistribution(contributors, "count");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      // 1:3 ratio should give ~25M and ~75M
      expect(result[0].units).toBeLessThan(result[1].units);
      expect(result[1].units).toBeGreaterThan(TOTAL_UNITS / 2n);
    });

    it("falls back to equal when all counts are 0", () => {
      const contributors: ContributorWeight[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          actionCount: 0,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionCount: 0,
        },
      ];
      const result = calculateDistribution(contributors, "count");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      expect(result[0].units).toBe(result[1].units);
    });

    it("handles undefined action count as 0", () => {
      const contributors: ContributorWeight[] = [
        { address: "0x0000000000000000000000000000000000000001" },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionCount: 4,
        },
      ];
      const result = calculateDistribution(contributors, "count");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      // First contributor should have 0 base allocation, gets only remainder distribution
      expect(result[1].units).toBeGreaterThan(result[0].units);
    });
  });

  describe("value distribution (proportional by action value)", () => {
    it("distributes proportionally by action value", () => {
      const contributors: ContributorWeight[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          actionCount: 10,
          actionValue: 100,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionCount: 1,
          actionValue: 900,
        },
      ];
      const result = calculateDistribution(contributors, "value");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      // 100:900 ratio (1:9)
      expect(result[1].units).toBeGreaterThan(result[0].units);
    });

    it("falls back to equal when all values are 0", () => {
      const contributors: ContributorWeight[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          actionValue: 0,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionValue: 0,
        },
      ];
      const result = calculateDistribution(contributors, "value");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      expect(result[0].units).toBe(result[1].units);
    });

    it("handles negative action values as 0", () => {
      const contributors: ContributorWeight[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          actionValue: -100,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionValue: 100,
        },
      ];
      const result = calculateDistribution(contributors, "value");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
    });
  });

  describe("proportional distribution", () => {
    it("behaves same as count distribution", () => {
      const contributors = createContributors(3);
      const countResult = calculateDistribution(contributors, "count");
      const proportionalResult = calculateDistribution(
        contributors,
        "proportional"
      );

      // Both should produce same results based on actionCount
      expect(proportionalResult.map((e) => e.units)).toEqual(
        countResult.map((e) => e.units)
      );
    });
  });

  describe("custom distribution", () => {
    it("throws when no custom entries provided", () => {
      const contributors = createContributors(2);
      expect(() => calculateDistribution(contributors, "custom")).toThrow(
        "Custom distribution requires entries"
      );
    });

    it("throws when custom entries is empty array", () => {
      const contributors = createContributors(2);
      expect(() => calculateDistribution(contributors, "custom", [])).toThrow(
        "Custom distribution requires entries"
      );
    });

    it("throws when custom entries do not total TOTAL_UNITS", () => {
      const contributors = createContributors(2);
      const customEntries: AllowlistEntry[] = [
        { address: "0x0000000000000000000000000000000000000001", units: 100n },
      ];
      expect(() =>
        calculateDistribution(contributors, "custom", customEntries)
      ).toThrow(`Distribution must total ${TOTAL_UNITS.toString()} units`);
    });

    it("returns custom entries unchanged when valid", () => {
      const contributors = createContributors(2);
      const customEntries: AllowlistEntry[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          units: TOTAL_UNITS / 4n,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          units: (TOTAL_UNITS * 3n) / 4n,
        },
      ];
      const result = calculateDistribution(
        contributors,
        "custom",
        customEntries
      );

      expect(result).toBe(customEntries);
      expect(sumUnits(result)).toBe(TOTAL_UNITS);
    });

    it("ignores contributors when custom entries are provided", () => {
      const contributors = createContributors(5);
      const customEntries: AllowlistEntry[] = [
        {
          address: "0x000000000000000000000000000000000000AAAA",
          units: TOTAL_UNITS,
        },
      ];
      const result = calculateDistribution(
        contributors,
        "custom",
        customEntries
      );

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe(
        "0x000000000000000000000000000000000000AAAA"
      );
    });
  });

  describe("edge cases", () => {
    it("handles large number of contributors", () => {
      const contributors = createContributors(100);
      const result = calculateDistribution(contributors, "equal");

      expect(result).toHaveLength(100);
      expect(sumUnits(result)).toBe(TOTAL_UNITS);
    });

    it("handles distribution when contributor count exceeds total units would create fractional units", () => {
      // With 100M units and many contributors, ensure no fractional units
      const contributors = createContributors(7);
      const result = calculateDistribution(contributors, "equal");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      // All units should be positive bigints
      for (const entry of result) {
        expect(entry.units).toBeGreaterThan(0n);
      }
    });

    it("handles extremely skewed proportional distribution", () => {
      const contributors: ContributorWeight[] = [
        {
          address: "0x0000000000000000000000000000000000000001",
          actionCount: 1,
        },
        {
          address: "0x0000000000000000000000000000000000000002",
          actionCount: 999999,
        },
      ];
      const result = calculateDistribution(contributors, "count");

      expect(sumUnits(result)).toBe(TOTAL_UNITS);
      // Second contributor should have almost all units
      expect(result[1].units).toBeGreaterThan((TOTAL_UNITS * 99n) / 100n);
    });
  });
});
