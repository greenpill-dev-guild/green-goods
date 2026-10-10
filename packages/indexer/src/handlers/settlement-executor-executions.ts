import { indexer } from "envio";

import {
  configurationId,
  executionStatus,
  settlementExecutionId,
  settlementMessageId,
} from "./settlement-projections";
import { normalizeAddress } from "./shared";

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "SettlementExecutionStored" },
  async ({ event, context }) => {
    const executionKey = event.params.executionKey.toLowerCase();
    const commandMessageId = event.params.commandMessageId.toLowerCase();
    const configuration = await context.SettlementConfiguration.get(configurationId(event.chainId));
    if (configuration?.remoteEvmChainId === undefined) return;
    context.SettlementExecution.set({
      id: settlementExecutionId(event.chainId, executionKey),
      chainId: event.chainId,
      sourceChainId: configuration.remoteEvmChainId,
      executionKey,
      commandMessageId,
      acknowledgmentReceiver: normalizeAddress(event.params.acknowledgmentReceiver),
      protocolVersion: Number(event.params.protocolVersion),
      executorGarden: normalizeAddress(event.params.executorGarden),
      executorGardenId: normalizeAddress(event.params.executorGarden),
      isBatch: event.params.isBatch,
      settlementId: event.params.settlementId,
      attempt: Number(event.params.attempt),
      status: executionStatus(event.params.status),
      failureCode: Number(event.params.failureCode),
      txHash: event.transaction.hash.toLowerCase(),
      acknowledgmentMessageId: undefined,
      acknowledgmentSent: false,
      acknowledgmentDeferralCode: "NONE",
      duplicateMessageIds: [],
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
    context.SettlementMessage.set({
      id: settlementMessageId(event.chainId, commandMessageId),
      chainId: event.chainId,
      messageId: commandMessageId,
      executionKey,
      direction: "COMMAND",
      status: "ACKNOWLEDGED",
      isBatch: event.params.isBatch,
      subjectId: event.params.settlementId,
      attempt: Number(event.params.attempt),
      destinationPeer: normalizeAddress(event.srcAddress),
      destinationGasLimit: undefined,
      protocolVersion: Number(event.params.protocolVersion),
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
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "DuplicateSettlementMessage" },
  async ({ event, context }) => {
    const executionKey = event.params.executionKey.toLowerCase();
    const commandMessageId = event.params.commandMessageId.toLowerCase();
    const execution = await context.SettlementExecution.get(
      settlementExecutionId(event.chainId, executionKey)
    );
    if (!execution) return;
    const configuration = await context.SettlementConfiguration.get(configurationId(event.chainId));
    const duplicateMessageIds = execution.duplicateMessageIds.includes(commandMessageId)
      ? execution.duplicateMessageIds
      : [...execution.duplicateMessageIds, commandMessageId];
    context.SettlementExecution.set({
      ...execution,
      duplicateMessageIds,
      updatedAt: event.block.timestamp,
    });
    context.SettlementMessage.set({
      id: settlementMessageId(event.chainId, commandMessageId),
      chainId: event.chainId,
      messageId: commandMessageId,
      executionKey,
      direction: "COMMAND",
      status: "DUPLICATE",
      isBatch: execution.isBatch,
      subjectId: execution.settlementId,
      attempt: execution.attempt,
      destinationPeer: normalizeAddress(event.srcAddress),
      destinationGasLimit: undefined,
      protocolVersion: execution.protocolVersion,
      commandPayloadHash: undefined,
      sourceChainId: execution.sourceChainId,
      destinationChainId: event.chainId,
      sourceChainSelector: configuration?.remoteChainSelector,
      destinationChainSelector: configuration?.localChainSelector,
      fee: undefined,
      reserveFunded: undefined,
      failureCode: execution.failureCode,
      txHash: event.transaction.hash.toLowerCase(),
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
  }
);
