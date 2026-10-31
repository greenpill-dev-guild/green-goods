import { executeBatchOperation, reconcileBatchOperation } from "./batch-operation";
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
    list: async (scope) => {
      await sender.assertOwnership?.(scope.account, scope.chainId);
      await storage().prune();
      return storage().list(scope.account, scope.chainId);
    },
  };
  return sender;
}
