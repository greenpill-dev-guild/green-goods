import type { Database } from "bun:sqlite";
import type { Address } from "@green-goods/shared/types";
import {
  decryptGardenJoinRequestRecord,
  GARDEN_JOIN_REQUEST_MAX_PENDING_PER_GARDEN,
  GARDEN_JOIN_REQUEST_RETENTION_MS,
  type CreateGardenJoinRequestRecord,
  type EncryptedGardenJoinRequest,
  type GardenJoinRequestCipher,
  type GardenJoinRequestPersonalFields,
  type ResolveGardenJoinRequestRecord,
} from "../garden-join-requests";

type StoredGardenJoinRequest = Omit<EncryptedGardenJoinRequest, "resolvedAt"> & {
  resolvedAt: string | null;
};

export function createGardenJoinRequest(
  db: Database,
  cipher: GardenJoinRequestCipher,
  id: string,
  input: CreateGardenJoinRequestRecord
) {
  const accountAddressKey = cipher.accountKey(input.accountAddress);
  db.run("BEGIN IMMEDIATE");
  try {
    const existing = findPending(db, input.gardenAddress, accountAddressKey);
    if (existing) {
      db.run("COMMIT");
      return { created: false as const, request: decrypt(cipher, existing) };
    }
    const count = db
      .query(
        "SELECT COUNT(*) AS count FROM garden_join_requests WHERE gardenAddress = ? AND state = 'pending'"
      )
      .get(input.gardenAddress) as { count: number };
    if (count.count >= GARDEN_JOIN_REQUEST_MAX_PENDING_PER_GARDEN) {
      db.run("ROLLBACK");
      return { created: false as const, full: true as const };
    }
    const encrypted = cipher.encrypt(
      JSON.stringify({
        accountAddress: input.accountAddress,
        displayName: input.displayName,
        ...(input.note ? { note: input.note } : {}),
      } satisfies GardenJoinRequestPersonalFields)
    );
    db.query(
      `INSERT INTO garden_join_requests
       (id, gardenAddress, accountAddressKey, ciphertext, nonce, kind, state, requestedVia,
        requestedAt, expiresAt, resolvedAt, updatedAt, revision)
       VALUES (?, ?, ?, ?, ?, 'garden_membership', 'pending', ?, ?, ?, NULL, ?, 0)`
    ).run(
      id,
      input.gardenAddress,
      accountAddressKey,
      encrypted.ciphertext,
      encrypted.nonce,
      input.requestedVia,
      input.requestedAt,
      input.expiresAt,
      input.requestedAt
    );
    const stored = getById(db, input.gardenAddress, id)!;
    db.run("COMMIT");
    return { created: true as const, request: decrypt(cipher, stored) };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

export function getGardenJoinRequestMine(
  db: Database,
  cipher: GardenJoinRequestCipher,
  gardenAddress: Address,
  accountAddress: Address
) {
  const row = db
    .query(
      `SELECT * FROM garden_join_requests
       WHERE gardenAddress = ? AND accountAddressKey = ?
       ORDER BY requestedAt DESC, id DESC LIMIT 1`
    )
    .get(gardenAddress, cipher.accountKey(accountAddress)) as StoredGardenJoinRequest | null;
  return row ? decrypt(cipher, row) : undefined;
}

export function getGardenJoinRequestById(
  db: Database,
  cipher: GardenJoinRequestCipher,
  gardenAddress: Address,
  requestId: string
) {
  const row = getById(db, gardenAddress, requestId);
  return row ? decrypt(cipher, row) : undefined;
}

export function listPendingGardenJoinRequests(
  db: Database,
  cipher: GardenJoinRequestCipher,
  gardenAddress: Address,
  options: { cursor?: string; limit?: number } = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const [cursorDate, cursorId] = options.cursor?.split("|") ?? [];
  const rows = (
    cursorDate && cursorId
      ? db
          .query(
            `SELECT * FROM garden_join_requests
           WHERE gardenAddress = ? AND state = 'pending'
             AND (requestedAt < ? OR (requestedAt = ? AND id < ?))
           ORDER BY requestedAt DESC, id DESC LIMIT ?`
          )
          .all(gardenAddress, cursorDate, cursorDate, cursorId, limit + 1)
      : db
          .query(
            `SELECT * FROM garden_join_requests
           WHERE gardenAddress = ? AND state = 'pending'
           ORDER BY requestedAt DESC, id DESC LIMIT ?`
          )
          .all(gardenAddress, limit + 1)
  ) as StoredGardenJoinRequest[];
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => decrypt(cipher, row)),
    ...(rows.length > limit && page.at(-1)
      ? { nextCursor: `${page.at(-1)!.requestedAt}|${page.at(-1)!.id}` }
      : {}),
  };
}

export function resolveGardenJoinRequest(
  db: Database,
  cipher: GardenJoinRequestCipher,
  input: ResolveGardenJoinRequestRecord
) {
  db.run("BEGIN IMMEDIATE");
  try {
    const existing = getById(db, input.gardenAddress, input.requestId);
    if (!existing) {
      db.run("ROLLBACK");
      return { ok: false as const, reason: "not_found" as const };
    }
    if (existing.revision !== input.expectedRevision) {
      db.run("ROLLBACK");
      return { ok: false as const, reason: "revision_conflict" as const };
    }
    if (existing.state !== "pending") {
      db.run("ROLLBACK");
      return { ok: false as const, reason: "not_pending" as const };
    }
    const personal = JSON.parse(
      cipher.decrypt({ ciphertext: existing.ciphertext, nonce: existing.nonce })
    ) as GardenJoinRequestPersonalFields;
    const encrypted = cipher.encrypt(
      JSON.stringify({
        ...personal,
        ...(input.state === "declined" && input.reason ? { reason: input.reason } : {}),
      } satisfies GardenJoinRequestPersonalFields)
    );
    db.query(
      `UPDATE garden_join_requests
       SET ciphertext = ?, nonce = ?, state = ?, resolvedAt = ?, updatedAt = ?, revision = revision + 1
       WHERE id = ? AND gardenAddress = ? AND revision = ? AND state = 'pending'`
    ).run(
      encrypted.ciphertext,
      encrypted.nonce,
      input.state,
      input.resolvedAt,
      input.resolvedAt,
      input.requestId,
      input.gardenAddress,
      input.expectedRevision
    );
    const updated = getById(db, input.gardenAddress, input.requestId)!;
    db.run("COMMIT");
    return { ok: true as const, request: decrypt(cipher, updated) };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

export function reconcileWelcomedGardenJoinRequest(
  db: Database,
  cipher: GardenJoinRequestCipher,
  gardenAddress: Address,
  requestId: string,
  resolvedAt: string
) {
  const existing = getById(db, gardenAddress, requestId);
  if (!existing) return undefined;
  if (existing.state === "welcomed") return decrypt(cipher, existing);
  db.query(
    `UPDATE garden_join_requests
     SET state = 'welcomed', resolvedAt = ?, updatedAt = ?, revision = revision + 1
     WHERE id = ? AND gardenAddress = ?`
  ).run(resolvedAt, resolvedAt, requestId, gardenAddress);
  const updated = getById(db, gardenAddress, requestId);
  return updated ? decrypt(cipher, updated) : undefined;
}

export function claimGardenJoinRequestProof(db: Database, nonce: string, expiresAt: string) {
  const result = db
    .query("INSERT OR IGNORE INTO garden_join_request_proofs (nonce, expiresAt) VALUES (?, ?)")
    .run(nonce, expiresAt);
  return result.changes > 0;
}

export function withdrawGardenJoinRequest(
  db: Database,
  cipher: GardenJoinRequestCipher,
  gardenAddress: Address,
  accountAddress: Address
) {
  const result = db
    .query(
      `DELETE FROM garden_join_requests
       WHERE gardenAddress = ? AND accountAddressKey = ? AND state = 'pending'`
    )
    .run(gardenAddress, cipher.accountKey(accountAddress));
  return result.changes > 0;
}

export function sweepGardenJoinRequests(db: Database, nowIso: string) {
  const resolvedCutoff = new Date(
    Date.parse(nowIso) - GARDEN_JOIN_REQUEST_RETENTION_MS
  ).toISOString();
  const result = db
    .query(
      `DELETE FROM garden_join_requests
       WHERE (state = 'pending' AND expiresAt <= ?)
          OR (state != 'pending' AND resolvedAt IS NOT NULL AND resolvedAt <= ?)`
    )
    .run(nowIso, resolvedCutoff);
  db.query("DELETE FROM garden_join_request_proofs WHERE expiresAt <= ?").run(nowIso);
  return { deleted: result.changes };
}

function getById(db: Database, gardenAddress: Address, requestId: string) {
  return (
    (db
      .query("SELECT * FROM garden_join_requests WHERE gardenAddress = ? AND id = ?")
      .get(gardenAddress, requestId) as StoredGardenJoinRequest | null) ?? undefined
  );
}

function findPending(db: Database, gardenAddress: Address, accountAddressKey: string) {
  return (
    (db
      .query(
        "SELECT * FROM garden_join_requests WHERE gardenAddress = ? AND accountAddressKey = ? AND state = 'pending'"
      )
      .get(gardenAddress, accountAddressKey) as StoredGardenJoinRequest | null) ?? undefined
  );
}

function decrypt(cipher: GardenJoinRequestCipher, row: StoredGardenJoinRequest) {
  const { resolvedAt, ...record } = row;
  return decryptGardenJoinRequestRecord(cipher, {
    ...record,
    ...(resolvedAt ? { resolvedAt } : {}),
  });
}

function rollback(db: Database): void {
  try {
    db.run("ROLLBACK");
  } catch {
    // Keep the original failure.
  }
}
