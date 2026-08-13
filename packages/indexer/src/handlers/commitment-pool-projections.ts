import type { Commitment, CommitmentCycle, CommitmentPool } from "envio";
import { keccak256, toBytes } from "viem";

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
  return keccak256(toBytes(label));
}

export function sortedUnique<T extends string | number | bigint>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => {
    if (typeof left === "bigint" && typeof right === "bigint") {
      return left < right ? -1 : left > right ? 1 : 0;
    }
    return String(left).localeCompare(String(right));
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
  return values[Number(value)] ?? "UNKNOWN";
}

export {
  createCommitment,
  createContributor,
  createCycle,
  createPool,
  createSeries,
  createWorkAttribution,
} from "./commitment-pool-factories";
