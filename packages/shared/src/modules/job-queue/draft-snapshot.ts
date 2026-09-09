import type { IDBPDatabase } from "idb";
import type { Address } from "../../types/domain";
import type { DraftImage, WorkDraftRecord, MissingDraftAttachment } from "../../types/job-queue";
import { identifyWorkFile, roundWorkLocation } from "../work/work-attachments";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { computeFirstIncompleteStep, type DraftDB } from "./draft-state";
const MAX_DRAFTS_PER_USER = 20;
export async function saveDraftSnapshot(
  db: IDBPDatabase<DraftDB>,
  userAddress: Address,
  chainId: number,
  draftId: string,
  data: Partial<WorkDraftRecord>,
  media: File[],
  audio: File[],
  isCurrent: () => boolean = () => true,
  retainedUnreadable: Array<string | MissingDraftAttachment> = []
): Promise<WorkDraftRecord> {
  const missing = retainedUnreadable.filter(
    (item): item is MissingDraftAttachment => typeof item !== "string"
  );
  const retainedUnreadableIds = retainedUnreadable.map((item) =>
    typeof item === "string" ? item : item.id
  );
  const entries: DraftImage[] = [];
  let slot = 0;
  for (const [order, file] of [...media, ...audio].entries()) {
    const attachment = await identifyWorkFile(file);
    entries.push({
      ...attachment,
      draftId,
      kind: order < media.length ? "media" : "audio",
      order: (() => {
        while (missing.some((item) => item.order === slot)) slot++;
        return slot++;
      })(),
      createdAt: Date.now(),
    });
  }
  if (!isCurrent()) throw new DOMException("Draft changed", "AbortError");
  return retryOnceAfterQuotaCleanup(async () => {
    const tx = db.transaction(["drafts", "draft_images", "active_drafts"], "readwrite");
    try {
      const drafts = tx.objectStore("drafts");
      const previous = await drafts.get(draftId);
      if (
        previous &&
        (previous.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
          previous.chainId !== chainId)
      )
        throw new Error("draft-owner");
      const owned = (await drafts.getAll()).filter(
        (item) => item.userAddress.toLowerCase() === userAddress.toLowerCase()
      );
      if (
        !previous &&
        owned.filter((draft) => draft.chainId === chainId).length >= MAX_DRAFTS_PER_USER
      )
        throw new Error("draft-limit");
      if (!isCurrent()) throw new DOMException("Draft changed", "AbortError");
      const next: WorkDraftRecord = {
        gardenAddress: null,
        actionUID: null,
        feedback: "",
        details: {},
        currentStep: "intro",
        firstIncompleteStep: "intro",
        ...previous,
        ...data,
        id: draftId,
        userAddress,
        chainId,
        missingAttachments: missing,
        tags: data.tags ?? [],
        location: roundWorkLocation(data.location),
        clientWorkId: previous?.clientWorkId ?? data.clientWorkId ?? crypto.randomUUID(),
        uploadCheckpoint: previous?.uploadCheckpoint ?? data.uploadCheckpoint,
        revision: (previous?.revision ?? 0) + 1,
        createdAt: previous?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      const thumbnail = entries.find(
        (entry) => entry.kind === "media" && entry.fileData.type.startsWith("image/")
      );
      next.thumbnail = thumbnail
        ? { attachmentId: thumbnail.id, contentHash: thumbnail.contentHash }
        : null;
      next.attachmentCount = media.length + retainedUnreadableIds.length;
      next.details = Object.fromEntries(
        Object.entries(next.details ?? {}).filter(([key]) => key !== "_location")
      );
      next.firstIncompleteStep = computeFirstIncompleteStep(next, media.length > 0);
      const images = tx.objectStore("draft_images");
      const old = await images.index("draftId").getAll(draftId);
      const retained = new Set([...entries.map((entry) => entry.id), ...retainedUnreadableIds]);
      for (const entry of old) if (!retained.has(entry.id)) await images.delete(entry.id);
      for (const entry of entries) await images.put(entry);
      await drafts.put(next);
      await tx
        .objectStore("active_drafts")
        .put({ scope: `${userAddress.toLowerCase()}:${chainId}`, draftId });
      if (!isCurrent()) throw new DOMException("Draft changed", "AbortError");
      await tx.done;
      return next;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Already aborted. */
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
  });
}
