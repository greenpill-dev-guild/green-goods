import { addr, txHash } from "./events";

export interface SettlementMessageOptions {
  isBatch?: boolean;
  subjectId?: bigint;
  attempt?: bigint;
  executorGarden?: string;
  destinationExecutor?: string;
  acknowledgmentReceiver?: string;
}

export function settlementMessage(seed: number, options: SettlementMessageOptions = {}) {
  const isBatch = options.isBatch ?? false;
  const subjectId = options.subjectId ?? BigInt(seed);
  const attempt = options.attempt ?? 0n;
  const ids = {
    executionKey: txHash(seed),
    commandMessageId: txHash(seed + 1),
    retryExecutionKey: txHash(seed + 2),
    retryCommandMessageId: txHash(seed + 3),
    acknowledgmentMessageId: txHash(seed + 4),
    duplicateAcknowledgmentMessageId: txHash(seed + 5),
    staleAcknowledgmentMessageId: txHash(seed + 6),
    retryAcknowledgmentMessageId: txHash(seed + 7),
    duplicateCommandMessageId: txHash(seed + 8),
  };
  const sourceCommand = {
    executionKey: ids.executionKey,
    commandMessageId: ids.commandMessageId,
    isBatch,
    subjectId,
    attempt,
    destinationChainSelector: 16_688_752_181_858_512n,
    destinationExecutor: options.destinationExecutor ?? addr(80),
    destinationGasLimit: 600_000n,
    protocolVersion: 1n,
    commandPayloadHash: txHash(seed + 100),
    fee: 3n,
  };

  return {
    ids,
    source: {
      dispatched: sourceCommand,
      retried: {
        ...sourceCommand,
        executionKey: ids.retryExecutionKey,
        commandMessageId: ids.retryCommandMessageId,
        attempt: attempt + 1n,
      },
      acknowledged: (
        overrides: { retry?: boolean; success?: boolean; acknowledgmentMessageId?: string } = {}
      ) => {
        const retry = overrides.retry ?? false;
        const success = overrides.success ?? true;
        return {
          executionKey: retry ? ids.retryExecutionKey : ids.executionKey,
          acknowledgmentMessageId:
            overrides.acknowledgmentMessageId ??
            (retry ? ids.retryAcknowledgmentMessageId : ids.acknowledgmentMessageId),
          originatingCommandMessageId: retry ? ids.retryCommandMessageId : ids.commandMessageId,
          isBatch,
          subjectId,
          success,
          failureCode: success ? 0n : 8n,
        };
      },
    },
    executor: {
      stored: {
        executionKey: ids.executionKey,
        commandMessageId: ids.commandMessageId,
        executorGarden: options.executorGarden ?? addr(1),
        acknowledgmentReceiver: options.acknowledgmentReceiver ?? addr(70),
        protocolVersion: 1n,
        isBatch,
        settlementId: subjectId,
        attempt,
        status: 1n,
        failureCode: 0n,
      },
      acknowledgmentSent: {
        executionKey: ids.executionKey,
        commandMessageId: ids.commandMessageId,
        acknowledgmentMessageId: ids.acknowledgmentMessageId,
        fee: 5n,
        reserveFunded: true,
      },
      deferred: {
        executionKey: ids.executionKey,
        commandMessageId: ids.commandMessageId,
        reasonCode: 2n,
      },
      duplicate: {
        executionKey: ids.executionKey,
        commandMessageId: ids.duplicateCommandMessageId,
      },
    },
  };
}
