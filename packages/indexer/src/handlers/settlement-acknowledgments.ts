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
import { linkPayoutPlanToCommitment } from "./settlement-funding-reconciliation";

const SOURCE_STRANDED_FAILURE_CODE = 12;

function acknowledgmentWins(
  attempt: number,
  nextState: "CONFIRMED" | "FAILED",
  currentAttempt: number,
  currentState: Disbursement["state"]
): boolean {
  if (attempt !== currentAttempt) return attempt > currentAttempt;
  return currentState !== "CONFIRMED" || nextState === "CONFIRMED";
}

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
    if (
      !currentSubject ||
      acknowledgmentWins(attempt, nextState, currentSubject.attempt, currentSubject.state)
    ) {
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
        updatedAt: Math.max(currentSubject?.updatedAt ?? 0, event.block.timestamp),
      });
    }
    if (commandIndex) {
      context.SettlementCommandIndex.set({
        ...commandIndex,
        state: nextState,
        acknowledgmentMessageId,
        failureCode: Number(event.params.failureCode),
        resolvedAt: event.block.timestamp,
        updatedAt: event.block.timestamp,
      });
    }
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
    const updateChild = async (existing: Disbursement) => {
      if (!acknowledgmentWins(attempt, nextState, existing.attempt, existing.state)) return;
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
      if (existing.kind === "REFUND" && existing.fundingEntityId) {
        const funding = await context.CommitmentFunding.get(existing.fundingEntityId);
        if (funding) {
          context.CommitmentFunding.set({
            ...funding,
            state: event.params.success ? "REFUNDED" : "REFUND_QUEUED",
            closedAt: event.params.success ? event.block.timestamp : funding.closedAt,
            updatedAt: Math.max(funding.updatedAt, event.block.timestamp),
          });
        }
      }
    };

    if (event.params.isBatch) {
      const batch = await context.SettlementBatch.get(
        settlementBatchId(event.chainId, event.params.subjectId)
      );
      if (batch && acknowledgmentWins(attempt, nextState, batch.attempt, batch.state)) {
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
          if (child) await updateChild(child);
        }
      }
    } else {
      const child = await context.Disbursement.get(
        disbursementId(event.chainId, event.params.subjectId)
      );
      if (child) await updateChild(child);
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
      const updatedPlan = {
        ...updatedPlanBase,
        status: payoutStatus(updatedPlanBase),
      };
      context.CommitmentPayoutPlan.set(updatedPlan);
      await linkPayoutPlanToCommitment(context, updatedPlan);
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

indexer.onEvent(
  { contract: "SettlementModule", event: "StrandedSubjectFailed" },
  async ({ event, context }) => {
    const executionKey = event.params.executionKey.toLowerCase();
    const subjectEntityId = settlementSubjectId(
      event.chainId,
      event.params.isBatch,
      event.params.subjectId
    );
    const [currentSubject, commandIndex] = await Promise.all([
      context.SettlementSubjectState.get(subjectEntityId),
      context.SettlementCommandIndex.get(settlementCommandIndexId(event.chainId, executionKey)),
    ]);
    const attempt = commandIndex?.attempt ?? currentSubject?.attempt ?? 0;
    const commandMessageId = commandIndex?.commandMessageId ?? currentSubject?.commandMessageId;
    context.SettlementSubjectState.set({
      id: subjectEntityId,
      chainId: event.chainId,
      isBatch: event.params.isBatch,
      subjectId: event.params.subjectId,
      state: "FAILED",
      attempt,
      executionKey,
      commandMessageId,
      acknowledgmentMessageId: undefined,
      failureCode: SOURCE_STRANDED_FAILURE_CODE,
      dispatchedAt: currentSubject?.dispatchedAt,
      confirmedAt: undefined,
      reasonCID: currentSubject?.reasonCID,
      updatedAt: event.block.timestamp,
    });
    if (commandIndex) {
      context.SettlementCommandIndex.set({
        ...commandIndex,
        state: "FAILED",
        acknowledgmentMessageId: undefined,
        failureCode: SOURCE_STRANDED_FAILURE_CODE,
        resolvedAt: event.block.timestamp,
        updatedAt: event.block.timestamp,
      });
    }

    const planDeltas = new Map<string, { confirmed: number; failed: number }>();
    const failChild = (existing: Disbursement) => {
      if (existing.payoutPlanEntityId) {
        const current = planDeltas.get(existing.payoutPlanEntityId) ?? { confirmed: 0, failed: 0 };
        current.confirmed -= existing.state === "CONFIRMED" ? 1 : 0;
        current.failed += 1 - (existing.state === "FAILED" ? 1 : 0);
        planDeltas.set(existing.payoutPlanEntityId, current);
      }
      context.Disbursement.set({
        ...existing,
        state: "FAILED",
        attempt,
        executionKey,
        commandMessageId,
        acknowledgmentMessageId: undefined,
        failureCode: SOURCE_STRANDED_FAILURE_CODE,
        confirmedAt: undefined,
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
          state: "FAILED",
          attempt,
          executionKey,
          commandMessageId,
          acknowledgmentMessageId: undefined,
          failureCode: SOURCE_STRANDED_FAILURE_CODE,
          confirmedAt: undefined,
          updatedAt: event.block.timestamp,
        });
        for (const childEntityId of batch.disbursementEntityIds) {
          const child = await context.Disbursement.get(childEntityId);
          if (child) failChild(child);
        }
      }
    } else {
      const child = await context.Disbursement.get(
        disbursementId(event.chainId, event.params.subjectId)
      );
      if (child) failChild(child);
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
