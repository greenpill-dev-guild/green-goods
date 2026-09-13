import { type IDBPDatabase, openDB } from "idb";
import { migrateAvatarDrafts } from "./draft-avatars";
import { isWorkDraft, type DraftDB } from "./draft-state";

const DB_NAME = "green-goods-drafts";
const DB_VERSION = 3;

/** Owns structural upgrades and closes connections before another tab upgrades. */
class DraftConnection {
  private db: IDBPDatabase<DraftDB> | null = null;
  private opening: Promise<IDBPDatabase<DraftDB>> | null = null;

  async init(): Promise<IDBPDatabase<DraftDB>> {
    if (this.db) return this.db;
    if (this.opening) return this.opening;
    this.opening = new Promise<IDBPDatabase<DraftDB>>((resolve, reject) => {
      let abandoned = false;
      let connection: IDBPDatabase<DraftDB> | undefined;
      const fail = (error: unknown) => {
        abandoned = true;
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error("draft-database-open-timeout")), 3000);
      openDB<DraftDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, _newVersion, tx) {
          if (!db.objectStoreNames.contains("active_drafts"))
            db.createObjectStore("active_drafts", { keyPath: "scope" });
          if (!db.objectStoreNames.contains("draft_migrations"))
            db.createObjectStore("draft_migrations", { keyPath: "source" });
          if (!db.objectStoreNames.contains("drafts")) {
            const drafts = db.createObjectStore("drafts", { keyPath: "id" });
            drafts.createIndex("userAddress", "userAddress");
            drafts.createIndex("chainId", "chainId");
            drafts.createIndex("gardenAddress", "gardenAddress");
            drafts.createIndex("updatedAt", "updatedAt");
            drafts.createIndex("userAddress_chainId", ["userAddress", "chainId"]);
          }
          if (!db.objectStoreNames.contains("draft_images")) {
            const images = db.createObjectStore("draft_images", { keyPath: "id" });
            images.createIndex("draftId", "draftId");
            images.createIndex("createdAt", "createdAt");
          }
          if (oldVersion < 3) {
            void (async () => {
              let cursor = await tx.objectStore("drafts").openCursor();
              while (cursor) {
                if (isWorkDraft(cursor.value))
                  await cursor.update({ ...cursor.value, kind: "work" });
                cursor = await cursor.continue();
              }
            })().catch(() => {
              try {
                tx.abort();
              } catch {
                /* Already aborted. */
              }
            });
          }
        },
        blocked() {
          fail(new Error("draft-database-upgrade-blocked"));
        },
        blocking: () => {
          connection?.close();
          this.db = null;
        },
        terminated: () => {
          this.db = null;
        },
      })
        .then(async (db) => {
          connection = db;
          if (abandoned) {
            db.close();
            return;
          }
          clearTimeout(timer);
          this.db = db;
          // Structural upgrade commits before copying bytes from the separate legacy database.
          await migrateAvatarDrafts(db);
          resolve(db);
        }, fail)
        .finally(() => clearTimeout(timer));
    });
    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }
}

export const draftConnection = new DraftConnection();
