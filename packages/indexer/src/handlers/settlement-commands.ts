import { indexer, type SettlementSubjectState } from "envio";

import {
  applySubjectStateToDisbursement,
  disbursementId,
  settlementBatchId,
  settlementCommandIndexId,
  settlementMessageId,
  settlementSubjectId,
} from "./settlement-projections";
import { applySubjectStateToBatch } from "./settlement-batches";
import { sourceConfig } from "./settlement-source-configuration";
import { normalizeAddress } from "./shared";

async function recordCommand(
  event: {
    chainId: number;
    srcAddress: string;
    block: { timestamp: number };
    transaction: { hash: string };
    params: {
      executionKey: string;
      commandMessageId: string;
      isBatch: boolean;
      subjectId: bigint;
      attempt: bigint;
      destinationChainSelector: bigint;
      destinationExecutor: string;
      destinationGasLimit: bigint;
      protocolVersion: bigint;
      commandPayloadHash: string;
      fee: bigint;
    };
  },
  context: Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"],
  status: "SENT" | "RETRIED"
): Promise<void> {
  const executionKey = event.params.executionKey.toLowerCase();
  const commandMessageId = event.params.commandMessageId.toLowerCase();
  const subjectEntityId = settlementSubjectId(
    event.chainId,
    event.params.isBatch,
    event.params.subjectId
  );
  const subject: SettlementSubjectState = {
    id: subjectEntityId,
    chainId: event.chainId,
    isBatch: event.params.isBatch,
    subjectId: event.params.subjectId,
    state: "DISPATCHED",
    attempt: Number(event.params.attempt),
    executionKey,
    commandMessageId,
    acknowledgmentMessageId: undefined,
    failureCode: undefined,
    dispatchedAt: event.block.timestamp,
    confirmedAt: undefined,
    reasonCID: undefined,
    updatedAt: event.block.timestamp,
  };
  context.SettlementSubjectState.set(subject);
  context.SettlementCommandIndex.set({
    id: settlementCommandIndexId(event.chainId, executionKey),
    chainId: event.chainId,
    executionKey,
    isBatch: event.params.isBatch,
    subjectId: event.params.subjectId,
    attempt: Number(event.params.attempt),
    protocolVersion: Number(event.params.protocolVersion),
    commandMessageId,
    state: "DISPATCHED",
    acknowledgmentMessageId: undefined,
    failureCode: undefined,
    resolvedAt: undefined,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
  const config = await sourceConfig(
    context,
    event.chainId,
    event.srcAddress,
    event.block.timestamp
  );
  if (config.remoteEvmChainId !== undefined) {
    context.SettlementMessage.set({
      id: settlementMessageId(event.chainId, commandMessageId),
      chainId: event.chainId,
      messageId: commandMessageId,
      executionKey,
      direction: "COMMAND",
      status,
      isBatch: event.params.isBatch,
      subjectId: event.params.subjectId,
      attempt: Number(event.params.attempt),
      destinationPeer: normalizeAddress(event.params.destinationExecutor),
      destinationGasLimit: Number(event.params.destinationGasLimit),
      protocolVersion: Number(event.params.protocolVersion),
      commandPayloadHash: event.params.commandPayloadHash.toLowerCase(),
      sourceChainId: event.chainId,
      destinationChainId: config.remoteEvmChainId,
      sourceChainSelector: config.localChainSelector,
      destinationChainSelector: event.params.destinationChainSelector,
      fee: event.params.fee,
      reserveFunded: true,
      failureCode: undefined,
      txHash: event.transaction.hash.toLowerCase(),
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
  }
  const nativeFeeBalance =
    config.nativeFeeBalance >= event.params.fee ? config.nativeFeeBalance - event.params.fee : 0n;
  context.SettlementConfiguration.set({
    ...config,
    nativeFeeBalance,
    feeReserveLow: nativeFeeBalance < config.feeReserveMinimum,
    updatedAt: event.block.timestamp,
  });

  if (event.params.isBatch) {
    const batch = await context.SettlementBatch.get(
      settlementBatchId(event.chainId, event.params.subjectId)
    );
    if (batch) {
      context.SettlementBatch.set(applySubjectStateToBatch(batch, subject));
      for (const childEntityId of batch.disbursementEntityIds) {
        const child = await context.Disbursement.get(childEntityId);
        if (child) context.Disbursement.set(applySubjectStateToDisbursement(child, subject));
      }
    }
  } else {
    const child = await context.Disbursement.get(
      disbursementId(event.chainId, event.params.subjectId)
    );
    if (child) context.Disbursement.set(applySubjectStateToDisbursement(child, subject));
  }
}

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementCommandDispatched" },
  ({ event, context }) => recordCommand(event, context, "SENT")
);

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementCommandRetried" },
  ({ event, context }) => recordCommand(event, context, "RETRIED")
);
