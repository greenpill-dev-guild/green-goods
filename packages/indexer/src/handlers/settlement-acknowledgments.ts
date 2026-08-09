import { indexer, type Disbursement } from "envio";

import {
  configurationId,
  disbursementId,
  payoutStatus,
  settlementBatchId,
  settlementCommandIndexId,
  settlementMessageId,
  settlementSubjectId,
} from "./settlement-projections";
import { normalizeAddress } from "./shared";

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementAcknowledged" },
  async ({ event, context }) => {
    const executionKey = event.params.executionKey.toLowerCase();
    const acknowledgmentMessageId = event.params.acknowledgmentMessageId.toLowerCase();
    const originatingCommandMessageId = event.params.originatingCommandMessageId.toLowerCase();
    const nextState = event.params.success ? "CONFIRMED" : "FAILED";
    const subjectEntityId = settlementSubjectId(
      event.chainId,
      event.params.isBatch,
      event.params.subjectId
    );
    const [currentSubject, commandIndex, configuration] = await Promise.all([
      context.SettlementSubjectState.get(subjectEntityId),
      context.SettlementCommandIndex.get(settlementCommandIndexId(event.chainId, executionKey)),
      context.SettlementConfiguration.get(configurationId(event.chainId)),
    ]);
    const attempt = commandIndex?.attempt ?? currentSubject?.attempt ?? 0;
    context.SettlementSubjectState.set({
      id: subjectEntityId,
      chainId: event.chainId,
      isBatch: event.params.isBatch,
      subjectId: event.params.subjectId,
      state: nextState,
      attempt,
      executionKey,
      commandMessageId: originatingCommandMessageId,
      acknowledgmentMessageId,
      failureCode: Number(event.params.failureCode),
      dispatchedAt: currentSubject?.dispatchedAt,
      confirmedAt: event.params.success ? event.block.timestamp : undefined,
      reasonCID: currentSubject?.reasonCID,
      updatedAt: event.block.timestamp,
    });
    if (configuration?.remoteEvmChainId !== undefined) {
      context.SettlementMessage.set({
        id: settlementMessageId(event.chainId, acknowledgmentMessageId),
        chainId: event.chainId,
        messageId: acknowledgmentMessageId,
        executionKey,
        direction: "ACKNOWLEDGMENT",
        status: "ACKNOWLEDGED",
        isBatch: event.params.isBatch,
        subjectId: event.params.subjectId,
        attempt,
        destinationPeer: normalizeAddress(event.srcAddress),
        destinationGasLimit: undefined,
        protocolVersion: commandIndex?.protocolVersion ?? configuration.protocolVersion,
        commandPayloadHash: undefined,
        sourceChainId: configuration.remoteEvmChainId,
        destinationChainId: event.chainId,
        sourceChainSelector: configuration.remoteChainSelector,
        destinationChainSelector: configuration.localChainSelector,
        fee: undefined,
        reserveFunded: undefined,
        failureCode: Number(event.params.failureCode),
        txHash: event.transaction.hash.toLowerCase(),
        createdAt: event.block.timestamp,
        updatedAt: event.block.timestamp,
      });
    }

    const planDeltas = new Map<string, { confirmed: number; failed: number }>();
    const updateChild = (existing: Disbursement) => {
      const current = planDeltas.get(existing.payoutPlanEntityId ?? "") ?? {
        confirmed: 0,
        failed: 0,
      };
      if (existing.payoutPlanEntityId) {
        current.confirmed +=
          (nextState === "CONFIRMED" ? 1 : 0) - (existing.state === "CONFIRMED" ? 1 : 0);
        current.failed += (nextState === "FAILED" ? 1 : 0) - (existing.state === "FAILED" ? 1 : 0);
        planDeltas.set(existing.payoutPlanEntityId, current);
      }
      context.Disbursement.set({
        ...existing,
        state: nextState,
        attempt,
        executionKey,
        commandMessageId: originatingCommandMessageId,
        acknowledgmentMessageId,
        failureCode: Number(event.params.failureCode),
        confirmedAt: event.params.success ? event.block.timestamp : undefined,
        updatedAt: event.block.timestamp,
      });
    };

    if (event.params.isBatch) {
      const batch = await context.SettlementBatch.get(
        settlementBatchId(event.chainId, event.params.subjectId)
      );
      if (batch) {
        context.SettlementBatch.set({
          ...batch,
          state: nextState,
          attempt,
          executionKey,
          commandMessageId: originatingCommandMessageId,
          acknowledgmentMessageId,
          failureCode: Number(event.params.failureCode),
          confirmedAt: event.params.success ? event.block.timestamp : undefined,
          updatedAt: event.block.timestamp,
        });
        for (const childEntityId of batch.disbursementEntityIds) {
          const child = await context.Disbursement.get(childEntityId);
          if (child) updateChild(child);
        }
      }
    } else {
      const child = await context.Disbursement.get(
        disbursementId(event.chainId, event.params.subjectId)
      );
      if (child) updateChild(child);
    }

    for (const [planEntityId, delta] of planDeltas) {
      const plan = await context.CommitmentPayoutPlan.get(planEntityId);
      if (!plan) continue;
      const updatedPlanBase = {
        ...plan,
        confirmedPayoutCount: Math.max(0, plan.confirmedPayoutCount + delta.confirmed),
        failedPayoutCount: Math.max(0, plan.failedPayoutCount + delta.failed),
        updatedAt: event.block.timestamp,
      };
      context.CommitmentPayoutPlan.set({
        ...updatedPlanBase,
        status: payoutStatus(updatedPlanBase),
      });
    }
  }
);

type SettlementHandlerContext = Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"];

async function recordIgnoredAcknowledgment(
  event: {
    chainId: number;
    srcAddress: string;
    block: { timestamp: number };
    transaction: { hash: string };
    params: { executionKey: string; acknowledgmentMessageId: string };
  },
  context: SettlementHandlerContext,
  status: "DUPLICATE" | "STALE"
): Promise<void> {
  const executionKey = event.params.executionKey.toLowerCase();
  const acknowledgmentMessageId = event.params.acknowledgmentMessageId.toLowerCase();
  const [commandIndex, configuration] = await Promise.all([
    context.SettlementCommandIndex.get(settlementCommandIndexId(event.chainId, executionKey)),
    context.SettlementConfiguration.get(configurationId(event.chainId)),
  ]);
  if (!commandIndex || configuration?.remoteEvmChainId === undefined) return;
  context.SettlementMessage.set({
    id: settlementMessageId(event.chainId, acknowledgmentMessageId),
    chainId: event.chainId,
    messageId: acknowledgmentMessageId,
    executionKey,
    direction: "ACKNOWLEDGMENT",
    status,
    isBatch: commandIndex.isBatch,
    subjectId: commandIndex.subjectId,
    attempt: commandIndex.attempt,
    destinationPeer: normalizeAddress(event.srcAddress),
    destinationGasLimit: undefined,
    protocolVersion: commandIndex.protocolVersion,
    commandPayloadHash: undefined,
    sourceChainId: configuration.remoteEvmChainId,
    destinationChainId: event.chainId,
    sourceChainSelector: configuration.remoteChainSelector,
    destinationChainSelector: configuration.localChainSelector,
    fee: undefined,
    reserveFunded: undefined,
    failureCode: undefined,
    txHash: event.transaction.hash.toLowerCase(),
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
}

indexer.onEvent(
  { contract: "SettlementModule", event: "DuplicateAcknowledgmentIgnored" },
  ({ event, context }) => recordIgnoredAcknowledgment(event, context, "DUPLICATE")
);

indexer.onEvent(
  { contract: "SettlementModule", event: "StaleAcknowledgmentIgnored" },
  ({ event, context }) => recordIgnoredAcknowledgment(event, context, "STALE")
);
