import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDB, getDB, initDB } from "../services/db";

let databaseDirectory: string;
let databasePath: string;

function rawDatabase(): Database {
  return Reflect.get(getDB(), "db") as Database;
}

beforeAll(() => {
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "green-goods-agent-sqlite-"));
  databasePath = path.join(databaseDirectory, "agent.db");
  initDB(databasePath);
});

afterAll(async () => {
  await closeDB();
  rmSync(databaseDirectory, { recursive: true, force: true });
  expect(existsSync(databaseDirectory)).toBe(false);
});

describe("agent storage with real bun:sqlite", () => {
  it("creates the production schema with foreign-key enforcement enabled", () => {
    const sqlite = rawDatabase();
    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "chat_message_attachments",
        "chat_messages",
        "pending_works",
        "sessions",
        "users",
      ])
    );
    expect(sqlite.query("PRAGMA user_version").get()).toEqual({ user_version: 4 });
    expect(sqlite.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });

    expect(() =>
      sqlite
        .query(
          `INSERT INTO chat_message_attachments
            (id, chatMessageId, ordinal, kind, telegramFileId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run("orphan", "missing-message", 0, "photo", "file-id", Date.now())
    ).toThrow(/FOREIGN KEY constraint failed/i);
  });

  it("persists encrypted users and retrieves them after reopening the database", async () => {
    const privateKey = `0x${"a".repeat(64)}`;
    const db = getDB();
    await db.createUser({
      platform: "telegram",
      platformId: "sqlite-integration-user",
      privateKey,
      address: `0x${"1".repeat(40)}`,
      role: "gardener",
      locale: "pt-BR",
    });

    const stored = rawDatabase()
      .query("SELECT privateKey FROM users WHERE platform = ? AND platformId = ?")
      .get("telegram", "sqlite-integration-user") as { privateKey: string };
    expect(stored.privateKey).not.toBe(privateKey);

    await closeDB();
    initDB(databasePath);

    const reopened = await getDB().getUser("telegram", "sqlite-integration-user");
    expect(reopened).toMatchObject({
      platform: "telegram",
      platformId: "sqlite-integration-user",
      privateKey,
      locale: "pt-BR",
    });
    expect(existsSync(databasePath)).toBe(true);
  });
});
