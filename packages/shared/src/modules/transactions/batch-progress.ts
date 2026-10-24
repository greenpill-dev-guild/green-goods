import { logger } from "../app/logger";
import type { BatchJournal } from "./batch-journal";
import type { BatchGroup, BatchRecord } from "./batch-types";

/** A lease fences writers while the durable intent continues to fence sends after a crash. */
export async function withBatchProgress(
  journal: BatchJournal,
  initial: BatchRecord,
  recovery: boolean,
  run: (
    save: (group: BatchGroup) => Promise<void>,
    current: () => BatchRecord
  ) => Promise<BatchRecord>
) {
  const token = await journal.claim(initial.id, recovery);
  let record = initial;
  let lost = false;
  const timer = setInterval(() => {
    void journal.renew(initial.id, token).catch(() => {
      lost = true;
    });
  }, 15_000);
  const save = async (group: BatchGroup) => {
    if (lost) throw new Error("batch-claim-lost");
    const index = record.groups.findIndex(
      (candidate) => candidate.itemIds.join("\0") === group.itemIds.join("\0")
    );
    if (index < 0) throw new Error("batch-group-mismatch");
    const groups = record.groups.map((candidate, i) => (i === index ? group : candidate));
    const itemStates = { ...record.itemStates };
    for (const id of group.itemIds)
      itemStates[id] = group.confirmedItemIds?.includes(id) ? "confirmed" : group.status;
    const status = groups.every((candidate) => candidate.status === "confirmed")
      ? "confirmed"
      : group.status === "confirmed"
        ? "prepared"
        : group.status;
    // Keep new references in memory even if IndexedDB refuses their checkpoint.
    record = {
      ...record,
      groups,
      itemStates,
      status,
      reference: group.reference,
      receipts: [
        ...new Map(
          groups
            .flatMap((candidate) => candidate.receipts)
            .map((receipt) => [receipt.transactionHash, receipt])
        ).values(),
      ],
    };
    record = await journal.checkpoint(record.id, token, record);
  };
  try {
    record = (await journal.get(initial.id))!;
    return await run(save, () => record);
  } finally {
    clearInterval(timer);
    await journal
      .release(initial.id, token)
      .catch((error: unknown) =>
        logger.warn("[BatchRecovery] Could not release execution claim", { error })
      );
  }
}
