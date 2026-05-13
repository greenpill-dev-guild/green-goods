/**
 * derivation utility tests
 *
 * Pins the threshold + accrual + status approximations consumed by
 * ConvictionMeter / ProposalCardConviction. The formulas are placeholders
 * until pool-config reads land — these tests lock the documented behavior so
 * a future formula swap can't silently regress.
 *
 * Cleanup item A2 from .plans/active/admin-design-revamp/handoffs/claude-cleanup.md.
 */

import { describe, expect, it } from "vitest";

import {
  deriveConvictionPercent,
  deriveDailyAccrual,
  deriveProposalStatus,
  deriveThreshold,
} from "../../../utils/conviction/derivation";
import type {
  ConvictionPoolConfig,
  ConvictionWeight,
  HypercertEntry,
} from "../../../types/conviction";

const CONFIG: ConvictionPoolConfig = {
  decayRate: 1n,
  pointsPerVoter: 100n,
  memberCount: 4,
};

const WEIGHT_ZERO: ConvictionWeight = { hypercertId: 1n, weight: 0n };
const WEIGHT_HALF: ConvictionWeight = { hypercertId: 1n, weight: 200n };
const WEIGHT_FULL: ConvictionWeight = { hypercertId: 1n, weight: 400n };

describe("deriveThreshold", () => {
  it("returns the documented 75% placeholder", () => {
    expect(deriveThreshold(CONFIG, WEIGHT_HALF)).toBe(75);
  });

  it("ignores its inputs (placeholder until pool-config formula lands)", () => {
    const otherConfig: ConvictionPoolConfig = {
      decayRate: 99n,
      pointsPerVoter: 9_999n,
      memberCount: 1_000,
    };
    expect(deriveThreshold(otherConfig, WEIGHT_FULL)).toBe(75);
  });
});

describe("deriveConvictionPercent", () => {
  it("returns 0 when pointsPerVoter is zero", () => {
    expect(deriveConvictionPercent({ ...CONFIG, pointsPerVoter: 0n }, WEIGHT_HALF)).toBe(0);
  });

  it("returns 0 when memberCount is zero", () => {
    expect(deriveConvictionPercent({ ...CONFIG, memberCount: 0 }, WEIGHT_HALF)).toBe(0);
  });

  it("returns 0 when memberCount is negative", () => {
    expect(deriveConvictionPercent({ ...CONFIG, memberCount: -1 }, WEIGHT_HALF)).toBe(0);
  });

  it("returns 0 when weight is zero", () => {
    expect(deriveConvictionPercent(CONFIG, WEIGHT_ZERO)).toBe(0);
  });

  it("computes 50% when weight is half of pool max", () => {
    // pool max = 100 * 4 = 400; weight 200 → 50%
    expect(deriveConvictionPercent(CONFIG, WEIGHT_HALF)).toBe(50);
  });

  it("returns 100% when weight equals pool max", () => {
    expect(deriveConvictionPercent(CONFIG, WEIGHT_FULL)).toBe(100);
  });
});

describe("deriveDailyAccrual", () => {
  it("returns 0 when memberAllocation is zero", () => {
    expect(deriveDailyAccrual(CONFIG, 0n)).toBe(0);
  });

  it("returns 0 when memberAllocation is negative", () => {
    expect(deriveDailyAccrual(CONFIG, -1n)).toBe(0);
  });

  it("returns 0 when pointsPerVoter is zero", () => {
    expect(deriveDailyAccrual({ ...CONFIG, pointsPerVoter: 0n }, 100n)).toBe(0);
  });

  it("returns 0 when memberCount is zero", () => {
    expect(deriveDailyAccrual({ ...CONFIG, memberCount: 0 }, 100n)).toBe(0);
  });

  it("returns 0 when decayRate is zero", () => {
    expect(deriveDailyAccrual({ ...CONFIG, decayRate: 0n }, 100n)).toBe(0);
  });

  it("returns a positive number when all inputs are positive", () => {
    const accrual = deriveDailyAccrual(CONFIG, 100n);
    expect(accrual).toBeGreaterThan(0);
  });
});

describe("deriveProposalStatus", () => {
  const ACTIVE: Pick<HypercertEntry, "active"> = { active: true };
  const INACTIVE: Pick<HypercertEntry, "active"> = { active: false };

  it("returns 'funded' whenever the funded flag is true (overrides everything else)", () => {
    expect(deriveProposalStatus(ACTIVE, 0, 75, true)).toBe("funded");
    expect(deriveProposalStatus(INACTIVE, 0, 75, true)).toBe("funded");
    expect(deriveProposalStatus(ACTIVE, 90, 75, true)).toBe("funded");
  });

  it("defaults funded=false when the argument is omitted", () => {
    expect(deriveProposalStatus(ACTIVE, 50, 75)).toBe("accruing");
  });

  it("returns 'expired' when inactive and conviction is zero or below", () => {
    expect(deriveProposalStatus(INACTIVE, 0, 75)).toBe("expired");
    expect(deriveProposalStatus(INACTIVE, -1, 75)).toBe("expired");
  });

  it("returns 'withdrawn' when inactive but residual conviction remains", () => {
    expect(deriveProposalStatus(INACTIVE, 1, 75)).toBe("withdrawn");
    expect(deriveProposalStatus(INACTIVE, 50, 75)).toBe("withdrawn");
  });

  it("returns 'passing' when active and conviction crosses the threshold", () => {
    expect(deriveProposalStatus(ACTIVE, 75, 75)).toBe("passing");
    expect(deriveProposalStatus(ACTIVE, 90, 75)).toBe("passing");
  });

  it("returns 'accruing' when active and conviction is below threshold", () => {
    expect(deriveProposalStatus(ACTIVE, 0, 75)).toBe("accruing");
    expect(deriveProposalStatus(ACTIVE, 74.9, 75)).toBe("accruing");
  });
});
