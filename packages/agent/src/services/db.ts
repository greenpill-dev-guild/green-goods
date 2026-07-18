/**
 * Database Service (SQLite)
 *
 * Direct database operations. No interface abstraction.
 */

import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";
import type {
  ChatMessageStatus,
  CreateUserInput,
  NewChatMessageAttachmentInput,
  NewChatMessageInput,
  OutboundResponse,
  PendingWork,
  Platform,
  Session,
  User,
} from "../types";
import * as chatMessages from "./db/chat-messages";
import * as fundingIntents from "./db/funding-intents";
import * as idempotency from "./db/idempotency";
import { type ClaimIdempotencyInput, type IdempotencyRecord } from "./db/idempotency";
import * as pendingWork from "./db/pending-work";
import { initSchema } from "./db/schema";
import * as sessions from "./db/sessions";
import * as users from "./db/users";
import type { FundingIntentRecord } from "./funding-intents";

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
    // SQLite defaults FK enforcement off, which silently breaks
    // ON DELETE CASCADE for chat_message_attachments. Turn it on per
    // connection — there's no persistent setting.
    this.db.run("PRAGMA foreign_keys = ON");
    initSchema(this.db);
  }

  // ===========================================================================
  // USERS
  // ===========================================================================

  async getUser(platform: Platform, platformId: string) {
    return users.getUser(this.db, platform, platformId);
  }

  async createUser(input: CreateUserInput) {
    return users.createUser(this.db, input);
  }

  async updateUser(
    platform: Platform,
    platformId: string,
    update: Partial<Pick<User, "currentGarden" | "role" | "locale">>
  ) {
    return users.updateUser(this.db, platform, platformId, update);
  }

  async getOperatorForGarden(gardenAddress: string) {
    return users.getOperatorForGarden(this.db, gardenAddress);
  }

  // ===========================================================================
  // SESSIONS
  // ===========================================================================

  async getSession(platform: Platform, platformId: string) {
    return sessions.getSession(this.db, platform, platformId);
  }

  async setSession(session: Session) {
    return sessions.setSession(this.db, session);
  }

  async clearSession(platform: Platform, platformId: string) {
    return sessions.clearSession(this.db, platform, platformId);
  }

  // ===========================================================================
  // PENDING WORK
  // ===========================================================================

  async addPendingWork(work: Omit<PendingWork, "createdAt">) {
    return pendingWork.addPendingWork(this.db, work);
  }

  async getPendingWork(id: string) {
    return pendingWork.getPendingWork(this.db, id);
  }

  async getPendingWorksForGarden(gardenAddress: string) {
    return pendingWork.getPendingWorksForGarden(this.db, gardenAddress);
  }

  async removePendingWork(id: string) {
    return pendingWork.removePendingWork(this.db, id);
  }

  // ===========================================================================
  // IDEMPOTENCY
  // ===========================================================================

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | undefined> {
    return idempotency.getIdempotencyRecord(this.db, key);
  }

  async claimIdempotencyKey(input: ClaimIdempotencyInput) {
    return idempotency.claimIdempotencyKey(this.db, input);
  }

  async completeIdempotencyKey(key: string, response: OutboundResponse) {
    return idempotency.completeIdempotencyKey(this.db, key, response);
  }

  // ===========================================================================
  // CHAT MESSAGES (silent topic capture)
  // ===========================================================================

  async addChatMessage(
    input: NewChatMessageInput,
    attachments: NewChatMessageAttachmentInput[] = []
  ) {
    return chatMessages.addChatMessage(this.db, input, attachments);
  }

  async getChatMessage(id: string) {
    return chatMessages.getChatMessage(this.db, id);
  }

  async getNewChatMessages(filter: chatMessages.ChatMessageFilter) {
    return chatMessages.getNewChatMessages(this.db, filter);
  }

  async updateChatMessageStatus(id: string, status: ChatMessageStatus) {
    return chatMessages.updateChatMessageStatus(this.db, id, status);
  }

  async claimChatMessage(id: string, staleProcessingBefore: number, now = Date.now()) {
    return chatMessages.claimChatMessage(this.db, id, staleProcessingBefore, now);
  }

  async getChatMessageAttachment(chatMessageId: string, ordinal: number) {
    return chatMessages.getChatMessageAttachment(this.db, chatMessageId, ordinal);
  }

  async sweepStaleChatMessages(cutoffMs: number) {
    return chatMessages.sweepStaleChatMessages(this.db, cutoffMs);
  }

  // ===========================================================================
  // FUNDING INTENTS
  // ===========================================================================

  async createFundingIntent(record: FundingIntentRecord) {
    return fundingIntents.createFundingIntent(this.db, record);
  }

  async getFundingIntent(id: string) {
    return fundingIntents.getFundingIntent(this.db, id);
  }

  async getFundingIntentByClientRequestId(clientRequestId: string) {
    return fundingIntents.getFundingIntentByClientRequestId(this.db, clientRequestId);
  }

  async updateFundingIntent(record: FundingIntentRecord) {
    return fundingIntents.updateFundingIntent(this.db, record);
  }

  async appendFundingIntentEvent(
    intentId: string,
    status: FundingIntentRecord["status"],
    note: string,
    providerEventId?: string
  ) {
    return fundingIntents.appendFundingIntentEvent(
      this.db,
      intentId,
      status,
      note,
      providerEventId
    );
  }

  async listPendingFundingIntents(limit = 1000) {
    return fundingIntents.listPendingFundingIntents(this.db, limit);
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

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
  update: Partial<Pick<User, "currentGarden" | "role" | "locale">>
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

export const getIdempotencyRecord = (key: string) => getDB().getIdempotencyRecord(key);
export const claimIdempotencyKey = (input: ClaimIdempotencyInput) =>
  getDB().claimIdempotencyKey(input);
export const completeIdempotencyKey = (key: string, response: OutboundResponse) =>
  getDB().completeIdempotencyKey(key, response);

export const addChatMessage = (
  input: NewChatMessageInput,
  attachments?: NewChatMessageAttachmentInput[]
) => getDB().addChatMessage(input, attachments);
export const getChatMessage = (id: string) => getDB().getChatMessage(id);
export const getNewChatMessages = (filter: Parameters<DB["getNewChatMessages"]>[0]) =>
  getDB().getNewChatMessages(filter);
export const updateChatMessageStatus = (id: string, status: ChatMessageStatus) =>
  getDB().updateChatMessageStatus(id, status);
export const claimChatMessage = (id: string, staleProcessingBefore: number, now?: number) =>
  getDB().claimChatMessage(id, staleProcessingBefore, now);
export const getChatMessageAttachment = (chatMessageId: string, ordinal: number) =>
  getDB().getChatMessageAttachment(chatMessageId, ordinal);
export const sweepStaleChatMessages = (cutoffMs: number) =>
  getDB().sweepStaleChatMessages(cutoffMs);

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
