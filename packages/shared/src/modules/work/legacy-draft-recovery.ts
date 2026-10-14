import { get, set, delMany } from "idb-keyval";
import type { WorkDraftRecord } from "../../types/job-queue";
export const LEGACY_MEDIA_KEY = "work_images_draft";
const MARKER_KEY = "work_images_draft_recovery";
interface LegacyRecoveryMarker {
  sourceId: string;
  draftId: string;
  scope: string;
  entries: Array<{ id: string; index: number; name: string }>;
}
export async function getLegacyRecoveryMarker(): Promise<LegacyRecoveryMarker | undefined> {
  const marker = await get<LegacyRecoveryMarker>(MARKER_KEY);
  return marker?.sourceId ? marker : undefined;
}
export async function startLegacyRecovery(
  files: File[],
  scope: string
): Promise<LegacyRecoveryMarker> {
  const previous = await getLegacyRecoveryMarker();
  if (previous) {
    if (previous.scope !== scope) throw new Error("draft-owner");
    return previous;
  }
  const marker = {
    sourceId: crypto.randomUUID(),
    draftId: crypto.randomUUID(),
    scope,
    entries: files.map((file, index) => ({ id: crypto.randomUUID(), index, name: file.name })),
  };
  await set(MARKER_KEY, marker);
  return marker;
}
export async function finishLegacyRecovery(
  record: WorkDraftRecord,
  discard = false
): Promise<void> {
  if (!record.legacySourceId || (!discard && record.missingAttachments?.length)) return;
  const marker = await getLegacyRecoveryMarker();
  if (
    marker?.sourceId === record.legacySourceId &&
    marker.scope === `${record.userAddress.toLowerCase()}:${record.chainId}`
  )
    await delMany([LEGACY_MEDIA_KEY, MARKER_KEY]);
}
export async function discardUnrecoveredLegacy(scope: string): Promise<void> {
  const marker = await getLegacyRecoveryMarker();
  if (marker && marker.scope !== scope) throw new Error("draft-owner");
  await delMany([LEGACY_MEDIA_KEY, MARKER_KEY]);
}
