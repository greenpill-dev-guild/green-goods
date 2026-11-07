import { Database } from "bun:sqlite";
import { describe, expect, it, vi } from "vitest";
import { passkeyDirectoryQueries } from "../services/db/passkey-directory";
import { initSchema } from "../services/db/schema";
import { createPasskeyDisplayNames } from "../services/passkey-display-names";

const first = "0xa111111111111111111111111111111111111111" as const;
const second = "0xb222222222222222222222222222222222222222" as const;

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

  it("skips an invalid credential without blocking later records or changing their labels", async () => {
    const invalid = {
      ...record(1, "broken"),
      accountProfile: "kernel-0.3.3" as const,
      credentialId: "",
      credentialKey: "",
    };
    const valid = record(2, "maya");
    const derive = vi.fn(async ({ rowId }: { rowId: number }) => {
      if (rowId === invalid.rowId) throw new Error("Invalid credential");
      return first;
    });
    const lookup = createPasskeyDisplayNames(
      (after) => [invalid, valid].filter((row) => row.rowId > after),
      derive
    );

    await expect(lookup([first])).resolves.toEqual(["maya"]);
    await expect(lookup([first])).resolves.toEqual(["maya"]);
    expect(derive).toHaveBeenCalledExactlyOnceWith(valid);
  });

  it("retries a failed derivation instead of caching an empty answer", async () => {
    const derive = vi.fn(async () => first).mockRejectedValueOnce(new Error("RPC unavailable"));
    const lookup = createPasskeyDisplayNames((after) => (after ? [] : [record(1, "maya")]), derive);

    await expect(lookup([first])).resolves.toEqual([null]);
    await expect(lookup([first])).resolves.toEqual(["maya"]);
  });

  it("indexes later rows when one derivation fails, then reconciles a recovered collision", async () => {
    const rows = [record(1, "maya"), record(2, "river"), record(3, "forest")];
    const derive = vi.fn(async ({ rowId }: { rowId: number }) => {
      if (rowId === 1) throw new Error("RPC unavailable");
      return rowId === 2 ? first : second;
    });
    const lookup = createPasskeyDisplayNames(
      (after) => rows.filter((row) => row.rowId > after),
      derive
    );

    await expect(lookup([second, first])).resolves.toEqual(["forest", "river"]);
    await expect(lookup([second, first])).resolves.toEqual(["forest", "river"]);
    derive.mockResolvedValueOnce(first);
    await expect(lookup([second, first])).resolves.toEqual(["forest", null]);
    expect(derive.mock.calls.map(([row]) => row.rowId)).toEqual([1, 2, 3, 1, 1]);
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
