/**
 * Storage Tests
 *
 * Tests for the SQLite storage with real database operations.
 */

import fs from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// We'll use direct DB access instead of the adapter pattern
import { closeDB, getDB, initDB } from "../services/db";
import type { CreateUserInput, NewChatMessageInput, Session, WorkDraftData } from "../types";

// Test database path
const TEST_DB_DIR = "data/test";
const TEST_DB_PATH = `${TEST_DB_DIR}/test-storage-vitest-${process.pid}-${Date.now()}.db`;

beforeAll(() => {
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
  await closeDB();

  // Remove main database and companion WAL/SHM files
  const filesToRemove = [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`];
  for (const file of filesToRemove) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
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
      locale: "es-MX",
    };

    const created = await db.createUser(input);

    expect(created.platform).toBe("telegram");
    expect(created.platformId).toBe(platformId);
    expect(created.address).toBe(input.address);
    expect(created.locale).toBe("es-MX");

    const retrieved = await db.getUser("telegram", platformId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.address).toBe(input.address);
    expect(retrieved?.locale).toBe("es-MX");
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

  it("updates a user's last known locale independently of role and garden", async () => {
    const db = getDB();
    const platformId = `locale-user-${Date.now()}`;

    await db.createUser({
      platform: "telegram",
      platformId,
      privateKey: "0x" + "c".repeat(64),
      address: "0x" + "4".repeat(40),
      role: "gardener",
      locale: "en",
    });

    await db.updateUser("telegram", platformId, {
      locale: "pt-BR",
    });

    const updated = await db.getUser("telegram", platformId);
    expect(updated?.locale).toBe("pt-BR");
    expect(updated?.role).toBe("gardener");
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

// ============================================================================
// CHAT MESSAGE TESTS
// ============================================================================

describe("Chat Message Capture", () => {
  function buildChatMessageInput(
    overrides: Partial<NewChatMessageInput> = {}
  ): NewChatMessageInput {
    const seed = Date.now();
    return {
      id: `telegram:-100:${seed}`,
      platform: "telegram",
      chatId: "-1002847752257",
      threadId: "311",
      messageId: String(seed),
      senderPlatformId: "user-1",
      senderDisplayName: "Test Reporter",
      text: "the map keeps freezing on my phone",
      inferredType: "bug",
      postedAt: seed,
      ...overrides,
    };
  }

  it("persists a chat message with no attachments", async () => {
    const db = getDB();
    const input = buildChatMessageInput();

    const stored = await db.addChatMessage(input);

    expect(stored.id).toBe(input.id);
    expect(stored.inferredType).toBe("bug");
    expect(stored.status).toBe("new");
    expect(stored.attachments).toEqual([]);
  });

  it("persists attachments atomically with the message", async () => {
    const db = getDB();
    const input = buildChatMessageInput({
      id: `chat-with-attach-${Date.now()}`,
      messageId: `${Date.now()}`,
    });

    const stored = await db.addChatMessage(input, [
      {
        ordinal: 0,
        kind: "photo",
        telegramFileId: "file-photo-1",
        mimeType: "image/jpeg",
        fileSize: 12345,
        width: 800,
        height: 600,
      },
      {
        ordinal: 1,
        kind: "video",
        telegramFileId: "file-video-1",
        mimeType: "video/mp4",
        fileSize: 1024 * 1024,
        duration: 12,
      },
    ]);

    expect(stored.attachments).toHaveLength(2);
    const fetched = await db.getChatMessage(input.id);
    expect(fetched?.attachments).toHaveLength(2);

    const photo = await db.getChatMessageAttachment(input.id, 0);
    expect(photo?.kind).toBe("photo");
    expect(photo?.telegramFileId).toBe("file-photo-1");

    const video = await db.getChatMessageAttachment(input.id, 1);
    expect(video?.kind).toBe("video");
    expect(video?.duration).toBe(12);
  });

  it("filters new messages by chat, thread, and inferred type", async () => {
    const db = getDB();
    const seed = Date.now();
    const bug = await db.addChatMessage(
      buildChatMessageInput({
        id: `bug-${seed}`,
        messageId: `${seed}-bug`,
        threadId: "311",
        inferredType: "bug",
      })
    );
    const idea = await db.addChatMessage(
      buildChatMessageInput({
        id: `idea-${seed}`,
        messageId: `${seed}-idea`,
        threadId: "312",
        inferredType: "idea",
      })
    );

    const bugs = await db.getNewChatMessages({
      chatId: "-1002847752257",
      threadId: "311",
      inferredType: "bug",
    });

    const ids = bugs.map((message) => message.id);
    expect(ids).toContain(bug.id);
    expect(ids).not.toContain(idea.id);
    // All returned rows must have inferredType=bug and the right thread.
    expect(bugs.every((message) => message.inferredType === "bug")).toBe(true);
    expect(bugs.every((message) => message.threadId === "311")).toBe(true);
  });

  it("transitions status and reflects it in subsequent reads", async () => {
    const db = getDB();
    const stored = await db.addChatMessage(
      buildChatMessageInput({ id: `triage-${Date.now()}`, messageId: `${Date.now()}-triage` })
    );

    await db.updateChatMessageStatus(stored.id, "triaged");

    const newOnly = await db.getNewChatMessages({ chatId: stored.chatId, status: "new" });
    expect(newOnly.find((message) => message.id === stored.id)).toBeUndefined();

    const triagedOnly = await db.getNewChatMessages({
      chatId: stored.chatId,
      status: "triaged",
    });
    expect(triagedOnly.find((message) => message.id === stored.id)).toBeDefined();
  });

  it("atomically claims new messages for processing", async () => {
    const db = getDB();
    const stored = await db.addChatMessage(
      buildChatMessageInput({ id: `claim-${Date.now()}`, messageId: `${Date.now()}-claim` })
    );

    // Threshold far in the past: a fresh claim must never look like an expired
    // lease, no matter how many milliseconds the runner sleeps between calls.
    // (Date.now() - 1 here was flaky under full-suite parallelism: >=2ms between
    // the two claims made the first claim "stale" and the re-claim succeeded.)
    const staleProcessingBefore = Date.now() - 60_000;
    await expect(db.claimChatMessage(stored.id, staleProcessingBefore)).resolves.toBe(true);
    await expect(db.claimChatMessage(stored.id, staleProcessingBefore)).resolves.toBe(false);

    const processing = await db.getNewChatMessages({
      chatId: stored.chatId,
      status: "processing",
    });
    expect(processing.find((message) => message.id === stored.id)).toBeDefined();

    // Lease expiry is a deliberate branch, not an accident: a threshold ahead
    // of the claim timestamp treats the processing row as crashed and reclaims.
    await expect(db.claimChatMessage(stored.id, Date.now() + 1_000)).resolves.toBe(true);
  });

  it("can read all statuses for read-only clustering", async () => {
    const db = getDB();
    const seed = Date.now();
    const newMessage = await db.addChatMessage(
      buildChatMessageInput({ id: `all-new-${seed}`, messageId: `${seed}-all-new` })
    );
    const triagedMessage = await db.addChatMessage(
      buildChatMessageInput({ id: `all-triaged-${seed}`, messageId: `${seed}-all-triaged` })
    );
    await db.updateChatMessageStatus(triagedMessage.id, "triaged");

    const all = await db.getNewChatMessages({
      chatId: newMessage.chatId,
      inferredType: "bug",
      status: "all",
    });
    const ids = all.map((message) => message.id);
    expect(ids).toContain(newMessage.id);
    expect(ids).toContain(triagedMessage.id);
  });

  it("rolls back the message when attachment persistence fails", async () => {
    const db = getDB();
    const id = `rollback-${Date.now()}`;

    await expect(
      db.addChatMessage(buildChatMessageInput({ id, messageId: `${Date.now()}-rollback` }), [
        {
          ordinal: 0,
          kind: "photo",
          telegramFileId: "file-photo-dup-a",
          mimeType: "image/jpeg",
        },
        {
          ordinal: 0,
          kind: "photo",
          telegramFileId: "file-photo-dup-b",
          mimeType: "image/jpeg",
        },
      ])
    ).rejects.toThrow();

    expect(await db.getChatMessage(id)).toBeUndefined();
  });

  it("sweeps non-new rows older than the cutoff and cascades attachments", async () => {
    const db = getDB();
    const old = await db.addChatMessage(
      buildChatMessageInput({
        id: `sweep-${Date.now()}`,
        messageId: `${Date.now()}-sweep`,
        postedAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
      }),
      [
        {
          ordinal: 0,
          kind: "photo",
          telegramFileId: "file-old-photo",
          mimeType: "image/jpeg",
        },
      ]
    );
    await db.updateChatMessageStatus(old.id, "triaged");

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const result = await db.sweepStaleChatMessages(cutoff);

    expect(result.pruned).toBeGreaterThanOrEqual(1);
    expect(await db.getChatMessage(old.id)).toBeUndefined();
    expect(await db.getChatMessageAttachment(old.id, 0)).toBeUndefined();
  });

  it("does not prune rows still flagged 'new' regardless of age", async () => {
    const db = getDB();
    const stale = await db.addChatMessage(
      buildChatMessageInput({
        id: `stale-new-${Date.now()}`,
        messageId: `${Date.now()}-stale-new`,
        postedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      })
    );

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const result = await db.sweepStaleChatMessages(cutoff);

    expect(result.staleNew).toBeGreaterThanOrEqual(1);
    expect(await db.getChatMessage(stale.id)).toBeDefined();
  });
});
