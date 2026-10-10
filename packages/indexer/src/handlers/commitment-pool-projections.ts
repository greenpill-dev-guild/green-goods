import type { Commitment, CommitmentCycle, CommitmentPool } from "envio";
import { keccak256, stringToBytes } from "viem";

import { normalizeAddress } from "./shared";

export function poolingEntityId(chainId: number, rawId: bigint): string {
  return `${chainId}-${rawId}`;
}

export function commitmentMemberId(chainId: number, commitmentId: bigint, account: string): string {
  return `${chainId}-${commitmentId}-${normalizeAddress(account)}`;
}

export function poolMemberId(chainId: number, poolId: bigint, account: string): string {
  return `${chainId}-${poolId}-${normalizeAddress(account)}`;
}

export function workAttributionId(chainId: number, workUID: string): string {
  return `${chainId}-${workUID.toLowerCase()}`;
}

export function eventAuditId(chainId: number, transactionHash: string, logIndex: number): string {
  return `${chainId}-${transactionHash.toLowerCase()}-${logIndex}`;
}

export function fundingIndexId(chainId: number, commitmentId: bigint, funder: string): string {
  return `${chainId}-${commitmentId}-${normalizeAddress(funder)}`;
}

export function exactLabelHash(label: string): string {
  return keccak256(stringToBytes(label));
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortedUnique<T extends string | number | bigint>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => {
    if (typeof left === "bigint" && typeof right === "bigint") {
      return left < right ? -1 : left > right ? 1 : 0;
    }
    if (typeof left === "number" && typeof right === "number") return left - right;
    return compareCodeUnits(String(left), String(right));
  });
}

export function sortedUniqueByNumericSuffix(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => {
    const leftMatch = left.match(/-(\d+)$/);
    const rightMatch = right.match(/-(\d+)$/);
    if (leftMatch && rightMatch) {
      const leftPrefix = left.slice(0, leftMatch.index);
      const rightPrefix = right.slice(0, rightMatch.index);
      const prefixOrder = compareCodeUnits(leftPrefix, rightPrefix);
      if (prefixOrder !== 0) return prefixOrder;
      return Number(leftMatch[1]) - Number(rightMatch[1]);
    }
    return compareCodeUnits(left, right);
  });
}

export function cursorWins(
  blockNumber: number,
  logIndex: number,
  currentBlock: bigint | undefined,
  currentLogIndex: number | undefined
): boolean {
  if (currentBlock === undefined || currentLogIndex === undefined) return true;
  const incoming = BigInt(blockNumber);
  return incoming > currentBlock || (incoming === currentBlock && logIndex > currentLogIndex);
}

export function cycleAllocationUnset(cycle: CommitmentCycle): boolean {
  return (
    cycle.gardenersBps +
      cycle.treasuryBps +
      cycle.operatorBps +
      cycle.evaluatorBps +
      cycle.communityBps +
      cycle.funderBps +
      cycle.equalParticipationBps +
      cycle.verifiedContributionBps ===
    0
  );
}

export function computeRecognitionWeights(
  rows: readonly {
    readonly id: string;
    readonly account: string;
    readonly verifiedCredits: number;
  }[],
  equalParticipationBps: number,
  verifiedContributionBps: number
): ReadonlyMap<string, number> | undefined {
  if (
    equalParticipationBps < 0 ||
    verifiedContributionBps < 0 ||
    equalParticipationBps + verifiedContributionBps !== 10_000
  ) {
    return undefined;
  }
  if (rows.length === 0) return new Map();

  const sortedRows = [...rows].sort((left, right) => compareCodeUnits(left.account, right.account));
  const equalBase = Math.floor(equalParticipationBps / sortedRows.length);
  const equalRemainderIds = new Set(
    sortedRows.slice(0, equalParticipationBps % sortedRows.length).map((row) => row.id)
  );
  const totalCredits = sortedRows.reduce((total, row) => total + row.verifiedCredits, 0);
  if (totalCredits <= 0) return undefined;

  const verifiedRows = sortedRows.map((row) => {
    const numerator = verifiedContributionBps * row.verifiedCredits;
    return {
      ...row,
      floor: Math.floor(numerator / totalCredits),
      remainder: numerator % totalCredits,
    };
  });
  const verifiedRemainder =
    verifiedContributionBps - verifiedRows.reduce((total, row) => total + row.floor, 0);
  const verifiedRemainderIds = new Set(
    [...verifiedRows]
      .sort(
        (left, right) =>
          right.remainder - left.remainder || compareCodeUnits(left.account, right.account)
      )
      .slice(0, verifiedRemainder)
      .map((row) => row.id)
  );

  return new Map(
    verifiedRows.map((row) => [
      row.id,
      equalBase +
        (equalRemainderIds.has(row.id) ? 1 : 0) +
        row.floor +
        (verifiedRemainderIds.has(row.id) ? 1 : 0),
    ])
  );
}

export function commitmentPoolType(value: bigint): CommitmentPool["poolType"] {
  return value === 0n ? "GARDEN" : value === 1n ? "PROTOCOL" : "UNKNOWN";
}

export function commitmentCycleType(value: bigint): CommitmentCycle["cycleType"] {
  return value === 0n ? "SEASON" : value === 1n ? "CAMPAIGN" : "UNKNOWN";
}

export function commitmentDirection(value: bigint): Commitment["direction"] {
  return value === 0n ? "OFFER" : value === 1n ? "REQUEST" : "UNKNOWN";
}

export function commitmentKind(value: bigint): Commitment["commitmentType"] {
  const values = [
    "DOMAIN_IMPACT",
    "SUPPORT_SERVICE",
    "SEASON_CAMPAIGN",
    "STEWARD_CAPTURED",
  ] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function commitmentClaimType(value: bigint): Commitment["claimType"] {
  return value === 0n ? "GARDEN" : value === 1n ? "INDIVIDUAL" : "UNKNOWN";
}

export function commitmentClaimMode(value: bigint): Commitment["claimMode"] {
  return value === 0n ? "OPEN" : value === 1n ? "APPROVAL_GATED" : "UNKNOWN";
}

export function contributorPolicy(value: bigint): Commitment["contributorPolicy"] {
  return value === 0n ? "OPEN" : value === 1n ? "LEAD_MANAGED" : "UNKNOWN";
}

export function considerationRail(value: bigint): Commitment["considerationRail"] {
  const values = ["NONE", "ARBITRUM_EXTERNAL", "CELO_SETTLEMENT"] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function confirmationPath(value: bigint): Commitment["confirmationPath"] {
  const values = ["ORDINARY", "POOL_FALLBACK", "PROTOCOL_FALLBACK"] as const;
  return values[Number(value)] ?? "UNKNOWN";
}

export function commitmentState(value: bigint): Commitment["state"] {
  const values = [
    "UNKNOWN",
    "OFFERED",
    "REQUESTED",
    "ACCEPTED",
    "READY_FOR_CONFIRMATION",
    "FULFILLED",
    "CANCELLED",
    "EXPIRED",
    "DISPUTED",
  ] as const;
  const state = values[Number(value)];
  if (!state || state === "UNKNOWN") {
    throw new Error(`Unknown commitment state: ${value}`);
  }
  return state;
}

export {
  createCommitment,
  createContributor,
  createCycle,
  createPool,
  createRequirement,
  createSeries,
  createWorkAttribution,
} from "./commitment-pool-factories";
