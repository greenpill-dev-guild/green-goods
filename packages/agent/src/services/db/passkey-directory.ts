import type { Database } from "bun:sqlite";

export type StoredPasskey = {
  userName: string;
  credentialId: string;
  publicKey: `0x${string}`;
  rpId: string;
  origin: string;
  createdAt: string;
};

export type PendingPasskeyRegistration = {
  challenge: string;
  userName: string;
  rpId: string;
  origin: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
};

export type PasskeyInsertResult =
  | { ok: true }
  | { ok: false; reason: "name_taken" | "credential_exists" };

/** The directory's queries, bound to one database. */
export function passkeyDirectoryQueries(db: Database) {
  return {
    findByName: (userName: string) => getPasskeyByName(db, userName),
    insert: (passkey: StoredPasskey) => insertPasskey(db, passkey),
    saveChallenge: (pending: PendingPasskeyRegistration, now: number) =>
      savePasskeyRegistrationChallenge(db, pending, now),
    takeChallenge: (challenge: string, now: number) =>
      takePasskeyRegistrationChallenge(db, challenge, now),
  };
}

function getPasskeyByName(db: Database, userName: string): StoredPasskey | undefined {
  const row = db
    .query(
      "SELECT userName, credentialId, publicKey, rpId, origin, createdAt FROM passkey_credentials WHERE userName = ?"
    )
    .get(userName) as StoredPasskey | null;
  return row ?? undefined;
}

/** A name is held by its first registration: an existing name or credential is never replaced. */
function insertPasskey(db: Database, passkey: StoredPasskey): PasskeyInsertResult {
  db.run("BEGIN IMMEDIATE");
  try {
    if (getPasskeyByName(db, passkey.userName)) {
      db.run("ROLLBACK");
      return { ok: false, reason: "name_taken" };
    }
    const sameCredential = db
      .query("SELECT 1 FROM passkey_credentials WHERE credentialId = ?")
      .get(passkey.credentialId);
    if (sameCredential) {
      db.run("ROLLBACK");
      return { ok: false, reason: "credential_exists" };
    }
    db.query(
      "INSERT INTO passkey_credentials (userName, credentialId, publicKey, rpId, origin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      passkey.userName,
      passkey.credentialId,
      passkey.publicKey,
      passkey.rpId,
      passkey.origin,
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
 * Remember a sign-up that has started. Expired challenges are removed in the same step, so
 * sign-ups nobody finishes cannot pile up.
 */
function savePasskeyRegistrationChallenge(
  db: Database,
  pending: PendingPasskeyRegistration,
  now: number
): void {
  db.query("DELETE FROM passkey_registration_challenges WHERE expiresAt <= ?").run(now);
  db.query(
    "INSERT OR REPLACE INTO passkey_registration_challenges (challenge, userName, rpId, origin, expiresAt) VALUES (?, ?, ?, ?, ?)"
  ).run(pending.challenge, pending.userName, pending.rpId, pending.origin, pending.expiresAt);
}

/** Hand out a pending registration once; an expired or unknown challenge returns nothing. */
function takePasskeyRegistrationChallenge(
  db: Database,
  challenge: string,
  now: number
): PendingPasskeyRegistration | undefined {
  db.run("BEGIN IMMEDIATE");
  try {
    db.query("DELETE FROM passkey_registration_challenges WHERE expiresAt <= ?").run(now);
    const row = db
      .query(
        "SELECT challenge, userName, rpId, origin, expiresAt FROM passkey_registration_challenges WHERE challenge = ?"
      )
      .get(challenge) as PendingPasskeyRegistration | null;
    if (row) {
      db.query("DELETE FROM passkey_registration_challenges WHERE challenge = ?").run(challenge);
    }
    db.run("COMMIT");
    return row ?? undefined;
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
