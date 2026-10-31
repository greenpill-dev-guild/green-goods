import { logger } from "../app/logger";
import {
  type BatchOperations,
  type BatchRecord,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
  type VerifyBatchItems,
} from "./batch-types";

const VERIFY_ATTEMPTS = 3;

/**
 * Confirms an item only when `isProven` reads it from the chain: a receipt alone cannot say what a
 * call changed. An RPC can answer from before the receipt's block, so a mismatch is read again
 * before it stands.
 */
export function verifyByReading(
  isProven: (itemId: string) => Promise<boolean>,
  retryMs = 1_500
): VerifyBatchItems {
  return async ({ itemIds }) => {
    for (let attempt = 1; ; attempt += 1) {
      const proven = await Promise.all(itemIds.map(isProven));
      const matched = itemIds.filter((_, index) => proven[index]);
      if (matched.length === itemIds.length || attempt === VERIFY_ATTEMPTS) return matched;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  };
}

/** The items a save has proven. Report them once, when it ends, not on every read. */
export const provenItems = (record: BatchRecord) =>
  record.prepared.items.filter((item) => record.itemStates[item.id] === "confirmed");

/**
 * Read, or end, every save in a domain whose outcome is unknown. A save stays whole until it ends.
 * `shownIds` are the saves this tab last showed: another tab can end one, and it would no longer be
 * among the open ones. `onlyShown` settles only those, for a person who has seen nothing else.
 */
export async function settleOpenBatches(input: {
  batches: BatchOperations;
  scope: BatchScope;
  domain: string;
  verifierFor: (prepared: PreparedBatch) => VerifyBatchItems;
  settle: BatchOperations["reconcile"];
  shownIds?: readonly string[];
  onlyShown?: boolean;
}): Promise<{ held: BatchRecord[]; ended: BatchRecord[] }> {
  const { batches, scope, domain, verifierFor, settle, shownIds = [], onlyShown = false } = input;
  const records = await batches.list(scope);
  const open = records.filter(
    (record) => record.prepared.domain === domain && UNKNOWN_BATCH_STATES.has(record.status)
  );
  const endedElsewhere = records.filter(
    (record) => shownIds.includes(record.id) && !UNKNOWN_BATCH_STATES.has(record.status)
  );
  const settled = await Promise.all(
    open.map((record) =>
      onlyShown && !shownIds.includes(record.id)
        ? record
        : settle(record.id, scope, verifierFor(record.prepared)).catch((error: unknown) => {
            // Another tab may be working on it. The hold stands; it can be read again.
            logger.warn("Could not read a held batch", { error, id: record.id, domain });
            return record;
          })
    )
  );
  return {
    held: settled.filter((record) => UNKNOWN_BATCH_STATES.has(record.status)),
    ended: [...settled, ...endedElsewhere].filter(
      (record) => !UNKNOWN_BATCH_STATES.has(record.status)
    ),
  };
}
