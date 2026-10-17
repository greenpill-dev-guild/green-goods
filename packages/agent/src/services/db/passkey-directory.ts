import type { Database } from "bun:sqlite";

/** Where a directory entry came from: a sign-up here, or an older account brought in. */
export type PasskeySource = "registered" | "adopted";

export type StoredPasskey = {
  userName: string;
  /** The exact ID string the account was made with. Kernel hashes it, so it is never re-encoded. */
  credentialId: string;
  /** The credential's bytes in base64url: the browser's ID, which a ceremony asks for. */
  credentialKey: string;
  publicKey: `0x${string}`;
  rpId: string;
  origin: string;
  source: PasskeySource;
  createdAt: string;
};

/** What a stored challenge answers, so a challenge of one kind can never complete the other. */
export type PasskeyChallengePurpose = "registration" | "adoption";

export type PendingPasskeyRegistration = {
  challenge: string;
  purpose: PasskeyChallengePurpose;
  userName: string;
  rpId: string;
  origin: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
};

export type PasskeyInsertResult =
  | { ok: true }
  | { ok: false; reason: "name_taken" | "credential_exists" };

/**
 * A P-256 key in the one spelling the directory stores: 0x04, then lowercase x and y. The same
 * point written without 04, or in another case, is the same key, so one account must not hold a
 * second name through its key's spelling.
 */
export function storedPasskeyPublicKey(publicKey: string): `0x${string}` {
  const hex = publicKey.replace(/^0x/i, "").toLowerCase();
  if (/^[0-9a-f]{128}$/.test(hex)) return `0x04${hex}`;
  if (/^04[0-9a-f]{128}$/.test(hex)) return `0x${hex}`;
  throw new Error("Passkey public key is not an uncompressed P-256 point");
}

/** The directory's queries, bound to one database. */
export function passkeyDirectoryQueries(db: Database) {
  return {
    findByName: (userName: string) => getPasskeyByName(db, userName),
    insert: (passkey: StoredPasskey) => insertPasskey(db, passkey),
    saveChallenge: (pending: PendingPasskeyRegistration, now: number) =>
      savePasskeyRegistrationChallenge(db, pending, now),
    takeChallenge: (challenge: string, now: number, purpose: PasskeyChallengePurpose) =>
      takePasskeyRegistrationChallenge(db, challenge, now, purpose),
  };
}

const PASSKEY_COLUMNS =
  "userName, credentialId, credentialKey, publicKey, rpId, origin, source, createdAt";

function getPasskeyByName(db: Database, userName: string): StoredPasskey | undefined {
  const row = db
    .query(`SELECT ${PASSKEY_COLUMNS} FROM passkey_credentials WHERE userName = ?`)
    .get(userName) as StoredPasskey | null;
  return row ?? undefined;
}

/**
 * A name is held by its first registration, and an account (its exact ID string with its key) by
 * one name. Neither is ever replaced. The other spelling of one passkey is another account.
 */
function insertPasskey(db: Database, passkey: StoredPasskey): PasskeyInsertResult {
  const publicKey = storedPasskeyPublicKey(passkey.publicKey);
  db.run("BEGIN IMMEDIATE");
  try {
    if (getPasskeyByName(db, passkey.userName)) {
      db.run("ROLLBACK");
      return { ok: false, reason: "name_taken" };
    }
    const sameAccount = db
      .query("SELECT 1 FROM passkey_credentials WHERE credentialId = ? AND publicKey = ?")
      .get(passkey.credentialId, publicKey);
    if (sameAccount) {
      db.run("ROLLBACK");
      return { ok: false, reason: "credential_exists" };
    }
    db.query(
      `INSERT INTO passkey_credentials (${PASSKEY_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      passkey.userName,
      passkey.credentialId,
      passkey.credentialKey,
      publicKey,
      passkey.rpId,
      passkey.origin,
      passkey.source,
      passkey.createdAt
    );
    db.run("COMMIT");
    return { ok: true };
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

/**
 * Remember a ceremony that has started. Expired challenges are removed in the same step, so
 * ceremonies nobody finishes cannot pile up.
 */
function savePasskeyRegistrationChallenge(
  db: Database,
  pending: PendingPasskeyRegistration,
  now: number
): void {
  db.query("DELETE FROM passkey_registration_challenges WHERE expiresAt <= ?").run(now);
  db.query(
    "INSERT OR REPLACE INTO passkey_registration_challenges (challenge, purpose, userName, rpId, origin, expiresAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    pending.challenge,
    pending.purpose,
    pending.userName,
    pending.rpId,
    pending.origin,
    pending.expiresAt
  );
}

/**
 * Hand out a pending challenge once, and only for its own purpose. The challenge is spent either
 * way; an expired, unknown or mismatched challenge returns nothing.
 */
function takePasskeyRegistrationChallenge(
  db: Database,
  challenge: string,
  now: number,
  purpose: PasskeyChallengePurpose
): PendingPasskeyRegistration | undefined {
  db.run("BEGIN IMMEDIATE");
  try {
    db.query("DELETE FROM passkey_registration_challenges WHERE expiresAt <= ?").run(now);
    const row = db
      .query(
        "SELECT challenge, purpose, userName, rpId, origin, expiresAt FROM passkey_registration_challenges WHERE challenge = ?"
      )
      .get(challenge) as PendingPasskeyRegistration | null;
    if (row) {
      db.query("DELETE FROM passkey_registration_challenges WHERE challenge = ?").run(challenge);
    }
    db.run("COMMIT");
    return row?.purpose === purpose ? row : undefined;
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

function rollbackQuietly(db: Database): void {
  try {
    db.run("ROLLBACK");
  } catch {
    // SQLite may already have rolled the transaction back.
  }
}
