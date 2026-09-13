import "fake-indexeddb/auto";
import { IDBObjectStore, IDBOpenDBRequest } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteDB, openDB } from "idb";
import { serializeFile } from "../../utils/storage/file-serialization";

const account = "0x1234567890abcdef1234567890abcdef12345678";
const chain = 11155111;
const legacyName = "green-goods-profile-avatar-drafts";
const canonicalName = "green-goods-drafts";
let close: (() => void) | undefined;
async function api() {
  const { draftDB } = await import("../../modules/job-queue/draft-db");
  const db = await draftDB.init();
  close = () => db.close();
  return { draftDB, db, ...(await import("../../modules/profile-avatar/drafts")) };
}
async function seedLegacy(updatedAt = 100) {
  const db = await openDB(legacyName, 1, {
    upgrade(database) {
      database.createObjectStore("drafts", { keyPath: "key" });
    },
  });
  const value = {
    key: `${chain}:${account}`,
    chainId: chain,
    address: account,
    action: "set",
    fileData: await serializeFile(
      new File(["retained bytes"], "avatar.png", { type: "image/png" })
    ),
    updatedAt,
  };
  await db.put("drafts", value);
  db.close();
  return value;
}

beforeEach(async () => {
  vi.resetModules();
  await deleteDB(canonicalName);
  await deleteDB(legacyName);
});
afterEach(() => {
  close?.();
  close = undefined;
  vi.restoreAllMocks();
});

describe("canonical work and avatar drafts", () => {
  it("writes avatar bytes to the canonical schema without consuming a work slot", async () => {
    const { db, draftDB, saveProfileAvatarDraft, loadProfileAvatarDraft } = await api();
    await saveProfileAvatarDraft(chain, account, {
      action: "set",
      file: new File(["photo"], "picked.png", { type: "image/png" }),
    });
    const records = await db.getAll("drafts");
    expect(records).toEqual([
      expect.objectContaining({
        kind: "profile-avatar",
        chainId: chain,
        fileData: expect.objectContaining({ name: "picked.png" }),
      }),
    ]);
    for (let n = 0; n < 20; n++)
      await draftDB.saveSnapshot(account, chain, `work-${n}`, {}, [], []);
    expect(await draftDB.getDraftCount(account, chain)).toBe(20);
    await expect(draftDB.saveSnapshot(account, chain, "too-many", {}, [], [])).rejects.toThrow(
      "draft-limit"
    );
    expect((await loadProfileAvatarDraft(chain, account))?.file?.name).toBe("picked.png");
    expect(await draftDB.getDraft(`avatar:${chain}:${account}`)).toBeUndefined();
  });

  it("copies legacy avatar bytes durably before removing their old entry", async () => {
    const legacy = await seedLegacy();
    const { db, loadProfileAvatarDraft } = await api();
    const loaded = await loadProfileAvatarDraft(chain, account);
    expect(loaded?.fileData?.data).toEqual(legacy.fileData.data);
    expect(await db.getAll("drafts")).toEqual([
      expect.objectContaining({ kind: "profile-avatar", updatedAt: 100 }),
    ]);
    const old = await openDB(legacyName);
    expect(await old.count("drafts")).toBe(0);
    old.close();
  });

  it("preserves a newer destination and isolates account/chain drafts", async () => {
    const { db, saveProfileAvatarDraft, loadProfileAvatarDraft, clearProfileAvatarDraft } =
      await api();
    await saveProfileAvatarDraft(chain, account, {
      action: "set",
      file: new File(["new"], "new.png"),
    });
    await seedLegacy(10);
    expect((await loadProfileAvatarDraft(chain, account))?.file?.name).toBe("new.png");
    await saveProfileAvatarDraft(chain + 1, account, { action: "clear" });
    await clearProfileAvatarDraft(chain, account);
    expect(await loadProfileAvatarDraft(chain, account)).toBeNull();
    expect(await loadProfileAvatarDraft(chain + 1, account)).toMatchObject({ action: "clear" });
    expect(
      await loadProfileAvatarDraft(chain, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ).toBeNull();
    expect(await db.count("drafts")).toBe(2);
  });

  it("retains recoverable source bytes on quota failure and resumes the copy", async () => {
    const legacy = await seedLegacy();
    const put = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.transaction.db.name === canonicalName && this.name === "drafts")
        throw new DOMException("full", "QuotaExceededError");
      return put.call(this, value, key);
    });
    const { db, loadProfileAvatarDraft } = await api();
    expect((await loadProfileAvatarDraft(chain, account))?.fileData?.data).toEqual(
      legacy.fileData.data
    );
    expect(await db.count("drafts")).toBe(0);
    const old = await openDB(legacyName);
    expect(await old.count("drafts")).toBe(1);
    failure.mockRestore();
    expect((await loadProfileAvatarDraft(chain, account))?.fileData?.data).toEqual(
      legacy.fileData.data
    );
    expect(await db.count("drafts")).toBe(1);
    expect(await old.count("drafts")).toBe(0);
    old.close();
  });

  it("retries interrupted source cleanup without replacing a successful copy", async () => {
    await seedLegacy();
    const remove = IDBObjectStore.prototype.delete;
    const failure = vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (
      this: IDBObjectStore,
      key
    ) {
      if (this.transaction.db.name === legacyName) throw new Error("interrupted");
      return remove.call(this, key);
    });
    const { db, loadProfileAvatarDraft } = await api();
    expect(await db.count("drafts")).toBe(1);
    expect(await db.count("draft_migrations")).toBe(1);
    const copied = await db.getAll("drafts");
    failure.mockRestore();
    await loadProfileAvatarDraft(chain, account);
    expect(await db.getAll("drafts")).toEqual(copied);
    const old = await openDB(legacyName);
    expect(await old.count("drafts")).toBe(0);
    old.close();
  });

  it("does not resurrect a cleared draft after interrupted legacy cleanup", async () => {
    await seedLegacy();
    const remove = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (
      this: IDBObjectStore,
      key
    ) {
      if (this.transaction.db.name === legacyName) throw new Error("interrupted");
      return remove.call(this, key);
    });
    const { clearProfileAvatarDraft, loadProfileAvatarDraft } = await api();
    await clearProfileAvatarDraft(chain, account);
    expect(await loadProfileAvatarDraft(chain, account)).toBeNull();
    vi.restoreAllMocks();
    expect(await loadProfileAvatarDraft(chain, account)).toBeNull();
  });

  it("upgrades existing work IDs, bytes and active identity in place", async () => {
    const old = await openDB(canonicalName, 2, {
      upgrade(database) {
        const drafts = database.createObjectStore("drafts", { keyPath: "id" });
        drafts.createIndex("userAddress", "userAddress");
        drafts.createIndex("chainId", "chainId");
        drafts.createIndex("gardenAddress", "gardenAddress");
        drafts.createIndex("updatedAt", "updatedAt");
        drafts.createIndex("userAddress_chainId", ["userAddress", "chainId"]);
        const images = database.createObjectStore("draft_images", { keyPath: "id" });
        images.createIndex("draftId", "draftId");
        images.createIndex("createdAt", "createdAt");
        database.createObjectStore("active_drafts", { keyPath: "scope" });
      },
    });
    const bytes = await serializeFile(new File(["evidence"], "work.jpg", { type: "image/jpeg" }));
    await old.put("drafts", {
      id: "work-id",
      clientWorkId: "submission-id",
      userAddress: account,
      chainId: chain,
      feedback: "keep",
      gardenAddress: null,
      actionUID: null,
      currentStep: "media",
      firstIncompleteStep: "media",
      updatedAt: 1,
      createdAt: 1,
    });
    await old.put("draft_images", {
      id: "attachment-id",
      draftId: "work-id",
      fileData: bytes,
      contentHash: "retained-hash",
      createdAt: 1,
    });
    await old.put("active_drafts", { scope: `${account}:${chain}`, draftId: "work-id" });
    old.close();
    await seedLegacy();
    const { db, draftDB } = await api();
    expect(db.version).toBe(3);
    expect(await draftDB.getDraft("work-id")).toMatchObject({
      kind: "work",
      clientWorkId: "submission-id",
      feedback: "keep",
    });
    expect(await db.get("draft_images", "attachment-id")).toMatchObject({
      fileData: bytes,
      contentHash: "retained-hash",
    });
    expect(await draftDB.getActiveDraft(account, chain)).toBe("work-id");
    expect(await draftDB.getDraftCount(account, chain)).toBe(1);
  });

  it("reports a blocked upgrade and closes its connection on version changes", async () => {
    const old = await openDB(canonicalName, 2);
    const { draftDB } = await import("../../modules/job-queue/draft-db");
    await expect(draftDB.init()).rejects.toThrow("draft-database-upgrade-blocked");
    old.close();
    // The abandoned request may now finish; its result must close before a retry.
    const db = await draftDB.init();
    close = () => db.close();
    const next = await openDB(canonicalName, 4);
    expect(next.version).toBe(4);
    next.close();
  });

  it("keeps canonical work and avatar reads usable when a legacy open never completes", async () => {
    const { draftDB, saveProfileAvatarDraft, loadProfileAvatarDraft } = await api();
    await saveProfileAvatarDraft(chain, account, {
      action: "set",
      file: new File(["saved"], "saved.png", { type: "image/png" }),
    });
    await draftDB.saveSnapshot(account, chain, "retained-work", {}, [], []);
    const realOpen = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, "open").mockImplementation((name, version) =>
      name === legacyName ? new IDBOpenDBRequest() : realOpen(name, version)
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const loaded = loadProfileAvatarDraft(chain, account);
      await vi.advanceTimersByTimeAsync(6_001);
      await expect(loaded).resolves.toMatchObject({ fileData: { name: "saved.png" } });
      expect(await draftDB.getDraft("retained-work")).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads the canonical bytes when the legacy database cannot be opened", async () => {
    const { saveProfileAvatarDraft, loadProfileAvatarDraft } = await api();
    await saveProfileAvatarDraft(chain, account, {
      action: "set",
      file: new File(["canonical"], "saved.png", { type: "image/png" }),
    });
    const newerLegacy = await openDB(legacyName, 2);
    newerLegacy.close();
    await expect(loadProfileAvatarDraft(chain, account)).resolves.toMatchObject({
      fileData: { name: "saved.png" },
    });
  });

  it("keeps a legacy row with mismatched ownership out of account reads", async () => {
    const { loadProfileAvatarDraft } = await api();
    const row = await seedLegacy();
    const old = await openDB(legacyName);
    await old.put("drafts", { ...row, address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" });
    try {
      await expect(loadProfileAvatarDraft(chain, account)).resolves.toBeNull();
      expect(await old.count("drafts")).toBe(1);
    } finally {
      old.close();
    }
  });

  it("preserves malformed legacy entries and equal-time conflicts for recovery", async () => {
    const legacy = await seedLegacy();
    const { db, loadProfileAvatarDraft } = await api();
    const row = await db.get("drafts", `avatar:${chain}:${account}`);
    expect(row).toBeDefined();
    const old = await openDB(legacyName);
    const different = { ...legacy, cid: "different-content" };
    await old.put("drafts", different);
    await old.put("drafts", { key: "unresolved", action: "set", fileData: { data: "invalid" } });
    await loadProfileAvatarDraft(chain, account);
    expect(await db.get("drafts", `avatar:${chain}:${account}`)).toEqual(row);
    expect(await old.count("drafts")).toBe(2);
    old.close();
  });
});
