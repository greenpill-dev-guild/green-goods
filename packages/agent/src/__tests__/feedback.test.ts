/**
 * Feedback Tests
 *
 * Tests for feedback storage (DB), /bug and /idea handlers, and API endpoints.
 */

import fs from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleFeedback, type FeedbackDeps } from "../handlers/feedback";
import * as db from "../services/db";
import { initDB } from "../services/db";
import type { InboundMessage, User } from "../types";

// ============================================================================
// SETUP
// ============================================================================

const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/feedback-test-${process.pid}-${Date.now()}.db`;

function removeTestDatabaseFiles() {
  for (const file of [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

beforeAll(() => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
  removeTestDatabaseFiles();
  initDB(TEST_DB_PATH);
});

afterAll(async () => {
  await db.closeDB();
  removeTestDatabaseFiles();
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

let idCounter = 0;
const mockDeps: FeedbackDeps = {
  generateId: () => `test-feedback-${++idCounter}`,
};

// ============================================================================
// DB TESTS
// ============================================================================

describe("Feedback DB", () => {
  it("stores and retrieves feedback by ID", async () => {
    const feedback = await db.addFeedback({
      id: "fb-db-1",
      type: "bug",
      status: "new",
      text: "The map doesn't load",
      platform: "telegram",
      platformId: "user-db-1",
      displayName: "Alice",
      gardenAddress: "0x" + "a".repeat(40),
    });

    expect(feedback.id).toBe("fb-db-1");
    expect(feedback.createdAt).toBeGreaterThan(0);
    expect(feedback.updatedAt).toBeGreaterThan(0);

    const retrieved = await db.getFeedback("fb-db-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe("bug");
    expect(retrieved!.text).toBe("The map doesn't load");
    expect(retrieved!.displayName).toBe("Alice");
    expect(retrieved!.gardenAddress).toBe("0x" + "a".repeat(40));
  });

  it("returns undefined for nonexistent feedback", async () => {
    const result = await db.getFeedback("nonexistent-id");
    expect(result).toBeUndefined();
  });

  it("getNewFeedback returns only status=new items", async () => {
    const now = Date.now();

    await db.addFeedback({
      id: "fb-new-1",
      type: "bug",
      status: "new",
      text: "Bug report 1",
      platform: "telegram",
      platformId: "user-1",
    });

    await db.addFeedback({
      id: "fb-triaged-1",
      type: "bug",
      status: "new",
      text: "Bug report 2",
      platform: "telegram",
      platformId: "user-2",
    });
    await db.updateFeedbackStatus("fb-triaged-1", "triaged");

    const newFeedback = await db.getNewFeedback(now - 1000);
    const ids = newFeedback.map((f) => f.id);

    expect(ids).toContain("fb-new-1");
    expect(ids).not.toContain("fb-triaged-1");
  });

  it("getNewFeedback filters by type", async () => {
    const now = Date.now();

    await db.addFeedback({
      id: "fb-type-bug",
      type: "bug",
      status: "new",
      text: "A bug",
      platform: "telegram",
      platformId: "user-3",
    });

    await db.addFeedback({
      id: "fb-type-idea",
      type: "idea",
      status: "new",
      text: "An idea",
      platform: "telegram",
      platformId: "user-4",
    });

    const bugs = await db.getNewFeedback(now - 1000, "bug");
    const ideas = await db.getNewFeedback(now - 1000, "idea");

    expect(bugs.some((f) => f.id === "fb-type-bug")).toBe(true);
    expect(bugs.some((f) => f.id === "fb-type-idea")).toBe(false);
    expect(ideas.some((f) => f.id === "fb-type-idea")).toBe(true);
    expect(ideas.some((f) => f.id === "fb-type-bug")).toBe(false);
  });

  it("getNewFeedback filters by since timestamp", async () => {
    const before = Date.now();

    await db.addFeedback({
      id: "fb-since-1",
      type: "bug",
      status: "new",
      text: "Recent bug",
      platform: "telegram",
      platformId: "user-5",
    });

    // Query with a future timestamp should return nothing new
    const future = Date.now() + 10_000;
    const empty = await db.getNewFeedback(future);
    expect(empty.some((f) => f.id === "fb-since-1")).toBe(false);

    // Query with a past timestamp should include our item
    const results = await db.getNewFeedback(before - 1000);
    expect(results.some((f) => f.id === "fb-since-1")).toBe(true);
  });

  it("updateFeedbackStatus changes status and updatedAt", async () => {
    await db.addFeedback({
      id: "fb-status-1",
      type: "idea",
      status: "new",
      text: "Status test",
      platform: "telegram",
      platformId: "user-6",
    });

    const before = await db.getFeedback("fb-status-1");
    expect(before!.status).toBe("new");

    // Small delay to ensure updatedAt changes
    await new Promise((r) => setTimeout(r, 10));

    await db.updateFeedbackStatus("fb-status-1", "responded");

    const after = await db.getFeedback("fb-status-1");
    expect(after!.status).toBe("responded");
    expect(after!.updatedAt).toBeGreaterThanOrEqual(before!.updatedAt);
  });
});

// ============================================================================
// HANDLER TESTS
// ============================================================================

describe("handleFeedback", () => {
  it("/bug with description stores feedback and returns ack", async () => {
    const message = createMockMessage({
      sender: { platformId: "handler-user-1", displayName: "Gardener" },
      content: { type: "command", name: "bug", args: ["the", "map", "is", "broken"] },
    });
    const user = createMockUser({
      platformId: "handler-user-1",
      currentGarden: "0x" + "b".repeat(40),
    });

    const result = await handleFeedback(message, user, "bug", mockDeps);

    expect(result.response.text).toContain("logged this bug");
    expect(result.updateSession).toBeUndefined();
    expect(result.clearSession).toBeUndefined();

    // Verify it was stored
    const stored = await db.getFeedback(`test-feedback-${idCounter}`);
    expect(stored).toBeDefined();
    expect(stored!.type).toBe("bug");
    expect(stored!.text).toBe("the map is broken");
    expect(stored!.gardenAddress).toBe("0x" + "b".repeat(40));
  });

  it("/bug with no args returns usage text", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "bug", args: [] },
    });
    const user = createMockUser();

    const result = await handleFeedback(message, user, "bug", mockDeps);

    expect(result.response.text).toContain("Usage:");
    expect(result.response.text).toContain("/bug");
  });

  it("/idea stores feedback with type idea", async () => {
    const message = createMockMessage({
      sender: { platformId: "handler-user-2" },
      content: { type: "command", name: "idea", args: ["add", "a", "leaderboard"] },
    });
    const user = createMockUser({ platformId: "handler-user-2" });

    const result = await handleFeedback(message, user, "idea", mockDeps);

    expect(result.response.text).toContain("idea");

    const stored = await db.getFeedback(`test-feedback-${idCounter}`);
    expect(stored).toBeDefined();
    expect(stored!.type).toBe("idea");
    expect(stored!.text).toBe("add a leaderboard");
  });

  it("stores displayName and gardenAddress from context", async () => {
    const message = createMockMessage({
      sender: { platformId: "handler-user-3", displayName: "Maria" },
      content: { type: "command", name: "bug", args: ["error submitting"] },
    });
    const user = createMockUser({
      platformId: "handler-user-3",
      currentGarden: "0x" + "c".repeat(40),
    });

    await handleFeedback(message, user, "bug", mockDeps);

    const stored = await db.getFeedback(`test-feedback-${idCounter}`);
    expect(stored!.displayName).toBe("Maria");
    expect(stored!.gardenAddress).toBe("0x" + "c".repeat(40));
  });
});

// ============================================================================
// API TESTS
// ============================================================================

describe("Feedback API", () => {
  let app: Awaited<ReturnType<typeof import("../api/server").createServer>>;
  const API_TOKEN = "test-api-token-12345";

  beforeAll(async () => {
    const { createServer } = await import("../api/server");
    app = createServer(
      {
        isAIReady: () => true,
        botApiToken: API_TOKEN,
        notifier: {
          notify: async () => {},
        },
      },
      { logger: false }
    );
  });

  it("rejects requests without auth token", async () => {
    const response = await app.request("/api/feedback");
    expect(response.status).toBe(401);
  });

  it("rejects requests with wrong auth token", async () => {
    const response = await app.request("/api/feedback", {
      method: "GET",
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(response.status).toBe(401);
  });

  it("GET /api/feedback returns new feedback", async () => {
    // Seed a feedback item
    await db.addFeedback({
      id: "fb-api-get-1",
      type: "bug",
      status: "new",
      text: "API test bug",
      platform: "telegram",
      platformId: "api-user-1",
    });

    const response = await app.request("/api/feedback?type=bug", {
      method: "GET",
      headers: { authorization: `Bearer ${API_TOKEN}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.feedback.some((f: { id: string }) => f.id === "fb-api-get-1")).toBe(true);
  });

  it("PATCH /api/feedback/:id updates status", async () => {
    await db.addFeedback({
      id: "fb-api-patch-1",
      type: "idea",
      status: "new",
      text: "Patch test",
      platform: "telegram",
      platformId: "api-user-2",
    });

    const response = await app.request("/api/feedback/fb-api-patch-1", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "triaged" }),
    });

    expect(response.status).toBe(200);

    const updated = await db.getFeedback("fb-api-patch-1");
    expect(updated!.status).toBe("triaged");
  });

  it("PATCH /api/feedback/:id rejects invalid status", async () => {
    const response = await app.request("/api/feedback/fb-api-patch-1", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "invalid" }),
    });

    expect(response.status).toBe(400);
  });

  it("POST /api/notify rejects invalid platform", async () => {
    const response = await app.request("/api/notify", {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        platform: "unknown-platform",
        platformId: "123",
        message: "Hello",
      }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Invalid platform");
  });

  it("POST /api/notify sends message and marks responded", async () => {
    let notifyCalled = false;
    const { createServer } = await import("../api/server");
    const appWithNotifier = createServer(
      {
        isAIReady: () => true,
        botApiToken: API_TOKEN,
        notifier: {
          notify: async (platform, platformId, message) => {
            notifyCalled = true;
            expect(platform).toBe("telegram");
            expect(platformId).toBe("notify-user-1");
            expect(message).toBe("We fixed your bug!");
          },
        },
      },
      { logger: false }
    );

    await db.addFeedback({
      id: "fb-api-notify-1",
      type: "bug",
      status: "triaged",
      text: "Notify test",
      platform: "telegram",
      platformId: "notify-user-1",
    });

    const response = await appWithNotifier.request("/api/notify", {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        platform: "telegram",
        platformId: "notify-user-1",
        message: "We fixed your bug!",
        feedbackId: "fb-api-notify-1",
      }),
    });

    expect(response.status).toBe(200);
    expect(notifyCalled).toBe(true);

    const updated = await db.getFeedback("fb-api-notify-1");
    expect(updated!.status).toBe("responded");
  });
});
