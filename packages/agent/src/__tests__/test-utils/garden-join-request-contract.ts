import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EncryptedGardenJoinRequest,
  GardenJoinRequestStore,
} from "../../services/garden-join-requests";

const garden = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
const requestedAt = "2026-08-27T12:00:00.000Z";
const expiresAt = "2026-09-26T12:00:00.000Z";
// Read inside the request's lifetime even when this suite runs after expiry.
const readAt = "2026-08-28T12:00:00.000Z";

// Both adapters expose persisted records so the same privacy/deletion contract
// checks storage, not just the records returned by the public API.
interface StoreHarness {
  store: GardenJoinRequestStore;
  inspectEncryptedRecords(): EncryptedGardenJoinRequest[];
  inspectProofKeys(): string[];
}

export function gardenJoinRequestStoreContract(label: string, createStore: () => StoreHarness) {
  describe(label, () => {
    // The fixtures expire on 2026-09-26, and `getMine` reads the real clock when
    // it is not handed a time, so the suite pins the clock to the day after it
    // was written. Only Date is faked; crypto and promises run for real.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("keeps personal fields encrypted at rest and returns one active request", async () => {
      const { store, inspectEncryptedRecords } = createStore();
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
      expect(await store.getMine(garden, account, readAt)).toMatchObject({
        displayName: "Maya",
        note: "Weekly compost pickup",
        state: "pending",
      });
      expect(JSON.stringify(inspectEncryptedRecords())).not.toContain(account);
      expect(JSON.stringify(inspectEncryptedRecords())).not.toContain("Maya");
    });

    it("keeps membership and steward requests separate for the same account and garden", async () => {
      const { store, inspectEncryptedRecords } = createStore();
      const input = {
        gardenAddress: garden,
        accountAddress: account,
        displayName: "Maya",
        requestedAt,
        expiresAt,
      };
      const membership = await store.create({ ...input, requestedVia: "garden_detail" });
      const steward = await store.create({
        ...input,
        kind: "steward_access",
        requestedVia: "admin_access",
      });
      const duplicate = await store.create({
        ...input,
        kind: "steward_access",
        requestedVia: "account_profile",
      });
      expect(membership).toMatchObject({ created: true, request: { kind: "garden_membership" } });
      expect(steward).toMatchObject({ created: true, request: { kind: "steward_access" } });
      if (steward.created !== true || membership.created !== true || "full" in duplicate) {
        throw new Error("Expected separate pending requests");
      }
      expect(duplicate).toMatchObject({ created: false, request: { id: steward.request.id } });
      expect(await store.getMine(garden, account, readAt)).toMatchObject({
        id: membership.request.id,
      });
      expect(await store.getMine(garden, account, readAt, "steward_access")).toMatchObject({
        id: steward.request.id,
      });
      expect(
        (await store.listPending(garden, { nowIso: readAt })).items.map(({ id }) => id)
      ).toEqual([membership.request.id]);
      expect(
        (await store.listPending(garden, { nowIso: readAt, kind: "steward_access" })).items.map(
          ({ id }) => id
        )
      ).toEqual([steward.request.id]);
      expect(inspectEncryptedRecords()).toHaveLength(2);
    });

    it("rejects a different request kind before withdrawal or resolution", async () => {
      const { store } = createStore();
      const steward = await store.create({
        gardenAddress: garden,
        accountAddress: account,
        kind: "steward_access",
        displayName: "Maya",
        requestedVia: "admin_access",
        requestedAt,
        expiresAt,
      });
      if (!steward.created) throw new Error("Expected steward request");
      const identity = {
        gardenAddress: garden,
        requestId: steward.request.id,
        expectedRevision: 0,
      };
      expect(await store.withdraw({ ...identity, accountAddress: account })).toBe(false);
      expect(await store.resolve({ ...identity, state: "declined", resolvedAt: readAt })).toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(await store.reconcileWelcomed(garden, steward.request.id, readAt)).toBeUndefined();
      expect(await store.getMine(garden, account, readAt, "steward_access")).toMatchObject({
        state: "pending",
      });
      expect(
        await store.withdraw({ ...identity, accountAddress: account, kind: "steward_access" })
      ).toBe(true);
    });

    it("requires revision consistency and preserves the decline reason for the requester", async () => {
      const { store } = createStore();
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
      expect(await store.getMine(garden, account, readAt)).toMatchObject({
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
      const { store, inspectEncryptedRecords } = createStore();
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
      expect(inspectEncryptedRecords()).toHaveLength(1);
    });

    it("withdraws pending rows and hard-deletes expired or retained rows", async () => {
      const { store } = createStore();
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
      const { store } = createStore();
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
      if (replacement.created !== true)
        throw new Error("Expected replacement request to be created");

      expect(await store.withdraw(firstIdentity)).toBe(false);
      expect(await store.getMine(garden, account, readAt)).toMatchObject({
        id: replacement.request.id,
        state: "pending",
      });
    });

    it("deletes expired pending rows before self and queue reads", async () => {
      const { store, inspectEncryptedRecords } = createStore();
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
      expect(inspectEncryptedRecords()).toHaveLength(0);

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
      expect(inspectEncryptedRecords()).toHaveLength(0);
    });

    it("stores replay guards as keyed nonce digests", async () => {
      const { store, inspectProofKeys } = createStore();
      const proofNonce = `0x${"aB".repeat(32)}`;
      const caseVariant = `0x${proofNonce.slice(2).toUpperCase()}`;

      expect(await store.claimProof(proofNonce, expiresAt)).toBe(true);
      expect(inspectProofKeys()).toHaveLength(1);
      expect(inspectProofKeys()).not.toContain(proofNonce);
      expect(await store.claimProof(caseVariant, expiresAt)).toBe(false);
    });

    it("enforces the 100-request garden limit after checking for an existing request", async () => {
      const { store, inspectEncryptedRecords } = createStore();
      const input = {
        gardenAddress: garden,
        accountAddress: account,
        displayName: "Gardener",
        requestedVia: "garden_detail" as const,
        requestedAt,
        expiresAt,
      };
      const first = await store.create(input);
      if (!first.created || "full" in first) throw new Error("Expected first request");
      for (let i = 1; i < 100; i++) {
        await expect(
          store.create({ ...input, accountAddress: `0x${i.toString(16).padStart(40, "0")}` })
        ).resolves.toMatchObject({ created: true });
      }
      await expect(store.create(input)).resolves.toMatchObject({
        created: false,
        request: { id: first.request.id },
      });
      const nextInput = {
        ...input,
        accountAddress: "0x3333333333333333333333333333333333333333" as const,
      };
      await expect(store.create(nextInput)).resolves.toEqual({ created: false, full: true });
      await expect(
        store.create({ ...nextInput, kind: "steward_access", requestedVia: "admin_access" })
      ).resolves.toEqual({ created: false, full: true });
      expect(inspectEncryptedRecords()).toHaveLength(100);
      await expect(
        store.withdraw({
          gardenAddress: garden,
          accountAddress: account,
          requestId: first.request.id,
          expectedRevision: 99,
        })
      ).resolves.toBe(false);
      await expect(
        store.withdraw({
          gardenAddress: garden,
          accountAddress: account,
          requestId: first.request.id,
          expectedRevision: 0,
        })
      ).resolves.toBe(true);
      await expect(store.create(nextInput)).resolves.toMatchObject({ created: true });
      expect(inspectEncryptedRecords()).toHaveLength(100);
    });
  });
}
