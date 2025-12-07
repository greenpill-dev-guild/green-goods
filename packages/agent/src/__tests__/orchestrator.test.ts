/**
 * Orchestrator Tests
 *
 * Tests for the message orchestrator routing and session management.
 */

import { describe, it, expect, mock } from "bun:test";
import { Orchestrator, type OrchestratorDeps } from "../core/orchestrator";
import type { InboundMessage, Platform } from "../core/contracts/message";
import type { StoragePort, User } from "../ports/storage";
import type { BlockchainPort } from "../ports/blockchain";
import type { AIPort, ParsedWorkData } from "../ports/ai";

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

function createMockStoragePort(overrides: Partial<StoragePort> = {}): StoragePort {
  return {
    getUser: mock(() => Promise.resolve(undefined)),
    createUser: mock((input) => Promise.resolve({ ...input, createdAt: Date.now() } as User)),
    updateUser: mock(() => Promise.resolve()),
    getOperatorForGarden: mock(() => Promise.resolve(undefined)),
    getSession: mock(() => Promise.resolve(undefined)),
    setSession: mock(() => Promise.resolve()),
    clearSession: mock(() => Promise.resolve()),
    addPendingWork: mock(() => Promise.resolve()),
    getPendingWork: mock(() => Promise.resolve(undefined)),
    getPendingWorksForGarden: mock(() => Promise.resolve([])),
    removePendingWork: mock(() => Promise.resolve()),
    close: mock(() => Promise.resolve()),
    ...overrides,
  };
}

function createMockBlockchainPort(overrides: Partial<BlockchainPort> = {}): BlockchainPort {
  return {
    submitWork: mock(() => Promise.resolve(("0x" + "f".repeat(64)) as `0x${string}`)),
    submitApproval: mock(() => Promise.resolve(("0x" + "f".repeat(64)) as `0x${string}`)),
    isOperator: mock(() => Promise.resolve({ verified: false })),
    isGardener: mock(() => Promise.resolve({ verified: false })),
    getGardenInfo: mock(() =>
      Promise.resolve({ exists: true, name: "Test Garden", address: "0x123" })
    ),
    getChainId: mock(() => 84532),
    clearCache: mock(() => {}),
    ...overrides,
  };
}

function createMockAIPort(overrides: Partial<AIPort> = {}): AIPort {
  return {
    transcribe: mock(() => Promise.resolve("transcribed text")),
    parseWorkText: mock(() =>
      Promise.resolve({
        tasks: [{ type: "planting", species: "trees", count: 5 }],
        notes: "Planted 5 trees today",
        date: new Date().toISOString().split("T")[0],
      } as ParsedWorkData)
    ),
    isModelLoaded: mock(() => true),
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  return {
    storage: createMockStoragePort(),
    ai: createMockAIPort(),
    blockchain: createMockBlockchainPort(),
    rateLimiter: {
      check: () => ({ allowed: true, remaining: 10, resetIn: 60000, limit: 10 }),
      peek: () => ({ remaining: 10, limit: 10 }),
    },
    crypto: {
      generateSecurePrivateKey: () => ("0x" + "a".repeat(64)) as `0x${string}`,
      generateSecureId: () => "test-id-123",
      isValidAddress: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    },
    ...overrides,
  };
}

// ============================================================================
// ROUTING TESTS
// ============================================================================

describe("Orchestrator", () => {
  describe("message routing", () => {
    it("routes /start command correctly", async () => {
      const deps = createMockDeps();
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "command", name: "start", args: [] },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Welcome to Green Goods");
      expect(deps.storage.createUser).toHaveBeenCalled();
    });

    it("routes /help command without requiring user", async () => {
      const deps = createMockDeps();
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "command", name: "help", args: [] },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("/start");
      expect(response.text).toContain("/join");
    });

    it("requires user for most commands", async () => {
      const deps = createMockDeps();
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "command", name: "status", args: [] },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Please run /start first");
    });

    it("routes /join command when user exists", async () => {
      const user = createMockUser();
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "command", name: "join", args: ["0x" + "a".repeat(40)] },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Joined garden successfully");
    });

    it("returns error for unknown commands", async () => {
      const user = createMockUser();
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "command", name: "unknowncmd", args: [] },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Unknown command");
    });
  });

  describe("rate limiting", () => {
    it("blocks requests when rate limited", async () => {
      const deps = createMockDeps({
        rateLimiter: {
          check: () => ({
            allowed: false,
            remaining: 0,
            resetIn: 30000,
            limit: 10,
            message: "Too many requests",
          }),
          peek: () => ({ remaining: 0, limit: 10 }),
        },
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "command", name: "start", args: [] },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Please wait");
    });
  });

  describe("text message handling", () => {
    it("requires user for text messages", async () => {
      const deps = createMockDeps();
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "text", text: "I planted 5 trees" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Please run /start first");
    });

    it("requires garden for text messages", async () => {
      const user = createMockUser({ currentGarden: undefined });
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "text", text: "I planted 5 trees" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Please join a garden first");
    });

    it("parses text as work submission when user has garden", async () => {
      const user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "text", text: "I planted 5 trees" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Confirm your submission");
      expect(deps.storage.setSession).toHaveBeenCalled();
    });
  });

  describe("voice message handling", () => {
    it("requires voice processor for voice messages", async () => {
      const user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
        voiceProcessor: undefined,
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "voice", audioUrl: "file_id", mimeType: "audio/ogg" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Voice processing is not available");
    });

    it("processes voice when processor available", async () => {
      const user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
        voiceProcessor: {
          downloadAndTranscribe: mock(() => Promise.resolve("I planted 5 trees")),
        },
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "voice", audioUrl: "file_id", mimeType: "audio/ogg" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Confirm your submission");
    });

    it("handles voice processing errors gracefully", async () => {
      const user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
        voiceProcessor: {
          downloadAndTranscribe: mock(() => Promise.reject(new Error("Network error"))),
        },
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "voice", audioUrl: "file_id", mimeType: "audio/ogg" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Sorry, I couldn't process that audio");
      expect(response.text).toContain("Network error");
    });
  });

  describe("callback handling", () => {
    it("requires user for callbacks", async () => {
      const deps = createMockDeps();
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "callback", data: "confirm_submission" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Session expired");
    });

    it("handles unknown callback data", async () => {
      const user = createMockUser();
      const deps = createMockDeps({
        storage: createMockStoragePort({
          getUser: mock(() => Promise.resolve(user)),
        }),
      });
      const orchestrator = new Orchestrator(deps);

      const message = createMockMessage({
        content: { type: "callback", data: "unknown_action" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Unknown action");
    });
  });

  describe("unsupported message types", () => {
    it("returns error for unsupported content types", async () => {
      const deps = createMockDeps();
      const orchestrator = new Orchestrator(deps);

      // Force an unsupported content type
      const message = createMockMessage({
        content: { type: "image", imageUrl: "file_id", mimeType: "image/jpeg" },
      });

      const response = await orchestrator.handle(message);

      expect(response.text).toContain("Unsupported message type");
    });
  });
});

// ============================================================================
// SESSION UPDATE HELPER TESTS
// ============================================================================

describe("Orchestrator session updates", () => {
  it("saves session when updateSession is set", async () => {
    const user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
    const storage = createMockStoragePort({
      getUser: mock(() => Promise.resolve(user)),
    });
    const deps = createMockDeps({ storage });
    const orchestrator = new Orchestrator(deps);

    const message = createMockMessage({
      content: { type: "text", text: "I planted 5 trees" },
    });

    await orchestrator.handle(message);

    expect(storage.setSession).toHaveBeenCalled();
  });

  it("clears session when clearSession is true", async () => {
    const user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
    const session = {
      platform: "telegram" as Platform,
      platformId: "user-123",
      step: "confirming_work" as const,
      draft: { tasks: [] },
      updatedAt: Date.now(),
    };
    const storage = createMockStoragePort({
      getUser: mock(() => Promise.resolve(user)),
      getSession: mock(() => Promise.resolve(session)),
    });
    const deps = createMockDeps({ storage });
    const orchestrator = new Orchestrator(deps);

    const message = createMockMessage({
      content: { type: "callback", data: "cancel_submission" },
    });

    await orchestrator.handle(message);

    expect(storage.clearSession).toHaveBeenCalled();
  });
});
