/**
 * Bidirectional translation between the on-chain points model
 * (HypercertSignalPool: bigint amounts against a per-voter pointsBudget)
 * and the WeightAllocator's percent model (0–100 floats summing to ≤100).
 *
 * Save path uses signed deltas (HypercertSignal.deltaSupport: int256), so the
 * percent-diff → bigint-delta computation lives here too. Silently-wrong math
 * here = silently-wrong votes; this file is the testable single source of truth.
 *
 * Spec: design_handoff_admin-revamp/README.md § 7 (conviction voting).
 * Audit finding: docs/admin-revamp/audit.md §5.5 (decided), Tier-5 audit #3.
 */

import type { ConvictionAllocations, VoterAllocation } from "../../types/conviction";

const PERCENT_BASIS = 10_000n; // 2 decimal places of precision

/**
 * Convert an on-chain points amount to a 0–100 percent of the member's budget.
 * Returns 0 when the budget is zero (member has no voting power yet).
 */
export function pointsToPercent(amount: bigint, budget: bigint): number {
  if (budget <= 0n) return 0;
  // Multiply first to keep precision before truncation, then divide back.
  return Number((amount * PERCENT_BASIS) / budget) / Number(PERCENT_BASIS / 100n);
}

/**
 * Convert a 0–100 percent of the member's budget back to an on-chain points
 * amount. Clamps the percent to [0, 100] before computing.
 */
export function percentToPoints(percent: number, budget: bigint): bigint {
  if (budget <= 0n) return 0n;
  if (Number.isNaN(percent)) return 0n;
  const clamped = Math.max(0, Math.min(100, percent));
  // Round to avoid trailing-fractional jitter (slider drag → fractional pct).
  const scaled = BigInt(Math.round(clamped * 100));
  return (scaled * budget) / PERCENT_BASIS;
}

/**
 * Build a percent-keyed allocations map from the on-chain VoterAllocation array
 * for a member with a given pointsBudget. The map's keys are hypercertId.toString()
 * (matching ConvictionProposal.id which is also a string).
 */
export function allocationsToPercentMap(
  allocations: VoterAllocation[],
  budget: bigint
): ConvictionAllocations {
  const map: ConvictionAllocations = {};
  for (const allocation of allocations) {
    map[allocation.hypercertId.toString()] = pointsToPercent(allocation.amount, budget);
  }
  return map;
}

/** Signed delta for a single hypercert in a save batch. */
export interface ConvictionSignedDelta {
  hypercertId: bigint;
  /** Signed: positive adds support, negative removes it. */
  deltaSupport: bigint;
}

/**
 * Diff two percent-keyed allocations maps and produce the signed-delta array
 * that useAllocateHypercertSupport expects. Hypercerts present in old but not
 * new are treated as percent=0 (full withdrawal); hypercerts present in new
 * but not old start from percent=0.
 *
 * Returns only entries with non-zero delta (to keep the on-chain tx tight).
 */
export function percentMapToSignedDeltas(
  oldAllocations: ConvictionAllocations,
  newAllocations: ConvictionAllocations,
  budget: bigint
): ConvictionSignedDelta[] {
  if (budget <= 0n) return [];

  const ids = new Set<string>([...Object.keys(oldAllocations), ...Object.keys(newAllocations)]);

  const deltas: ConvictionSignedDelta[] = [];
  for (const id of ids) {
    const oldPercent = oldAllocations[id] ?? 0;
    const newPercent = newAllocations[id] ?? 0;
    if (oldPercent === newPercent) continue;

    const oldPoints = percentToPoints(oldPercent, budget);
    const newPoints = percentToPoints(newPercent, budget);
    const delta = newPoints - oldPoints;
    if (delta === 0n) continue;

    deltas.push({
      hypercertId: BigInt(id),
      deltaSupport: delta,
    });
  }
  return deltas;
}
