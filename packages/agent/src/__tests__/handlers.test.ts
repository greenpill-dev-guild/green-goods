/**
 * Handler Tests
 *
 * Tests for the core message handlers (start, join, submit).
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";

import { handleStart, type StartDeps } from "../handlers/start";
import { handleJoin, type JoinDeps } from "../handlers/join";
import { handleTextSubmission, handleCancelSubmission, type SubmitDeps } from "../handlers/submit";
import type { InboundMessage, User } from "../types";
import { initDB } from "../services/db";
import { initAI } from "../services/ai";
import * as db from "../services/db";

// Set up test environment
const TEST_DB_PATH = "data/test/handlers-test.db";
const originalSecret = process.env.ENCRYPTION_SECRET;

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
  initDB(TEST_DB_PATH);
  initAI();
});

afterAll(async () => {
  if (originalSecret) {
    process.env.ENCRYPTION_SECRET = originalSecret;
  } else {
    delete process.env.ENCRYPTION_SECRET;
  }
});

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "msg-123",
    platform: "telegram",
    sender: { platformId: "user-123", displayName: "Test User" },
    content: { type: "text", text: "test message" },
    locale: "en",
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    platform: "telegram",
    platformId: "user-123",
    privateKey: "0x" + "a".repeat(64),
    address: "0x" + "1".repeat(40),
    role: "gardener",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// START HANDLER
// ============================================================================

describe("handleStart", () => {
  it("creates a new wallet for first-time users", async () => {
    const message = createMockMessage({
      sender: { platformId: `new-user-${Date.now()}` },
      content: { type: "command", name: "start", args: [] },
    });

    const deps: StartDeps = {
      generatePrivateKey: () => `0x${"b".repeat(64)}` as `0x${string}`,
    };

    const result = await handleStart(message, deps);

    expect(result.response.text).toContain("Welcome to Green Goods");
    expect(result.response.text).toContain("created a wallet");
  });

  it("welcomes back existing users", async () => {
    // First create the user
    const platformId = `existing-user-${Date.now()}`;
    await db.createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "c".repeat(64),
      address: "0x" + "2".repeat(40),
      role: "gardener",
    });

    const message = createMockMessage({
      sender: { platformId },
      content: { type: "command", name: "start", args: [] },
    });

    const deps: StartDeps = {
      generatePrivateKey: () => `0x${"d".repeat(64)}` as `0x${string}`,
    };

    const result = await handleStart(message, deps);

    expect(result.response.text).toContain("Welcome back");
  });
});

// ============================================================================
// JOIN HANDLER
// ============================================================================

describe("handleJoin", () => {
  it("shows usage when no address provided", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "join", args: [] },
    });

    const user = createMockUser();
    const deps: JoinDeps = {
      isValidAddress: (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    };

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Usage");
  });

  it("rejects invalid address format", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "join", args: ["invalid-address"] },
    });

    const user = createMockUser();
    const deps: JoinDeps = {
      isValidAddress: (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    };

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Invalid address format");
  });
});

// ============================================================================
// SUBMIT HANDLER
// ============================================================================

describe("handleTextSubmission", () => {
  it("parses work from text and shows confirmation", async () => {
    const message = createMockMessage({
      content: { type: "text", text: "I planted 5 trees today" },
    });

    const user = createMockUser({ currentGarden: "0x" + "3".repeat(40) });
    const deps: SubmitDeps = {
      generateId: () => "test-id-123",
    };

    const result = await handleTextSubmission(message, user, deps);

    expect(result.response.text).toContain("Confirm");
    expect(result.response.buttons).toBeDefined();
    expect(result.updateSession).toBeDefined();
    expect(result.updateSession?.step).toBe("confirming_work");
  });

  it("shows error when no tasks identified", async () => {
    const message = createMockMessage({
      content: { type: "text", text: "hello there" },
    });

    const user = createMockUser({ currentGarden: "0x" + "3".repeat(40) });
    const deps: SubmitDeps = {
      generateId: () => "test-id-123",
    };

    const result = await handleTextSubmission(message, user, deps);

    expect(result.response.text).toContain("couldn't identify");
  });
});

describe("handleCancelSubmission", () => {
  it("clears session and confirms cancellation", async () => {
    const platformId = `cancel-user-${Date.now()}`;
    const message = createMockMessage({
      sender: { platformId },
      content: { type: "callback", data: "cancel_submission" },
    });

    const deps: SubmitDeps = {
      generateId: () => "test-id",
    };

    const result = await handleCancelSubmission(message, deps);

    expect(result.response.text).toContain("cancelled");
    expect(result.clearSession).toBe(true);
  });
});
