import type { WorkDraft, WorkUploadCheckpoint } from "../../types/domain";
import type { WorkDraftRecord } from "../../types/job-queue";
import { draftDB } from "../job-queue/draft-db";
export async function createDraftUploadPersistence(
  record: WorkDraftRecord,
  draft: WorkDraft,
  retained: { current: { id: string; checkpoint: WorkUploadCheckpoint } | null }
) {
  draft.uploadCheckpoint = (retained.current?.id === record.id
    ? retained.current.checkpoint
    : record.uploadCheckpoint) ?? { submittedAt: new Date().toISOString(), files: {} };
  const onCheckpoint = async (checkpoint: WorkUploadCheckpoint) => {
    draft.uploadCheckpoint = checkpoint;
    retained.current = { id: record.id, checkpoint };
    await draftDB.updateDraft(record.id, { uploadCheckpoint: checkpoint });
  };
  await onCheckpoint(draft.uploadCheckpoint);
  return {
    clientWorkId: record.clientWorkId,
    onCheckpoint,
    onBroadcast: async (hash: `0x${string}`) =>
      onCheckpoint({ ...draft.uploadCheckpoint!, transactionHash: hash }),
  };
}
