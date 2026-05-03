/**
 * Threshold + accrual + status derivation for the conviction-voting view-model.
 *
 * The on-chain HypercertSignalPool encodes conviction as `convictionLast`
 * (bigint), accrued per block in proportion to the weight allocated. The exact
 * accrual formula depends on the pool's decay rate and pointsPerVoter; the
 * functions here approximate the values the UI needs (0–100 percent + days)
 * from the data the existing hooks expose. Audit finding #2 + #6 from the
 * Tier-5 audit-then-ship pass.
 *
 * NOTE: the math below is a best-effort approximation. A follow-up should
 * verify each formula against the HypercertSignalPool contract source — the
 * function shapes are intentionally stable so the formulas can be tightened
 * without touching consumers. Each TODO marks a value that should be sourced
 * from the contract once the reverse-engineering is done.
 */

import type {
  ConvictionPoolConfig,
  ConvictionProposalStatus,
  ConvictionWeight,
  HypercertEntry,
} from "../../types/conviction";

/**
 * Per-hypercert input for the derivation functions. Composes data from
 * useHypercertConviction (the weight) + the pool's membership list.
 */
export interface ConvictionDerivationInput {
  weight: ConvictionWeight;
  /** This member's current allocated weight on the hypercert (in points). */
  memberAllocation: bigint;
}

const PERCENT_BASIS = 10_000n;
// TODO: source from chain-config; Arbitrum has ~0.25s block time but conviction
// pools usually quote in days. Using the conservative ~12s "EVM standard" until
// verified.
const BLOCKS_PER_DAY = 7_200n;
// TODO: pull from contract; the prototype's UI Review § 03 uses ~75% as the
// canonical illustrative threshold.
const DEFAULT_THRESHOLD_PERCENT = 75;

/**
 * Derive the conviction threshold for a hypercert as a 0–100 percent.
 * The threshold represents the conviction level at which the proposal passes.
 *
 * Approximation: a fixed 75% of theoretical maximum until the contract math
 * is reverse-engineered. The function takes weight + pool config so a future
 * refactor can switch to a per-hypercert formula without breaking callers.
 */
export function deriveThreshold(
  _poolConfig: ConvictionPoolConfig,
  _weight: ConvictionWeight
): number {
  // TODO: replace with HypercertSignalPool's actual threshold formula.
  return DEFAULT_THRESHOLD_PERCENT;
}

/**
 * Derive a 0–100 percent representation of the hypercert's current conviction.
 * Approximated as the ratio of conviction weight to the theoretical pool
 * maximum (pointsPerVoter × memberCount).
 */
export function deriveConvictionPercent(
  poolConfig: ConvictionPoolConfig,
  weight: ConvictionWeight
): number {
  if (poolConfig.pointsPerVoter <= 0n || poolConfig.memberCount <= 0) return 0;
  const max = poolConfig.pointsPerVoter * BigInt(poolConfig.memberCount);
  if (max <= 0n) return 0;
  const numerator = weight.weight * PERCENT_BASIS;
  return Number(numerator / max) / Number(PERCENT_BASIS / 100n);
}

/**
 * Derive the daily accrual rate (in percent of the pool max conviction) at
 * the member's current allocation. Returns 0 when the member has no
 * allocation on this hypercert (no contribution to its accrual).
 *
 * Approximation: decay-rate normalised to a daily window, scaled by the
 * member's share of the pool's total points budget.
 */
export function deriveDailyAccrual(
  poolConfig: ConvictionPoolConfig,
  memberAllocation: bigint
): number {
  if (memberAllocation <= 0n) return 0;
  if (poolConfig.pointsPerVoter <= 0n || poolConfig.memberCount <= 0) return 0;
  if (poolConfig.decayRate <= 0n) return 0;

  const poolMax = poolConfig.pointsPerVoter * BigInt(poolConfig.memberCount);
  if (poolMax <= 0n) return 0;

  // Member share of total pool budget → contribution to daily accrual.
  const share = Number((memberAllocation * PERCENT_BASIS) / poolMax) / Number(PERCENT_BASIS);
  const dailyDecayPoints = Number(poolConfig.decayRate * BLOCKS_PER_DAY);

  // Scale to percent of pool max.
  return (share * dailyDecayPoints * 100) / Number(poolMax);
}

/**
 * Map on-chain HypercertEntry + derived percentages to the ConvictionProposalStatus
 * lifecycle the UI uses. "funded" has no on-chain signal yet — pass `funded=true`
 * from an off-chain matched-funding signal once that exists (Tier 6).
 */
export function deriveProposalStatus(
  entry: Pick<HypercertEntry, "active">,
  convictionPercent: number,
  thresholdPercent: number,
  funded = false
): ConvictionProposalStatus {
  if (funded) return "funded";
  if (!entry.active) {
    // Inactive: distinguish "expired" (decayed to zero) vs "withdrawn" (still
    // has residual conviction but the member pulled their weight).
    return convictionPercent <= 0 ? "expired" : "withdrawn";
  }
  return convictionPercent >= thresholdPercent ? "passing" : "accruing";
}
