/**
 * Handler Tests
 *
 * Tests for the core message handlers (start, join, submit).
 */

import fs from "fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { handleApprove } from "../handlers/approve";
import { handleMessage } from "../handlers/index";
import { handleJoin, type JoinDeps } from "../handlers/join";
import { handleReject } from "../handlers/reject";
import { handleStart, type StartDeps } from "../handlers/start";
import {
  handleCancelSubmission,
  handleConfirmSubmission,
  handleTextSubmission,
  type SubmitDeps,
} from "../handlers/submit";
import { initAI } from "../services/ai";
import * as blockchain from "../services/blockchain";
import * as db from "../services/db";
import { initDB } from "../services/db";
import { rateLimiter } from "../services/rate-limiter";
import type { InboundMessage, PendingWork, Session, User } from "../types";
import { mockLogger } from "./utils/mocks";

// Set up test environment
const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/handlers-test-${process.pid}-${Date.now()}.db`;

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
  initAI();
});

afterAll(async () => {
  await db.closeDB();
  removeTestDatabaseFiles();
});

afterEach(() => {
  vi.restoreAllMocks();
  mockLogger.error.mockClear();
  rateLimiter.resetAll("user-123");
  rateLimiter.resetAll("operator-123");
});

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "msg-123",
    platform: "telegram",
    chat: { id: "chat-private", type: "private" },
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

function createPendingWork(overrides: Partial<PendingWork> = {}): PendingWork {
  return {
    id: "work-123",
    actionUID: 1,
    gardenerAddress: "0x" + "2".repeat(40),
    gardenerPlatform: "telegram",
    gardenerPlatformId: "gardener-123",
    gardenAddress: "0x" + "3".repeat(40),
    data: {
      actionUID: 1,
      title: "Submission",
      plantSelection: ["oak"],
      plantCount: 5,
      feedback: "planted 5 oak trees",
      media: [],
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

function createSubmissionSession(overrides: Partial<Session> = {}): Session {
  return {
    platform: "telegram",
    platformId: "user-123",
    step: "confirming_work",
    draft: {
      tasks: [{ type: "planting", species: "oak", count: 5 }],
      notes: "planted 5 oak trees",
      date: "2026-05-04",
    },
    updatedAt: Date.now(),
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

  it("localizes first-time onboarding when Telegram provides Spanish locale", async () => {
    const message = createMockMessage({
      sender: { platformId: `new-user-es-${Date.now()}` },
      content: { type: "command", name: "start", args: [] },
      locale: "es-MX",
    });

    const deps: StartDeps = {
      generatePrivateKey: () => `0x${"b".repeat(64)}` as `0x${string}`,
    };

    const result = await handleStart(message, deps);

    expect(result.response.text).toContain("Bienvenido a Green Goods");
    expect(result.response.text).not.toContain("Welcome to Green Goods");
    const user = await db.getUser(message.platform, message.sender.platformId);
    expect(user?.locale).toBe("es-MX");
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

  it("updates the stored locale when a returning user starts from another language", async () => {
    const platformId = `returning-locale-${Date.now()}`;
    await db.createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "d".repeat(64),
      address: "0x" + "5".repeat(40),
      role: "gardener",
      locale: "en",
    });

    const message = createMockMessage({
      sender: { platformId },
      content: { type: "command", name: "start", args: [] },
      locale: "pt-BR",
    });

    const result = await handleStart(message, {
      generatePrivateKey: () => `0x${"e".repeat(64)}` as `0x${string}`,
    });

    expect(result.response.text).toContain("Boas-vindas de volta");
    const user = await db.getUser("telegram", platformId);
    expect(user?.locale).toBe("pt-BR");
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

  it("keeps garden lookup failures generic for users while logging detail", async () => {
    const internalError = new Error("RPC lookup leaked detail: upstream token join-secret");
    const message = createMockMessage({
      content: { type: "command", name: "join", args: ["0x" + "3".repeat(40)] },
    });
    const user = createMockUser();
    const deps: JoinDeps = {
      isValidAddress: () => true,
    };

    vi.spyOn(blockchain, "getGardenInfo").mockRejectedValueOnce(internalError);

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("An unexpected error occurred. Please try again.");
    expect(result.response.text).not.toContain("join-secret");
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: internalError,
        category: "internal",
        gardenAddress: "0x" + "3".repeat(40),
      }),
      "Garden join lookup error"
    );
  });

  it("does not join when the garden contract is missing", async () => {
    const gardenAddress = "0x" + "3".repeat(40);
    const message = createMockMessage({
      content: { type: "command", name: "join", args: [gardenAddress] },
    });
    const user = createMockUser();
    const deps: JoinDeps = {
      isValidAddress: () => true,
    };

    vi.spyOn(blockchain, "getGardenInfo").mockResolvedValueOnce({
      exists: false,
      address: gardenAddress,
    });
    const updateUser = vi.spyOn(db, "updateUser");

    const result = await handleJoin(message, user, deps);

    expect(result.response.text).toContain("Garden not found");
    expect(updateUser).not.toHaveBeenCalled();
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

  it("parses the localized Spanish and Portuguese examples shown to users", async () => {
    const user = createMockUser({ currentGarden: "0x" + "3".repeat(40) });
    const deps: SubmitDeps = {
      generateId: () => "test-id-123",
    };

    const spanish = await handleTextSubmission(
      createMockMessage({
        content: { type: "text", text: "Hoy planté 5 árboles" },
        locale: "es-MX",
      }),
      user,
      deps
    );
    const portuguese = await handleTextSubmission(
      createMockMessage({
        content: { type: "text", text: "Removi 10 kg de ervas daninhas" },
        locale: "pt-BR",
      }),
      user,
      deps
    );

    expect(spanish.response.text).toContain("Confirma tu envío");
    expect(spanish.updateSession).toBeDefined();
    expect(portuguese.response.text).toContain("Confirme seu envio");
    expect(portuguese.updateSession).toBeDefined();
  });

  it("blocks operator accounts from starting gardener work submissions", async () => {
    const message = createMockMessage({
      content: { type: "text", text: "I planted 5 trees today" },
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: "0x" + "3".repeat(40),
    });
    const deps: SubmitDeps = {
      generateId: () => "test-id-123",
    };

    const result = await handleTextSubmission(message, operator, deps);

    expect(result.response.text).toContain("only available for gardeners");
    expect(result.updateSession).toBeUndefined();
  });
});

describe("handleConfirmSubmission", () => {
  it("blocks operator accounts from confirming gardener work submissions", async () => {
    const message = createMockMessage({
      id: "confirm-operator-1",
      content: { type: "callback", data: "confirm_submission" },
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: "0x" + "3".repeat(40),
    });
    const session = createSubmissionSession();
    const addPendingWork = vi.spyOn(db, "addPendingWork");

    const result = await handleConfirmSubmission(message, operator, session, {
      generateId: () => "pending-operator",
    });

    expect(result.response.text).toContain("only available for gardeners");
    expect(addPendingWork).not.toHaveBeenCalled();
  });

  it("deduplicates repeated confirm callbacks by external message id", async () => {
    const message = createMockMessage({
      id: "confirm-duplicate-1",
      content: { type: "callback", data: "confirm_submission" },
    });
    const gardener = createMockUser({
      currentGarden: "0x" + "3".repeat(40),
    });
    const session = createSubmissionSession();
    const addPendingWork = vi.spyOn(db, "addPendingWork");
    const generateId = vi.fn(() => "pending-id-1");

    const first = await handleConfirmSubmission(message, gardener, session, { generateId });
    const second = await handleConfirmSubmission(message, gardener, session, { generateId });

    expect(first.response.text).toContain("pending-id-1");
    expect(second.response.text).toBe(first.response.text);
    expect(addPendingWork).toHaveBeenCalledTimes(1);
    expect(generateId).toHaveBeenCalledTimes(1);
  });

  it("notifies operators in the operator's stored locale", async () => {
    const gardenAddress = "0x" + "6".repeat(40);
    const operatorPlatformId = `operator-locale-${Date.now()}`;
    vi.spyOn(db, "getOperatorForGarden").mockResolvedValueOnce(
      createMockUser({
        platformId: operatorPlatformId,
        address: "0x" + "7".repeat(40),
        currentGarden: gardenAddress,
        role: "operator",
        locale: "pt-BR",
      })
    );

    const message = createMockMessage({
      id: "confirm-recipient-locale-1",
      content: { type: "callback", data: "confirm_submission" },
      locale: "es-MX",
    });
    const gardener = createMockUser({
      currentGarden: gardenAddress,
    });
    const session = createSubmissionSession();
    const notifyOperator = vi.fn<(operatorPlatformId: string, message: string) => Promise<void>>(
      async () => undefined
    );
    const addPendingWork = vi.spyOn(db, "addPendingWork");

    await handleConfirmSubmission(message, gardener, session, {
      generateId: () => "pending-recipient-locale",
      notifyOperator,
    });

    expect(addPendingWork).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Submission",
        }),
      })
    );
    expect(notifyOperator).toHaveBeenCalledWith(
      operatorPlatformId,
      expect.stringContaining("Novo envio de trabalho")
    );
    expect(notifyOperator.mock.calls[0]?.[1]).not.toContain("Nuevo envío de trabajo");
  });

  it("returns in-progress for duplicate confirm callbacks before session lookup", async () => {
    const message = createMockMessage({
      id: "confirm-in-progress-1",
      content: { type: "callback", data: "confirm_submission" },
    });
    const gardener = createMockUser({
      currentGarden: "0x" + "3".repeat(40),
    });

    await db.claimIdempotencyKey({
      key: `submit-confirm:${message.platform}:${message.sender.platformId}:${message.id}`,
      handler: "submit-confirm",
      platform: message.platform,
      platformId: message.sender.platformId,
      messageId: message.id,
    });

    vi.spyOn(db, "getUser").mockResolvedValueOnce(gardener);
    const getSession = vi.spyOn(db, "getSession");

    const result = await handleMessage(message);

    expect(result.text).toContain("already being processed");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("keeps storage failures generic for users while logging detail", async () => {
    const internalError = new Error("sqlite leaked detail: disk path /secret/agent.db");
    const message = createMockMessage({
      id: "confirm-error-1",
      content: { type: "callback", data: "confirm_submission" },
    });
    const gardener = createMockUser({
      currentGarden: "0x" + "3".repeat(40),
    });
    const session = createSubmissionSession();

    vi.spyOn(db, "addPendingWork").mockRejectedValueOnce(internalError);

    const result = await handleConfirmSubmission(message, gardener, session, {
      generateId: () => "pending-error-1",
    });

    expect(result.response.text).toContain("An unexpected error occurred. Please try again.");
    expect(result.response.text).not.toContain("/secret/agent.db");
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: internalError,
        category: "internal",
        handler: "submit",
        externalMessageId: "confirm-error-1",
      }),
      "Submission confirmation error"
    );
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

// ============================================================================
// APPROVE HANDLER
// ============================================================================

describe("handleApprove", () => {
  it("blocks non-operator accounts before approval side effects", async () => {
    const pendingWork = createPendingWork();
    const message = createMockMessage({
      content: { type: "command", name: "approve", args: [pendingWork.id] },
    });
    const gardener = createMockUser({
      role: "gardener",
      currentGarden: pendingWork.gardenAddress,
    });
    const isOperator = vi.spyOn(blockchain, "isOperator");
    const submitWork = vi.spyOn(blockchain, "submitWork");

    vi.spyOn(db, "getPendingWork").mockResolvedValueOnce(pendingWork);

    const result = await handleApprove(message, gardener, {});

    expect(result.response.text).toContain("Permission Denied");
    expect(isOperator).not.toHaveBeenCalled();
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("keeps internal approval failures generic for users while logging detail", async () => {
    const internalError = new Error("RPC provider leaked detail: upstream token abc123");
    const workId = "work-123";
    const pendingWork = createPendingWork({ id: workId });

    const message = createMockMessage({
      content: { type: "command", name: "approve", args: [workId] },
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: pendingWork.gardenAddress,
    });
    const gardener = createMockUser({
      platformId: pendingWork.gardenerPlatformId,
      privateKey: "0x" + "b".repeat(64),
      address: pendingWork.gardenerAddress,
    });

    vi.spyOn(db, "getPendingWork").mockResolvedValueOnce(pendingWork);
    vi.spyOn(db, "getUser").mockResolvedValueOnce(gardener);
    vi.spyOn(blockchain, "isOperator").mockResolvedValueOnce({ verified: true });
    vi.spyOn(blockchain, "submitWork").mockRejectedValueOnce(internalError);

    const result = await handleApprove(message, operator, {});

    expect(result.response.text).toContain("An unexpected error occurred. Please try again.");
    expect(result.response.text).not.toContain("RPC provider leaked detail");
    expect(result.response.text).not.toContain("abc123");
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: internalError,
        category: "internal",
        workId,
      }),
      "Approval error"
    );
  });

  it("deduplicates repeated approvals by external message id", async () => {
    const workId = "work-duplicate";
    const pendingWork = createPendingWork({ id: workId });
    const message = createMockMessage({
      id: "approve-duplicate-1",
      content: { type: "command", name: "approve", args: [workId] },
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: pendingWork.gardenAddress,
    });
    const gardener = createMockUser({
      platformId: pendingWork.gardenerPlatformId,
      privateKey: "0x" + "b".repeat(64),
      address: pendingWork.gardenerAddress,
    });
    const submitWork = vi.spyOn(blockchain, "submitWork").mockResolvedValue(`0x${"c".repeat(64)}`);
    const submitApproval = vi
      .spyOn(blockchain, "submitApproval")
      .mockResolvedValue(`0x${"d".repeat(64)}`);

    vi.spyOn(db, "getPendingWork").mockResolvedValue(pendingWork);
    vi.spyOn(db, "getUser").mockResolvedValue(gardener);
    vi.spyOn(blockchain, "isOperator").mockResolvedValue({ verified: true });
    vi.spyOn(db, "removePendingWork").mockResolvedValue();

    const first = await handleApprove(message, operator, {});
    const second = await handleApprove(message, operator, {});

    expect(first.response.text).toContain("Work approved and attested");
    expect(second.response.text).toBe(first.response.text);
    expect(submitWork).toHaveBeenCalledTimes(1);
    expect(submitApproval).toHaveBeenCalledTimes(1);
  });

  it("keeps protocol metadata canonical and notifies gardeners in their stored locale", async () => {
    const workId = "work-locale-protocol";
    const pendingWork = createPendingWork({ id: workId });
    const message = createMockMessage({
      id: "approve-locale-protocol-1",
      content: { type: "command", name: "approve", args: [workId] },
      locale: "es-MX",
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: pendingWork.gardenAddress,
      locale: "es-MX",
    });
    const gardener = createMockUser({
      platformId: pendingWork.gardenerPlatformId,
      privateKey: "0x" + "b".repeat(64),
      address: pendingWork.gardenerAddress,
      locale: "pt-BR",
    });
    const submitWork = vi.spyOn(blockchain, "submitWork").mockResolvedValue(`0x${"c".repeat(64)}`);
    const submitApproval = vi
      .spyOn(blockchain, "submitApproval")
      .mockResolvedValue(`0x${"d".repeat(64)}`);
    const notifyGardener = vi.fn<
      (platform: string, platformId: string, message: string) => Promise<void>
    >(async () => undefined);

    vi.spyOn(db, "getPendingWork").mockResolvedValueOnce(pendingWork);
    vi.spyOn(db, "getUser").mockResolvedValueOnce(gardener);
    vi.spyOn(blockchain, "isOperator").mockResolvedValueOnce({ verified: true });
    vi.spyOn(db, "removePendingWork").mockResolvedValueOnce();

    const result = await handleApprove(message, operator, { notifyGardener });

    expect(result.response.text).toContain("Trabajo aprobado y atestiguado");
    expect(submitWork).toHaveBeenCalledWith(
      expect.objectContaining({ actionTitle: "Work Submission" })
    );
    expect(submitApproval).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: "Approved via bot" })
    );
    expect(notifyGardener).toHaveBeenCalledWith(
      pendingWork.gardenerPlatform,
      pendingWork.gardenerPlatformId,
      expect.stringContaining("Seu trabalho foi aprovado")
    );
    expect(notifyGardener.mock.calls[0]?.[2]).not.toContain("Tu trabajo fue aprobado");
  });

  it("returns in-progress for duplicate approvals before pending-work lookup", async () => {
    const workId = "work-in-progress";
    const message = createMockMessage({
      id: "approve-in-progress-1",
      content: { type: "command", name: "approve", args: [workId] },
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: "0x" + "3".repeat(40),
    });

    await db.claimIdempotencyKey({
      key: `approve:${message.platform}:${message.sender.platformId}:${message.id}`,
      handler: "approve",
      platform: message.platform,
      platformId: message.sender.platformId,
      messageId: message.id,
    });

    const getPendingWork = vi.spyOn(db, "getPendingWork");

    const result = await handleApprove(message, operator, {});

    expect(result.response.text).toContain("already being processed");
    expect(getPendingWork).not.toHaveBeenCalled();
  });
});

// ============================================================================
// REJECT HANDLER
// ============================================================================

describe("handleReject", () => {
  it("blocks non-operator accounts before rejection side effects", async () => {
    const pendingWork = createPendingWork();
    const message = createMockMessage({
      content: { type: "command", name: "reject", args: [pendingWork.id, "not enough detail"] },
    });
    const gardener = createMockUser({
      role: "gardener",
      currentGarden: pendingWork.gardenAddress,
    });
    const isOperator = vi.spyOn(blockchain, "isOperator");
    const removePendingWork = vi.spyOn(db, "removePendingWork");

    vi.spyOn(db, "getPendingWork").mockResolvedValueOnce(pendingWork);

    const result = await handleReject(message, gardener, {});

    expect(result.response.text).toContain("Permission Denied");
    expect(isOperator).not.toHaveBeenCalled();
    expect(removePendingWork).not.toHaveBeenCalled();
  });

  it("keeps internal rejection failures generic for users while logging detail", async () => {
    const internalError = new Error("db leaked detail: row lock reject-secret");
    const pendingWork = createPendingWork();
    const message = createMockMessage({
      content: { type: "command", name: "reject", args: [pendingWork.id, "not enough detail"] },
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: pendingWork.gardenAddress,
    });

    vi.spyOn(db, "getPendingWork").mockResolvedValueOnce(pendingWork);
    vi.spyOn(blockchain, "isOperator").mockResolvedValueOnce({ verified: true });
    vi.spyOn(db, "removePendingWork").mockRejectedValueOnce(internalError);

    const result = await handleReject(message, operator, {});

    expect(result.response.text).toContain("An unexpected error occurred. Please try again.");
    expect(result.response.text).not.toContain("reject-secret");
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: internalError,
        category: "internal",
        workId: pendingWork.id,
      }),
      "Rejection error"
    );
  });

  it("notifies rejected gardeners in their stored locale", async () => {
    const pendingWork = createPendingWork({ id: "work-reject-locale" });
    const message = createMockMessage({
      id: "reject-recipient-locale-1",
      content: { type: "command", name: "reject", args: [pendingWork.id, "needs photos"] },
      locale: "es-MX",
    });
    const operator = createMockUser({
      role: "operator",
      currentGarden: pendingWork.gardenAddress,
      locale: "es-MX",
    });
    const gardener = createMockUser({
      platformId: pendingWork.gardenerPlatformId,
      address: pendingWork.gardenerAddress,
      locale: "pt-BR",
    });
    const notifyGardener = vi.fn<
      (platform: string, platformId: string, message: string) => Promise<void>
    >(async () => undefined);

    vi.spyOn(db, "getPendingWork").mockResolvedValueOnce(pendingWork);
    vi.spyOn(blockchain, "isOperator").mockResolvedValueOnce({ verified: true });
    vi.spyOn(db, "removePendingWork").mockResolvedValueOnce();
    vi.spyOn(db, "getUser").mockResolvedValueOnce(gardener);

    const result = await handleReject(message, operator, { notifyGardener });

    expect(result.response.text).toContain("Trabajo");
    expect(notifyGardener).toHaveBeenCalledWith(
      pendingWork.gardenerPlatform,
      pendingWork.gardenerPlatformId,
      expect.stringContaining("Seu trabalho foi rejeitado")
    );
    expect(notifyGardener.mock.calls[0]?.[2]).not.toContain("Tu trabajo fue rechazado");
  });
});

// ============================================================================
// ROUTER RATE-LIMIT BOUNDARIES
// ============================================================================

describe("handleMessage rate-limit boundaries", () => {
  it("stores the latest inbound locale for existing users before routing", async () => {
    const platformId = `router-locale-${Date.now()}`;
    const user = createMockUser({
      platformId,
      currentGarden: "0x" + "3".repeat(40),
      locale: "en",
    });
    await db.createUser(user);

    await handleMessage(
      createMockMessage({
        sender: { platformId },
        content: { type: "command", name: "status", args: [] },
        locale: "pt-BR",
      })
    );

    const updated = await db.getUser("telegram", platformId);
    expect(updated?.locale).toBe("pt-BR");
  });

  it("keeps status and pending commands available after command-rate exhaustion", async () => {
    const user = createMockUser({
      platformId: "operator-123",
      role: "operator",
      currentGarden: "0x" + "3".repeat(40),
    });
    vi.spyOn(db, "getUser").mockResolvedValue(user);
    vi.spyOn(db, "getSession").mockResolvedValue(undefined);
    vi.spyOn(db, "getPendingWorksForGarden").mockResolvedValue([]);

    for (let i = 0; i < 20; i++) {
      rateLimiter.check(user.platformId, "command");
    }

    const status = await handleMessage(
      createMockMessage({
        sender: { platformId: user.platformId },
        content: { type: "command", name: "status", args: [] },
      })
    );
    const pending = await handleMessage(
      createMockMessage({
        sender: { platformId: user.platformId },
        content: { type: "command", name: "pending", args: [] },
      })
    );

    expect(status.text).toContain("Your Status");
    expect(pending.text).toContain("No pending work submissions");
    expect(status.text).not.toContain("Too many commands");
    expect(pending.text).not.toContain("Too many commands");
  });
});
