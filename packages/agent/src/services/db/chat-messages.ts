import { Database } from "bun:sqlite";
import type {
  CaptureType,
  ChatMessage,
  ChatMessageAttachment,
  ChatMessageStatus,
  NewChatMessageAttachmentInput,
  NewChatMessageInput,
} from "../../types";
import {
  type ChatMessageAttachmentRow,
  type ChatMessageRow,
  deserializeChatMessage,
  deserializeChatMessageAttachment,
} from "./serializers";

export interface ChatMessageFilter {
  chatId?: string;
  threadId?: string;
  since?: number;
  status?: ChatMessageStatus | "all";
  inferredType?: CaptureType;
  limit?: number;
}

export async function addChatMessage(
  db: Database,
  input: NewChatMessageInput,
  attachments: NewChatMessageAttachmentInput[] = []
): Promise<ChatMessage> {
  const now = Date.now();
  const persistedAttachments: ChatMessageAttachment[] = [];

  try {
    db.run("BEGIN");

    db.query(
      `INSERT INTO chat_messages (
           id, platform, chatId, threadId, messageId, senderPlatformId, senderDisplayName,
           text, replyToMessageId, inferredType, status, postedAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`
    ).run(
      input.id,
      input.platform,
      input.chatId,
      input.threadId ?? null,
      input.messageId,
      input.senderPlatformId,
      input.senderDisplayName ?? null,
      input.text,
      input.replyToMessageId ?? null,
      input.inferredType,
      input.postedAt,
      now
    );

    for (const att of attachments) {
      const attachmentId = `${input.id}:${att.ordinal}`;
      db.query(
        `INSERT INTO chat_message_attachments (
             id, chatMessageId, ordinal, kind, telegramFileId, mimeType,
             fileSize, duration, width, height, createdAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        attachmentId,
        input.id,
        att.ordinal,
        att.kind,
        att.telegramFileId,
        att.mimeType ?? null,
        att.fileSize ?? null,
        att.duration ?? null,
        att.width ?? null,
        att.height ?? null,
        now
      );
      persistedAttachments.push({
        id: attachmentId,
        chatMessageId: input.id,
        ordinal: att.ordinal,
        kind: att.kind,
        telegramFileId: att.telegramFileId,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        duration: att.duration,
        width: att.width,
        height: att.height,
        createdAt: now,
      });
    }

    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch {
      // Ignore rollback failure; preserve the original insert error.
    }
    throw error;
  }

  return {
    id: input.id,
    platform: input.platform,
    chatId: input.chatId,
    threadId: input.threadId,
    messageId: input.messageId,
    senderPlatformId: input.senderPlatformId,
    senderDisplayName: input.senderDisplayName,
    text: input.text,
    replyToMessageId: input.replyToMessageId,
    inferredType: input.inferredType,
    status: "new",
    postedAt: input.postedAt,
    updatedAt: now,
    attachments: persistedAttachments,
  };
}

export async function getChatMessage(db: Database, id: string): Promise<ChatMessage | undefined> {
  const row = db.query("SELECT * FROM chat_messages WHERE id = ?").get(id) as ChatMessageRow | null;
  if (!row) return undefined;
  const attachments = queryAttachmentsFor(db, [row.id]);
  return deserializeChatMessage(row, attachments.get(row.id) ?? []);
}

export async function getNewChatMessages(
  db: Database,
  filter: ChatMessageFilter
): Promise<ChatMessage[]> {
  const status = filter.status ?? "new";
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (status !== "all") {
    clauses.push("status = ?");
    params.push(status);
  }
  if (filter.chatId) {
    clauses.push("chatId = ?");
    params.push(filter.chatId);
  }
  if (filter.threadId) {
    clauses.push("threadId = ?");
    params.push(filter.threadId);
  }
  if (filter.inferredType) {
    clauses.push("inferredType = ?");
    params.push(filter.inferredType);
  }
  if (filter.since !== undefined) {
    clauses.push("postedAt >= ?");
    params.push(filter.since);
  }

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT * FROM chat_messages${where} ORDER BY postedAt ASC LIMIT ?`;
  params.push(limit);

  const rows = db.query(sql).all(...params) as ChatMessageRow[];
  if (rows.length === 0) return [];

  const attachments = queryAttachmentsFor(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => deserializeChatMessage(row, attachments.get(row.id) ?? []));
}

export async function updateChatMessageStatus(
  db: Database,
  id: string,
  status: ChatMessageStatus
): Promise<void> {
  db.query("UPDATE chat_messages SET status = ?, updatedAt = ? WHERE id = ?").run(
    status,
    Date.now(),
    id
  );
}

export async function claimChatMessage(
  db: Database,
  id: string,
  staleProcessingBefore: number,
  now = Date.now()
): Promise<boolean> {
  const result = db
    .query(
      `UPDATE chat_messages
       SET status = 'processing', updatedAt = ?
       WHERE id = ? AND (status = 'new' OR (status = 'processing' AND updatedAt < ?))`
    )
    .run(now, id, staleProcessingBefore);

  return result.changes > 0;
}

export async function getChatMessageAttachment(
  db: Database,
  chatMessageId: string,
  ordinal: number
): Promise<ChatMessageAttachment | undefined> {
  const row = db
    .query("SELECT * FROM chat_message_attachments WHERE chatMessageId = ? AND ordinal = ?")
    .get(chatMessageId, ordinal) as ChatMessageAttachmentRow | null;
  if (!row) return undefined;
  return deserializeChatMessageAttachment(row);
}

/**
 * Delete terminal chat_messages rows older than `cutoffMs`.
 * Cascade deletes attachments via the FK constraint.
 *
 * Stale `new` rows signal a routine outage. Stale `processing` rows signal a
 * crashed run and can be reclaimed by PATCHing `processing` after the lock
 * timeout.
 */
export async function sweepStaleChatMessages(
  db: Database,
  cutoffMs: number
): Promise<{
  pruned: number;
  staleNew: number;
  staleProcessing: number;
}> {
  const prunableRows = db
    .query("SELECT id FROM chat_messages WHERE status IN ('triaged', 'rejected') AND postedAt < ?")
    .all(cutoffMs) as Array<{ id: string }>;

  db.query(
    "DELETE FROM chat_messages WHERE status IN ('triaged', 'rejected') AND postedAt < ?"
  ).run(cutoffMs);

  const staleNewRow = db
    .query("SELECT COUNT(*) AS count FROM chat_messages WHERE status = 'new' AND postedAt < ?")
    .get(cutoffMs) as { count: number } | null;

  const staleProcessingRow = db
    .query(
      "SELECT COUNT(*) AS count FROM chat_messages WHERE status = 'processing' AND updatedAt < ?"
    )
    .get(cutoffMs) as { count: number } | null;

  return {
    pruned: prunableRows.length,
    staleNew: staleNewRow?.count ?? 0,
    staleProcessing: staleProcessingRow?.count ?? 0,
  };
}

function queryAttachmentsFor(
  db: Database,
  messageIds: string[]
): Map<string, ChatMessageAttachment[]> {
  const byMessage = new Map<string, ChatMessageAttachment[]>();
  if (messageIds.length === 0) return byMessage;

  const placeholders = messageIds.map(() => "?").join(", ");
  const rows = db
    .query(
      `SELECT * FROM chat_message_attachments WHERE chatMessageId IN (${placeholders}) ORDER BY chatMessageId, ordinal ASC`
    )
    .all(...messageIds) as ChatMessageAttachmentRow[];

  for (const row of rows) {
    const list = byMessage.get(row.chatMessageId) ?? [];
    list.push(deserializeChatMessageAttachment(row));
    byMessage.set(row.chatMessageId, list);
  }
  return byMessage;
}
