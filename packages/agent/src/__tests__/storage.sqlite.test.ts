import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDB, getDB, initDB } from "../services/db";
import { createSavedOfferCipher } from "../services/saved-offers";
import type { SavedOfferCipher } from "../services/saved-offers";
import {
  createGardenJoinRequestCipher,
  createSqliteGardenJoinRequestStore,
} from "../services/garden-join-requests";
import {
  canonicalSavedOfferPayload,
  type SavedOfferPayloadV1,
} from "@green-goods/shared/public-contracts";

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
        "garden_join_request_proofs",
        "garden_join_requests",
        "pending_works",
        "saved_offers",
        "sessions",
        "users",
      ])
    );
    expect(sqlite.query("PRAGMA user_version").get()).toEqual({ user_version: 7 });
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

  it("persists join-request personal fields only as ciphertext", async () => {
    const cipher = createGardenJoinRequestCipher("cd".repeat(32));
    const store = createSqliteGardenJoinRequestStore(cipher, {
      id: () => "0198f665-9a00-7000-8000-000000000002",
    });
    const garden = `0x${"5".repeat(40)}` as const;
    const account = `0x${"6".repeat(40)}` as const;
    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Private gardener",
      note: "Private joining note",
      requestedVia: "garden_detail",
      requestedAt: "2026-08-27T12:00:00.000Z",
      expiresAt: "2026-09-26T12:00:00.000Z",
    });

    const raw = rawDatabase()
      .query("SELECT accountAddressKey, ciphertext FROM garden_join_requests")
      .get() as { accountAddressKey: string; ciphertext: string };
    expect(raw.accountAddressKey).not.toContain(account);
    expect(raw.ciphertext).not.toContain("Private gardener");
    expect(raw.ciphertext).not.toContain("Private joining note");

    await closeDB();
    initDB(databasePath);
    await expect(store.getMine(garden, account)).resolves.toMatchObject({
      displayName: "Private gardener",
      note: "Private joining note",
    });
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

  it("persists only encrypted Saved Offer payloads across a database restart", async () => {
    const cipher = createSavedOfferCipher(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    const owner = `0x${"2".repeat(40)}` as const;
    const payload: SavedOfferPayloadV1 = {
      schemaVersion: 1,
      savedOfferId: "0191f2a0-1d5e-7c41-8f45-5ee9120ec012",
      title: "Private rain garden offer",
      description: "Install one rain garden.",
      commitmentKind: "DomainImpact",
      unitLabel: "gardens",
      targetUnits: "1",
      claimMode: "Open",
      domainTags: ["water"],
      requirements: [],
      seriesLinks: [],
    };
    const created = await getDB().compareAndSwapSavedOffer(cipher, {
      chainId: 42161,
      owner,
      savedOfferId: payload.savedOfferId,
      payload: canonicalSavedOfferPayload(payload),
      expectedVersion: 0,
      updatedAt: new Date().toISOString(),
    });
    expect(created).toMatchObject({ ok: true, record: { version: 1, payload } });
    const stored = rawDatabase()
      .query("SELECT ciphertext FROM saved_offers WHERE savedOfferId = ?")
      .get(payload.savedOfferId) as { ciphertext: string };
    expect(stored.ciphertext).not.toContain(payload.title);

    await closeDB();
    initDB(databasePath);

    await expect(
      getDB().getSavedOffer(cipher, 42161, owner, payload.savedOfferId)
    ).resolves.toMatchObject({ version: 1, payload });
  });

  it("enforces Saved Offer conflicts, tombstones, and stale-resurrection protection", async () => {
    const cipher = createSavedOfferCipher(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    const owner = `0x${"3".repeat(40)}` as const;
    const savedOfferId = "0191f2a0-1d5e-7c41-8f45-5ee9120ec099";
    const payload: SavedOfferPayloadV1 = {
      schemaVersion: 1,
      savedOfferId,
      title: "Conflict-safe offer",
      description: "Exercise the production SQLite mutation path.",
      commitmentKind: "SupportService",
      unitLabel: "reviews",
      targetUnits: "1",
      claimMode: "Open",
      domainTags: [],
      requirements: [],
      seriesLinks: [],
    };
    const input = {
      chainId: 42161,
      owner,
      savedOfferId,
      payload: canonicalSavedOfferPayload(payload),
      updatedAt: new Date().toISOString(),
    };

    await expect(
      getDB().compareAndSwapSavedOffer(cipher, { ...input, expectedVersion: 0 })
    ).resolves.toMatchObject({ ok: true, record: { version: 1 } });
    await expect(
      getDB().compareAndSwapSavedOffer(cipher, { ...input, expectedVersion: 0 })
    ).resolves.toEqual({ ok: false, currentVersion: 1 });
    await expect(getDB().tombstoneSavedOffer({ ...input, expectedVersion: 0 })).resolves.toEqual({
      ok: false,
      reason: "version_conflict",
      currentVersion: 1,
    });
    await expect(getDB().tombstoneSavedOffer({ ...input, expectedVersion: 1 })).resolves.toEqual({
      ok: true,
      version: 2,
    });
    await expect(
      getDB().getSavedOffer(cipher, 42161, owner, savedOfferId)
    ).resolves.toBeUndefined();
    await expect(
      getDB().compareAndSwapSavedOffer(cipher, { ...input, expectedVersion: 1 })
    ).resolves.toEqual({ ok: false, currentVersion: 2 });
  });

  it("rolls back a failed Saved Offer encryption transaction", async () => {
    const cipher = createSavedOfferCipher(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    const failingCipher: SavedOfferCipher = {
      encrypt() {
        throw new Error("expected encryption failure");
      },
      decrypt: cipher.decrypt,
    };
    const owner = `0x${"4".repeat(40)}` as const;
    const savedOfferId = "0191f2a0-1d5e-7c41-8f45-5ee9120ec098";
    const payload: SavedOfferPayloadV1 = {
      schemaVersion: 1,
      savedOfferId,
      title: "Rollback offer",
      description: "No partial write may survive.",
      commitmentKind: "SupportService",
      unitLabel: "checks",
      targetUnits: "1",
      claimMode: "Open",
      domainTags: [],
      requirements: [],
      seriesLinks: [],
    };
    const input = {
      chainId: 42161,
      owner,
      savedOfferId,
      payload: canonicalSavedOfferPayload(payload),
      expectedVersion: 0,
      updatedAt: new Date().toISOString(),
    };

    await expect(getDB().compareAndSwapSavedOffer(failingCipher, input)).rejects.toThrow(
      "expected encryption failure"
    );
    expect(
      rawDatabase()
        .query("SELECT COUNT(*) AS count FROM saved_offers WHERE savedOfferId = ?")
        .get(savedOfferId)
    ).toEqual({ count: 0 });
    await expect(getDB().compareAndSwapSavedOffer(cipher, input)).resolves.toMatchObject({
      ok: true,
      record: { version: 1 },
    });
  });
});
