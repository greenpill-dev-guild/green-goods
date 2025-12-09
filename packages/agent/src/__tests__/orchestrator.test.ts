/**
 * Message Router Tests
 *
 * Tests for the handleMessage routing and session management.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { handleMessage, setHandlerContext } from "../handlers";
import type { InboundMessage } from "../types";
import { initDB, createUser } from "../services/db";
import { initBlockchain } from "../services/blockchain";
import { initAI } from "../services/ai";
import { baseSepolia } from "viem/chains";

// Test setup
const TEST_DB_PATH = "data/test/orchestrator-test.db";
const originalSecret = process.env.ENCRYPTION_SECRET;

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
  initDB(TEST_DB_PATH);
  initBlockchain(baseSepolia);
  initAI();
  setHandlerContext({});
});

afterAll(async () => {
  if (originalSecret) {
    process.env.ENCRYPTION_SECRET = originalSecret;
  } else {
    delete process.env.ENCRYPTION_SECRET;
  }
});

// ============================================================================
// HELPERS
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

// ============================================================================
// ROUTING TESTS
// ============================================================================

describe("handleMessage - Command Routing", () => {
  it("routes /start command", async () => {
    const message = createMockMessage({
      sender: { platformId: `route-start-${Date.now()}` },
      content: { type: "command", name: "start", args: [] },
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("Green Goods");
  });

  it("routes /help command", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "help", args: [] },
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("Help");
    expect(response.text).toContain("/start");
  });

  it("rejects commands for users without wallet", async () => {
    const message = createMockMessage({
      sender: { platformId: `no-wallet-${Date.now()}` },
      content: { type: "command", name: "status", args: [] },
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("/start first");
  });

  it("handles unknown commands", async () => {
    const platformId = `unknown-cmd-${Date.now()}`;

    // Create user first
    await createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "a".repeat(64),
      address: "0x" + "1".repeat(40),
      role: "gardener",
    });

    const message = createMockMessage({
      sender: { platformId },
      content: { type: "command", name: "unknown_command", args: [] },
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("Unknown command");
  });
});

describe("handleMessage - Text Routing", () => {
  it("requires garden join before text submission", async () => {
    const platformId = `no-garden-${Date.now()}`;

    await createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "b".repeat(64),
      address: "0x" + "2".repeat(40),
      role: "gardener",
    });

    const message = createMockMessage({
      sender: { platformId },
      content: { type: "text", text: "I planted 5 trees" },
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("join a garden");
  });

  it("processes text as work submission when garden joined", async () => {
    const platformId = `with-garden-${Date.now()}`;

    await createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "c".repeat(64),
      address: "0x" + "3".repeat(40),
      role: "gardener",
      currentGarden: "0x" + "9".repeat(40),
    });

    const message = createMockMessage({
      sender: { platformId },
      content: { type: "text", text: "I planted 5 trees today" },
    });

    const response = await handleMessage(message);

    // Either confirmation or error message, but should be processed
    expect(response.text.length).toBeGreaterThan(0);
  });
});

describe("handleMessage - Callback Routing", () => {
  it("handles unknown callbacks gracefully", async () => {
    const platformId = `callback-${Date.now()}`;

    await createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "d".repeat(64),
      address: "0x" + "4".repeat(40),
      role: "gardener",
    });

    const message = createMockMessage({
      sender: { platformId },
      content: { type: "callback", data: "unknown_action" },
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("Unknown");
  });
});

describe("handleMessage - Photo Messages", () => {
  it("prompts user to start first when sending photo without wallet", async () => {
    const message = createMockMessage({
      content: { type: "image", imageUrl: "test.jpg", mimeType: "image/jpeg" } as const,
    });

    const response = await handleMessage(message);

    // User hasn't created a wallet yet
    expect(response.text).toContain("/start");
  });

  it("returns error for truly unsupported message types", async () => {
    const message = createMockMessage({
      // @ts-expect-error - testing unsupported type
      content: { type: "unknown_type" } as const,
    });

    const response = await handleMessage(message);

    expect(response.text).toContain("Unsupported");
  });
});
