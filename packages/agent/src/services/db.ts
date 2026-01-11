/**
 * Database Service (SQLite)
 *
 * Direct database operations. No interface abstraction.
 */

import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
import type {
  CreateUserInput,
  PendingWork,
  Platform,
  Session,
  SessionStep,
  User,
  WorkDraftData,
} from "../types";
import { getPrivateKey, isValidAddress, isValidPrivateKey, prepareKeyForStorage } from "./crypto";
import { loggers } from "./logger";

const log = loggers.db;

// ============================================================================
// DATABASE CLASS
// ============================================================================

class DB {
  private db: Database;

  constructor(dbPath: string = "data/agent.db") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        platform TEXT NOT NULL,
        platformId TEXT NOT NULL,
        privateKey TEXT NOT NULL,
        address TEXT NOT NULL,
        currentGarden TEXT,
        role TEXT DEFAULT 'gardener',
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (platform, platformId)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        platform TEXT NOT NULL,
        platformId TEXT NOT NULL,
        step TEXT NOT NULL DEFAULT 'idle',
        draft TEXT,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (platform, platformId)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS pending_works (
        id TEXT PRIMARY KEY,
        actionUID INTEGER NOT NULL,
        gardenerAddress TEXT NOT NULL,
        gardenerPlatform TEXT NOT NULL,
        gardenerPlatformId TEXT NOT NULL,
        gardenAddress TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_users_garden ON users(currentGarden) WHERE currentGarden IS NOT NULL`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_pending_works_garden ON pending_works(gardenAddress)`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_users_role_garden ON users(role, currentGarden) WHERE role = 'operator'`
    );
  }

  // ==========================================================================
  // USERS
  // ==========================================================================

  async getUser(platform: Platform, platformId: string): Promise<User | undefined> {
    const row = this.db
      .query("SELECT * FROM users WHERE platform = ? AND platformId = ?")
      .get(platform, platformId) as {
      platform: string;
      platformId: string;
      privateKey: string;
      address: string;
      currentGarden: string | null;
      role: string | null;
      createdAt: number;
    } | null;

    if (!row) return undefined;

    const { privateKey, needsMigration } = getPrivateKey(row.privateKey);
    if (needsMigration) {
      await this.migrateUserKey(platform, platformId, privateKey);
    }

    return {
      platform: row.platform as Platform,
      platformId: row.platformId,
      privateKey,
      address: row.address,
      currentGarden: row.currentGarden ?? undefined,
      role: row.role as User["role"],
      createdAt: row.createdAt,
    };
  }

  private async migrateUserKey(
    platform: string,
    platformId: string,
    plainKey: string
  ): Promise<void> {
    const encryptedKey = prepareKeyForStorage(plainKey);
    this.db
      .query("UPDATE users SET privateKey = ? WHERE platform = ? AND platformId = ?")
      .run(encryptedKey, platform, platformId);
    log.info({ platform, platformId }, "Migrated key to encrypted storage");
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (!isValidPrivateKey(input.privateKey)) {
      throw new Error("Invalid private key format");
    }
    if (!isValidAddress(input.address)) {
      throw new Error("Invalid address format");
    }

    const encryptedKey = prepareKeyForStorage(input.privateKey);
    const createdAt = Date.now();

    this.db
      .query(
        `INSERT INTO users (platform, platformId, privateKey, address, currentGarden, role, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.platform,
        input.platformId,
        encryptedKey,
        input.address,
        input.currentGarden ?? null,
        input.role ?? "gardener",
        createdAt
      );

    return {
      platform: input.platform,
      platformId: input.platformId,
      privateKey: input.privateKey,
      address: input.address,
      currentGarden: input.currentGarden,
      role: input.role ?? "gardener",
      createdAt,
    };
  }

  async updateUser(
    platform: Platform,
    platformId: string,
    update: Partial<Pick<User, "currentGarden" | "role">>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];

    if (update.currentGarden !== undefined) {
      setClauses.push("currentGarden = ?");
      values.push(update.currentGarden ?? null);
    }
    if (update.role !== undefined) {
      setClauses.push("role = ?");
      values.push(update.role ?? null);
    }

    if (setClauses.length === 0) return;

    this.db
      .query(`UPDATE users SET ${setClauses.join(", ")} WHERE platform = ? AND platformId = ?`)
      .run(...values, platform, platformId);
  }

  async getOperatorForGarden(gardenAddress: string): Promise<User | undefined> {
    const row = this.db
      .query("SELECT * FROM users WHERE role = 'operator' AND currentGarden = ? LIMIT 1")
      .get(gardenAddress) as {
      platform: string;
      platformId: string;
      privateKey: string;
      address: string;
      currentGarden: string | null;
      role: string | null;
      createdAt: number;
    } | null;

    if (!row) return undefined;

    const { privateKey } = getPrivateKey(row.privateKey);
    return {
      platform: row.platform as Platform,
      platformId: row.platformId,
      privateKey,
      address: row.address,
      currentGarden: row.currentGarden ?? undefined,
      role: row.role as User["role"],
      createdAt: row.createdAt,
    };
  }

  // ==========================================================================
  // SESSIONS
  // ==========================================================================

  async getSession(platform: Platform, platformId: string): Promise<Session | undefined> {
    const row = this.db
      .query("SELECT * FROM sessions WHERE platform = ? AND platformId = ?")
      .get(platform, platformId) as {
      platform: string;
      platformId: string;
      step: string;
      draft: string | null;
      updatedAt: number;
    } | null;

    if (!row) return undefined;

    let draft: unknown = undefined;
    if (row.draft) {
      try {
        draft = JSON.parse(row.draft);
      } catch {
        log.warn({ platform, platformId }, "Invalid session draft JSON");
      }
    }

    return {
      platform: row.platform as Platform,
      platformId: row.platformId,
      step: row.step as SessionStep,
      draft,
      updatedAt: row.updatedAt,
    };
  }

  async setSession(session: Session): Promise<void> {
    const draftJson = session.draft ? JSON.stringify(session.draft) : null;
    this.db
      .query(
        `INSERT OR REPLACE INTO sessions (platform, platformId, step, draft, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        session.platform,
        session.platformId,
        session.step,
        draftJson,
        session.updatedAt || Date.now()
      );
  }

  async clearSession(platform: Platform, platformId: string): Promise<void> {
    this.db
      .query("DELETE FROM sessions WHERE platform = ? AND platformId = ?")
      .run(platform, platformId);
  }

  // ==========================================================================
  // PENDING WORK
  // ==========================================================================

  async addPendingWork(work: Omit<PendingWork, "createdAt">): Promise<void> {
    this.db
      .query(
        `INSERT INTO pending_works (id, actionUID, gardenerAddress, gardenerPlatform, gardenerPlatformId, gardenAddress, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        work.id,
        work.actionUID,
        work.gardenerAddress,
        work.gardenerPlatform,
        work.gardenerPlatformId,
        work.gardenAddress,
        JSON.stringify(work.data)
      );
  }

  async getPendingWork(id: string): Promise<PendingWork | undefined> {
    const row = this.db.query("SELECT * FROM pending_works WHERE id = ?").get(id) as {
      id: string;
      actionUID: number;
      gardenerAddress: string;
      gardenerPlatform: string;
      gardenerPlatformId: string;
      gardenAddress: string;
      data: string;
      createdAt: number;
    } | null;

    if (!row) return undefined;

    return {
      id: row.id,
      actionUID: row.actionUID,
      gardenerAddress: row.gardenerAddress,
      gardenerPlatform: row.gardenerPlatform as Platform,
      gardenerPlatformId: row.gardenerPlatformId,
      gardenAddress: row.gardenAddress,
      data: JSON.parse(row.data) as WorkDraftData,
      createdAt: row.createdAt,
    };
  }

  async getPendingWorksForGarden(gardenAddress: string): Promise<PendingWork[]> {
    const rows = this.db
      .query("SELECT * FROM pending_works WHERE gardenAddress = ? ORDER BY createdAt DESC")
      .all(gardenAddress) as Array<{
      id: string;
      actionUID: number;
      gardenerAddress: string;
      gardenerPlatform: string;
      gardenerPlatformId: string;
      gardenAddress: string;
      data: string;
      createdAt: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      actionUID: row.actionUID,
      gardenerAddress: row.gardenerAddress,
      gardenerPlatform: row.gardenerPlatform as Platform,
      gardenerPlatformId: row.gardenerPlatformId,
      gardenAddress: row.gardenAddress,
      data: JSON.parse(row.data) as WorkDraftData,
      createdAt: row.createdAt,
    }));
  }

  async removePendingWork(id: string): Promise<void> {
    this.db.query("DELETE FROM pending_works WHERE id = ?").run(id);
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  async close(): Promise<void> {
    this.db.close();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let _db: DB | null = null;

export function initDB(dbPath?: string): DB {
  if (!_db) {
    _db = new DB(dbPath);
  }
  return _db;
}

export function getDB(): DB {
  if (!_db) {
    throw new Error("Database not initialized. Call initDB() first.");
  }
  return _db;
}

// Re-export convenience functions
export const getUser = (platform: Platform, platformId: string) =>
  getDB().getUser(platform, platformId);
export const createUser = (input: CreateUserInput) => getDB().createUser(input);
export const updateUser = (
  platform: Platform,
  platformId: string,
  update: Partial<Pick<User, "currentGarden" | "role">>
) => getDB().updateUser(platform, platformId, update);
export const getOperatorForGarden = (gardenAddress: string) =>
  getDB().getOperatorForGarden(gardenAddress);

export const getSession = (platform: Platform, platformId: string) =>
  getDB().getSession(platform, platformId);
export const setSession = (session: Session) => getDB().setSession(session);
export const clearSession = (platform: Platform, platformId: string) =>
  getDB().clearSession(platform, platformId);

export const addPendingWork = (work: Omit<PendingWork, "createdAt">) =>
  getDB().addPendingWork(work);
export const getPendingWork = (id: string) => getDB().getPendingWork(id);
export const getPendingWorksForGarden = (gardenAddress: string) =>
  getDB().getPendingWorksForGarden(gardenAddress);
export const removePendingWork = (id: string) => getDB().removePendingWork(id);

export const closeDB = () => _db?.close();
