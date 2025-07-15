import { type IDBPDatabase, openDB } from "idb";

// Local interface for cached work data (based on global WorkCard)
export interface CachedWork {
  id: string;
  title: string;
  actionUID: number;
  gardenerAddress: string;
  gardenAddress: string;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
  status?: "pending" | "approved" | "rejected";
}

export interface OfflineWork {
  id: string;
  type: "work" | "approval";
  data: unknown; // Using unknown for type safety
  images?: File[];
  timestamp: number;
  synced: boolean;
  error?: string;
}

export interface OfflineImage {
  id: string;
  workId: string;
  file: File;
  url: string;
}

const DB_NAME = "green-goods-offline";
const DB_VERSION = 1;

class OfflineDatabase {
  private db: IDBPDatabase | null = null;

  async init() {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store for offline work submissions and approvals
        if (!db.objectStoreNames.contains("pendingWork")) {
          const pendingWork = db.createObjectStore("pendingWork", { keyPath: "id" });
          pendingWork.createIndex("type", "type");
          pendingWork.createIndex("synced", "synced");
          pendingWork.createIndex("timestamp", "timestamp");
        }

        // Store for cached images
        if (!db.objectStoreNames.contains("offlineImages")) {
          const images = db.createObjectStore("offlineImages", { keyPath: "id" });
          images.createIndex("workId", "workId");
        }

        // Store for cached work data (for viewing offline)
        if (!db.objectStoreNames.contains("cachedWork")) {
          const cachedWork = db.createObjectStore("cachedWork", { keyPath: "id" });
          cachedWork.createIndex("gardenAddress", "gardenAddress");
          cachedWork.createIndex("gardenerAddress", "gardenerAddress");
        }
      },
    });

    return this.db;
  }

  async addPendingWork(work: Omit<OfflineWork, "id" | "timestamp">) {
    const db = await this.init();
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    const workData: OfflineWork = {
      ...work,
      id,
      timestamp,
      synced: false,
    };

    await db.add("pendingWork", workData);

    // Store images separately if present
    if (work.images && work.images.length > 0) {
      for (const image of work.images) {
        const imageId = crypto.randomUUID();
        const url = URL.createObjectURL(image);
        await db.add("offlineImages", {
          id: imageId,
          workId: id,
          file: image,
          url,
        });
      }
    }

    return id;
  }

  async getPendingWork(type?: "work" | "approval"): Promise<OfflineWork[]> {
    const db = await this.init();

    if (type) {
      const tx = db.transaction("pendingWork", "readonly");
      const index = tx.objectStore("pendingWork").index("type");
      return await index.getAll(type);
    }

    return db.getAll("pendingWork");
  }

  async getUnsyncedWork(): Promise<OfflineWork[]> {
    const db = await this.init();
    const allWork = await db.getAll("pendingWork");
    return allWork.filter((work) => !work.synced);
  }

  async markAsSynced(id: string) {
    const db = await this.init();
    const work = await db.get("pendingWork", id);

    if (work) {
      work.synced = true;
      await db.put("pendingWork", work);
    }
  }

  async markAsError(id: string, error: string) {
    const db = await this.init();
    const work = await db.get("pendingWork", id);

    if (work) {
      work.error = error;
      await db.put("pendingWork", work);
    }
  }

  async getImagesForWork(workId: string): Promise<OfflineImage[]> {
    const db = await this.init();
    const tx = db.transaction("offlineImages", "readonly");
    const index = tx.objectStore("offlineImages").index("workId");
    return await index.getAll(workId);
  }

  async cacheWork(work: CachedWork) {
    const db = await this.init();
    await db.put("cachedWork", work);
  }

  async getCachedWork(gardenAddress?: string): Promise<CachedWork[]> {
    const db = await this.init();

    if (gardenAddress) {
      const tx = db.transaction("cachedWork", "readonly");
      const index = tx.objectStore("cachedWork").index("gardenAddress");
      return await index.getAll(gardenAddress);
    }

    return db.getAll("cachedWork");
  }

  async clearSyncedWork() {
    const db = await this.init();
    const allWork = await db.getAll("pendingWork");
    const syncedWork = allWork.filter((work) => work.synced);

    for (const work of syncedWork) {
      // Clean up associated images
      const images = await this.getImagesForWork(work.id);
      for (const image of images) {
        URL.revokeObjectURL(image.url);
        await db.delete("offlineImages", image.id);
      }

      await db.delete("pendingWork", work.id);
    }
  }
}

export const offlineDB = new OfflineDatabase();
