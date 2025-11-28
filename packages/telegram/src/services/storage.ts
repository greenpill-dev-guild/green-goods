import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";
import type { ParsedWorkData } from "./ai";
import {
  getPrivateKey,
  prepareKeyForStorage,
  isValidAddress,
  isValidPrivateKey,
} from "./crypto";

// ============================================================================
// TYPES
// ============================================================================

/**
 * User record stored in the database.
 *
 * SECURITY WARNING: privateKey is stored unencrypted in MVP.
 * For production, implement proper key management (e.g., KMS, HSM).
 */
export interface User {
  telegramId: number;
  /** WARNING: Stored unencrypted - MVP only! */
  privateKey: string;
  address: string;
  /** Address of current garden context */
  currentGarden?: string;
  role?: "gardener" | "operator";
}

/** Conversation session state */
export interface Session {
  telegramId: number;
  step: "idle" | "joining_garden" | "submitting_work" | "approving_work";
  draft?: ParsedWorkData;
}

/** Work pending operator approval */
export interface PendingWork {
  id: string;
  actionUID: number;
  gardenerAddress: string;
  gardenerTelegramId: number;
  gardenAddress: string;
  data: WorkDraftData;
  createdAt: number;
}

/** Structured work data for pending submissions */
export interface WorkDraftData {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: string[]; // IPFS CIDs or local paths
}

// ============================================================================
// STORAGE SERVICE
// ============================================================================

/**
 * StorageService manages persistent data for the Telegram bot using SQLite.
 *
 * Handles:
 * - User accounts and wallets
 * - Conversation sessions
 * - Pending work submissions awaiting approval
 *
 * @example
 * const storage = new StorageService("data/bot.db");
 * const user = storage.getUser(123456789);
 */
export class StorageService {
  private db: Database;

  constructor(dbPath: string = "bot.db") {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  /**
   * Initializes database schema with migrations.
   * Safe to call multiple times (uses IF NOT EXISTS).
   */
  private initSchema(): void {
    // Users table - stores wallet and garden context
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        telegramId INTEGER PRIMARY KEY,
        privateKey TEXT NOT NULL,
        address TEXT NOT NULL,
        currentGarden TEXT,
        role TEXT DEFAULT 'gardener',
        createdAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Sessions table - conversation state
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        telegramId INTEGER PRIMARY KEY,
        step TEXT NOT NULL DEFAULT 'idle',
        draft TEXT,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Pending works table - submissions awaiting approval
    this.db.run(`
      CREATE TABLE IF NOT EXISTS pending_works (
        id TEXT PRIMARY KEY,
        actionUID INTEGER NOT NULL,
        gardenerAddress TEXT NOT NULL,
        gardenerTelegramId INTEGER NOT NULL,
        gardenAddress TEXT,
        data TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Run migrations for existing databases
    this.runMigrations();

    // Create indexes after migrations
    this.createIndexes();
  }

  /**
   * Runs schema migrations for existing databases.
   * Handles adding new columns to existing tables.
   */
  private runMigrations(): void {
    // Check if gardenAddress column exists in pending_works
    const tableInfo = this.db
      .query("PRAGMA table_info(pending_works)")
      .all() as Array<{ name: string }>;

    const hasGardenAddress = tableInfo.some((col) => col.name === "gardenAddress");

    if (!hasGardenAddress) {
      console.log("Running migration: Adding gardenAddress column to pending_works");
      this.db.run("ALTER TABLE pending_works ADD COLUMN gardenAddress TEXT");
    }

    // Check if createdAt column exists in pending_works
    const hasCreatedAt = tableInfo.some((col) => col.name === "createdAt");
    if (!hasCreatedAt) {
      console.log("Running migration: Adding createdAt column to pending_works");
      this.db.run(
        "ALTER TABLE pending_works ADD COLUMN createdAt INTEGER DEFAULT (strftime('%s', 'now'))"
      );
    }
  }

  /**
   * Creates database indexes for faster queries.
   */
  private createIndexes(): void {
    // Create index for faster garden lookups on users
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_users_garden 
      ON users(currentGarden) WHERE currentGarden IS NOT NULL
    `);

    // Only create index on gardenAddress if the column exists
    try {
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_pending_works_garden 
        ON pending_works(gardenAddress) WHERE gardenAddress IS NOT NULL
      `);
    } catch {
      // Index creation might fail if column doesn't exist yet
      console.warn("Could not create idx_pending_works_garden index");
    }
  }

  /**
   * Retrieves a user by Telegram ID.
   * Automatically decrypts the private key.
   * Returns undefined if user doesn't exist.
   */
  getUser(telegramId: number): User | undefined {
    const result = this.db.query("SELECT * FROM users WHERE telegramId = ?").get(telegramId) as
      | { telegramId: number; privateKey: string; address: string; currentGarden?: string; role?: string }
      | null;

    if (!result) return undefined;

    // Decrypt the private key
    const { privateKey, needsMigration } = getPrivateKey(result.privateKey);

    // If the key was stored unencrypted, migrate it now
    if (needsMigration) {
      this.migrateUserKey(telegramId, privateKey);
    }

    return {
      telegramId: result.telegramId,
      privateKey,
      address: result.address,
      currentGarden: result.currentGarden,
      role: result.role as User["role"],
    };
  }

  /**
   * Migrates an unencrypted key to encrypted storage.
   * Called automatically when getting a user with a legacy key.
   */
  private migrateUserKey(telegramId: number, plainKey: string): void {
    const encryptedKey = prepareKeyForStorage(plainKey);
    this.db
      .query("UPDATE users SET privateKey = $privateKey WHERE telegramId = $telegramId")
      .run({ $telegramId: telegramId, $privateKey: encryptedKey });
    console.log(`Migrated key for user ${telegramId} to encrypted storage`);
  }

  /**
   * Creates a new user with encrypted private key.
   *
   * @param user - User data with plaintext private key
   * @throws Error if private key or address format is invalid
   */
  createUser(user: User): void {
    // Validate inputs
    if (!isValidPrivateKey(user.privateKey)) {
      throw new Error("Invalid private key format");
    }
    if (!isValidAddress(user.address)) {
      throw new Error("Invalid address format");
    }

    // Encrypt the private key before storing
    const encryptedKey = prepareKeyForStorage(user.privateKey);

    this.db
      .query(
        `
      INSERT INTO users (telegramId, privateKey, address, currentGarden, role)
      VALUES ($telegramId, $privateKey, $address, $currentGarden, $role)
    `
      )
      .run({
        $telegramId: user.telegramId,
        $privateKey: encryptedKey,
        $address: user.address,
        $currentGarden: user.currentGarden ?? null,
        $role: user.role ?? "gardener",
      });
  }

  updateUser(user: Partial<User> & { telegramId: number }) {
    const fields = Object.keys(user).filter(k => k !== "telegramId").map(k => `${k} = $${k}`).join(", ");
    if (!fields) return;
    
    const params: any = { $telegramId: user.telegramId };
    for (const [key, value] of Object.entries(user)) {
      if (key !== "telegramId") params[`$${key}`] = value;
    }

    this.db.query(`UPDATE users SET ${fields} WHERE telegramId = $telegramId`).run(params);
  }

  /**
   * Retrieves conversation session for a user.
   * Automatically parses JSON-serialized draft data.
   */
  getSession(telegramId: number): Session | undefined {
    const row = this.db
      .query("SELECT * FROM sessions WHERE telegramId = ?")
      .get(telegramId) as { telegramId: number; step: string; draft?: string } | undefined;

    if (!row) return undefined;

    const session: Session = {
      telegramId: row.telegramId,
      step: row.step as Session["step"],
      draft: undefined,
    };

    if (row.draft) {
      try {
        session.draft = JSON.parse(row.draft);
      } catch {
        // Invalid JSON - treat as no draft
        console.warn(`Invalid session draft JSON for user ${telegramId}`);
      }
    }

    return session;
  }

  setSession(session: Session) {
    const data = {
      $telegramId: session.telegramId,
      $step: session.step,
      $draft: session.draft ? JSON.stringify(session.draft) : null
    };
    this.db.query(`
      INSERT OR REPLACE INTO sessions (telegramId, step, draft)
      VALUES ($telegramId, $step, $draft)
    `).run(data);
  }

  clearSession(telegramId: number) {
    this.db.query("DELETE FROM sessions WHERE telegramId = ?").run(telegramId);
  }

  /**
   * Stores a pending work submission awaiting operator approval.
   */
  addPendingWork(work: Omit<PendingWork, "createdAt">): void {
    this.db
      .query(
        `
      INSERT INTO pending_works (id, actionUID, gardenerAddress, gardenerTelegramId, gardenAddress, data)
      VALUES ($id, $actionUID, $gardenerAddress, $gardenerTelegramId, $gardenAddress, $data)
    `
      )
      .run({
        $id: work.id,
        $actionUID: work.actionUID,
        $gardenerAddress: work.gardenerAddress,
        $gardenerTelegramId: work.gardenerTelegramId,
        $gardenAddress: work.gardenAddress ?? null,
        $data: JSON.stringify(work.data),
      });
  }

  /**
   * Retrieves a pending work by ID.
   * Returns undefined if not found.
   */
  getPendingWork(id: string): PendingWork | undefined {
    const row = this.db.query("SELECT * FROM pending_works WHERE id = ?").get(id) as
      | { id: string; actionUID: number; gardenerAddress: string; gardenerTelegramId: number; gardenAddress: string; data: string; createdAt: number }
      | undefined;

    if (!row) return undefined;

    return {
      ...row,
      data: JSON.parse(row.data) as WorkDraftData,
    };
  }

  /**
   * Retrieves all pending works for a garden.
   */
  getPendingWorksForGarden(gardenAddress: string): PendingWork[] {
    const rows = this.db
      .query("SELECT * FROM pending_works WHERE gardenAddress = ? ORDER BY createdAt DESC")
      .all(gardenAddress) as Array<{
      id: string;
      actionUID: number;
      gardenerAddress: string;
      gardenerTelegramId: number;
      gardenAddress: string;
      data: string;
      createdAt: number;
    }>;

    return rows.map((row) => ({
      ...row,
      data: JSON.parse(row.data) as WorkDraftData,
    }));
  }

  /**
   * Removes a pending work after it's been processed (approved/rejected).
   */
  removePendingWork(id: string): void {
    this.db.query("DELETE FROM pending_works WHERE id = ?").run(id);
  }

  /**
   * Finds an operator for a specific garden.
   * Returns undefined if no operator is registered.
   */
  getOperatorForGarden(gardenAddress: string): User | undefined {
    const result = this.db
      .query("SELECT * FROM users WHERE role = 'operator' AND currentGarden = ?")
      .get(gardenAddress);
    return result ? (result as User) : undefined;
  }

  /**
   * Lists all operators in the system (for debugging/admin).
   */
  getAllOperators(): User[] {
    return this.db.query("SELECT * FROM users WHERE role = 'operator'").all() as User[];
  }

  /**
   * Closes the database connection.
   * Call this when shutting down the bot.
   */
  close(): void {
    this.db.close();
  }
}

/** Singleton storage instance */
export const storage = new StorageService(process.env.DB_PATH || "data/bot.db");
