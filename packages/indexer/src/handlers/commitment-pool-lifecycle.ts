import type { Commitment } from "envio";

import { commitmentState, confirmationPath, cursorWins } from "./commitment-pool-projections";
import { recordMemberEvent, sweepClaimRequests } from "./commitment-pool-claims";
import {
  getCommitment,
  reconcileMemberHistory,
  reconcileRecognitionWeights,
} from "./commitment-pool-members";
import { type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { applyLifecycleState } from "./commitment-pool-state";
import { reconcileCommitmentHypercerts } from "./hypercert-allocations";
import { normalizeAddress } from "./shared";

export async function handleLifecycle(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  let state = commitment.state;
  let fulfilledBy = commitment.fulfilledBy;
  let path = commitment.confirmationPath;
  let fallbackReason = commitment.fallbackReason;
  let preDisputeState = commitment.preDisputeState;
  let disputeReasonCID = commitment.disputeReasonCID;
  let cancelReasonCID = commitment.cancelReasonCID;
  if (event.eventName === "CommitmentReadyForConfirmation") state = "READY_FOR_CONFIRMATION";
  if (event.eventName === "CommitmentFulfilled") {
    state = "FULFILLED";
    fulfilledBy = normalizeAddress(value<string>(event, "confirmer"));
    path = confirmationPath(value<bigint>(event, "confirmationPath"));
    fallbackReason = value<string>(event, "reason") || undefined;
  }
  if (event.eventName === "CommitmentCancelled") {
    state = "CANCELLED";
    cancelReasonCID = value<string>(event, "reasonCID");
  }
  if (event.eventName === "CommitmentExpired") state = "EXPIRED";
  if (event.eventName === "CommitmentDisputed") {
    state = "DISPUTED";
    preDisputeState = commitmentState(value<bigint>(event, "previousState"));
    disputeReasonCID = value<string>(event, "reasonCID");
  }
  if (event.eventName === "DisputeResolved") {
    state = commitmentState(value<bigint>(event, "finalState"));
    if (state === "FULFILLED") {
      fulfilledBy = undefined;
      path = undefined;
      fallbackReason = undefined;
    }
  }
  if (!state) return;
  const lifecycleWins = cursorWins(
    event.block.number,
    event.logIndex,
    commitment.lifecycleBlockNumber,
    commitment.lifecycleLogIndex
  );
  const updated = await applyLifecycleState(
    context,
    commitment,
    state,
    BigInt(event.block.number),
    event.logIndex,
    event.block.timestamp,
    {
      readyOverridden:
        event.eventName === "CommitmentReadyForConfirmation"
          ? value<boolean>(event, "overridden")
          : commitment.readyOverridden,
      fulfilledBy,
      confirmationPath: path,
      fallbackReason,
      fulfilledByFallback: path === "POOL_FALLBACK" || path === "PROTOCOL_FALLBACK",
      preDisputeState,
      disputeReasonCID,
      cancelReasonCID,
    }
  );
  if (event.eventName === "CommitmentCancelled" || event.eventName === "CommitmentExpired") {
    await sweepClaimRequests(
      context,
      updated,
      undefined,
      event.eventName === "CommitmentCancelled" ? "COMMITMENT_CANCELLED" : "COMMITMENT_EXPIRED",
      event.block.timestamp
    );
  }
  if (!lifecycleWins) return;

  if (
    event.eventName === "DisputeResolved" &&
    (updated.state === "CANCELLED" || updated.state === "EXPIRED")
  ) {
    await sweepClaimRequests(
      context,
      updated,
      undefined,
      updated.state === "CANCELLED" ? "COMMITMENT_CANCELLED" : "COMMITMENT_EXPIRED",
      event.block.timestamp
    );
  }
  if (event.eventName === "CommitmentDisputed") {
    await recordMemberEvent(
      context,
      updated,
      normalizeAddress(value<string>(event, "raiser")),
      "disputesRaised",
      event.block.timestamp
    );
  }
}

export async function handleMiscCommitment(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (event.eventName === "ContributorRosterFrozen") {
    const updated = {
      ...commitment,
      contributorsFrozen: true,
      frozenContributorCount: Number(value<bigint>(event, "contributorCount")),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    } satisfies Commitment;
    context.Commitment.set(updated);
    const reconciled = await reconcileMemberHistory(context, updated, event.block.timestamp);
    await reconcileRecognitionWeights(context, reconciled, event.block.timestamp);
    await reconcileCommitmentHypercerts(context, reconciled, event.block.timestamp);
    return;
  }
  if (event.eventName === "AssessmentAttached") {
    context.Commitment.set({
      ...commitment,
      assessmentUID: value<string>(event, "assessmentUID").toLowerCase(),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "ConfirmationRecorded") {
    const confirmer = normalizeAddress(value<string>(event, "confirmer"));
    const thresholdWins = cursorWins(
      event.block.number,
      event.logIndex,
      commitment.confirmerRuleUpdateBlockNumber,
      commitment.confirmerRuleUpdateLogIndex
    );
    const updated = {
      ...commitment,
      confirmationCount: Math.max(
        commitment.confirmationCount,
        Number(value<bigint>(event, "confirmationCount"))
      ),
      confirmationThreshold: thresholdWins
        ? Number(value<bigint>(event, "threshold"))
        : commitment.confirmationThreshold,
      confirmerRuleUpdateBlockNumber: thresholdWins
        ? BigInt(event.block.number)
        : commitment.confirmerRuleUpdateBlockNumber,
      confirmerRuleUpdateLogIndex: thresholdWins
        ? event.logIndex
        : commitment.confirmerRuleUpdateLogIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    } satisfies Commitment;
    context.Commitment.set(updated);
    await recordMemberEvent(
      context,
      updated,
      confirmer,
      "confirmationsGiven",
      event.block.timestamp
    );
    return;
  }
  if (event.eventName === "ConsiderationPaid") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.considerationUpdateBlockNumber,
        commitment.considerationUpdateLogIndex
      )
    )
      return;
    context.Commitment.set({
      ...commitment,
      considerationPaid: true,
      considerationSource: normalizeAddress(value<string>(event, "source")),
      considerationRecipient: normalizeAddress(value<string>(event, "recipient")),
      considerationToken: normalizeAddress(value<string>(event, "token")),
      considerationAmount: value<bigint>(event, "amount"),
      considerationPayoutRef: value<string>(event, "payoutRef").toLowerCase(),
      considerationRecordedBy: normalizeAddress(value<string>(event, "recordedBy")),
      considerationUpdateBlockNumber: BigInt(event.block.number),
      considerationUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
  }
}
