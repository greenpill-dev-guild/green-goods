/**
 * Handler Tests
 *
 * Tests for the core message handlers (start, join, submit).
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleStart, type StartDeps } from "../core/handlers/start";
import { handleJoin, type JoinDeps } from "../core/handlers/join";
import {
  handleTextSubmission,
  handleVoiceSubmission,
  handleConfirmSubmission,
  handleCancelSubmission,
  type SubmitDeps,
} from "../core/handlers/submit";
import type { InboundMessage } from "../core/contracts/message";
import type { StoragePort, User } from "../ports/storage";
import type { BlockchainPort, GardenInfo } from "../ports/blockchain";
import type { AIPort, ParsedWorkData } from "../ports/ai";
import type { Session } from "../core/contracts/response";

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

// ============================================================================
// START HANDLER TESTS
// ============================================================================

describe("handleStart", () => {
  let storage: StoragePort;
  let deps: StartDeps;

  beforeEach(() => {
    storage = createMockStoragePort();
    deps = {
      storage,
      generatePrivateKey: () => ("0x" + "a".repeat(64)) as `0x${string}`,
    };
  });

  it("creates wallet for new user", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "start", args: [] },
    });

    const result = await handleStart(message, deps);

    expect(result.response.text).toContain("Welcome to Green Goods");
    expect(result.response.text).toContain("I've created a wallet");
    expect(result.response.parseMode).toBe("markdown");
    expect(storage.createUser).toHaveBeenCalled();
  });

  it("welcomes back existing user", async () => {
    const existingUser = createMockUser({
      currentGarden: "0x" + "2".repeat(40),
    });
    storage = createMockStoragePort({
      getUser: mock(() => Promise.resolve(existingUser)),
    });
    deps.storage = storage;

    const message = createMockMessage({
      content: { type: "command", name: "start", args: [] },
    });

    const result = await handleStart(message, deps);

    expect(result.response.text).toContain("Welcome back");
    expect(result.response.text).toContain(existingUser.address.slice(0, 6));
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it("shows not joined status for user without garden", async () => {
    const existingUser = createMockUser({ currentGarden: undefined });
    storage = createMockStoragePort({
      getUser: mock(() => Promise.resolve(existingUser)),
    });
    deps.storage = storage;

    const message = createMockMessage({
      content: { type: "command", name: "start", args: [] },
    });

    const result = await handleStart(message, deps);

    expect(result.response.text).toContain("Not joined");
  });
});

// ============================================================================
// JOIN HANDLER TESTS
// ============================================================================

describe("handleJoin", () => {
  let storage: StoragePort;
  let blockchain: BlockchainPort;
  let deps: JoinDeps;
  let user: User;

  beforeEach(() => {
    storage = createMockStoragePort();
    blockchain = createMockBlockchainPort();
    user = createMockUser();
    deps = {
      storage,
      blockchain,
      isValidAddress: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    };
  });

  it("shows usage when no address provided", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "join", args: [] },
    });

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Usage");
    expect(result.response.text).toContain("/join");
  });

  it("rejects invalid address format", async () => {
    const message = createMockMessage({
      content: { type: "command", name: "join", args: ["invalid-address"] },
    });

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Invalid address format");
  });

  it("rejects non-existent garden", async () => {
    blockchain = createMockBlockchainPort({
      getGardenInfo: mock(() => Promise.resolve({ exists: false, address: "0x123" })),
    });
    deps.blockchain = blockchain;

    const gardenAddress = "0x" + "a".repeat(40);
    const message = createMockMessage({
      content: { type: "command", name: "join", args: [gardenAddress] },
    });

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Garden not found");
  });

  it("successfully joins valid garden", async () => {
    const gardenAddress = "0x" + "a".repeat(40);
    const gardenInfo: GardenInfo = {
      exists: true,
      name: "Test Garden",
      address: gardenAddress,
    };
    blockchain = createMockBlockchainPort({
      getGardenInfo: mock(() => Promise.resolve(gardenInfo)),
    });
    deps.blockchain = blockchain;

    const message = createMockMessage({
      content: { type: "command", name: "join", args: [gardenAddress] },
    });

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Joined garden successfully");
    expect(result.response.text).toContain("Test Garden");
    expect(storage.updateUser).toHaveBeenCalled();
  });
});

// ============================================================================
// SUBMIT HANDLER TESTS
// ============================================================================

describe("handleTextSubmission", () => {
  let storage: StoragePort;
  let ai: AIPort;
  let deps: SubmitDeps;
  let user: User;

  beforeEach(() => {
    storage = createMockStoragePort();
    ai = createMockAIPort();
    user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
    deps = {
      storage,
      ai,
      generateId: () => "work-123",
    };
  });

  it("parses work from text and shows confirmation", async () => {
    const message = createMockMessage({
      content: { type: "text", text: "I planted 5 trees today" },
    });

    const result = await handleTextSubmission(message, user, deps);

    expect(result.response.text).toContain("Confirm your submission");
    expect(result.response.text).toContain("planting");
    expect(result.response.buttons).toHaveLength(2);
    expect(result.updateSession?.step).toBe("confirming_work");
  });

  it("shows error when no tasks identified", async () => {
    ai = createMockAIPort({
      parseWorkText: mock(() =>
        Promise.resolve({
          tasks: [],
          notes: "",
          date: new Date().toISOString().split("T")[0],
        })
      ),
    });
    deps.ai = ai;

    const message = createMockMessage({
      content: { type: "text", text: "hello there" },
    });

    const result = await handleTextSubmission(message, user, deps);

    expect(result.response.text).toContain("couldn't identify any work tasks");
  });
});

describe("handleVoiceSubmission", () => {
  let storage: StoragePort;
  let ai: AIPort;
  let deps: SubmitDeps;
  let user: User;

  beforeEach(() => {
    storage = createMockStoragePort();
    ai = createMockAIPort();
    user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
    deps = {
      storage,
      ai,
      generateId: () => "work-123",
    };
  });

  it("parses work from transcribed text", async () => {
    const message = createMockMessage({
      content: { type: "voice", audioUrl: "file_id_123", mimeType: "audio/ogg" },
    });

    const result = await handleVoiceSubmission(message, user, "I planted 5 trees today", deps);

    expect(result.response.text).toContain("Confirm your submission");
    expect(result.updateSession?.step).toBe("confirming_work");
  });

  it("shows transcription when no tasks identified", async () => {
    ai = createMockAIPort({
      parseWorkText: mock(() =>
        Promise.resolve({
          tasks: [],
          notes: "",
          date: new Date().toISOString().split("T")[0],
        })
      ),
    });
    deps.ai = ai;

    const message = createMockMessage({
      content: { type: "voice", audioUrl: "file_id_123", mimeType: "audio/ogg" },
    });

    const result = await handleVoiceSubmission(message, user, "just saying hello", deps);

    expect(result.response.text).toContain("I heard:");
    expect(result.response.text).toContain("just saying hello");
    expect(result.response.text).toContain("couldn't identify any work tasks");
  });
});

describe("handleConfirmSubmission", () => {
  let storage: StoragePort;
  let ai: AIPort;
  let deps: SubmitDeps;
  let user: User;
  let session: Session;

  beforeEach(() => {
    storage = createMockStoragePort();
    ai = createMockAIPort();
    user = createMockUser({ currentGarden: "0x" + "2".repeat(40) });
    session = {
      platform: "telegram",
      platformId: "user-123",
      step: "confirming_work",
      draft: {
        tasks: [{ type: "planting", species: "trees", count: 5 }],
        notes: "Planted 5 trees",
        date: "2024-01-15",
      },
      updatedAt: Date.now(),
    };
    deps = {
      storage,
      ai,
      generateId: () => "work-123",
    };
  });

  it("creates pending work and clears session", async () => {
    const message = createMockMessage({
      content: { type: "callback", data: "confirm_submission" },
    });

    const result = await handleConfirmSubmission(message, user, session, deps);

    expect(result.response.text).toContain("Work submitted for approval");
    expect(result.response.text).toContain("work-123");
    expect(result.clearSession).toBe(true);
    expect(storage.addPendingWork).toHaveBeenCalled();
    expect(storage.clearSession).toHaveBeenCalled();
  });

  it("handles expired session", async () => {
    session.draft = undefined;

    const message = createMockMessage({
      content: { type: "callback", data: "confirm_submission" },
    });

    const result = await handleConfirmSubmission(message, user, session, deps);

    expect(result.response.text).toContain("Session expired");
    expect(result.clearSession).toBe(true);
  });

  it("notifies operator when available", async () => {
    const operator = createMockUser({
      platformId: "operator-456",
      role: "operator",
    });
    storage = createMockStoragePort({
      getOperatorForGarden: mock(() => Promise.resolve(operator)),
    });
    deps.storage = storage;

    const notifyOperator = mock(() => Promise.resolve());
    deps.notifyOperator = notifyOperator;

    const message = createMockMessage({
      content: { type: "callback", data: "confirm_submission" },
    });

    await handleConfirmSubmission(message, user, session, deps);

    expect(notifyOperator).toHaveBeenCalled();
  });
});

describe("handleCancelSubmission", () => {
  let storage: StoragePort;
  let ai: AIPort;
  let deps: SubmitDeps;

  beforeEach(() => {
    storage = createMockStoragePort();
    ai = createMockAIPort();
    deps = {
      storage,
      ai,
      generateId: () => "work-123",
    };
  });

  it("clears session and confirms cancellation", async () => {
    const message = createMockMessage({
      content: { type: "callback", data: "cancel_submission" },
    });

    const result = await handleCancelSubmission(message, deps);

    expect(result.response.text).toContain("Submission cancelled");
    expect(result.clearSession).toBe(true);
    expect(storage.clearSession).toHaveBeenCalled();
  });
});
