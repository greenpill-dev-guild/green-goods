import type { Commitment, CommitmentContributor, PoolMemberHistory } from "envio";

import { createCommitment, poolMemberId, poolingEntityId } from "./commitment-pool-projections";
import type { PoolingContext, RuntimeEvent } from "./commitment-pool-runtime";
import { normalizeAddress } from "./shared";

export async function getCommitment(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint
): Promise<Commitment> {
  return (
    (await context.Commitment.get(poolingEntityId(event.chainId, commitmentId))) ??
    createCommitment(event.chainId, commitmentId, event.block.timestamp)
  );
}

function createMemberHistory(
  chainId: number,
  poolId: bigint,
  account: string,
  timestamp: number
): PoolMemberHistory {
  const normalized = normalizeAddress(account);
  return {
    id: poolMemberId(chainId, poolId, normalized),
    chainId,
    poolId,
    poolEntityId: poolingEntityId(chainId, poolId),
    account: normalized,
    leadAccepted: 0,
    leadFulfilled: 0,
    leadCancelled: 0,
    leadExpired: 0,
    contributorFulfilled: 0,
    receivedFulfilled: 0,
    confirmationsGiven: 0,
    disputesRaised: 0,
    updatedAt: timestamp,
  };
}

export type MemberHistoryCounter =
  | "leadAccepted"
  | "leadFulfilled"
  | "leadCancelled"
  | "leadExpired"
  | "contributorFulfilled"
  | "receivedFulfilled"
  | "confirmationsGiven"
  | "disputesRaised";

export async function applyMemberHistoryDelta(
  context: PoolingContext,
  chainId: number,
  poolId: bigint,
  account: string | undefined,
  counter: MemberHistoryCounter,
  delta: 1 | -1,
  timestamp: number
): Promise<void> {
  if (!account) return;
  const id = poolMemberId(chainId, poolId, account);
  const existing =
    (await context.PoolMemberHistory.get(id)) ??
    createMemberHistory(chainId, poolId, account, timestamp);
  context.PoolMemberHistory.set({
    ...existing,
    [counter]: Math.max(0, existing[counter] + delta),
    updatedAt: Math.max(existing.updatedAt, timestamp),
  });
}

function terminalHistoryCounter(
  state: Commitment["state"]
): "leadFulfilled" | "leadCancelled" | "leadExpired" | undefined {
  if (state === "FULFILLED") return "leadFulfilled";
  if (state === "CANCELLED") return "leadCancelled";
  if (state === "EXPIRED") return "leadExpired";
  return undefined;
}

export async function reconcileMemberHistory(
  context: PoolingContext,
  commitment: Commitment,
  timestamp: number
): Promise<Commitment> {
  const poolId = commitment.poolId;
  if (poolId === undefined) return commitment;
  const desiredOutcome =
    commitment.acceptanceSeen && isTerminal(commitment.state) ? commitment.state : undefined;
  let updated = commitment;
  if (commitment.memberHistoryOutcome !== desiredOutcome && commitment.leadProvider) {
    const previousCounter = terminalHistoryCounter(commitment.memberHistoryOutcome);
    const nextCounter = terminalHistoryCounter(desiredOutcome);
    if (previousCounter) {
      await applyMemberHistoryDelta(
        context,
        commitment.chainId,
        poolId,
        commitment.leadProvider,
        previousCounter,
        -1,
        timestamp
      );
    }
    if (nextCounter) {
      await applyMemberHistoryDelta(
        context,
        commitment.chainId,
        poolId,
        commitment.leadProvider,
        nextCounter,
        1,
        timestamp
      );
    }
    updated = {
      ...updated,
      memberHistoryOutcome: desiredOutcome,
      updatedAt: Math.max(updated.updatedAt, timestamp),
    };
    context.Commitment.set(updated);
  }

  if (
    updated.state !== "FULFILLED" ||
    updated.fulfilledParticipantHistoryApplied ||
    !updated.acceptanceSeen ||
    updated.frozenContributorCount === undefined
  )
    return updated;

  const contributorIndex = await context.CommitmentContributorIndex.get(updated.id);
  const contributors = (
    await Promise.all(
      (contributorIndex?.contributorEntityIds ?? []).map((id) =>
        context.CommitmentContributor.get(id)
      )
    )
  ).filter((row): row is CommitmentContributor => Boolean(row?.active));
  if (contributors.length !== updated.frozenContributorCount) return updated;

  for (const contributor of contributors) {
    if (contributor.contributor === updated.leadProvider) continue;
    await applyMemberHistoryDelta(
      context,
      updated.chainId,
      poolId,
      contributor.contributor,
      "contributorFulfilled",
      1,
      timestamp
    );
  }
  const receiver = updated.direction === "REQUEST" ? updated.creator : updated.counterparty;
  await applyMemberHistoryDelta(
    context,
    updated.chainId,
    poolId,
    receiver,
    "receivedFulfilled",
    1,
    timestamp
  );
  updated = {
    ...updated,
    fulfilledParticipantHistoryApplied: true,
    updatedAt: Math.max(updated.updatedAt, timestamp),
  };
  context.Commitment.set(updated);
  return updated;
}

export async function reconcileRecognitionWeights(
  context: PoolingContext,
  commitment: Commitment,
  timestamp: number
): Promise<void> {
  if (!commitment.contributorsFrozen || commitment.frozenContributorCount === undefined) return;
  const index = await context.CommitmentContributorIndex.get(commitment.id);
  const active = (
    await Promise.all(
      (index?.contributorEntityIds ?? []).map((id) => context.CommitmentContributor.get(id))
    )
  )
    .filter((row): row is CommitmentContributor => Boolean(row?.active))
    .sort((left, right) => left.contributor.localeCompare(right.contributor));
  if (active.length !== commitment.frozenContributorCount) return;
  const eligible = active.filter((row) => row.approvedWorkCredits + row.evidenceCredits > 0);
  if (eligible.length === 0) return;
  let equalBps = 2_000;
  let verifiedBps = 8_000;
  if (commitment.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(commitment.chainId, commitment.cycleId)
    );
    if (cycle && cycle.equalParticipationBps + cycle.verifiedContributionBps === 10_000) {
      equalBps = cycle.equalParticipationBps;
      verifiedBps = cycle.verifiedContributionBps;
    }
  }

  const equalBase = Math.floor(equalBps / eligible.length);
  const equalRemainder = equalBps % eligible.length;
  const totalCredits = eligible.reduce(
    (total, row) => total + row.approvedWorkCredits + row.evidenceCredits,
    0
  );
  const verified = eligible.map((row) => {
    const numerator = verifiedBps * (row.approvedWorkCredits + row.evidenceCredits);
    return {
      id: row.id,
      floor: Math.floor(numerator / totalCredits),
      remainder: numerator % totalCredits,
      account: row.contributor,
    };
  });
  const verifiedRemainder = verifiedBps - verified.reduce((total, row) => total + row.floor, 0);
  const verifiedRemainderIds = new Set(
    [...verified]
      .sort(
        (left, right) =>
          right.remainder - left.remainder || left.account.localeCompare(right.account)
      )
      .slice(0, verifiedRemainder)
      .map((row) => row.id)
  );
  const equalRemainderIds = new Set(eligible.slice(0, equalRemainder).map((row) => row.id));
  for (const row of eligible) {
    const verifiedRow = verified.find((candidate) => candidate.id === row.id);
    const weight =
      equalBase +
      (equalRemainderIds.has(row.id) ? 1 : 0) +
      (verifiedRow?.floor ?? 0) +
      (verifiedRemainderIds.has(row.id) ? 1 : 0);
    context.CommitmentContributor.set({
      ...row,
      recognitionWeightBps: weight,
      updatedAt: Math.max(row.updatedAt, timestamp),
    });
  }
}

export function isTerminal(state: Commitment["state"]): boolean {
  return state === "FULFILLED" || state === "CANCELLED" || state === "EXPIRED";
}
