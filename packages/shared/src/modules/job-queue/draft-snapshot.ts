import type { Address } from "../../types/domain";
import type { DraftImage, MissingDraftAttachment, WorkDraftRecord } from "../../types/job-queue";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { identifyWorkFile, roundWorkLocation } from "../work/work-attachments";
import type { DraftDatabase } from "./draft-connection";
import { computeFirstIncompleteStep, isWorkDraft } from "./draft-state";

const MAX_DRAFTS_PER_USER = 20;

/**
 * Save one revision of a work draft with its attachments in a single
 * transaction. `isCurrent` lets a superseded save abort before it commits.
 */
export async function saveDraftSnapshot(
  db: DraftDatabase,
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
  return retryOnceAfterQuotaCleanup(() =>
    db.transaction("rw", db.drafts, db.draft_images, db.active_drafts, async () => {
      const previous = await db.drafts.get(draftId);
      if (previous && !isWorkDraft(previous)) throw new Error("draft-kind-conflict");
      if (
        previous &&
        (previous.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
          previous.chainId !== chainId)
      )
        throw new Error("draft-owner");
      const owned = (await db.drafts.toArray())
        .filter(isWorkDraft)
        .filter((item) => item.userAddress.toLowerCase() === userAddress.toLowerCase());
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
        kind: "work",
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
      const old = await db.draft_images.where("draftId").equals(draftId).toArray();
      const retained = new Set([...entries.map((entry) => entry.id), ...retainedUnreadableIds]);
      await db.draft_images.bulkDelete(
        old.filter((entry) => !retained.has(entry.id)).map((entry) => entry.id)
      );
      await db.draft_images.bulkPut(entries);
      await db.drafts.put(next);
      await db.active_drafts.put({ scope: `${userAddress.toLowerCase()}:${chainId}`, draftId });
      if (!isCurrent()) throw new DOMException("Draft changed", "AbortError");
      return next;
    })
  );
}
