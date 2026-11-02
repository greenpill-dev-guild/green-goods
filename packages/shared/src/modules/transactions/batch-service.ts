import {
  executeBatchOperation,
  reconcileBatchOperation,
  releaseBatchOperation,
} from "./batch-operation";
import { BatchJournal } from "./batch-journal";
import type { TransactionSender } from "./types";

// One storage connection per origin; records themselves remain partitioned by account and chain.
let journal: BatchJournal | undefined;

/** Compose recovery with the actual sender, opening storage only on an explicit batch action. */
export function withBatchRecovery<T extends TransactionSender>(sender: T): T {
  const storage = () => (journal ??= new BatchJournal());
  sender.batches = {
    execute: (prepared, options) =>
      executeBatchOperation({
        sender,
        journal: storage(),
        prepared,
        preflight: options.preflight,
        verify: options.verify,
        onBroadcasting: options.onBroadcasting,
      }),
    reconcile: (operationId, scope, verify) =>
      reconcileBatchOperation({
        sender,
        journal: storage(),
        operationId,
        account: scope.account,
        chainId: scope.chainId,
        verify,
      }),
    release: (operationId, scope, verify) =>
      releaseBatchOperation({
        sender,
        journal: storage(),
        operationId,
        account: scope.account,
        chainId: scope.chainId,
        verify,
      }),
    // Reading this account's own journal needs no signer: a wallet still reconnecting must still
    // learn which items are held, or its forms would send past them. Settling a hold (reconcile,
    // release) asserts ownership itself, and a read that cannot settle leaves the hold standing.
    list: async (scope) => {
      await storage().prune();
      return storage().list(scope.account, scope.chainId);
    },
  };
  return sender;
}
