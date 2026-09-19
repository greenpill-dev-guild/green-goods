import { type DraftDatabase, draftConnection } from "./draft-connection";
import { saveDraftSnapshot } from "./draft-snapshot";
import { computeFirstIncompleteStep, hasMeaningfulDraftDetails, isWorkDraft } from "./draft-state";

export { computeFirstIncompleteStep, hasMeaningfulDraftDetails } from "./draft-state";

import {
  hashWorkBytes,
  isHeicFile,
  restoreWorkFile,
  roundWorkLocation,
} from "../work/work-attachments";
/**
 * Draft Database Module
 *
 * Manages work submission drafts with IndexedDB persistence through Dexie.
 * Drafts survive PWA closes and support multiple drafts per user.
 *
 * @module modules/job-queue/draft-db
 */

import type { Address } from "../../types/domain";
import type {
  DraftImage,
  MissingDraftAttachment,
  SerializedFileData,
  WorkDraftRecord,
} from "../../types/job-queue";
import {
  buildFileMetadata,
  deserializeFile,
  serializeFile,
} from "../../utils/storage/file-serialization";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { trackPrivateQueueEvent } from "./job-analytics";
import { mediaResourceManager } from "./media-resource-manager";

const MAX_DRAFTS_PER_USER = 20;

class DraftStore {
  async init(): Promise<DraftDatabase> {
    return draftConnection.init();
  }

  async getActiveDraft(userAddress: string, chainId: number): Promise<string | null> {
    const db = await this.init();
    return (await db.active_drafts.get(`${userAddress.toLowerCase()}:${chainId}`))?.draftId ?? null;
  }

  async setActiveDraft(
    userAddress: string,
    chainId: number,
    draftId: string | null
  ): Promise<void> {
    const db = await this.init();
    await db.active_drafts.put({ scope: `${userAddress.toLowerCase()}:${chainId}`, draftId });
  }

  async saveSnapshot(
    ...args: Parameters<typeof saveDraftSnapshot> extends [unknown, ...infer Rest] ? Rest : never
  ): Promise<WorkDraftRecord> {
    return saveDraftSnapshot(await this.init(), ...args);
  }

  /**
   * Create a new draft. Returns the draft ID.
   */
  async createDraft(
    userAddress: Address,
    chainId: number,
    data: Partial<
      Omit<WorkDraftRecord, "id" | "userAddress" | "chainId" | "createdAt" | "updatedAt">
    >
  ): Promise<string> {
    const db = await this.init();
    const id = crypto.randomUUID();
    const now = Date.now();
    const draft: WorkDraftRecord = {
      kind: "work",
      id,
      userAddress,
      chainId,
      gardenAddress: data.gardenAddress ?? null,
      actionUID: data.actionUID ?? null,
      feedback: data.feedback ?? "",
      details: data.details ?? {},
      ...(typeof data.timeSpentMinutes === "number"
        ? { timeSpentMinutes: data.timeSpentMinutes }
        : {}),
      currentStep: data.currentStep ?? "intro",
      firstIncompleteStep: data.firstIncompleteStep ?? "intro",
      createdAt: now,
      updatedAt: now,
    };
    await retryOnceAfterQuotaCleanup(() =>
      db.transaction("rw", db.drafts, async () => {
        const owned = (await db.drafts.toArray())
          .filter(isWorkDraft)
          .filter((item) => item.userAddress.toLowerCase() === userAddress.toLowerCase());
        if (owned.filter((record) => record.chainId === chainId).length >= MAX_DRAFTS_PER_USER)
          throw new Error("draft-limit");
        await db.drafts.add(draft);
      })
    );
    return id;
  }

  /**
   * Update an existing draft
   */
  async updateDraft(
    draftId: string,
    data: Partial<Omit<WorkDraftRecord, "id" | "userAddress" | "chainId" | "createdAt">>
  ): Promise<void> {
    const db = await this.init();
    await retryOnceAfterQuotaCleanup(() =>
      db.transaction("rw", db.drafts, db.draft_images, async () => {
        const existing = await db.drafts.get(draftId);
        if (!existing || !isWorkDraft(existing)) throw new Error(`Draft ${draftId} not found`);
        const attachments = await db.draft_images.where("draftId").equals(draftId).toArray();
        const updated = { ...existing, ...data, updatedAt: Date.now() };
        updated.location = roundWorkLocation(updated.location);
        updated.details = Object.fromEntries(
          Object.entries(updated.details ?? {}).filter(([key]) => key !== "_location")
        );
        updated.firstIncompleteStep = computeFirstIncompleteStep(
          updated,
          attachments.some((entry) => entry.kind !== "audio")
        );
        await db.drafts.put(updated);
      })
    );
  }

  /**
   * Get a draft by ID
   */
  async getDraft(draftId: string): Promise<WorkDraftRecord | undefined> {
    const db = await this.init();
    const draft = await db.drafts.get(draftId);
    return draft && isWorkDraft(draft) ? draft : undefined;
  }

  /**
   * Get all drafts for a user on a specific chain, ordered by updatedAt desc
   */
  async getDraftsForUser(userAddress: string, chainId: number): Promise<WorkDraftRecord[]> {
    const db = await this.init();
    return (await db.drafts.toArray())
      .filter(isWorkDraft)
      .filter((item) => item.userAddress.toLowerCase() === userAddress.toLowerCase())
      .filter((item) => item.chainId === chainId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Delete a draft and its images
   */
  async deleteDraft(draftId: string): Promise<void> {
    const db = await this.init();
    const images = await db.transaction(
      "rw",
      db.drafts,
      db.draft_images,
      db.active_drafts,
      async () => {
        const rows = await db.draft_images.where("draftId").equals(draftId).toArray();
        const draft = await db.drafts.get(draftId);
        if (draft && !isWorkDraft(draft)) throw new Error("draft-kind-conflict");
        if (draft) {
          const scope = `${draft.userAddress.toLowerCase()}:${draft.chainId}`;
          const active = await db.active_drafts.get(scope);
          if (active?.draftId === draftId) await db.active_drafts.delete(scope);
        }
        await db.draft_images.bulkDelete(rows.map((image) => image.id));
        await db.drafts.delete(draftId);
        return rows;
      }
    );
    for (const image of images) if (image.url) mediaResourceManager.cleanupUrl(image.url);
    mediaResourceManager.cleanupUrls(draftId);
  }

  /** Refresh a draft's resume step and timestamp after its attachments changed. */
  private async touchDraft(draftId: string): Promise<void> {
    const db = await this.init();
    const draft = await this.getDraft(draftId);
    if (!draft) return;
    const images = await this.getImagesForDraft(draftId);
    await retryOnceAfterQuotaCleanup(() =>
      db.drafts.put({
        ...draft,
        firstIncompleteStep: computeFirstIncompleteStep(draft, images.length > 0),
        updatedAt: Date.now(),
      })
    );
  }

  /**
   * Add an image to a draft.
   * Serializes the File to ArrayBuffer before storing to work around iOS Safari
   * IndexedDB issues with File objects.
   */
  async addImageToDraft(draftId: string, file: File): Promise<string> {
    const db = await this.init();
    const imageId = crypto.randomUUID();
    let fileData: SerializedFileData;
    try {
      fileData = await serializeFile(file);
    } catch (serializeError) {
      trackPrivateQueueEvent("job_queue_draft_file_serialization_failed", {
        ...buildFileMetadata(file),
      });
      throw serializeError;
    }
    try {
      const image: DraftImage = { id: imageId, draftId, fileData, createdAt: Date.now() };
      await retryOnceAfterQuotaCleanup(() => db.draft_images.add(image));
    } catch (storeError) {
      trackPrivateQueueEvent("job_queue_draft_storage_failed", { ...buildFileMetadata(file) });
      throw storeError;
    }
    await this.touchDraft(draftId);
    return imageId;
  }

  /**
   * Remove an image from a draft
   */
  async removeImageFromDraft(imageId: string): Promise<void> {
    const db = await this.init();
    const image = await db.draft_images.get(imageId);
    if (!image) return;
    if (image.url) mediaResourceManager.cleanupUrl(image.url);
    await db.draft_images.delete(imageId);
    await this.touchDraft(image.draftId);
  }

  /** The draft's summary photo as a File, or null when it has none. */
  async getThumbnailFile(draft: WorkDraftRecord): Promise<File | null> {
    const db = await this.init();
    if (draft.thumbnail === null) return null;
    // Legacy rows lack a summary reference: stop at the first photo instead of restoring the draft.
    const image = draft.thumbnail
      ? await db.draft_images.get(draft.thumbnail.attachmentId)
      : await db.draft_images
          .where("draftId")
          .equals(draft.id)
          .filter((row) => {
            const stored = row.fileData ?? row.file;
            return Boolean(stored?.type.startsWith("image/") && !isHeicFile(stored));
          })
          .first();
    if (!image || image.draftId !== draft.id) return null;
    const data = image.fileData?.data
      ? image.fileData
      : await serializeFile(deserializeFile(image, draft.id, image.id));
    return restoreWorkFile(data, image.id, image.contentHash ?? (await hashWorkBytes(data.data)));
  }

  /**
   * Get images for a draft.
   * Deserializes stored file data back to File objects.
   */
  async getImagesForDraft(
    draftId: string,
    onUnreadable?: (attachment: MissingDraftAttachment) => void
  ): Promise<Array<{ id: string; file: File; url: string; kind: "media" | "audio" }>> {
    const db = await this.init();
    const images = await db.draft_images.where("draftId").equals(draftId).toArray();
    const restored = await Promise.all(
      images
        .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
        .map(async (img) => {
          try {
            if (!img.fileData?.data && !img.file) throw new Error("unreadable-media");
            const fileData = img.fileData?.data
              ? img.fileData
              : await serializeFile(deserializeFile(img, `draft-${draftId}`, img.id));
            if (!fileData.data.byteLength) throw new Error("unreadable-media");
            const file = restoreWorkFile(
              fileData,
              img.id,
              img.contentHash ?? (await hashWorkBytes(fileData.data))
            );
            return { id: img.id, kind: img.kind ?? "media", file, url: "" };
          } catch (error) {
            if (!onUnreadable) throw error;
            onUnreadable({
              id: img.id,
              name: img.fileData?.name ?? img.file?.name ?? img.id,
              order: img.order ?? 0,
              kind: img.kind ?? "media",
            });
            return null;
          }
        })
    );
    return restored.filter((item): item is NonNullable<typeof item> => item !== null);
  }

  /**
   * Set all images for a draft (replaces existing)
   */
  async setImagesForDraft(draftId: string, files: File[]): Promise<void> {
    const db = await this.init();
    const serializedFiles: SerializedFileData[] = [];
    for (const file of files) {
      try {
        serializedFiles.push(await serializeFile(file));
      } catch (serializeError) {
        trackPrivateQueueEvent("job_queue_draft_file_serialization_failed", {
          ...buildFileMetadata(file),
        });
        throw serializeError;
      }
    }
    const timestamp = Date.now();
    const replacements: DraftImage[] = serializedFiles.map((fileData) => ({
      id: crypto.randomUUID(),
      draftId,
      fileData,
      createdAt: timestamp,
    }));
    let replaced: DraftImage[] = [];
    try {
      replaced = await retryOnceAfterQuotaCleanup(() =>
        db.transaction("rw", db.drafts, db.draft_images, async () => {
          const draft = await db.drafts.get(draftId);
          if (!draft || !isWorkDraft(draft)) throw new Error(`Draft ${draftId} not found`);
          const previous = await db.draft_images.where("draftId").equals(draftId).toArray();
          await db.draft_images.bulkDelete(previous.map((image) => image.id));
          await db.draft_images.bulkAdd(replacements);
          await db.drafts.put({
            ...draft,
            firstIncompleteStep: computeFirstIncompleteStep(draft, replacements.length > 0),
            updatedAt: timestamp,
          });
          return previous;
        })
      );
    } catch (storeError) {
      for (const file of files) {
        trackPrivateQueueEvent("job_queue_draft_storage_failed", { ...buildFileMetadata(file) });
      }
      throw storeError;
    }
    // Old object URLs remain valid until the replacement transaction commits.
    for (const image of replaced) if (image.url) mediaResourceManager.cleanupUrl(image.url);
  }

  /**
   * Get draft count for a user
   */
  async getDraftCount(userAddress: string, chainId: number): Promise<number> {
    return (await this.getDraftsForUser(userAddress, chainId)).length;
  }

  /**
   * Check if a draft has meaningful progress (for showing in UI)
   */
  async hasMeaningfulProgress(draftId: string): Promise<boolean> {
    const draft = await this.getDraft(draftId);
    if (!draft) return false;
    const images = await this.getImagesForDraft(draftId);
    return (
      images.length > 0 ||
      draft.feedback.trim().length > 0 ||
      (draft.timeSpentMinutes ?? 0) > 0 ||
      hasMeaningfulDraftDetails(draft.details)
    );
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Nothing to do for now, URLs are managed by mediaResourceManager
  }
}

export const draftDB = new DraftStore();
