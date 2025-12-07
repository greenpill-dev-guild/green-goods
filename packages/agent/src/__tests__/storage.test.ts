/**
 * SQLiteStorage Integration Tests
 *
 * Tests for the SQLite storage adapter with real database operations.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from "bun:test";
import { SQLiteStorage } from "../adapters/storage/sqlite";
import type { Platform } from "../core/contracts/message";
import type { CreateUserInput, WorkDraftData } from "../ports/storage";
import type { Session } from "../core/contracts/response";
import fs from "fs";

// Test database path
const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/test-storage.db`;

// Set up encryption secret for tests
const originalSecret = process.env.ENCRYPTION_SECRET;
const originalToken = process.env.TELEGRAM_BOT_TOKEN;

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
  process.env.TELEGRAM_BOT_TOKEN = "test-token-for-fallback";
});

afterAll(() => {
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

  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  if (fs.existsSync(TEST_DB_DIR)) {
    try {
      fs.rmdirSync(TEST_DB_DIR);
    } catch {
      // Directory might not be empty, ignore
    }
  }
});

describe("SQLiteStorage", () => {
  let storage: SQLiteStorage;

  beforeEach(() => {
    // Ensure clean database for each test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    storage = new SQLiteStorage(TEST_DB_PATH);
  });

  afterEach(async () => {
    await storage.close();
  });

  // ============================================================================
  // USER MANAGEMENT TESTS
  // ============================================================================

  describe("User Management", () => {
    const testUserInput: CreateUserInput = {
      platform: "telegram",
      platformId: "12345",
      privateKey: "0x" + "a".repeat(64),
      address: "0x" + "1".repeat(40),
      role: "gardener",
    };

    it("creates a new user with encrypted private key", async () => {
      const user = await storage.createUser(testUserInput);

      expect(user.platform).toBe(testUserInput.platform);
      expect(user.platformId).toBe(testUserInput.platformId);
      expect(user.address).toBe(testUserInput.address);
      expect(user.role).toBe("gardener");
      expect(user.createdAt).toBeGreaterThan(0);
    });

    it("retrieves an existing user by platform and platformId", async () => {
      await storage.createUser(testUserInput);

      const user = await storage.getUser("telegram", "12345");

      expect(user).toBeDefined();
      expect(user?.address).toBe(testUserInput.address);
      // Private key should be decrypted correctly
      expect(user?.privateKey).toBe(testUserInput.privateKey);
    });

    it("returns undefined for non-existent user", async () => {
      const user = await storage.getUser("telegram", "nonexistent");

      expect(user).toBeUndefined();
    });

    it("updates user garden and role", async () => {
      await storage.createUser(testUserInput);

      await storage.updateUser("telegram", "12345", {
        currentGarden: "0x" + "2".repeat(40),
        role: "operator",
      });

      const user = await storage.getUser("telegram", "12345");

      expect(user?.currentGarden).toBe("0x" + "2".repeat(40));
      expect(user?.role).toBe("operator");
    });

    it("validates address format on creation", async () => {
      const invalidInput = {
        ...testUserInput,
        address: "invalid-address",
      };

      await expect(storage.createUser(invalidInput)).rejects.toThrow("Invalid address format");
    });

    it("validates private key format on creation", async () => {
      const invalidInput = {
        ...testUserInput,
        privateKey: "invalid-key",
      };

      await expect(storage.createUser(invalidInput)).rejects.toThrow("Invalid private key format");
    });

    it("finds operator for garden", async () => {
      const gardenAddress = "0x" + "2".repeat(40);

      // Create an operator
      await storage.createUser({
        ...testUserInput,
        platformId: "operator-123",
        currentGarden: gardenAddress,
        role: "operator",
      });

      // Create a regular gardener in same garden
      await storage.createUser({
        ...testUserInput,
        platformId: "gardener-456",
        address: "0x" + "3".repeat(40),
        privateKey: "0x" + "b".repeat(64),
        currentGarden: gardenAddress,
        role: "gardener",
      });

      const operator = await storage.getOperatorForGarden(gardenAddress);

      expect(operator).toBeDefined();
      expect(operator?.role).toBe("operator");
      expect(operator?.platformId).toBe("operator-123");
    });

    it("returns undefined if no operator for garden", async () => {
      const gardenAddress = "0x" + "2".repeat(40);

      // Create only a gardener (not operator)
      await storage.createUser({
        ...testUserInput,
        currentGarden: gardenAddress,
        role: "gardener",
      });

      const operator = await storage.getOperatorForGarden(gardenAddress);

      expect(operator).toBeUndefined();
    });
  });

  // ============================================================================
  // SESSION MANAGEMENT TESTS
  // ============================================================================

  describe("Session Management", () => {
    it("creates and retrieves a session", async () => {
      const session: Session = {
        platform: "telegram",
        platformId: "user-123",
        step: "confirming_work",
        draft: { tasks: [{ type: "planting", species: "oak" }] },
        updatedAt: Date.now(),
      };

      await storage.setSession(session);

      const retrieved = await storage.getSession("telegram", "user-123");

      expect(retrieved).toBeDefined();
      expect(retrieved?.step).toBe("confirming_work");
      expect(retrieved?.draft).toEqual(session.draft);
    });

    it("updates existing session", async () => {
      const session1: Session = {
        platform: "telegram",
        platformId: "user-123",
        step: "submitting_work",
        updatedAt: Date.now(),
      };

      const session2: Session = {
        platform: "telegram",
        platformId: "user-123",
        step: "confirming_work",
        draft: { newData: true },
        updatedAt: Date.now(),
      };

      await storage.setSession(session1);
      await storage.setSession(session2);

      const retrieved = await storage.getSession("telegram", "user-123");

      expect(retrieved?.step).toBe("confirming_work");
      expect(retrieved?.draft).toEqual({ newData: true });
    });

    it("clears a session", async () => {
      const session: Session = {
        platform: "telegram",
        platformId: "user-123",
        step: "confirming_work",
        updatedAt: Date.now(),
      };

      await storage.setSession(session);
      await storage.clearSession("telegram", "user-123");

      const retrieved = await storage.getSession("telegram", "user-123");

      expect(retrieved).toBeUndefined();
    });

    it("returns undefined for non-existent session", async () => {
      const session = await storage.getSession("telegram", "nonexistent");

      expect(session).toBeUndefined();
    });

    it("handles session with null draft", async () => {
      const session: Session = {
        platform: "telegram",
        platformId: "user-123",
        step: "idle",
        updatedAt: Date.now(),
      };

      await storage.setSession(session);

      const retrieved = await storage.getSession("telegram", "user-123");

      expect(retrieved?.draft).toBeUndefined();
    });
  });

  // ============================================================================
  // PENDING WORK TESTS
  // ============================================================================

  describe("Pending Work", () => {
    const testWorkData: WorkDraftData = {
      actionUID: 1,
      title: "Test Work",
      plantSelection: ["oak", "maple"],
      plantCount: 5,
      feedback: "Planted 5 trees",
      media: [],
    };

    const testPendingWork = {
      id: "work-123",
      actionUID: 1,
      gardenerAddress: "0x" + "1".repeat(40),
      gardenerPlatform: "telegram" as Platform,
      gardenerPlatformId: "user-123",
      gardenAddress: "0x" + "2".repeat(40),
      data: testWorkData,
    };

    it("adds and retrieves pending work", async () => {
      await storage.addPendingWork(testPendingWork);

      const retrieved = await storage.getPendingWork("work-123");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("work-123");
      expect(retrieved?.gardenerAddress).toBe(testPendingWork.gardenerAddress);
      expect(retrieved?.data).toEqual(testWorkData);
      expect(retrieved?.createdAt).toBeGreaterThan(0);
    });

    it("returns undefined for non-existent pending work", async () => {
      const work = await storage.getPendingWork("nonexistent");

      expect(work).toBeUndefined();
    });

    it("retrieves pending works for a garden", async () => {
      const gardenAddress = "0x" + "2".repeat(40);

      // Add multiple works
      await storage.addPendingWork({
        ...testPendingWork,
        id: "work-1",
        gardenAddress,
      });
      await storage.addPendingWork({
        ...testPendingWork,
        id: "work-2",
        gardenAddress,
      });
      await storage.addPendingWork({
        ...testPendingWork,
        id: "work-3",
        gardenAddress: "0x" + "3".repeat(40), // Different garden
      });

      const works = await storage.getPendingWorksForGarden(gardenAddress);

      expect(works).toHaveLength(2);
      expect(works.map((w) => w.id).sort()).toEqual(["work-1", "work-2"].sort());
    });

    it("returns empty array when no pending works for garden", async () => {
      const works = await storage.getPendingWorksForGarden("0x" + "9".repeat(40));

      expect(works).toHaveLength(0);
    });

    it("removes pending work", async () => {
      await storage.addPendingWork(testPendingWork);
      await storage.removePendingWork("work-123");

      const work = await storage.getPendingWork("work-123");

      expect(work).toBeUndefined();
    });

    it("returns pending works sorted by createdAt", async () => {
      const gardenAddress = "0x" + "2".repeat(40);

      // Add multiple works
      await storage.addPendingWork({
        ...testPendingWork,
        id: "work-1",
        gardenAddress,
      });

      await storage.addPendingWork({
        ...testPendingWork,
        id: "work-2",
        gardenAddress,
      });

      const works = await storage.getPendingWorksForGarden(gardenAddress);

      // Verify both works are returned
      expect(works).toHaveLength(2);

      // Verify they have valid createdAt timestamps
      expect(works[0].createdAt).toBeGreaterThan(0);
      expect(works[1].createdAt).toBeGreaterThan(0);

      // Verify ordering (descending by createdAt - newer first)
      expect(works[0].createdAt).toBeGreaterThanOrEqual(works[1].createdAt);
    });
  });

  // ============================================================================
  // LIFECYCLE TESTS
  // ============================================================================

  describe("Lifecycle", () => {
    it("closes database connection cleanly", async () => {
      await storage.createUser({
        platform: "telegram",
        platformId: "test-user",
        privateKey: "0x" + "a".repeat(64),
        address: "0x" + "1".repeat(40),
      });

      // Verify close() completes without error
      let error: Error | undefined;
      try {
        await storage.close();
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeUndefined();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("handles special characters in work data", async () => {
      const specialData: WorkDraftData = {
        actionUID: 1,
        title: 'Test "with" special\'s <characters> & symbols',
        plantSelection: ["tree's", '"quoted"'],
        plantCount: 5,
        feedback: "Unicode: 🌱🌳🌲 中文 العربية",
        media: [],
      };

      await storage.addPendingWork({
        id: "work-special",
        actionUID: 1,
        gardenerAddress: "0x" + "1".repeat(40),
        gardenerPlatform: "telegram",
        gardenerPlatformId: "user-123",
        gardenAddress: "0x" + "2".repeat(40),
        data: specialData,
      });

      const retrieved = await storage.getPendingWork("work-special");

      expect(retrieved?.data).toEqual(specialData);
    });

    it("handles multiple platforms for same user ID", async () => {
      const baseInput = {
        platformId: "12345", // Same ID
        privateKey: "0x" + "a".repeat(64),
        address: "0x" + "1".repeat(40),
      };

      await storage.createUser({ ...baseInput, platform: "telegram" });
      await storage.createUser({
        ...baseInput,
        platform: "discord",
        address: "0x" + "2".repeat(40),
        privateKey: "0x" + "b".repeat(64),
      });

      const telegramUser = await storage.getUser("telegram", "12345");
      const discordUser = await storage.getUser("discord", "12345");

      expect(telegramUser?.address).toBe("0x" + "1".repeat(40));
      expect(discordUser?.address).toBe("0x" + "2".repeat(40));
    });
  });
});
