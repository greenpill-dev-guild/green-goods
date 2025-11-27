/**
 * Storage Service Tests
 *
 * Tests for the SQLite-based storage layer.
 * Uses an in-memory database for isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { StorageService, type User, type PendingWork } from "../services/storage";
import fs from "fs";
import path from "path";

describe("StorageService", () => {
  let storage: StorageService;
  const testDbPath = path.resolve(__dirname, "test-bot.db");

  beforeEach(() => {
    // Create fresh database for each test
    storage = new StorageService(testDbPath);
  });

  afterEach(() => {
    storage.close();
    // Cleanup test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("User Management", () => {
    const testUser: User = {
      telegramId: 123456789,
      privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      address: "0x1234567890123456789012345678901234567890",
      role: "gardener",
    };

    it("creates and retrieves a user", () => {
      storage.createUser(testUser);
      const retrieved = storage.getUser(testUser.telegramId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.telegramId).toBe(testUser.telegramId);
      expect(retrieved?.address).toBe(testUser.address);
      expect(retrieved?.privateKey).toBe(testUser.privateKey);
    });

    it("returns undefined for non-existent user", () => {
      const result = storage.getUser(999999);
      expect(result).toBeUndefined();
    });

    it("updates user fields", () => {
      storage.createUser(testUser);
      storage.updateUser({
        telegramId: testUser.telegramId,
        currentGarden: "0xabcdef1234567890abcdef1234567890abcdef12",
        role: "operator",
      });

      const updated = storage.getUser(testUser.telegramId);
      expect(updated?.currentGarden).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
      expect(updated?.role).toBe("operator");
    });

    it("finds operator for garden", () => {
      const operatorUser: User = {
        ...testUser,
        role: "operator",
        currentGarden: "0xGARDEN123",
      };
      storage.createUser(operatorUser);

      const operator = storage.getOperatorForGarden("0xGARDEN123");
      expect(operator).toBeDefined();
      expect(operator?.role).toBe("operator");
    });

    it("returns undefined when no operator exists for garden", () => {
      storage.createUser(testUser);
      const operator = storage.getOperatorForGarden("0xNONEXISTENT");
      expect(operator).toBeUndefined();
    });
  });

  describe("Session Management", () => {
    const telegramId = 123456789;

    it("creates and retrieves a session", () => {
      storage.setSession({
        telegramId,
        step: "submitting_work",
        draft: {
          tasks: [{ type: "planting", species: "tree", count: 5 }],
          notes: "Test submission",
          date: "2024-01-15",
        },
      });

      const session = storage.getSession(telegramId);
      expect(session).toBeDefined();
      expect(session?.step).toBe("submitting_work");
      expect(session?.draft?.tasks).toHaveLength(1);
    });

    it("returns undefined for non-existent session", () => {
      const result = storage.getSession(999999);
      expect(result).toBeUndefined();
    });

    it("clears session", () => {
      storage.setSession({
        telegramId,
        step: "submitting_work",
      });

      storage.clearSession(telegramId);
      const session = storage.getSession(telegramId);
      expect(session).toBeUndefined();
    });

    it("handles session without draft", () => {
      storage.setSession({
        telegramId,
        step: "idle",
      });

      const session = storage.getSession(telegramId);
      expect(session?.draft).toBeUndefined();
    });

    it("overwrites existing session", () => {
      storage.setSession({
        telegramId,
        step: "submitting_work",
      });

      storage.setSession({
        telegramId,
        step: "approving_work",
      });

      const session = storage.getSession(telegramId);
      expect(session?.step).toBe("approving_work");
    });
  });

  describe("Pending Work Management", () => {
    const testWork: Omit<PendingWork, "createdAt"> = {
      id: "work123",
      actionUID: 0,
      gardenerAddress: "0x1234567890123456789012345678901234567890",
      gardenerTelegramId: 123456789,
      gardenAddress: "0xGARDEN123",
      data: {
        actionUID: 0,
        title: "Test Work",
        plantSelection: ["oak", "maple"],
        plantCount: 10,
        feedback: "Test feedback",
        media: [],
      },
    };

    it("adds and retrieves pending work", () => {
      storage.addPendingWork(testWork);
      const retrieved = storage.getPendingWork(testWork.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(testWork.id);
      expect(retrieved?.data.plantCount).toBe(10);
      expect(retrieved?.data.plantSelection).toEqual(["oak", "maple"]);
    });

    it("returns undefined for non-existent work", () => {
      const result = storage.getPendingWork("nonexistent");
      expect(result).toBeUndefined();
    });

    it("removes pending work", () => {
      storage.addPendingWork(testWork);
      storage.removePendingWork(testWork.id);

      const result = storage.getPendingWork(testWork.id);
      expect(result).toBeUndefined();
    });

    it("retrieves pending works for garden", () => {
      storage.addPendingWork(testWork);
      storage.addPendingWork({
        ...testWork,
        id: "work456",
      });
      storage.addPendingWork({
        ...testWork,
        id: "work789",
        gardenAddress: "0xOTHER_GARDEN",
      });

      const works = storage.getPendingWorksForGarden("0xGARDEN123");
      expect(works).toHaveLength(2);
    });

    it("returns empty array when no pending works for garden", () => {
      const works = storage.getPendingWorksForGarden("0xNONEXISTENT");
      expect(works).toHaveLength(0);
    });
  });

  describe("Database Lifecycle", () => {
    it("creates directory if it doesn't exist", () => {
      const nestedPath = path.resolve(__dirname, "nested/dir/test.db");
      const nestedStorage = new StorageService(nestedPath);

      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);

      nestedStorage.close();
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.dirname(nestedPath));
      fs.rmdirSync(path.dirname(path.dirname(nestedPath)));
    });

    it("handles close gracefully", () => {
      // Should not throw
      storage.close();
    });
  });
});
