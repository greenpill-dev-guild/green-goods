import { indexer } from "envio";

import {
  acknowledgmentDeferralCode,
  settlementExecutionId,
  settlementMessageId,
} from "./settlement-projections";
import { executorConfig } from "./settlement-executor-configuration";

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "AcknowledgmentSent" },
  async ({ event, context }) => {
    const executionKey = event.params.executionKey.toLowerCase();
    const acknowledgmentMessageId = event.params.acknowledgmentMessageId.toLowerCase();
    const execution = await context.SettlementExecution.get(
      settlementExecutionId(event.chainId, executionKey)
    );
    if (!execution) return;
    const configuration = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementExecution.set({
      ...execution,
      acknowledgmentMessageId,
      acknowledgmentSent: true,
      acknowledgmentDeferralCode: "NONE",
      updatedAt: event.block.timestamp,
    });
    context.SettlementMessage.set({
      id: settlementMessageId(event.chainId, acknowledgmentMessageId),
      chainId: event.chainId,
      messageId: acknowledgmentMessageId,
      executionKey,
      direction: "ACKNOWLEDGMENT",
      status: "SENT",
      isBatch: execution.isBatch,
      subjectId: execution.settlementId,
      attempt: execution.attempt,
      destinationPeer: execution.acknowledgmentReceiver,
      destinationGasLimit: undefined,
      protocolVersion: execution.protocolVersion,
      commandPayloadHash: undefined,
      sourceChainId: event.chainId,
      destinationChainId: execution.sourceChainId,
      sourceChainSelector: configuration.localChainSelector,
      destinationChainSelector: configuration.remoteChainSelector,
      fee: event.params.fee,
      reserveFunded: event.params.reserveFunded,
      failureCode: execution.failureCode,
      txHash: event.transaction.hash.toLowerCase(),
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
    if (!event.params.reserveFunded) return;
    const nativeFeeBalance =
      configuration.nativeFeeBalance >= event.params.fee
        ? configuration.nativeFeeBalance - event.params.fee
        : 0n;
    context.SettlementConfiguration.set({
      ...configuration,
      nativeFeeBalance,
      feeReserveLow: nativeFeeBalance < configuration.feeReserveMinimum,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "AcknowledgmentDeferred" },
  async ({ event, context }) => {
    const executionKey = event.params.executionKey.toLowerCase();
    const execution = await context.SettlementExecution.get(
      settlementExecutionId(event.chainId, executionKey)
    );
    if (!execution) return;
    context.SettlementExecution.set({
      ...execution,
      acknowledgmentDeferralCode: acknowledgmentDeferralCode(event.params.reasonCode),
      updatedAt: event.block.timestamp,
    });
    const commandMessageId = event.params.commandMessageId.toLowerCase();
    const command = await context.SettlementMessage.get(
      settlementMessageId(event.chainId, commandMessageId)
    );
    if (command) {
      context.SettlementMessage.set({
        ...command,
        status: "DEFERRED",
        updatedAt: event.block.timestamp,
      });
    }
  }
);
