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
  Feedback,
  FeedbackStatus,
  FeedbackType,
  PendingWork,
  Platform,
  Session,
  SessionStep,
  User,
  WorkDraftData,
} from "../types";
import { getPrivateKey, isValidAddress, isValidPrivateKey, prepareKeyForStorage } from "./crypto";
import type { FundingIntentRecord } from "./funding-intents";
import { loggers } from "./logger";

const log = loggers.db;

interface FundingIntentRow {
  id: string;
  gardenId: string;
  gardenName: string;
  gardenLocation: string | null;
  destinationType: FundingIntentRecord["destinationType"];
  destinationAddress: FundingIntentRecord["destinationAddress"];
  fundingIntent: FundingIntentRecord["fundingIntent"];
  paymentMethod: FundingIntentRecord["paymentMethod"];
  availabilityKey: string;
  clientRequestId: string;
  idempotencyFingerprint: string;
  amountUsd: string;
  chainId: number;
  token: FundingIntentRecord["token"];
  provider: "thirdweb";
  providerSessionId: string | null;
  providerPaymentId: string | null;
  status: FundingIntentRecord["status"];
  payerEmailHash: string | null;
  receiptTokenHash: string;
  quoteExpiresAt: string;
  checkoutExpiresAt: string | null;
  receiverAddress: FundingIntentRecord["receiverAddress"] | null;
  quotedAssetAmount: string | null;
  minAssetAmount: string | null;
  fundedAssetAmount: string | null;
  fundingTxHash: string | null;
  failureCode: FundingIntentRecord["failureCode"] | null;
  checkoutSession: string | null;
  transactionAttempts: string;
  createdAt: string;
  updatedAt: string;
}

type SqlValue = string | number | null;

function serializeFundingIntent(record: FundingIntentRecord): SqlValue[] {
  return [
    record.id,
    record.gardenId,
    record.gardenName,
    record.gardenLocation ?? null,
    record.destinationType,
    record.destinationAddress,
    record.fundingIntent,
    record.paymentMethod,
    record.availabilityKey,
    record.clientRequestId,
    record.idempotencyFingerprint,
    record.amountUsd,
    record.chainId,
    record.token,
    record.provider,
    record.providerSessionId ?? null,
    record.providerPaymentId ?? null,
    record.status,
    record.payerEmailHash ?? null,
    record.receiptTokenHash,
    record.quoteExpiresAt,
    record.checkoutExpiresAt ?? null,
    record.receiverAddress ?? null,
    record.quotedAssetAmount ?? null,
    record.minAssetAmount ?? null,
    record.fundedAssetAmount ?? null,
    record.fundingTxHash ?? null,
    record.failureCode ?? null,
    record.checkoutSession ? JSON.stringify(record.checkoutSession) : null,
    JSON.stringify(record.transactionAttempts),
    record.createdAt,
    record.updatedAt,
  ];
}

function serializeFundingIntentForUpdate(record: FundingIntentRecord): SqlValue[] {
  const [, ...withoutId] = serializeFundingIntent(record);
  return [...withoutId, record.id];
}

function deserializeFundingIntent(row: FundingIntentRow): FundingIntentRecord {
  return {
    id: row.id,
    gardenId: row.gardenId,
    gardenName: row.gardenName,
    gardenLocation: row.gardenLocation ?? undefined,
    destinationType: row.destinationType,
    destinationAddress: row.destinationAddress,
    fundingIntent: row.fundingIntent,
    paymentMethod: row.paymentMethod,
    availabilityKey: row.availabilityKey,
    clientRequestId: row.clientRequestId,
    idempotencyFingerprint: row.idempotencyFingerprint,
    amountUsd: row.amountUsd,
    chainId: row.chainId,
    token: row.token,
    provider: row.provider,
    providerSessionId: row.providerSessionId ?? undefined,
    providerPaymentId: row.providerPaymentId ?? undefined,
    status: row.status,
    payerEmailHash: row.payerEmailHash ?? undefined,
    receiptTokenHash: row.receiptTokenHash,
    quoteExpiresAt: row.quoteExpiresAt,
    checkoutExpiresAt: row.checkoutExpiresAt ?? undefined,
    receiverAddress: row.receiverAddress ?? undefined,
    quotedAssetAmount: row.quotedAssetAmount ?? undefined,
    minAssetAmount: row.minAssetAmount ?? undefined,
    fundedAssetAmount: row.fundedAssetAmount ?? undefined,
    fundingTxHash: row.fundingTxHash ?? undefined,
    failureCode: row.failureCode ?? undefined,
    checkoutSession: row.checkoutSession ? JSON.parse(row.checkoutSession) : undefined,
    transactionAttempts: JSON.parse(row.transactionAttempts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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

    this.db.run(`
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        text TEXT NOT NULL,
        platform TEXT NOT NULL,
        platformId TEXT NOT NULL,
        displayName TEXT,
        gardenAddress TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
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
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback(status, createdAt)`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_feedback_platform ON feedback(platform, platformId)`
    );

    this.db.run(`
      CREATE TABLE IF NOT EXISTS funding_intents (
        id TEXT PRIMARY KEY,
        gardenId TEXT NOT NULL,
        gardenName TEXT NOT NULL,
        gardenLocation TEXT,
        destinationType TEXT NOT NULL,
        destinationAddress TEXT NOT NULL,
        fundingIntent TEXT NOT NULL,
        paymentMethod TEXT NOT NULL,
        availabilityKey TEXT NOT NULL,
        clientRequestId TEXT NOT NULL UNIQUE,
        idempotencyFingerprint TEXT NOT NULL,
        amountUsd TEXT NOT NULL,
        chainId INTEGER NOT NULL,
        token TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerSessionId TEXT,
        providerPaymentId TEXT,
        status TEXT NOT NULL,
        payerEmailHash TEXT,
        receiptTokenHash TEXT NOT NULL,
        quoteExpiresAt TEXT NOT NULL,
        checkoutExpiresAt TEXT,
        receiverAddress TEXT,
        quotedAssetAmount TEXT,
        minAssetAmount TEXT,
        fundedAssetAmount TEXT,
        fundingTxHash TEXT,
        failureCode TEXT,
        checkoutSession TEXT,
        transactionAttempts TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS funding_intent_events (
        id TEXT PRIMARY KEY,
        intentId TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT NOT NULL,
        providerEventId TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(intentId) REFERENCES funding_intents(id)
      )
    `);

    this.ensureColumn("funding_intents", "providerSessionId", "TEXT");
    this.ensureColumn("funding_intents", "providerPaymentId", "TEXT");
    this.ensureColumn("funding_intent_events", "providerEventId", "TEXT");

    this.db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intents_funding_tx_hash
       ON funding_intents(fundingTxHash) WHERE fundingTxHash IS NOT NULL`
    );
    this.db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intents_provider_session
       ON funding_intents(providerSessionId) WHERE providerSessionId IS NOT NULL`
    );
    this.db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intents_provider_payment
       ON funding_intents(providerPaymentId) WHERE providerPaymentId IS NOT NULL`
    );
    this.db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intent_events_provider_event
       ON funding_intent_events(providerEventId) WHERE providerEventId IS NOT NULL`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_funding_intents_status
       ON funding_intents(status, updatedAt)`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_funding_intent_events_intent
       ON funding_intent_events(intentId, createdAt)`
    );
    this.db.run("PRAGMA user_version = 2");
  }

  private ensureColumn(
    table: "funding_intents" | "funding_intent_events",
    column: string,
    definition: string
  ): void {
    const columns = this.db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((info) => info.name === column)) {
      this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
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
  // FEEDBACK
  // ==========================================================================

  async addFeedback(feedback: Omit<Feedback, "createdAt" | "updatedAt">): Promise<Feedback> {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO feedback (id, type, status, text, platform, platformId, displayName, gardenAddress, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        feedback.id,
        feedback.type,
        feedback.status,
        feedback.text,
        feedback.platform,
        feedback.platformId,
        feedback.displayName ?? null,
        feedback.gardenAddress ?? null,
        now,
        now
      );

    return { ...feedback, createdAt: now, updatedAt: now };
  }

  async getFeedback(id: string): Promise<Feedback | undefined> {
    const row = this.db.query("SELECT * FROM feedback WHERE id = ?").get(id) as {
      id: string;
      type: string;
      status: string;
      text: string;
      platform: string;
      platformId: string;
      displayName: string | null;
      gardenAddress: string | null;
      createdAt: number;
      updatedAt: number;
    } | null;

    if (!row) return undefined;

    return {
      id: row.id,
      type: row.type as FeedbackType,
      status: row.status as FeedbackStatus,
      text: row.text,
      platform: row.platform as Platform,
      platformId: row.platformId,
      displayName: row.displayName ?? undefined,
      gardenAddress: row.gardenAddress ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getNewFeedback(since?: number, type?: FeedbackType): Promise<Feedback[]> {
    const defaultSince = Date.now() - 24 * 60 * 60 * 1000;
    const sinceMs = since ?? defaultSince;

    let query = "SELECT * FROM feedback WHERE status = 'new' AND createdAt >= ?";
    const params: (string | number)[] = [sinceMs];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY createdAt ASC";

    const rows = this.db.query(query).all(...params) as Array<{
      id: string;
      type: string;
      status: string;
      text: string;
      platform: string;
      platformId: string;
      displayName: string | null;
      gardenAddress: string | null;
      createdAt: number;
      updatedAt: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      type: row.type as FeedbackType,
      status: row.status as FeedbackStatus,
      text: row.text,
      platform: row.platform as Platform,
      platformId: row.platformId,
      displayName: row.displayName ?? undefined,
      gardenAddress: row.gardenAddress ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
    this.db
      .query("UPDATE feedback SET status = ?, updatedAt = ? WHERE id = ?")
      .run(status, Date.now(), id);
  }

  // ==========================================================================
  // FUNDING INTENTS
  // ==========================================================================

  async createFundingIntent(record: FundingIntentRecord): Promise<FundingIntentRecord> {
    this.db
      .query(
        `INSERT INTO funding_intents (
          id, gardenId, gardenName, gardenLocation, destinationType, destinationAddress,
          fundingIntent, paymentMethod, availabilityKey, clientRequestId, idempotencyFingerprint,
          amountUsd, chainId, token, provider, providerSessionId, providerPaymentId, status,
          payerEmailHash, receiptTokenHash,
          quoteExpiresAt, checkoutExpiresAt, receiverAddress, quotedAssetAmount, minAssetAmount,
          fundedAssetAmount, fundingTxHash, failureCode, checkoutSession, transactionAttempts,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...serializeFundingIntent(record));
    return record;
  }

  async getFundingIntent(id: string): Promise<FundingIntentRecord | undefined> {
    const row = this.db.query("SELECT * FROM funding_intents WHERE id = ?").get(id);
    return row ? deserializeFundingIntent(row as FundingIntentRow) : undefined;
  }

  async getFundingIntentByClientRequestId(
    clientRequestId: string
  ): Promise<FundingIntentRecord | undefined> {
    const row = this.db
      .query("SELECT * FROM funding_intents WHERE clientRequestId = ?")
      .get(clientRequestId);
    return row ? deserializeFundingIntent(row as FundingIntentRow) : undefined;
  }

  async updateFundingIntent(record: FundingIntentRecord): Promise<FundingIntentRecord> {
    this.db
      .query(
        `UPDATE funding_intents SET
          gardenId = ?, gardenName = ?, gardenLocation = ?, destinationType = ?,
          destinationAddress = ?, fundingIntent = ?, paymentMethod = ?, availabilityKey = ?,
          clientRequestId = ?, idempotencyFingerprint = ?, amountUsd = ?, chainId = ?,
          token = ?, provider = ?, providerSessionId = ?, providerPaymentId = ?, status = ?,
          payerEmailHash = ?, receiptTokenHash = ?, quoteExpiresAt = ?, checkoutExpiresAt = ?,
          receiverAddress = ?, quotedAssetAmount = ?, minAssetAmount = ?, fundedAssetAmount = ?,
          fundingTxHash = ?, failureCode = ?, checkoutSession = ?, transactionAttempts = ?,
          createdAt = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(...serializeFundingIntentForUpdate(record));
    return record;
  }

  async appendFundingIntentEvent(
    intentId: string,
    status: FundingIntentRecord["status"],
    note: string,
    providerEventId?: string
  ): Promise<void> {
    this.db
      .query(
        `INSERT INTO funding_intent_events (id, intentId, status, note, providerEventId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        `${intentId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        intentId,
        status,
        note,
        providerEventId ?? null,
        new Date().toISOString()
      );
  }

  async listPendingFundingIntents(limit = 1000): Promise<FundingIntentRecord[]> {
    const rows = this.db
      .query(
        `SELECT * FROM funding_intents
         WHERE status IN ('started', 'pending_provider')
         ORDER BY createdAt ASC
         LIMIT ?`
      )
      .all(limit) as FundingIntentRow[];
    return rows.map((row) => deserializeFundingIntent(row));
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

export const addFeedback = (feedback: Omit<Feedback, "createdAt" | "updatedAt">) =>
  getDB().addFeedback(feedback);
export const getFeedback = (id: string) => getDB().getFeedback(id);
export const getNewFeedback = (since?: number, type?: FeedbackType) =>
  getDB().getNewFeedback(since, type);
export const updateFeedbackStatus = (id: string, status: FeedbackStatus) =>
  getDB().updateFeedbackStatus(id, status);

export const createFundingIntent = (record: FundingIntentRecord) =>
  getDB().createFundingIntent(record);
export const getFundingIntent = (id: string) => getDB().getFundingIntent(id);
export const getFundingIntentByClientRequestId = (clientRequestId: string) =>
  getDB().getFundingIntentByClientRequestId(clientRequestId);
export const updateFundingIntent = (record: FundingIntentRecord) =>
  getDB().updateFundingIntent(record);
export const appendFundingIntentEvent = (
  intentId: string,
  status: FundingIntentRecord["status"],
  note: string,
  providerEventId?: string
) => getDB().appendFundingIntentEvent(intentId, status, note, providerEventId);
export const listPendingFundingIntents = (limit?: number) =>
  getDB().listPendingFundingIntents(limit ?? 1000);

export const closeDB = async () => {
  if (!_db) return;

  await _db.close();
  _db = null;
};
