import type { PoolFundingFeePolicy, ZodiacAllowance } from "./pool-funding";

export function clampPoolFundingAtZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

export function calculateKnownTransferFeeBuffer(
  amount: bigint,
  policy: PoolFundingFeePolicy
): bigint {
  const byBps = (amount * BigInt(policy.maxFeeBps)) / 10_000n;
  return byBps < policy.maxFeeAmount ? byBps : policy.maxFeeAmount;
}

export function calculateUnknownSplitFeeBuffer(
  amount: bigint,
  policy: PoolFundingFeePolicy
): bigint {
  return (amount * BigInt(policy.maxFeeBps)) / 10_000n;
}

export function calculateEffectiveZodiacAllowance(allowance: ZodiacAllowance, now: bigint): bigint {
  if (allowance.period === 0n || now < allowance.timestamp + allowance.period) {
    return allowance.balance;
  }
  const intervals = (now - allowance.timestamp) / allowance.period;
  const refilled = allowance.balance + allowance.refill * intervals;
  return refilled < allowance.maxRefill ? refilled : allowance.maxRefill;
}
