import { describe, expect, it } from "vitest";
import { createGardenJoinRequestCipher } from "../services/garden-join-requests";
import { MemoryGardenJoinRequestStore } from "../services/garden-join-request-memory-store";

const garden = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
const secret = "ab".repeat(32);
const requestedAt = "2026-08-27T12:00:00.000Z";
const expiresAt = "2026-09-26T12:00:00.000Z";

function createStore() {
  let requestId = 0;
  return new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher(secret), {
    id: () => `request-${++requestId}`,
  });
}

describe("garden join request store", () => {
  it("keeps personal fields encrypted at rest and returns one active request", async () => {
    const store = createStore();
    const first = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      note: "Weekly compost pickup",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    const duplicate = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Different name",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    if (first.created !== true || "full" in duplicate) {
      throw new Error("Expected an existing garden join request");
    }
    expect(duplicate.request.id).toBe(first.request.id);
    expect(await store.getMine(garden, account)).toMatchObject({
      displayName: "Maya",
      note: "Weekly compost pickup",
      state: "pending",
    });
    expect(JSON.stringify(store.inspectEncryptedRecords())).not.toContain(account);
    expect(JSON.stringify(store.inspectEncryptedRecords())).not.toContain("Maya");
  });

  it("requires revision consistency and preserves the decline reason for the requester", async () => {
    const store = createStore();
    const created = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    if (created.created !== true) {
      throw new Error("Expected the garden join request to be created");
    }

    expect(
      await store.resolve({
        gardenAddress: garden,
        requestId: created.request.id,
        expectedRevision: 99,
        state: "declined",
        reason: "Please attend one garden gathering first.",
        resolvedAt: requestedAt,
      })
    ).toMatchObject({ ok: false, reason: "revision_conflict" });

    expect(
      await store.resolve({
        gardenAddress: garden,
        requestId: created.request.id,
        expectedRevision: 0,
        state: "declined",
        reason: "Please attend one garden gathering first.",
        resolvedAt: requestedAt,
      })
    ).toMatchObject({ ok: true, request: { state: "declined", revision: 1 } });
    expect(await store.getMine(garden, account)).toMatchObject({
      reason: "Please attend one garden gathering first.",
      canAskAgain: true,
    });

    const reconciled = await store.reconcileWelcomed(
      garden,
      created.request.id,
      "2026-08-28T12:00:00.000Z"
    );
    expect(reconciled).toMatchObject({ state: "welcomed", revision: 2 });
    expect(reconciled).not.toHaveProperty("reason");
  });

  it("replaces an expired pending request before duplicate and capacity checks", async () => {
    const store = createStore();
    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Expired request",
      requestedVia: "garden_detail",
      requestedAt: "2026-07-01T12:00:00.000Z",
      expiresAt: "2026-08-01T12:00:00.000Z",
    });

    const fresh = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Fresh request",
      requestedVia: "garden_detail",
      requestedAt: "2026-08-02T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });

    expect(fresh).toMatchObject({ created: true, request: { displayName: "Fresh request" } });
    expect(store.inspectEncryptedRecords()).toHaveLength(1);
  });

  it("withdraws pending rows and hard-deletes expired or retained rows", async () => {
    const store = createStore();
    const created = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    if (created.created !== true) throw new Error("Expected request to be created");
    expect(
      await store.withdraw({
        gardenAddress: garden,
        accountAddress: account,
        requestId: created.request.id,
        expectedRevision: created.request.revision,
      })
    ).toBe(true);
    expect(await store.getMine(garden, account)).toBeUndefined();

    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    expect(await store.sweep("2026-09-27T12:00:00.000Z")).toEqual({
      expiredPending: 1,
      deletedResolved: 0,
    });
    expect(await store.getMine(garden, account)).toBeUndefined();

    const retained = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    if (retained.created !== true) throw new Error("Expected retained request to be created");
    await store.resolve({
      gardenAddress: garden,
      requestId: retained.request.id,
      expectedRevision: 0,
      state: "declined",
      reason: "No capacity.",
      resolvedAt: requestedAt,
    });
    expect(await store.sweep("2026-09-27T12:00:00.000Z")).toEqual({
      expiredPending: 0,
      deletedResolved: 1,
    });
  });

  it("does not let a stale withdrawal delete a replacement request", async () => {
    const store = createStore();
    const first = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "First request",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    if (first.created !== true) throw new Error("Expected first request to be created");
    const firstIdentity = {
      gardenAddress: garden,
      accountAddress: account,
      requestId: first.request.id,
      expectedRevision: first.request.revision,
    };
    expect(await store.withdraw(firstIdentity)).toBe(true);

    const replacement = await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Replacement request",
      requestedVia: "garden_detail",
      requestedAt: "2026-08-27T12:01:00.000Z",
      expiresAt: "2026-09-26T12:01:00.000Z",
    });
    if (replacement.created !== true) throw new Error("Expected replacement request to be created");

    expect(await store.withdraw(firstIdentity)).toBe(false);
    expect(await store.getMine(garden, account)).toMatchObject({
      id: replacement.request.id,
      state: "pending",
    });
  });

  it("deletes expired pending rows before self and queue reads", async () => {
    const store = createStore();
    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Expired request",
      requestedVia: "garden_detail",
      requestedAt: "2026-07-01T12:00:00.000Z",
      expiresAt: "2026-08-01T12:00:00.000Z",
    });

    await expect(
      store.getMine(garden, account, "2026-08-02T12:00:00.000Z")
    ).resolves.toBeUndefined();
    expect(store.inspectEncryptedRecords()).toHaveLength(0);

    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Another expired request",
      requestedVia: "garden_detail",
      requestedAt: "2026-07-02T12:00:00.000Z",
      expiresAt: "2026-08-01T12:00:00.000Z",
    });
    await expect(
      store.listPending(garden, { nowIso: "2026-08-02T12:00:00.000Z" })
    ).resolves.toEqual({ items: [] });
    expect(store.inspectEncryptedRecords()).toHaveLength(0);
  });

  it("stores replay guards as keyed nonce digests", async () => {
    const store = createStore();
    const proofNonce = `0x${"aB".repeat(32)}`;
    const caseVariant = `0x${proofNonce.slice(2).toUpperCase()}`;

    expect(await store.claimProof(proofNonce, expiresAt)).toBe(true);
    expect(store.inspectProofKeys()).toHaveLength(1);
    expect(store.inspectProofKeys()).not.toContain(proofNonce);
    expect(await store.claimProof(caseVariant, expiresAt)).toBe(false);
  });
});
