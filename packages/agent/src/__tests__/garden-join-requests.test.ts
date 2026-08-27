import { describe, expect, it } from "vitest";
import { createGardenJoinRequestCipher } from "../services/garden-join-requests";
import { MemoryGardenJoinRequestStore } from "../services/garden-join-request-memory-store";

const garden = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
const secret = "ab".repeat(32);
const requestedAt = "2026-08-27T12:00:00.000Z";
const expiresAt = "2026-09-26T12:00:00.000Z";

function createStore() {
  return new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher(secret), {
    id: () => "0198f665-9a00-7000-8000-000000000001",
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
  });

  it("withdraws pending rows and hard-deletes expired or retained rows", async () => {
    const store = createStore();
    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    expect(await store.withdraw(garden, account)).toBe(true);
    expect(await store.getMine(garden, account)).toBeUndefined();

    await store.create({
      gardenAddress: garden,
      accountAddress: account,
      displayName: "Maya",
      requestedVia: "garden_detail",
      requestedAt,
      expiresAt,
    });
    expect(await store.sweep("2026-09-27T12:00:00.000Z")).toEqual({ deleted: 1 });
    expect(await store.getMine(garden, account)).toBeUndefined();
  });
});
