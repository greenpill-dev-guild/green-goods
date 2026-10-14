import { Database } from "bun:sqlite";
import type { OutboundResponse, Platform } from "../../types";

export interface IdempotencyRecord {
  key: string;
  handler: string;
  platform: Platform;
  platformId: string;
  messageId: string;
  status: "started" | "completed";
  response?: OutboundResponse;
  createdAt: number;
  updatedAt: number;
}

export interface ClaimIdempotencyInput {
  key: string;
  handler: string;
  platform: Platform;
  platformId: string;
  messageId: string;
}

export async function getIdempotencyRecord(
  db: Database,
  key: string
): Promise<IdempotencyRecord | undefined> {
  const row = db.query("SELECT * FROM idempotency_keys WHERE key = ?").get(key) as {
    key: string;
    handler: string;
    platform: string;
    platformId: string;
    messageId: string;
    status: string;
    response: string | null;
    createdAt: number;
    updatedAt: number;
  } | null;

  if (!row) return undefined;

  return {
    key: row.key,
    handler: row.handler,
    platform: row.platform as Platform,
    platformId: row.platformId,
    messageId: row.messageId,
    status: row.status as IdempotencyRecord["status"],
    response: row.response ? (JSON.parse(row.response) as OutboundResponse) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function claimIdempotencyKey(
  db: Database,
  input: ClaimIdempotencyInput
): Promise<boolean> {
  const existing = await getIdempotencyRecord(db, input.key);
  if (existing) return false;

  const now = Date.now();
  const result = db
    .query(
      `INSERT OR IGNORE INTO idempotency_keys (key, handler, platform, platformId, messageId, status, response, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.key,
      input.handler,
      input.platform,
      input.platformId,
      input.messageId,
      "started",
      null,
      now,
      now
    );

  return result.changes === 1;
}

export async function completeIdempotencyKey(
  db: Database,
  key: string,
  response: OutboundResponse
): Promise<void> {
  db.query("UPDATE idempotency_keys SET status = ?, response = ?, updatedAt = ? WHERE key = ?").run(
    "completed",
    JSON.stringify(response),
    Date.now(),
    key
  );
}
