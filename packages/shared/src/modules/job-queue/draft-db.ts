/**
 * Draft Database Module
 *
 * Manages work submission drafts with IndexedDB persistence.
 * Drafts survive PWA closes and support multiple drafts per user.
 *
 * @module modules/job-queue/draft-db
 */

import { type IDBPDatabase, openDB } from "idb";
import type { DraftImage, DraftStep, WorkDraftRecord, SerializedFileData } from "../../types/job-queue";
import { serializeFile, deserializeFile, buildFileMetadata } from "../../utils/storage/file-serialization";
import { trackStorageError } from "../app/error-tracking";
import { mediaResourceManager } from "./media-resource-manager";

const DB_NAME = "green-goods-drafts";
const DB_VERSION = 1;
const MAX_DRAFTS_PER_USER = 20;

interface DraftDB {
  drafts: WorkDraftRecord;
  draft_images: DraftImage;
}

/**
 * Compute the first incomplete step based on draft data
 */
export function computeFirstIncompleteStep(
  draft: Partial<WorkDraftRecord>,
  hasImages: boolean
): DraftStep {
  // Step 1: Intro - needs garden and action selected
  if (!draft.gardenAddress || draft.actionUID === null || draft.actionUID === undefined) {
    return "intro";
  }

  // Step 2: Media - needs at least one image
  if (!hasImages) {
    return "media";
  }

  // Step 3: Details - needs feedback (plantSelection is optional)
  if (!draft.feedback || draft.feedback.trim() === "") {
    return "details";
  }

  // All steps complete, ready for review
  return "review";
}

class DraftDatabase {
  private db: IDBPDatabase<DraftDB> | null = null;

  async init(): Promise<IDBPDatabase<DraftDB>> {
    if (this.db) return this.db;

    this.db = await openDB<DraftDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create drafts store
        if (!db.objectStoreNames.contains("drafts")) {
          const draftsStore = db.createObjectStore("drafts", { keyPath: "id" });
          draftsStore.createIndex("userAddress", "userAddress");
          draftsStore.createIndex("chainId", "chainId");
          draftsStore.createIndex("gardenAddress", "gardenAddress");
          draftsStore.createIndex("updatedAt", "updatedAt");
          // Compound index for user + chain scoped queries
          draftsStore.createIndex("userAddress_chainId", ["userAddress", "chainId"]);
        }

        // Create draft images store
        if (!db.objectStoreNames.contains("draft_images")) {
          const imagesStore = db.createObjectStore("draft_images", { keyPath: "id" });
          imagesStore.createIndex("draftId", "draftId");
          imagesStore.createIndex("createdAt", "createdAt");
        }
      },
    });

    return this.db;
  }

  /**
   * Create a new draft. Returns the draft ID.
   */
  async createDraft(
    userAddress: string,
    chainId: number,
    data: Partial<Omit<WorkDraftRecord, "id" | "userAddress" | "chainId" | "createdAt" | "updatedAt">>
  ): Promise<string> {
    const db = await this.init();

    // Check draft count and enforce LRU limit
    await this.enforceDraftLimit(userAddress, chainId);

    const id = crypto.randomUUID();
    const now = Date.now();

    const draft: WorkDraftRecord = {
      id,
      userAddress,
      chainId,
      gardenAddress: data.gardenAddress ?? null,
      actionUID: data.actionUID ?? null,
      feedback: data.feedback ?? "",
      plantSelection: data.plantSelection ?? [],
      plantCount: data.plantCount,
      currentStep: data.currentStep ?? "intro",
      firstIncompleteStep: data.firstIncompleteStep ?? "intro",
      createdAt: now,
      updatedAt: now,
    };

    await db.add("drafts", draft);
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
    const existing = await db.get("drafts", draftId);

    if (!existing) {
      throw new Error(`Draft ${draftId} not found`);
    }

    // Get images to compute firstIncompleteStep
    const images = await this.getImagesForDraft(draftId);
    const hasImages = images.length > 0;

    const updated: WorkDraftRecord = {
      ...existing,
      ...data,
      firstIncompleteStep: computeFirstIncompleteStep({ ...existing, ...data }, hasImages),
      updatedAt: Date.now(),
    };

    await db.put("drafts", updated);
  }

  /**
   * Get a draft by ID
   */
  async getDraft(draftId: string): Promise<WorkDraftRecord | undefined> {
    const db = await this.init();
    return await db.get("drafts", draftId);
  }

  /**
   * Get all drafts for a user on a specific chain, ordered by updatedAt desc
   */
  async getDraftsForUser(userAddress: string, chainId: number): Promise<WorkDraftRecord[]> {
    const db = await this.init();
    const tx = db.transaction("drafts", "readonly");
    const index = tx.objectStore("drafts").index("userAddress");
    const userDrafts = await index.getAll(userAddress);

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
    const images = await this.getImagesForDraft(draftId);
    const tx = db.transaction(["drafts", "draft_images"], "readwrite");

    for (const image of images) {
      mediaResourceManager.cleanupUrl(image.url);
      await tx.objectStore("draft_images").delete(image.id);
    }

    // Clean up all URLs for this draft
    mediaResourceManager.cleanupUrls(draftId);

    await tx.objectStore("drafts").delete(draftId);
    await tx.done;
  }

  /**
   * Add an image to a draft.
   * Serializes the File to ArrayBuffer before storing to work around iOS Safari
   * IndexedDB issues with File objects.
   */
  async addImageToDraft(draftId: string, file: File): Promise<string> {
    const db = await this.init();
    const imageId = crypto.randomUUID();
    const url = mediaResourceManager.createUrl(file, draftId);

    // Serialize file BEFORE storing to avoid iOS Safari DOMException
    let fileData: SerializedFileData;
    try {
      fileData = await serializeFile(file);
    } catch (serializeError) {
      trackStorageError(serializeError, {
        source: "DraftDatabase.addImageToDraft",
        userAction: "serializing file for IndexedDB storage",
        metadata: buildFileMetadata(file, draftId),
      });
      throw serializeError;
    }

    try {
      await db.add("draft_images", {
        id: imageId,
        draftId,
        fileData, // Store serialized data instead of File
        url,
        createdAt: Date.now(),
      } as DraftImage);
    } catch (storeError) {
      trackStorageError(storeError, {
        source: "DraftDatabase.addImageToDraft",
        userAction: "storing image in IndexedDB",
        metadata: {
          ...buildFileMetadata(file, draftId),
          error_name: storeError instanceof Error ? storeError.name : "Unknown",
          error_message: storeError instanceof Error ? storeError.message : String(storeError),
        },
      });
      throw storeError;
    }

    // Update draft's updatedAt and firstIncompleteStep
    const draft = await this.getDraft(draftId);
    if (draft) {
      const images = await this.getImagesForDraft(draftId);
      await db.put("drafts", {
        ...draft,
        firstIncompleteStep: computeFirstIncompleteStep(draft, images.length > 0),
        updatedAt: Date.now(),
      });
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
      mediaResourceManager.cleanupUrl(image.url);
      await db.delete("draft_images", imageId);

      // Update draft's updatedAt and firstIncompleteStep
      const draft = await this.getDraft(image.draftId);
      if (draft) {
        const images = await this.getImagesForDraft(image.draftId);
        await db.put("drafts", {
          ...draft,
          firstIncompleteStep: computeFirstIncompleteStep(draft, images.length > 0),
          updatedAt: Date.now(),
        });
      }
    }
  }

  /**
   * Get images for a draft.
   * Deserializes stored file data back to File objects.
   */
  async getImagesForDraft(
    draftId: string
  ): Promise<Array<{ id: string; file: File; url: string }>> {
    const db = await this.init();
    const tx = db.transaction("draft_images", "readonly");
    const index = tx.objectStore("draft_images").index("draftId");
    const images = await index.getAll(draftId);

    // Deserialize files from IndexedDB format back to File objects
    return images.map((img) => {
      const file = deserializeFile(img, `draft-${draftId}`, img.id);

      return {
        id: img.id,
        file,
        url: mediaResourceManager.getOrCreateUrl(file, draftId),
      };
    });
  }

  /**
   * Set all images for a draft (replaces existing)
   */
  async setImagesForDraft(draftId: string, files: File[]): Promise<void> {
    const db = await this.init();

    // Delete existing images
    const existingImages = await this.getImagesForDraft(draftId);
    const tx = db.transaction("draft_images", "readwrite");
    for (const img of existingImages) {
      mediaResourceManager.cleanupUrl(img.url);
      await tx.objectStore("draft_images").delete(img.id);
    }
    await tx.done;

    // Add new images
    for (const file of files) {
      await this.addImageToDraft(draftId, file);
    }
  }

  /**
   * Enforce the max drafts limit (LRU by updatedAt)
   */
  private async enforceDraftLimit(userAddress: string, chainId: number): Promise<void> {
    const drafts = await this.getDraftsForUser(userAddress, chainId);

    if (drafts.length >= MAX_DRAFTS_PER_USER) {
      // Delete oldest drafts (already sorted by updatedAt desc)
      const draftsToDelete = drafts.slice(MAX_DRAFTS_PER_USER - 1);
      for (const draft of draftsToDelete) {
        await this.deleteDraft(draft.id);
      }
    }
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

    // Draft has progress if it has images or feedback
    return images.length > 0 || draft.feedback.trim().length > 0;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Nothing to do for now, URLs are managed by mediaResourceManager
  }
}

export const draftDB = new DraftDatabase();
