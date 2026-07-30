import type { ProfileAvatarRecord } from "@green-goods/shared/profile-avatar/protocol";
import type { Address } from "@green-goods/shared/types";
import type { Database } from "bun:sqlite";

type StoredProfileAvatar = {
  chainId: number;
  address: string;
  avatarUri: string | null;
  version: number;
  updatedAt: string;
};

export function getProfileAvatar(
  db: Database,
  chainId: number,
  address: Address
): ProfileAvatarRecord | undefined {
  const row = db
    .query(
      "SELECT chainId, address, avatarUri, version, updatedAt FROM profile_avatars WHERE chainId = ? AND address = ?"
    )
    .get(chainId, address) as StoredProfileAvatar | null;
  return row ? toRecord(row) : undefined;
}

export function compareAndSwapProfileAvatar(
  db: Database,
  input: {
    chainId: number;
    address: Address;
    avatarUri: string | null;
    expectedVersion: number;
    updatedAt: string;
  }
): { ok: true; record: ProfileAvatarRecord } | { ok: false; record?: ProfileAvatarRecord } {
  db.run("BEGIN IMMEDIATE");
  try {
    const existing = getProfileAvatar(db, input.chainId, input.address);
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== input.expectedVersion) {
      db.run("ROLLBACK");
      return { ok: false, record: existing };
    }

    const record: ProfileAvatarRecord = {
      chainId: input.chainId,
      address: input.address,
      avatarUri: input.avatarUri,
      version: currentVersion + 1,
      updatedAt: input.updatedAt,
    };
    if (existing) {
      db.query(
        "UPDATE profile_avatars SET avatarUri = ?, version = ?, updatedAt = ? WHERE chainId = ? AND address = ? AND version = ?"
      ).run(
        record.avatarUri,
        record.version,
        record.updatedAt,
        record.chainId,
        record.address,
        currentVersion
      );
    } else {
      db.query(
        "INSERT INTO profile_avatars (chainId, address, avatarUri, version, updatedAt) VALUES (?, ?, ?, ?, ?)"
      ).run(record.chainId, record.address, record.avatarUri, record.version, record.updatedAt);
    }
    db.run("COMMIT");
    return { ok: true, record };
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch {
      // The transaction may already have been rolled back by SQLite.
    }
    throw error;
  }
}

function toRecord(row: StoredProfileAvatar): ProfileAvatarRecord {
  return {
    chainId: row.chainId,
    address: row.address.toLowerCase() as Address,
    avatarUri: row.avatarUri,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}
