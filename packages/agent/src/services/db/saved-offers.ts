import {
  SAVED_OFFER_MAX_RECORDS_PER_OWNER,
  type SavedOfferPayloadV1,
  type SavedOfferRecord,
} from "@green-goods/shared/public-contracts";
import type { Address } from "@green-goods/shared/types";
import type { Database } from "bun:sqlite";
import type { SavedOfferCipher } from "../saved-offers";

type StoredSavedOffer = {
  chainId: number;
  owner: string;
  savedOfferId: string;
  ciphertext: string;
  nonce: string;
  version: number;
  updatedAt: string;
  deleted: number;
};

export type SavedOfferCasInput = {
  chainId: number;
  owner: Address;
  savedOfferId: string;
  payload: string;
  expectedVersion: number;
  updatedAt: string;
};

export function getSavedOffer(
  db: Database,
  cipher: SavedOfferCipher,
  chainId: number,
  owner: Address,
  savedOfferId: string
): SavedOfferRecord | undefined {
  const row = getStoredSavedOffer(db, chainId, owner, savedOfferId);
  return row && row.deleted === 0 ? decryptRecord(cipher, row) : undefined;
}

export function listSavedOffers(
  db: Database,
  cipher: SavedOfferCipher,
  chainId: number,
  owner: Address
): SavedOfferRecord[] {
  const rows = db
    .query(
      `SELECT chainId, owner, savedOfferId, ciphertext, nonce, version, updatedAt, deleted
       FROM saved_offers
       WHERE chainId = ? AND owner = ? AND deleted = 0
       ORDER BY updatedAt DESC, savedOfferId ASC`
    )
    .all(chainId, owner.toLowerCase()) as StoredSavedOffer[];
  return rows.map((row) => decryptRecord(cipher, row));
}

export function compareAndSwapSavedOffer(
  db: Database,
  cipher: SavedOfferCipher,
  input: SavedOfferCasInput
):
  | { ok: true; record: SavedOfferRecord }
  | { ok: false; currentVersion: number; reason?: "owner_limit_exceeded" } {
  db.run("BEGIN IMMEDIATE");
  try {
    const existing = getStoredSavedOffer(db, input.chainId, input.owner, input.savedOfferId);
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== input.expectedVersion) {
      db.run("ROLLBACK");
      return { ok: false, currentVersion };
    }
    if (!existing || existing.deleted !== 0) {
      const countRow = db
        .query(
          `SELECT COUNT(*) AS count FROM saved_offers
           WHERE chainId = ? AND owner = ? AND deleted = 0`
        )
        .get(input.chainId, input.owner.toLowerCase()) as { count: number } | null;
      const count = countRow?.count ?? 0;
      if (count >= SAVED_OFFER_MAX_RECORDS_PER_OWNER) {
        db.run("ROLLBACK");
        return { ok: false, currentVersion, reason: "owner_limit_exceeded" };
      }
    }
    const encrypted = cipher.encrypt(input.payload);
    const nextVersion = currentVersion + 1;
    if (existing) {
      db.query(
        `UPDATE saved_offers
         SET ciphertext = ?, nonce = ?, version = ?, updatedAt = ?, deleted = 0
         WHERE chainId = ? AND owner = ? AND savedOfferId = ? AND version = ?`
      ).run(
        encrypted.ciphertext,
        encrypted.nonce,
        nextVersion,
        input.updatedAt,
        input.chainId,
        input.owner.toLowerCase(),
        input.savedOfferId,
        currentVersion
      );
    } else {
      db.query(
        `INSERT INTO saved_offers
         (chainId, owner, savedOfferId, ciphertext, nonce, version, updatedAt, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(
        input.chainId,
        input.owner.toLowerCase(),
        input.savedOfferId,
        encrypted.ciphertext,
        encrypted.nonce,
        nextVersion,
        input.updatedAt
      );
    }
    db.run("COMMIT");
    return {
      ok: true,
      record: {
        savedOfferId: input.savedOfferId,
        payload: JSON.parse(input.payload) as SavedOfferPayloadV1,
        version: nextVersion,
        updatedAt: input.updatedAt,
      },
    };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

export function tombstoneSavedOffer(
  db: Database,
  input: {
    chainId: number;
    owner: Address;
    savedOfferId: string;
    expectedVersion: number;
    updatedAt: string;
  }
):
  | { ok: true; version: number }
  | { ok: false; reason: "not_found" | "version_conflict"; currentVersion: number } {
  db.run("BEGIN IMMEDIATE");
  try {
    const existing = getStoredSavedOffer(db, input.chainId, input.owner, input.savedOfferId);
    const currentVersion = existing?.version ?? 0;
    if (!existing || existing.deleted !== 0) {
      db.run("ROLLBACK");
      return { ok: false, reason: "not_found", currentVersion };
    }
    if (currentVersion !== input.expectedVersion) {
      db.run("ROLLBACK");
      return { ok: false, reason: "version_conflict", currentVersion };
    }
    const version = currentVersion + 1;
    db.query(
      `UPDATE saved_offers
       SET ciphertext = '', nonce = '', version = ?, updatedAt = ?, deleted = 1
       WHERE chainId = ? AND owner = ? AND savedOfferId = ? AND version = ?`
    ).run(
      version,
      input.updatedAt,
      input.chainId,
      input.owner.toLowerCase(),
      input.savedOfferId,
      currentVersion
    );
    db.run("COMMIT");
    return { ok: true, version };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

function getStoredSavedOffer(
  db: Database,
  chainId: number,
  owner: Address,
  savedOfferId: string
): StoredSavedOffer | undefined {
  return (
    (db
      .query(
        `SELECT chainId, owner, savedOfferId, ciphertext, nonce, version, updatedAt, deleted
         FROM saved_offers
         WHERE chainId = ? AND owner = ? AND savedOfferId = ?`
      )
      .get(chainId, owner.toLowerCase(), savedOfferId) as StoredSavedOffer | null) ?? undefined
  );
}

function decryptRecord(cipher: SavedOfferCipher, row: StoredSavedOffer): SavedOfferRecord {
  return {
    savedOfferId: row.savedOfferId,
    payload: JSON.parse(
      cipher.decrypt({ ciphertext: row.ciphertext, nonce: row.nonce })
    ) as SavedOfferPayloadV1,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function rollback(db: Database): void {
  try {
    db.run("ROLLBACK");
  } catch {
    // SQLite may already have rolled back the transaction.
  }
}
