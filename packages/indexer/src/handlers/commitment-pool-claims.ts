import type { Commitment, CommitmentClaimRequest } from "envio";

import {
  commitmentClaimType,
  commitmentMemberId,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import {
  applyMemberHistoryDelta,
  getCommitment,
  isTerminal,
  type MemberHistoryCounter,
  reconcileMemberHistory,
} from "./commitment-pool-members";
import {
  optionalAddress,
  type PoolingContext,
  type RuntimeEvent,
  value,
} from "./commitment-pool-runtime";
import { applyLifecycleState } from "./commitment-pool-state";
import { getTxHash, normalizeAddress } from "./shared";

export async function handleClaimEvent(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const claimant = normalizeAddress(value<string>(event, "claimant"));
  const id = commitmentMemberId(event.chainId, commitmentId, claimant);
  const existing = await context.CommitmentClaimRequest.get(id);
  const rowWins =
    !existing ||
    cursorWins(
      event.block.number,
      event.logIndex,
      existing.lifecycleBlockNumber,
      existing.lifecycleLogIndex
    );
  const commitment = await getCommitment(event, context, commitmentId);
  const acceptanceIsNewer =
    commitment.acceptanceBlockNumber !== undefined &&
    !cursorWins(
      event.block.number,
      event.logIndex,
      commitment.acceptanceBlockNumber,
      commitment.acceptanceLogIndex
    );
  const terminalMilestoneSeen =
    commitment.countedLifecycleStates.includes("CANCELLED") ||
    commitment.countedLifecycleStates.includes("EXPIRED");
  const terminalResolutionCode =
    commitment.state === "CANCELLED" || commitment.countedLifecycleStates.includes("CANCELLED")
      ? "COMMITMENT_CANCELLED"
      : "COMMITMENT_EXPIRED";
  const terminalIsNewer =
    terminalMilestoneSeen ||
    (isTerminal(commitment.state) &&
      commitment.lifecycleBlockNumber !== undefined &&
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.lifecycleBlockNumber,
        commitment.lifecycleLogIndex
      ));
  const requested = event.eventName === "ClaimRequested";
  const requestPayloadWins = requested && (rowWins || !(existing?.requestSeen ?? false));
  const gardenContext = requestPayloadWins
    ? optionalAddress(event, "gardenContext")
    : existing?.gardenContext;
  const newerDecline = !requested && rowWins;
  const settledState =
    !newerDecline &&
    (existing?.state === "ACCEPTED" ||
      existing?.state === "SUPERSEDED" ||
      (!rowWins && existing?.state === "DECLINED"))
      ? existing.state
      : undefined;
  const nextState: CommitmentClaimRequest["state"] = settledState
    ? settledState
    : requested
      ? acceptanceIsNewer
        ? commitment.counterparty === claimant
          ? "ACCEPTED"
          : "SUPERSEDED"
        : terminalIsNewer
          ? "SUPERSEDED"
          : rowWins
            ? "PENDING"
            : (existing?.state ?? "PENDING")
      : acceptanceIsNewer
        ? rowWins
          ? "DECLINED"
          : commitment.counterparty === claimant
            ? "ACCEPTED"
            : "SUPERSEDED"
        : terminalIsNewer
          ? rowWins
            ? "DECLINED"
            : "SUPERSEDED"
          : rowWins
            ? "DECLINED"
            : (existing?.state ?? "DECLINED");
  const request: CommitmentClaimRequest = {
    id,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
    claimant,
    requestSeen: requested || (existing?.requestSeen ?? false),
    requestedBy: requestPayloadWins
      ? normalizeAddress(value<string>(event, "requestedBy"))
      : existing?.requestedBy,
    claimType: requestPayloadWins
      ? commitmentClaimType(value<bigint>(event, "kind"))
      : existing?.claimType,
    gardenContext,
    gardenContextId: gardenContext,
    state: nextState,
    reasonCID:
      nextState === "DECLINED" && event.eventName === "ClaimDeclined" && rowWins
        ? value<string>(event, "reasonCID")
        : nextState === "PENDING"
          ? undefined
          : existing?.reasonCID,
    resolutionCode:
      nextState === "DECLINED"
        ? "CLAIM_DECLINED"
        : nextState === "ACCEPTED"
          ? "COMMITMENT_ACCEPTED"
          : nextState === "SUPERSEDED"
            ? terminalIsNewer
              ? terminalResolutionCode
              : "COMMITMENT_ACCEPTED"
            : undefined,
    lifecycleBlockNumber: rowWins ? BigInt(event.block.number) : existing?.lifecycleBlockNumber,
    lifecycleLogIndex: rowWins ? event.logIndex : existing?.lifecycleLogIndex,
    requestedAt: requestPayloadWins
      ? Number(value<bigint>(event, "requestedAt"))
      : existing?.requestedAt,
    resolvedAt:
      nextState === "PENDING"
        ? undefined
        : nextState === "DECLINED" && newerDecline
          ? event.block.timestamp
          : (existing?.resolvedAt ??
            (nextState === "ACCEPTED"
              ? commitment.acceptanceAt
              : nextState === "SUPERSEDED"
                ? terminalIsNewer
                  ? terminalResolutionCode === "COMMITMENT_CANCELLED"
                    ? commitment.cancelledAt
                    : commitment.expiredAt
                  : commitment.acceptanceAt
                : undefined) ??
            event.block.timestamp),
    updatedAt: Math.max(existing?.updatedAt ?? 0, event.block.timestamp),
  };
  context.CommitmentClaimRequest.set(request);
  const indexId = poolingEntityId(event.chainId, commitmentId);
  const requestIndex = await context.CommitmentClaimRequestIndex.get(indexId);
  context.CommitmentClaimRequestIndex.set({
    id: indexId,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: indexId,
    requestIds: sortedUnique([...(requestIndex?.requestIds ?? []), id]),
    updatedAt: Math.max(requestIndex?.updatedAt ?? 0, event.block.timestamp),
  });
}

type ClaimResolutionCode = "COMMITMENT_ACCEPTED" | "COMMITMENT_CANCELLED" | "COMMITMENT_EXPIRED";

export async function sweepClaimRequests(
  context: PoolingContext,
  commitment: Commitment,
  acceptedClaimant: string | undefined,
  resolutionCode: ClaimResolutionCode,
  timestamp: number
): Promise<void> {
  const requestIndex = await context.CommitmentClaimRequestIndex.get(commitment.id);
  for (const requestId of requestIndex?.requestIds ?? []) {
    const request = await context.CommitmentClaimRequest.get(requestId);
    if (!request || request.state !== "PENDING") continue;
    const accepted =
      resolutionCode === "COMMITMENT_ACCEPTED" &&
      acceptedClaimant !== undefined &&
      request.claimant === normalizeAddress(acceptedClaimant);
    context.CommitmentClaimRequest.set({
      ...request,
      state: accepted ? "ACCEPTED" : "SUPERSEDED",
      resolutionCode,
      resolvedAt: timestamp,
      updatedAt: Math.max(request.updatedAt, timestamp),
    });
  }
}

export async function recordMemberEvent(
  context: PoolingContext,
  commitment: Commitment,
  account: string | undefined,
  counter: MemberHistoryCounter,
  timestamp: number
): Promise<void> {
  if (commitment.poolId === undefined || account === undefined) return;
  await applyMemberHistoryDelta(
    context,
    commitment.chainId,
    commitment.poolId,
    account,
    counter,
    1,
    timestamp
  );
}

export async function applyAcceptanceSideEffects(
  context: PoolingContext,
  previous: Commitment,
  accepted: Commitment,
  claimant: string | undefined,
  timestamp: number
): Promise<Commitment> {
  if (previous.acceptanceSeen || accepted.poolId === undefined) {
    return reconcileMemberHistory(context, accepted, timestamp);
  }
  const pool = await context.CommitmentPool.get(poolingEntityId(accepted.chainId, accepted.poolId));
  if (pool) {
    context.CommitmentPool.set({
      ...pool,
      commitmentsDue:
        accepted.state === "CANCELLED" ? pool.commitmentsDue : pool.commitmentsDue + 1n,
      updatedAt: Math.max(pool.updatedAt, timestamp),
    });
  }
  if (accepted.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(accepted.chainId, accepted.cycleId)
    );
    if (cycle) {
      context.CommitmentCycle.set({
        ...cycle,
        commitmentsDue:
          accepted.state === "CANCELLED" ? cycle.commitmentsDue : cycle.commitmentsDue + 1n,
        updatedAt: Math.max(cycle.updatedAt, timestamp),
      });
    }
  }
  if (accepted.leadProvider) {
    const leadId = commitmentMemberId(
      accepted.chainId,
      accepted.commitmentId,
      accepted.leadProvider
    );
    const lead = await context.CommitmentContributor.get(leadId);
    if (lead && !lead.isLead) {
      context.CommitmentContributor.set({
        ...lead,
        isLead: true,
        updatedAt: Math.max(lead.updatedAt, timestamp),
      });
    }
  }
  await recordMemberEvent(
    context,
    accepted,
    accepted.leadProvider ?? claimant,
    "leadAccepted",
    timestamp
  );
  return reconcileMemberHistory(context, accepted, timestamp);
}

export async function handleAccepted(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  const claimant = normalizeAddress(value<string>(event, "claimant"));
  const providerGarden = optionalAddress(event, "providerGarden");
  const payerGarden = optionalAddress(event, "payerGarden");
  let accepted = await applyLifecycleState(
    context,
    commitment,
    "ACCEPTED",
    BigInt(event.block.number),
    event.logIndex,
    event.block.timestamp,
    {
      acceptanceSeen: true,
      counterparty: normalizeAddress(value<string>(event, "counterparty")),
      leadProvider: normalizeAddress(value<string>(event, "leadProvider")),
      providerGarden,
      providerGardenId: providerGarden,
      payerGarden,
      payerGardenId: payerGarden,
      counterpartyKind: commitmentClaimType(value<bigint>(event, "kind")),
      acceptanceBlockNumber: BigInt(event.block.number),
      acceptanceLogIndex: event.logIndex,
      acceptanceAt: event.block.timestamp,
    }
  );
  if (!accepted.acceptanceSeen) {
    accepted = {
      ...accepted,
      acceptanceSeen: true,
      counterparty: normalizeAddress(value<string>(event, "counterparty")),
      leadProvider: normalizeAddress(value<string>(event, "leadProvider")),
      providerGarden,
      providerGardenId: providerGarden,
      payerGarden,
      payerGardenId: payerGarden,
      counterpartyKind: commitmentClaimType(value<bigint>(event, "kind")),
      acceptanceBlockNumber: BigInt(event.block.number),
      acceptanceLogIndex: event.logIndex,
      acceptanceAt: event.block.timestamp,
      updatedAt: Math.max(accepted.updatedAt, event.block.timestamp),
    };
    context.Commitment.set(accepted);
  }
  accepted = await applyAcceptanceSideEffects(
    context,
    commitment,
    accepted,
    claimant,
    event.block.timestamp
  );
  await sweepClaimRequests(
    context,
    accepted,
    claimant,
    "COMMITMENT_ACCEPTED",
    event.block.timestamp
  );
}

export async function handleExchange(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const poolId = value<bigint>(event, "poolId");
  const commitmentIdA = value<bigint>(event, "commitmentIdA");
  const commitmentIdB = value<bigint>(event, "commitmentIdB");
  const id = `${event.chainId}-EXCHANGE-${poolId}-${commitmentIdA}-${commitmentIdB}`;
  if (await context.CommitmentExchange.get(id)) return;
  context.CommitmentExchange.set({
    id,
    chainId: event.chainId,
    poolId,
    poolEntityId: poolingEntityId(event.chainId, poolId),
    commitmentIdA,
    commitmentEntityIdA: poolingEntityId(event.chainId, commitmentIdA),
    commitmentIdB,
    commitmentEntityIdB: poolingEntityId(event.chainId, commitmentIdB),
    acceptorA: normalizeAddress(value<string>(event, "acceptorA")),
    acceptorB: normalizeAddress(value<string>(event, "acceptorB")),
    txHash: getTxHash(event.transaction).toLowerCase(),
    acceptedAt: event.block.timestamp,
  });
}
