/**
 * Storage Tests
 *
 * Tests for the SQLite storage with real database operations.
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import type { CreateUserInput, WorkDraftData, Session } from "../types";
import fs from "fs";

// We'll use direct DB access instead of the adapter pattern
import { initDB, getDB } from "../services/db";

// Test database path
const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/test-storage-2.db`;

// Set up encryption secret for tests
const originalSecret = process.env.ENCRYPTION_SECRET;
const originalToken = process.env.TELEGRAM_BOT_TOKEN;

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
  process.env.TELEGRAM_BOT_TOKEN = "test-token-for-fallback";

  // Ensure test directory exists
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  // Remove old test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Initialize DB
  initDB(TEST_DB_PATH);
});

afterAll(async () => {
  if (originalSecret) {
    process.env.ENCRYPTION_SECRET = originalSecret;
  } else {
    delete process.env.ENCRYPTION_SECRET;
  }
  if (originalToken) {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  } else {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

// ============================================================================
// USER TESTS
// ============================================================================

describe("User Management", () => {
  it("creates and retrieves a user", async () => {
    const db = getDB();
    const platformId = `test-user-${Date.now()}`;

    const input: CreateUserInput = {
      platform: "telegram",
      platformId,
      privateKey: "0x" + "a".repeat(64),
      address: "0x" + "1".repeat(40),
      role: "gardener",
    };

    const created = await db.createUser(input);

    expect(created.platform).toBe("telegram");
    expect(created.platformId).toBe(platformId);
    expect(created.address).toBe(input.address);

    const retrieved = await db.getUser("telegram", platformId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.address).toBe(input.address);
  });

  it("returns undefined for non-existent user", async () => {
    const db = getDB();
    const result = await db.getUser("telegram", "non-existent-user");
    expect(result).toBeUndefined();
  });

  it("updates user garden and role", async () => {
    const db = getDB();
    const platformId = `update-user-${Date.now()}`;

    await db.createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "b".repeat(64),
      address: "0x" + "2".repeat(40),
      role: "gardener",
    });

    const gardenAddress = "0x" + "9".repeat(40);
    await db.updateUser("telegram", platformId, {
      currentGarden: gardenAddress,
      role: "operator",
    });

    const updated = await db.getUser("telegram", platformId);
    expect(updated?.currentGarden).toBe(gardenAddress);
    expect(updated?.role).toBe("operator");
  });
});

// ============================================================================
// SESSION TESTS
// ============================================================================

describe("Session Management", () => {
  it("sets and retrieves a session", async () => {
    const db = getDB();
    const platformId = `session-user-${Date.now()}`;

    const session: Session = {
      platform: "telegram",
      platformId,
      step: "confirming_work",
      draft: { tasks: [], notes: "test", date: "2024-01-01" },
      updatedAt: Date.now(),
    };

    await db.setSession(session);
    const retrieved = await db.getSession("telegram", platformId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.step).toBe("confirming_work");
    expect(retrieved?.draft).toEqual(session.draft);
  });

  it("clears a session", async () => {
    const db = getDB();
    const platformId = `clear-session-${Date.now()}`;

    await db.setSession({
      platform: "telegram",
      platformId,
      step: "idle",
      updatedAt: Date.now(),
    });

    await db.clearSession("telegram", platformId);
    const cleared = await db.getSession("telegram", platformId);

    expect(cleared).toBeUndefined();
  });
});

// ============================================================================
// PENDING WORK TESTS
// ============================================================================

describe("Pending Work Management", () => {
  it("adds and retrieves pending work", async () => {
    const db = getDB();
    const workId = `work-${Date.now()}`;
    const gardenAddress = "0x" + "5".repeat(40);

    const workData: WorkDraftData = {
      actionUID: 1,
      title: "Test Work",
      plantSelection: ["oak", "pine"],
      plantCount: 5,
      feedback: "Planted trees",
      media: [],
    };

    await db.addPendingWork({
      id: workId,
      actionUID: workData.actionUID,
      gardenerAddress: "0x" + "6".repeat(40),
      gardenerPlatform: "telegram",
      gardenerPlatformId: "gardener-123",
      gardenAddress,
      data: workData,
    });

    const retrieved = await db.getPendingWork(workId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.data.title).toBe("Test Work");
    expect(retrieved?.data.plantCount).toBe(5);
  });

  it("lists pending works for a garden", async () => {
    const db = getDB();
    const gardenAddress = "0x" + "7".repeat(40);

    // Add multiple works
    for (let i = 0; i < 3; i++) {
      await db.addPendingWork({
        id: `garden-work-${Date.now()}-${i}`,
        actionUID: i,
        gardenerAddress: "0x" + "8".repeat(40),
        gardenerPlatform: "telegram",
        gardenerPlatformId: `gardener-${i}`,
        gardenAddress,
        data: {
          actionUID: i,
          title: `Work ${i}`,
          plantSelection: [],
          plantCount: i,
          feedback: "",
          media: [],
        },
      });
    }

    const works = await db.getPendingWorksForGarden(gardenAddress);
    expect(works.length).toBeGreaterThanOrEqual(3);
  });

  it("removes pending work", async () => {
    const db = getDB();
    const workId = `remove-work-${Date.now()}`;

    await db.addPendingWork({
      id: workId,
      actionUID: 0,
      gardenerAddress: "0x" + "a".repeat(40),
      gardenerPlatform: "telegram",
      gardenerPlatformId: "gardener-remove",
      gardenAddress: "0x" + "b".repeat(40),
      data: {
        actionUID: 0,
        title: "To Remove",
        plantSelection: [],
        plantCount: 0,
        feedback: "",
        media: [],
      },
    });

    await db.removePendingWork(workId);
    const removed = await db.getPendingWork(workId);

    expect(removed).toBeUndefined();
  });
});
