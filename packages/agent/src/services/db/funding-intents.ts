import { Database } from "bun:sqlite";
import type { FundingIntentRecord } from "../funding-intents";
import {
  deserializeFundingIntent,
  type FundingIntentRow,
  serializeFundingIntent,
  serializeFundingIntentForUpdate,
} from "./serializers";

export async function createFundingIntent(
  db: Database,
  record: FundingIntentRecord
): Promise<FundingIntentRecord> {
  db.query(
    `INSERT INTO funding_intents (
        id, gardenId, gardenName, gardenLocation, destinationType, destinationAddress,
        fundingIntent, paymentMethod, availabilityKey, clientRequestId, idempotencyFingerprint,
        amountUsd, chainId, token, provider, providerSessionId, providerPaymentId, status,
        payerEmailHash, receiptTokenHash,
        quoteExpiresAt, checkoutExpiresAt, receiverAddress, sourceRoute, managementUrl,
        quotedAssetAmount, minAssetAmount,
        fundedAssetAmount, fundingTxHash, failureCode, checkoutSession, transactionAttempts,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(...serializeFundingIntent(record));
  return record;
}

export async function getFundingIntent(
  db: Database,
  id: string
): Promise<FundingIntentRecord | undefined> {
  const row = db.query("SELECT * FROM funding_intents WHERE id = ?").get(id);
  return row ? deserializeFundingIntent(row as FundingIntentRow) : undefined;
}

export async function getFundingIntentByClientRequestId(
  db: Database,
  clientRequestId: string
): Promise<FundingIntentRecord | undefined> {
  const row = db
    .query("SELECT * FROM funding_intents WHERE clientRequestId = ?")
    .get(clientRequestId);
  return row ? deserializeFundingIntent(row as FundingIntentRow) : undefined;
}

export async function updateFundingIntent(
  db: Database,
  record: FundingIntentRecord
): Promise<FundingIntentRecord> {
  db.query(
    `UPDATE funding_intents SET
        gardenId = ?, gardenName = ?, gardenLocation = ?, destinationType = ?,
        destinationAddress = ?, fundingIntent = ?, paymentMethod = ?, availabilityKey = ?,
        clientRequestId = ?, idempotencyFingerprint = ?, amountUsd = ?, chainId = ?,
        token = ?, provider = ?, providerSessionId = ?, providerPaymentId = ?, status = ?,
        payerEmailHash = ?, receiptTokenHash = ?, quoteExpiresAt = ?, checkoutExpiresAt = ?,
        receiverAddress = ?, sourceRoute = ?, managementUrl = ?, quotedAssetAmount = ?,
        minAssetAmount = ?, fundedAssetAmount = ?, fundingTxHash = ?, failureCode = ?,
        checkoutSession = ?, transactionAttempts = ?, createdAt = ?, updatedAt = ?
       WHERE id = ?`
  ).run(...serializeFundingIntentForUpdate(record));
  return record;
}

export async function appendFundingIntentEvent(
  db: Database,
  intentId: string,
  status: FundingIntentRecord["status"],
  note: string,
  providerEventId?: string
): Promise<void> {
  db.query(
    `INSERT INTO funding_intent_events (id, intentId, status, note, providerEventId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `${intentId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    intentId,
    status,
    note,
    providerEventId ?? null,
    new Date().toISOString()
  );
}

export async function listPendingFundingIntents(
  db: Database,
  limit = 1000
): Promise<FundingIntentRecord[]> {
  const rows = db
    .query(
      `SELECT * FROM funding_intents
       WHERE status IN ('started', 'pending_provider')
       ORDER BY createdAt ASC
       LIMIT ?`
    )
    .all(limit) as FundingIntentRow[];
  return rows.map((row) => deserializeFundingIntent(row));
}
