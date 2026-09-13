import { draftConnection } from "./draft-connection";
import { saveDraftSnapshot } from "./draft-snapshot";
import {
  computeFirstIncompleteStep,
  hasMeaningfulDraftDetails,
  isWorkDraft,
  type DraftDB,
} from "./draft-state";
export { computeFirstIncompleteStep, hasMeaningfulDraftDetails } from "./draft-state";
import { hashWorkBytes, restoreWorkFile, roundWorkLocation } from "../work/work-attachments";
/**
 * Draft Database Module
 *
 * Manages work submission drafts with IndexedDB persistence.
 * Drafts survive PWA closes and support multiple drafts per user.
 *
 * @module modules/job-queue/draft-db
 */

import type { IDBPDatabase } from "idb";
import type { Address } from "../../types/domain";
import type { DraftImage, SerializedFileData, WorkDraftRecord } from "../../types/job-queue";
import {
  buildFileMetadata,
  deserializeFile,
  serializeFile,
} from "../../utils/storage/file-serialization";
import { retryOnceAfterQuotaCleanup } from "../../utils/storage/quota";
import { trackPrivateQueueEvent } from "./job-analytics";
import { mediaResourceManager } from "./media-resource-manager";

const MAX_DRAFTS_PER_USER = 20;

class DraftDatabase {
  async init(): Promise<IDBPDatabase<DraftDB>> {
    return draftConnection.init();
  }

  async getActiveDraft(userAddress: string, chainId: number): Promise<string | null> {
    const db = await this.init();
    return (
      (await db.get("active_drafts", `${userAddress.toLowerCase()}:${chainId}`))?.draftId ?? null
    );
  }

  async setActiveDraft(
    userAddress: string,
    chainId: number,
    draftId: string | null
  ): Promise<void> {
    const db = await this.init();
    await db.put("active_drafts", { scope: `${userAddress.toLowerCase()}:${chainId}`, draftId });
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

    await retryOnceAfterQuotaCleanup(async () => {
      const tx = db.transaction("drafts", "readwrite");
      try {
        const owned = (await tx.store.getAll())
          .filter(isWorkDraft)
          .filter((item) => item.userAddress.toLowerCase() === userAddress.toLowerCase());
        if (owned.filter((record) => record.chainId === chainId).length >= MAX_DRAFTS_PER_USER)
          throw new Error("draft-limit");
        await tx.store.add(draft);
        await tx.done;
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
    await retryOnceAfterQuotaCleanup(async () => {
      const tx = db.transaction(["drafts", "draft_images"], "readwrite");
      try {
        const store = tx.objectStore("drafts");
        const existing = await store.get(draftId);
        if (!existing || !isWorkDraft(existing)) throw new Error(`Draft ${draftId} not found`);
        const attachments = await tx.objectStore("draft_images").index("draftId").getAll(draftId);
        const updated = { ...existing, ...data, updatedAt: Date.now() };
        updated.location = roundWorkLocation(updated.location);
        updated.details = Object.fromEntries(
          Object.entries(updated.details ?? {}).filter(([key]) => key !== "_location")
        );
        updated.firstIncompleteStep = computeFirstIncompleteStep(
          updated,
          attachments.some((entry) => entry.kind !== "audio")
        );
        await store.put(updated);
        await tx.done;
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

  /**
   * Get a draft by ID
   */
  async getDraft(draftId: string): Promise<WorkDraftRecord | undefined> {
    const db = await this.init();
    const draft = await db.get("drafts", draftId);
    return draft && isWorkDraft(draft) ? draft : undefined;
  }

  /**
   * Get all drafts for a user on a specific chain, ordered by updatedAt desc
   */
  async getDraftsForUser(userAddress: string, chainId: number): Promise<WorkDraftRecord[]> {
    const db = await this.init();
    const tx = db.transaction("drafts", "readonly");
    const userDrafts = (await tx.objectStore("drafts").getAll())
      .filter(isWorkDraft)
      .filter((item) => item.userAddress.toLowerCase() === userAddress.toLowerCase());

    // Filter by chainId and sort by updatedAt descending
    return userDrafts
      .filter((d) => d.chainId === chainId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Delete a draft and its images
   */
  async deleteDraft(draftId: string): Promise<void> {
    const db = await this.init();

    // Delete images first
    const tx = db.transaction(["drafts", "draft_images", "active_drafts"], "readwrite");
    try {
      const images = await tx.objectStore("draft_images").index("draftId").getAll(draftId);
      const draft = await tx.objectStore("drafts").get(draftId);
      if (draft && !isWorkDraft(draft)) throw new Error("draft-kind-conflict");
      if (draft) {
        const scope = `${draft.userAddress.toLowerCase()}:${draft.chainId}`;
        const active = await tx.objectStore("active_drafts").get(scope);
        if (active?.draftId === draftId) await tx.objectStore("active_drafts").delete(scope);
      }

      for (const image of images) {
        await tx.objectStore("draft_images").delete(image.id);
      }

      await tx.objectStore("drafts").delete(draftId);
      await tx.done;
      for (const image of images) if (image.url) mediaResourceManager.cleanupUrl(image.url);
      mediaResourceManager.cleanupUrls(draftId);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Already completed or aborted. */
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  /**
   * Add an image to a draft.
   * Serializes the File to ArrayBuffer before storing to work around iOS Safari
   * IndexedDB issues with File objects.
   */
  async addImageToDraft(draftId: string, file: File): Promise<string> {
    const db = await this.init();
    const imageId = crypto.randomUUID();

    // Serialize file BEFORE storing to avoid iOS Safari DOMException
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
      const image: DraftImage = {
        id: imageId,
        draftId,
        fileData, // Store serialized data instead of File
        createdAt: Date.now(),
      } as DraftImage;
      await retryOnceAfterQuotaCleanup(() => db.add("draft_images", image));
    } catch (storeError) {
      trackPrivateQueueEvent("job_queue_draft_storage_failed", {
        ...buildFileMetadata(file),
      });
      throw storeError;
    }

    // Update draft's updatedAt and firstIncompleteStep
    const draft = await this.getDraft(draftId);
    if (draft) {
      const images = await this.getImagesForDraft(draftId);
      const updatedDraft: WorkDraftRecord = {
        ...draft,
        firstIncompleteStep: computeFirstIncompleteStep(draft, images.length > 0),
        updatedAt: Date.now(),
      };
      await retryOnceAfterQuotaCleanup(() => db.put("drafts", updatedDraft));
    }

    return imageId;
  }

  /**
   * Remove an image from a draft
   */
  async removeImageFromDraft(imageId: string): Promise<void> {
    const db = await this.init();
    const image = await db.get("draft_images", imageId);

    if (image) {
      if (image.url) mediaResourceManager.cleanupUrl(image.url);
      await db.delete("draft_images", imageId);

      // Update draft's updatedAt and firstIncompleteStep
      const draft = await this.getDraft(image.draftId);
      if (draft) {
        const images = await this.getImagesForDraft(image.draftId);
        const updatedDraft: WorkDraftRecord = {
          ...draft,
          firstIncompleteStep: computeFirstIncompleteStep(draft, images.length > 0),
          updatedAt: Date.now(),
        };
        await retryOnceAfterQuotaCleanup(() => db.put("drafts", updatedDraft));
      }
    }
  }

  /**
   * Get images for a draft.
   * Deserializes stored file data back to File objects.
   */
  async getThumbnailFile(draft: WorkDraftRecord): Promise<File | null> {
    const db = await this.init();
    if (draft.thumbnail === null) return null;
    let image = draft.thumbnail
      ? await db.get("draft_images", draft.thumbnail.attachmentId)
      : undefined;
    if (!draft.thumbnail) {
      // Legacy rows lack a summary reference. Stop at the first photo instead of restoring the draft.
      let cursor = await db.transaction("draft_images").store.index("draftId").openCursor(draft.id);
      while (cursor) {
        if ((cursor.value.fileData?.type ?? cursor.value.file?.type)?.startsWith("image/")) {
          image = cursor.value;
          break;
        }
        cursor = await cursor.continue();
      }
    }
    if (!image || image.draftId !== draft.id) return null;
    const data = image.fileData?.data
      ? image.fileData
      : await serializeFile(deserializeFile(image, draft.id, image.id));
    return restoreWorkFile(data, image.id, image.contentHash ?? (await hashWorkBytes(data.data)));
  }

  async getImagesForDraft(
    draftId: string,
    onUnreadable?: (attachment: import("../../types/job-queue").MissingDraftAttachment) => void
  ): Promise<Array<{ id: string; file: File; url: string; kind: "media" | "audio" }>> {
    const db = await this.init();
    const tx = db.transaction("draft_images", "readonly");
    const index = tx.objectStore("draft_images").index("draftId");
    const images = await index.getAll(draftId);

    // Deserialize files from IndexedDB format back to File objects
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

            return {
              id: img.id,
              kind: img.kind ?? "media",
              file,
              url: "",
            };
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
    const serializedFiles: Array<{ file: File; fileData: SerializedFileData }> = [];
    for (const file of files) {
      try {
        serializedFiles.push({ file, fileData: await serializeFile(file) });
      } catch (serializeError) {
        trackPrivateQueueEvent("job_queue_draft_file_serialization_failed", {
          ...buildFileMetadata(file),
        });
        throw serializeError;
      }
    }

    const timestamp = Date.now();
    const replacementImages = serializedFiles.map(({ fileData }) => ({
      id: crypto.randomUUID(),
      draftId,
      fileData,
      createdAt: timestamp,
    })) as DraftImage[];
    let committedPreviousImages: DraftImage[] = [];

    try {
      await retryOnceAfterQuotaCleanup(async () => {
        const tx = db.transaction(["drafts", "draft_images"], "readwrite");
        try {
          const draftStore = tx.objectStore("drafts");
          const imageStore = tx.objectStore("draft_images");
          const draft = await draftStore.get(draftId);
          if (!draft || !isWorkDraft(draft)) throw new Error(`Draft ${draftId} not found`);

          const previousImages = await imageStore.index("draftId").getAll(draftId);
          for (const image of previousImages) {
            await imageStore.delete(image.id);
          }
          for (const image of replacementImages) {
            await imageStore.add(image);
          }

          await draftStore.put({
            ...draft,
            firstIncompleteStep: computeFirstIncompleteStep(draft, replacementImages.length > 0),
            updatedAt: timestamp,
          });
          await tx.done;
          committedPreviousImages = previousImages;
        } catch (error) {
          try {
            tx.abort();
          } catch {
            // The browser may have already aborted the failed transaction.
          }
          await tx.done.catch(() => undefined);
          throw error;
        }
      });
    } catch (storeError) {
      replacementImages.forEach((image) => {
        if (image.url) mediaResourceManager.cleanupUrl(image.url);
      });
      files.forEach((file) => {
        trackPrivateQueueEvent("job_queue_draft_storage_failed", {
          ...buildFileMetadata(file),
        });
      });
      throw storeError;
    }

    // Old object URLs remain valid until the replacement transaction commits.
    committedPreviousImages.forEach((image) => {
      if (image.url) mediaResourceManager.cleanupUrl(image.url);
    });
  }

  /**
   * Get draft count for a user
   */
  async getDraftCount(userAddress: string, chainId: number): Promise<number> {
    const drafts = await this.getDraftsForUser(userAddress, chainId);
    return drafts.length;
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

export const draftDB = new DraftDatabase();
