import { Database } from "bun:sqlite";
import type { CreateUserInput, Platform, User } from "../../types";
import { getPrivateKey, isValidAddress, isValidPrivateKey, prepareKeyForStorage } from "../crypto";
import { loggers } from "../logger";

const log = loggers.db;

interface UserRow {
  platform: string;
  platformId: string;
  privateKey: string;
  address: string;
  currentGarden: string | null;
  role: string | null;
  locale: string | null;
  createdAt: number;
}

export async function getUser(
  db: Database,
  platform: Platform,
  platformId: string
): Promise<User | undefined> {
  const row = db
    .query("SELECT * FROM users WHERE platform = ? AND platformId = ?")
    .get(platform, platformId) as UserRow | null;

  if (!row) return undefined;

  const { privateKey, needsMigration } = getPrivateKey(row.privateKey);
  if (needsMigration) {
    await migrateUserKey(db, platform, platformId, privateKey);
  }

  return toUser(row, privateKey);
}

export async function createUser(db: Database, input: CreateUserInput): Promise<User> {
  if (!isValidPrivateKey(input.privateKey)) {
    throw new Error("Invalid private key format");
  }
  if (!isValidAddress(input.address)) {
    throw new Error("Invalid address format");
  }

  const encryptedKey = prepareKeyForStorage(input.privateKey);
  const createdAt = Date.now();

  db.query(
    `INSERT INTO users (platform, platformId, privateKey, address, currentGarden, role, locale, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.platform,
    input.platformId,
    encryptedKey,
    input.address,
    input.currentGarden ?? null,
    input.role ?? "gardener",
    input.locale ?? null,
    createdAt
  );

  return {
    platform: input.platform,
    platformId: input.platformId,
    privateKey: input.privateKey,
    address: input.address,
    currentGarden: input.currentGarden,
    role: input.role ?? "gardener",
    locale: input.locale,
    createdAt,
  };
}

export async function updateUser(
  db: Database,
  platform: Platform,
  platformId: string,
  update: Partial<Pick<User, "currentGarden" | "role" | "locale">>
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
  if (update.locale !== undefined) {
    setClauses.push("locale = ?");
    values.push(update.locale ?? null);
  }

  if (setClauses.length === 0) return;

  db.query(`UPDATE users SET ${setClauses.join(", ")} WHERE platform = ? AND platformId = ?`).run(
    ...values,
    platform,
    platformId
  );
}

export async function getOperatorForGarden(
  db: Database,
  gardenAddress: string
): Promise<User | undefined> {
  const row = db
    .query("SELECT * FROM users WHERE role = 'operator' AND currentGarden = ? LIMIT 1")
    .get(gardenAddress) as UserRow | null;

  if (!row) return undefined;

  const { privateKey } = getPrivateKey(row.privateKey);
  return toUser(row, privateKey);
}

async function migrateUserKey(
  db: Database,
  platform: string,
  platformId: string,
  plainKey: string
): Promise<void> {
  const encryptedKey = prepareKeyForStorage(plainKey);
  db.query("UPDATE users SET privateKey = ? WHERE platform = ? AND platformId = ?").run(
    encryptedKey,
    platform,
    platformId
  );
  log.info({ platform, platformId }, "Migrated key to encrypted storage");
}

function toUser(row: UserRow, privateKey: string): User {
  return {
    platform: row.platform as Platform,
    platformId: row.platformId,
    privateKey,
    address: row.address,
    currentGarden: row.currentGarden ?? undefined,
    role: row.role as User["role"],
    locale: row.locale ?? undefined,
    createdAt: row.createdAt,
  };
}
