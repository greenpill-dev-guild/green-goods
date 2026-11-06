import { Database } from "bun:sqlite";
import { describe, expect, it, vi } from "vitest";
import { passkeyDirectoryQueries } from "../services/db/passkey-directory";
import { initSchema } from "../services/db/schema";
import { createPasskeyDisplayNames } from "../services/passkey-display-names";
import { createHostedPasskeyDisplayNames } from "../services/hosted-passkey-display-names";

const first = "0xa111111111111111111111111111111111111111" as const;
const second = "0xb222222222222222222222222222222222222222" as const;
const hostedKey = `0x04${"a".repeat(128)}` as const;

describe("hosted passkey display names", () => {
  it("leaves failed and generated names unlisted, and retries after a provider failure", async () => {
    const db = new Database(":memory:");
    try {
      initSchema(db);
      const store = passkeyDirectoryQueries(db);
      const lookup = vi
        .fn(async () => [{ id: "deadbeef", publicKey: hostedKey }])
        .mockRejectedValueOnce(new Error("Pimlico unavailable"));
      const derive = vi.fn(async () => first);
      const hosted = createHostedPasskeyDisplayNames({ chainId: 42161, store, derive, lookup });

      await hosted.observe("user_1234567890");
      expect(lookup).not.toHaveBeenCalled();
      await expect(hosted.observe("maya")).rejects.toThrow("Pimlico unavailable");
      expect(hosted.read([first])).toEqual([null]);
      await hosted.observe("maya");
      expect(hosted.read([first])).toEqual(["maya"]);
      await hosted.observe("river");
      expect(hosted.read([first])).toEqual([null]);
    } finally {
      db.close();
    }
  });

  it("drains a queued legacy name after a lookup fails and coalesces duplicate observations", async () => {
    const db = new Database(":memory:");
    try {
      initSchema(db);
      const names = Array.from({ length: 9 }, (_, index) => `member-${index}`);
      let releaseLookups!: () => void;
      const blocked = new Promise<void>((resolve) => {
        releaseLookups = resolve;
      });
      const lookup = vi.fn(async (name: string) => {
        await blocked;
        if (name === names[0]) throw new Error("Pimlico unavailable");
        return name === names[8] ? [{ id: "deadbeef", publicKey: hostedKey }] : [];
      });
      const hosted = createHostedPasskeyDisplayNames({
        chainId: 42161,
        store: passkeyDirectoryQueries(db),
        derive: async () => first,
        lookup,
      });

      const observations = Promise.allSettled([
        ...names.map((name) => hosted.observe(name)),
        hosted.observe(names[8]),
      ]);
      const startedBeforeRelease = lookup.mock.calls.map(([name]) => name);
      releaseLookups();
      const results = await observations;

      expect(startedBeforeRelease).toEqual(names.slice(0, 8));
      expect(results.map(({ status }) => status)).toEqual([
        "rejected",
        ...Array(9).fill("fulfilled"),
      ]);
      expect(lookup.mock.calls.map(([name]) => name)).toEqual(names);
      expect(hosted.read([first])).toEqual([names[8]]);
    } finally {
      db.close();
    }
  });

  it("rejects new names at the backlog limit while keeping accepted observations", async () => {
    let releaseLookups!: () => void;
    const blocked = new Promise<void>((resolve) => {
      releaseLookups = resolve;
    });
    const lookup = vi.fn(async () => {
      await blocked;
      return [];
    });
    const hosted = createHostedPasskeyDisplayNames({
      chainId: 42161,
      store: {
        hasHostedDisplayName: () => false,
        rememberHostedDisplayName: vi.fn(),
        readHostedDisplayNames: () => [],
      },
      derive: async () => first,
      lookup,
    });

    const accepted = Promise.all(
      Array.from({ length: 264 }, (_, index) => hosted.observe(`member-${index}`))
    );
    const overflow = hosted.observe("overflow");
    const duplicate = hosted.observe("member-263");
    releaseLookups();

    await expect(overflow).rejects.toThrow("Hosted passkey observation queue is full");
    await Promise.all([accepted, duplicate]);
    expect(lookup).toHaveBeenCalledTimes(264);
  });

  it("keeps the provider's exact legacy ID and only stores the derived address and username", async () => {
    const db = new Database(":memory:");
    try {
      initSchema(db);
      const store = passkeyDirectoryQueries(db);
      const derive = vi.fn(async () => first);
      const lookup = vi.fn(async () => [{ id: "deadbeef", publicKey: hostedKey }]);
      const hosted = createHostedPasskeyDisplayNames({ chainId: 42161, store, derive, lookup });

      expect(hosted.read([first])).toEqual([null]);
      await Promise.all([hosted.observe("maya"), hosted.observe("maya")]);
      await hosted.observe("maya");
      expect(lookup).toHaveBeenCalledExactlyOnceWith("maya");
      expect(derive).toHaveBeenCalledExactlyOnceWith({
        accountProfile: "kernel-0.3.1-legacy",
        credentialId: "deadbeef",
        publicKey: hostedKey,
      });
      expect(hosted.read([second, first])).toEqual([null, "maya"]);
      expect(store.findByName("maya")).toBeUndefined();
      const reopened = createHostedPasskeyDisplayNames({ chainId: 42161, store, derive, lookup });
      expect(reopened.read([first])).toEqual(["maya"]);
    } finally {
      db.close();
    }
  });
});

function record(rowId: number, userName: string) {
  return {
    rowId,
    userName,
    credentialId: "deadbeef",
    credentialKey: "3q2-7w",
    publicKey: "0x04" as const,
    rpId: "greengoods.app",
    accountProfile: "kernel-0.3.1-legacy" as const,
  };
}

describe("passkey display names", () => {
  it("reads directory rows that were stored before the lookup started", async () => {
    const db = new Database(":memory:");
    try {
      initSchema(db);
      const store = passkeyDirectoryQueries(db);
      const { rowId: _, ...legacy } = record(1, "maya");
      expect(
        store.insert({
          ...legacy,
          origin: "https://www.greengoods.app",
          source: "adopted",
          createdAt: "2026-10-17T12:00:00.000Z",
          publicKey: `0x04${"a".repeat(128)}`,
        })
      ).toEqual({ ok: true });
      const derive = vi.fn(async () => first);
      const lookup = createPasskeyDisplayNames(store.readAddressRecords, derive);

      await expect(lookup([first])).resolves.toEqual(["maya"]);
      expect(derive).toHaveBeenCalledWith(
        expect.objectContaining({
          accountProfile: "kernel-0.3.1-legacy",
          credentialId: "deadbeef",
          credentialKey: "3q2-7w",
        })
      );
    } finally {
      db.close();
    }
  });

  it("returns only chosen names for the requested accounts, in request order", async () => {
    const rows = [record(1, "maya"), record(2, "user_1234567890")];
    const derive = vi.fn(async () => first);
    const lookup = createPasskeyDisplayNames(
      (after) => rows.filter((row) => row.rowId > after),
      derive
    );

    await expect(lookup([second, first])).resolves.toEqual([null, "maya"]);
    expect(derive).toHaveBeenCalledOnce();
  });

  it("shares work between requests and picks up later registrations", async () => {
    const rows = [record(1, "maya")];
    const derive = vi.fn(async (row: { rowId: number }) => (row.rowId === 1 ? first : second));
    const lookup = createPasskeyDisplayNames(
      (after) => rows.filter((row) => row.rowId > after),
      derive
    );

    await expect(Promise.all([lookup([first]), lookup([second])])).resolves.toEqual([
      ["maya"],
      [null],
    ]);
    rows.push(record(2, "river"));
    await expect(lookup([second])).resolves.toEqual(["river"]);
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it("retries a failed derivation instead of caching an empty answer", async () => {
    const derive = vi.fn(async () => first).mockRejectedValueOnce(new Error("RPC unavailable"));
    const lookup = createPasskeyDisplayNames((after) => (after ? [] : [record(1, "maya")]), derive);

    await expect(lookup([first])).rejects.toThrow("RPC unavailable");
    await expect(lookup([first])).resolves.toEqual(["maya"]);
  });

  it("returns no label when two credentials derive the same address", async () => {
    const rows = [record(1, "maya"), record(2, "river")];
    const lookup = createPasskeyDisplayNames(
      (after) => rows.filter((row) => row.rowId > after),
      async () => first
    );

    await expect(lookup([first])).resolves.toEqual([null]);
  });
});
