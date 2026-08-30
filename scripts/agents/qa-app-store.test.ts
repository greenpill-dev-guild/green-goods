import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => {
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobPreconditionFailedError,
    get: blob.get,
    put: blob.put,
  };
});

import { applyDelta, shardShapeError } from "../../packages/qa/api/state";

interface StoredBlob {
  body: string;
  etag: string;
}

describe("QA app Blob writes", () => {
  beforeEach(() => {
    blob.get.mockReset();
    blob.put.mockReset();
  });

  it("merges two first writers instead of letting a later create erase the first", async () => {
    let stored: StoredBlob | null = null;
    let etag = 0;
    let initialReads = 0;
    let releaseInitialReads = () => {};
    const bothInitialReadsStarted = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });

    blob.get.mockImplementation(async () => {
      if (!stored && initialReads < 2) {
        initialReads++;
        if (initialReads === 2) releaseInitialReads();
        await bothInitialReadsStarted;
        return null;
      }
      if (!stored) return null;
      return { statusCode: 200, stream: stored.body, etag: stored.etag };
    });

    blob.put.mockImplementation(async (_pathname, body, options) => {
      if (options.allowOverwrite === false && stored) throw new Error("pathname already exists");
      if (options.ifMatch && options.ifMatch !== stored?.etag) throw new Error("etag mismatch");
      stored = { body: String(body), etag: `etag-${++etag}` };
      return {};
    });

    const [phone, laptop] = await Promise.all([
      applyDelta("Afo", { "PUB-001": { s: "pass" } }),
      applyDelta("Afo", { "PUB-002": { n: "laptop note" } }),
    ]);

    expect(phone.entries).toHaveProperty("PUB-001");
    expect(laptop.entries).toHaveProperty("PUB-002");
    expect(JSON.parse(stored?.body ?? "{}").entries).toMatchObject({
      "PUB-001": { s: "pass" },
      "PUB-002": { n: "laptop note" },
    });
    expect(blob.put.mock.calls.slice(0, 2).every((call) => call[2].allowOverwrite === false)).toBe(true);
    expect(blob.put.mock.calls.some((call) => call[2].allowOverwrite === true && call[2].ifMatch)).toBe(true);
  });
});

describe("shard shape validation", () => {
  const entry = { s: "pass", n: "", at: "2026-08-30T10:00:00.000Z" };

  it("accepts a shard this endpoint can vouch for", () => {
    expect(shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": entry } })).toBeNull();
    expect(shardShapeError("Afo", { person: "Afo", entries: {} })).toBeNull();
    // A note with no verdict yet is a legitimate in-progress entry.
    expect(
      shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": { ...entry, s: "" } } }),
    ).toBeNull();
  });

  it("rejects a malformed entry rather than serving it to the checklist", () => {
    // GET hands what it read straight to the page, which reads `e.s` off it —
    // one bad entry took the board down for everyone in a live session.
    expect(shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": null } })).toMatch(
      /PUB-001 is not an object/,
    );
    expect(shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": { n: "x", at: "t" } } })).toMatch(
      /PUB-001 has no valid status/,
    );
    expect(
      shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": { ...entry, s: "maybe" } } }),
    ).toMatch(/PUB-001 has no valid status/);
    expect(shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": { s: "pass", at: "t" } } })).toMatch(
      /PUB-001 has no note/,
    );
    expect(shardShapeError("Afo", { person: "Afo", entries: { "PUB-001": { s: "pass", n: "" } } })).toMatch(
      /PUB-001 has no timestamp/,
    );
  });

  it("rejects a shard that is not one, or is filed under the wrong owner", () => {
    expect(shardShapeError("Afo", null)).toMatch(/not an object/);
    expect(shardShapeError("Afo", [])).toMatch(/not an object/);
    expect(shardShapeError("Afo", { person: "Gui", entries: {} })).toMatch(/owner as "Gui"/);
    expect(shardShapeError("Afo", { person: "Afo" })).toMatch(/no entries object/);
    expect(shardShapeError("Afo", { person: "Afo", entries: [] })).toMatch(/no entries object/);
  });
});
