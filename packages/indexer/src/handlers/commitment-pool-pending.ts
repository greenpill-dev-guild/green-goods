import type { Commitment, CommitmentPendingLifecycleProjection } from "envio";

import {
  commitmentClaimType,
  commitmentState,
  compareCodeUnits,
  confirmationPath,
  eventAuditId,
  sortedUnique,
} from "./commitment-pool-projections";
import {
  applyAcceptanceSideEffects,
  recordMemberEvent,
  sweepClaimRequests,
} from "./commitment-pool-claims";
import { getCommitment } from "./commitment-pool-members";
import {
  eventType,
  firstExplicitActor,
  type PoolingContext,
  type RuntimeEvent,
  value,
} from "./commitment-pool-runtime";
import { applyLifecycleState } from "./commitment-pool-state";
import { getTxHash, normalizeAddress } from "./shared";

const BUFFERED_LIFECYCLE_EVENTS = new Set([
  "CommitmentAccepted",
  "CommitmentReadyForConfirmation",
  "ConfirmationRecorded",
  "CommitmentFulfilled",
  "CommitmentCancelled",
  "CommitmentExpired",
  "CommitmentDisputed",
  "DisputeResolved",
]);

export async function enqueuePendingLifecycle(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<boolean> {
  if (!BUFFERED_LIFECYCLE_EVENTS.has(event.eventName)) return false;
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (commitment.creationSeen) return false;
  context.Commitment.set(commitment);
  const id = eventAuditId(event.chainId, getTxHash(event.transaction), event.logIndex);
  const existing = await context.CommitmentPendingLifecycleProjection.get(id);
  if (!existing) {
    const eventTypeValue = eventType(event.eventName);
    const claimant =
      typeof event.params.claimant === "string"
        ? normalizeAddress(event.params.claimant)
        : undefined;
    const projection: CommitmentPendingLifecycleProjection = {
      id,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: commitment.id,
      eventType: eventTypeValue,
      blockNumber: BigInt(event.block.number),
      logIndex: event.logIndex,
      nextState:
        event.eventName === "CommitmentAccepted"
          ? "ACCEPTED"
          : event.eventName === "CommitmentReadyForConfirmation"
            ? "READY_FOR_CONFIRMATION"
            : event.eventName === "CommitmentFulfilled"
              ? "FULFILLED"
              : event.eventName === "CommitmentCancelled"
                ? "CANCELLED"
                : event.eventName === "CommitmentExpired"
                  ? "EXPIRED"
                  : event.eventName === "CommitmentDisputed"
                    ? "DISPUTED"
                    : event.eventName === "DisputeResolved"
                      ? commitmentState(value<bigint>(event, "finalState"))
                      : undefined,
      actor: firstExplicitActor(event),
      claimType:
        typeof event.params.kind === "bigint" ? commitmentClaimType(event.params.kind) : undefined,
      gardenContext:
        typeof event.params.gardenContext === "string"
          ? normalizeAddress(event.params.gardenContext)
          : undefined,
      claimant,
      counterparty:
        typeof event.params.counterparty === "string"
          ? normalizeAddress(event.params.counterparty)
          : undefined,
      leadProvider:
        typeof event.params.leadProvider === "string"
          ? normalizeAddress(event.params.leadProvider)
          : undefined,
      providerGarden:
        typeof event.params.providerGarden === "string"
          ? normalizeAddress(event.params.providerGarden)
          : undefined,
      payerGarden:
        typeof event.params.payerGarden === "string"
          ? normalizeAddress(event.params.payerGarden)
          : undefined,
      confirmationCount:
        typeof event.params.confirmationCount === "bigint"
          ? Number(event.params.confirmationCount)
          : undefined,
      confirmationThreshold:
        typeof event.params.threshold === "bigint" ? Number(event.params.threshold) : undefined,
      overridden:
        typeof event.params.overridden === "boolean" ? event.params.overridden : undefined,
      confirmationPath:
        typeof event.params.confirmationPath === "bigint"
          ? confirmationPath(event.params.confirmationPath)
          : undefined,
      previousState:
        typeof event.params.previousState === "bigint"
          ? commitmentState(event.params.previousState)
          : undefined,
      disputeResolution:
        typeof event.params.resolution === "bigint" ? Number(event.params.resolution) : undefined,
      data:
        typeof event.params.reasonCID === "string"
          ? event.params.reasonCID
          : typeof event.params.reason === "string"
            ? event.params.reason
            : undefined,
      applied: false,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPendingLifecycleProjection.set(projection);
  }
  const index = await context.CommitmentPendingLifecycleProjectionIndex.get(commitment.id);
  context.CommitmentPendingLifecycleProjectionIndex.set({
    id: commitment.id,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: commitment.id,
    projectionIds: sortedUnique([...(index?.projectionIds ?? []), id]),
    updatedAt: Math.max(index?.updatedAt ?? 0, event.block.timestamp),
  });
  return true;
}

async function applyPendingProjection(
  context: PoolingContext,
  commitment: Commitment,
  projection: CommitmentPendingLifecycleProjection
): Promise<Commitment> {
  let patch: Partial<Commitment> = {};
  if (projection.eventType === "ACCEPTED") {
    patch = {
      acceptanceSeen: true,
      counterparty: projection.counterparty,
      leadProvider: projection.leadProvider,
      providerGarden: projection.providerGarden,
      providerGardenId: projection.providerGarden,
      payerGarden: projection.payerGarden,
      payerGardenId: projection.payerGarden,
      counterpartyKind: projection.claimType,
      acceptanceBlockNumber: projection.blockNumber,
      acceptanceLogIndex: projection.logIndex,
    };
  } else if (projection.eventType === "READY_FOR_CONFIRMATION") {
    patch = { readyOverridden: projection.overridden ?? false };
  } else if (projection.eventType === "CONFIRMATION_RECORDED") {
    const thresholdWins =
      commitment.confirmerRuleUpdateBlockNumber === undefined ||
      commitment.confirmerRuleUpdateLogIndex === undefined ||
      projection.blockNumber > commitment.confirmerRuleUpdateBlockNumber ||
      (projection.blockNumber === commitment.confirmerRuleUpdateBlockNumber &&
        projection.logIndex > commitment.confirmerRuleUpdateLogIndex);
    const updated = {
      ...commitment,
      confirmationCount: Math.max(commitment.confirmationCount, projection.confirmationCount ?? 0),
      confirmationThreshold: thresholdWins
        ? (projection.confirmationThreshold ?? commitment.confirmationThreshold)
        : commitment.confirmationThreshold,
      confirmerRuleUpdateBlockNumber: thresholdWins
        ? projection.blockNumber
        : commitment.confirmerRuleUpdateBlockNumber,
      confirmerRuleUpdateLogIndex: thresholdWins
        ? projection.logIndex
        : commitment.confirmerRuleUpdateLogIndex,
      confirmers: commitment.confirmers,
      updatedAt: Math.max(commitment.updatedAt, projection.updatedAt),
    };
    context.Commitment.set(updated);
    if (projection.actor) {
      await recordMemberEvent(
        context,
        updated,
        projection.actor,
        "confirmationsGiven",
        projection.updatedAt
      );
    }
    return updated;
  } else if (projection.eventType === "FULFILLED") {
    patch = {
      fulfilledBy: projection.actor,
      confirmationPath: projection.confirmationPath,
      fallbackReason: projection.data || undefined,
      fulfilledByFallback:
        projection.confirmationPath === "POOL_FALLBACK" ||
        projection.confirmationPath === "PROTOCOL_FALLBACK",
    };
  } else if (projection.eventType === "CANCELLED") {
    patch = { cancelReasonCID: projection.data };
  } else if (projection.eventType === "DISPUTED") {
    patch = {
      preDisputeState: projection.previousState,
      disputeReasonCID: projection.data,
    };
  } else if (projection.eventType === "DISPUTE_RESOLVED") {
    patch = {
      fulfilledBy: undefined,
      confirmationPath: undefined,
      fallbackReason: undefined,
      fulfilledByFallback: false,
    };
  }
  if (!projection.nextState) return commitment;
  const updated = await applyLifecycleState(
    context,
    commitment,
    projection.nextState,
    projection.blockNumber,
    projection.logIndex,
    projection.updatedAt,
    patch
  );
  if (projection.eventType === "ACCEPTED") {
    const accepted = await applyAcceptanceSideEffects(
      context,
      commitment,
      updated,
      projection.claimant,
      projection.updatedAt
    );
    await sweepClaimRequests(
      context,
      accepted,
      projection.claimant,
      "COMMITMENT_ACCEPTED",
      projection.updatedAt
    );
    return accepted;
  }
  if (
    projection.eventType === "CANCELLED" ||
    projection.eventType === "EXPIRED" ||
    (projection.eventType === "DISPUTE_RESOLVED" &&
      (updated.state === "CANCELLED" || updated.state === "EXPIRED"))
  ) {
    await sweepClaimRequests(
      context,
      updated,
      undefined,
      updated.state === "CANCELLED" ? "COMMITMENT_CANCELLED" : "COMMITMENT_EXPIRED",
      projection.updatedAt
    );
  }
  if (projection.eventType === "DISPUTED" && projection.actor) {
    await recordMemberEvent(
      context,
      updated,
      projection.actor,
      "disputesRaised",
      projection.updatedAt
    );
  }
  return updated;
}

export async function drainPendingLifecycle(
  context: PoolingContext,
  commitment: Commitment
): Promise<Commitment> {
  const index = await context.CommitmentPendingLifecycleProjectionIndex.get(commitment.id);
  if (!index || index.projectionIds.length === 0) return commitment;
  const projections = (
    await Promise.all(
      index.projectionIds.map((id) => context.CommitmentPendingLifecycleProjection.get(id))
    )
  )
    .filter((projection): projection is CommitmentPendingLifecycleProjection => Boolean(projection))
    .sort((left, right) => {
      if (left.blockNumber !== right.blockNumber)
        return left.blockNumber < right.blockNumber ? -1 : 1;
      if (left.logIndex !== right.logIndex) return left.logIndex - right.logIndex;
      return compareCodeUnits(left.id, right.id);
    });
  let updated = commitment;
  for (const projection of projections) {
    if (!projection.applied) {
      updated = await applyPendingProjection(context, updated, projection);
      context.CommitmentPendingLifecycleProjection.set({
        ...projection,
        applied: true,
        updatedAt: Math.max(projection.updatedAt, updated.updatedAt),
      });
    }
  }
  context.CommitmentPendingLifecycleProjectionIndex.set({
    ...index,
    projectionIds: [],
    updatedAt: Math.max(index.updatedAt, updated.updatedAt),
  });
  return updated;
}
