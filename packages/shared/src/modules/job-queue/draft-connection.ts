import Dexie, { type EntityTable, type Table } from "dexie";
import type { DraftImage } from "../../types/job-queue";
import { migrateAvatarDrafts } from "./draft-avatars";
import { type CanonicalDraftRecord, isWorkDraft } from "./draft-state";

/** The database name every build has used; read through `DraftDatabase`. */
const DRAFT_DB_NAME = "green-goods-drafts";
const OPEN_TIMEOUT_MS = 3000;

export interface ActiveDraftRow {
  scope: string;
  draftId: string | null;
}

export interface DraftMigrationReceipt {
  source: string;
  fingerprint: string;
  copiedAt: number;
}

/**
 * Work and avatar drafts as typed Dexie tables. Dexie stores a declared
 * version ×10 in IndexedDB, so version 4 opens the database earlier builds
 * created with `idb` at version 3 and upgrades it in place, keeping every
 * row; the compound index keeps its existing name.
 */
export class DraftDatabase extends Dexie {
  // A union row type keeps its members' own fields only through an explicit insert type.
  drafts!: Table<CanonicalDraftRecord, string, CanonicalDraftRecord>;
  draft_images!: EntityTable<DraftImage, "id">;
  active_drafts!: EntityTable<ActiveDraftRow, "scope">;
  draft_migrations!: EntityTable<DraftMigrationReceipt, "source">;

  constructor(name = DRAFT_DB_NAME) {
    super(name);
    this.version(4)
      .stores({
        drafts: "id, userAddress, chainId, gardenAddress, updatedAt, [userAddress+chainId]",
        draft_images: "id, draftId, createdAt",
        active_drafts: "scope",
        draft_migrations: "source",
      })
      // Drafts saved before kinds existed are work drafts.
      .upgrade((tx) =>
        tx
          .table<CanonicalDraftRecord>("drafts")
          .toCollection()
          .modify((record) => {
            if (isWorkDraft(record) && record.kind === undefined) record.kind = "work";
          })
      );
  }
}

/** Owns the single connection and closes it before another tab upgrades. */
class DraftConnection {
  private db: DraftDatabase | null = null;
  private opening: Promise<DraftDatabase> | null = null;

  async init(): Promise<DraftDatabase> {
    if (this.db) return this.db;
    if (this.opening) return this.opening;
    this.opening = this.open();
    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }

  private async open(): Promise<DraftDatabase> {
    const db = new DraftDatabase();
    const forget = () => {
      if (this.db === db) this.db = null;
    };
    db.on("versionchange", () => {
      db.close();
      forget();
    });
    db.on("close", forget);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abandoned = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("draft-database-open-timeout")), OPEN_TIMEOUT_MS);
      db.on("blocked", () => reject(new Error("draft-database-upgrade-blocked")));
    });
    try {
      await Promise.race([db.open(), abandoned]);
    } catch (error) {
      db.close();
      throw error;
    } finally {
      clearTimeout(timer);
    }
    this.db = db;
    // The structural upgrade has committed before bytes are copied from the separate legacy database.
    await migrateAvatarDrafts(db);
    return db;
  }
}

export const draftConnection = new DraftConnection();
