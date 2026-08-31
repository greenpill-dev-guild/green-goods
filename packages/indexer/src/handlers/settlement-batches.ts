import { indexer, type SettlementBatch, type SettlementSubjectState } from "envio";

import {
  applySubjectStateToDisbursement,
  disbursementId,
  disbursementKind,
  fundingRoute,
  payoutStatus,
  settlementBatchId,
  settlementSubjectId,
} from "./settlement-projections";
import { normalizeAddress } from "./shared";

export function applySubjectStateToBatch(
  entity: SettlementBatch,
  subject: SettlementSubjectState
): SettlementBatch {
  return {
    ...entity,
    state: subject.state,
    attempt: subject.attempt,
    executionKey: subject.executionKey,
    commandMessageId: subject.commandMessageId,
    acknowledgmentMessageId: subject.acknowledgmentMessageId,
    failureCode: subject.failureCode,
    dispatchedAt: subject.dispatchedAt,
    confirmedAt: subject.confirmedAt,
    reasonCID: subject.reasonCID ?? entity.reasonCID,
    updatedAt: Math.max(entity.updatedAt, subject.updatedAt),
  };
}

indexer.onEvent(
  { contract: "SettlementModule", event: "BatchCreated" },
  async ({ event, context }) => {
    const entityId = settlementBatchId(event.chainId, event.params.batchId);
    const subject = await context.SettlementSubjectState.get(
      settlementSubjectId(event.chainId, true, event.params.batchId)
    );
    const disbursementEntityIds = event.params.disbursementIds.map((id) =>
      disbursementId(event.chainId, id)
    );
    let batch: SettlementBatch = {
      id: entityId,
      chainId: event.chainId,
      batchId: event.params.batchId,
      executorGarden: normalizeAddress(event.params.executorGarden),
      executorGardenId: normalizeAddress(event.params.executorGarden),
      source: normalizeAddress(event.params.source),
      token: normalizeAddress(event.params.token),
      kind: disbursementKind(event.params.kind),
      fundingRoute: fundingRoute(event.params.fundingRoute),
      disbursementIds: [...event.params.disbursementIds],
      disbursementEntityIds,
      state: "QUEUED",
      attempt: 0,
      executionKey: undefined,
      commandMessageId: undefined,
      dispatchedAt: undefined,
      celoExecutionTx: undefined,
      acknowledgmentMessageId: undefined,
      confirmedAt: undefined,
      reasonCID: undefined,
      failureCode: undefined,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    };
    if (subject) batch = applySubjectStateToBatch(batch, subject);
    context.SettlementBatch.set(batch);

    for (const rawId of event.params.disbursementIds) {
      const childEntityId = disbursementId(event.chainId, rawId);
      context.SettlementBatchMembership.set({
        id: childEntityId,
        chainId: event.chainId,
        disbursementId: rawId,
        batchId: event.params.batchId,
        batchEntityId: entityId,
        updatedAt: event.block.timestamp,
      });
      const child = await context.Disbursement.get(childEntityId);
      if (child) {
        const childWithBatch = {
          ...child,
          batchId: event.params.batchId,
          batchEntityId: entityId,
          updatedAt: event.block.timestamp,
        };
        context.Disbursement.set(
          subject ? applySubjectStateToDisbursement(childWithBatch, subject) : childWithBatch
        );
      }
    }
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "BatchCancelled" },
  async ({ event, context }) => {
    const entityId = settlementBatchId(event.chainId, event.params.batchId);
    const batch = await context.SettlementBatch.get(entityId);
    if (!batch || batch.state === "CANCELLED") return;
    context.SettlementBatch.set({
      ...batch,
      state: "CANCELLED",
      reasonCID: event.params.reasonCID,
      updatedAt: event.block.timestamp,
    });
    context.SettlementSubjectState.set({
      id: settlementSubjectId(event.chainId, true, event.params.batchId),
      chainId: event.chainId,
      isBatch: true,
      subjectId: event.params.batchId,
      state: "CANCELLED",
      attempt: batch.attempt,
      executionKey: batch.executionKey,
      commandMessageId: batch.commandMessageId,
      acknowledgmentMessageId: batch.acknowledgmentMessageId,
      failureCode: batch.failureCode,
      dispatchedAt: batch.dispatchedAt,
      confirmedAt: batch.confirmedAt,
      reasonCID: event.params.reasonCID,
      updatedAt: event.block.timestamp,
    });
    for (const childEntityId of batch.disbursementEntityIds) {
      const child = await context.Disbursement.get(childEntityId);
      if (!child) continue;
      context.Disbursement.set({
        ...child,
        state: "CANCELLED",
        cancelledFromState: "QUEUED",
        reasonCID: event.params.reasonCID,
        updatedAt: event.block.timestamp,
      });
      if (!child.payoutPlanEntityId) continue;
      const plan = await context.CommitmentPayoutPlan.get(child.payoutPlanEntityId);
      if (!plan) continue;
      const nextBase = {
        ...plan,
        cancelledPayoutCount: plan.cancelledPayoutCount + 1,
        updatedAt: event.block.timestamp,
      };
      context.CommitmentPayoutPlan.set({ ...nextBase, status: payoutStatus(nextBase) });
    }
  }
);
