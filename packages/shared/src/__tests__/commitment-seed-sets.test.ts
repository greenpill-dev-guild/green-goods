import { describe, expect, it } from "vitest";

import {
  chunkCopies,
  copiesToRetry,
  countSeedCopies,
  mintGroupAddition,
  mintSeedSet,
  type SeedCopyProgress,
  seedSetLeftNothing,
  seedSetLocked,
} from "../modules/commitment-pooling/seed-sets";

const NOW = 1_790_000_000;
const DAY = 86_400;

function counter(prefix: string) {
  let next = 0;
  return () => `${prefix}-${String(++next).padStart(8, "0")}`;
}

const copy = (status: SeedCopyProgress["status"], miss?: SeedCopyProgress["miss"]) =>
  ({
    clientCommitmentId: `c-${status}-${miss ?? ""}`,
    status,
    miss,
    txHash: null,
    jobId: null,
  }) as const;

describe("copies of a set", () => {
  it("mints ten separate copies at Create, with one deadline and one group", () => {
    const set = mintSeedSet({ count: 10, dueInDays: 14, nowSeconds: NOW, newId: counter("id") });

    expect(set.copyIds).toHaveLength(10);
    expect(new Set(set.copyIds).size).toBe(10);
    expect(set.dueDate).toBe(BigInt(NOW + 14 * DAY));
    expect(set.displayGroupId).not.toBeNull();
    expect(set.copyIds).not.toContain(set.displayGroupId);
  });

  it("keeps a single commitment out of any group", () => {
    const set = mintSeedSet({ count: 1, dueInDays: 7, nowSeconds: NOW, newId: counter("id") });
    expect(set.copyIds).toHaveLength(1);
    expect(set.displayGroupId).toBeNull();
  });

  it("adds copies to a group under its id and deadline, only while that deadline is ahead", () => {
    const group = { displayGroupId: "group-00000001", dueDate: BigInt(NOW + 3 * DAY) };

    const added = mintGroupAddition({ group, count: 5, nowSeconds: NOW, newId: counter("add") });
    expect(added).toMatchObject({ displayGroupId: group.displayGroupId, dueDate: group.dueDate });
    expect("copyIds" in added && added.copyIds).toHaveLength(5);

    for (const nowSeconds of [NOW + 3 * DAY, NOW + 4 * DAY]) {
      expect(mintGroupAddition({ group, count: 5, nowSeconds, newId: counter("x") })).toEqual({
        refused: "deadline-passed",
      });
    }
  });

  // Whether nothing of a set can be on chain decides two things: its jobs are
  // cleared, and its answers stay the steward's to change.
  it.each([
    { label: "nothing tried yet", copies: [copy("waiting"), copy("waiting")], nothing: true },
    {
      label: "every copy declined or refused",
      copies: [copy("not-sent", "declined"), copy("not-sent", "refused")],
      nothing: true,
    },
    {
      label: "one copy created",
      copies: [copy("created"), copy("not-sent", "declined")],
      nothing: false,
    },
    {
      label: "one copy left to finish",
      copies: [copy("later"), copy("not-sent", "declined")],
      nothing: false,
    },
    {
      label: "one answer lost after a send",
      copies: [copy("not-sent", "failed"), copy("not-sent", "declined")],
      nothing: false,
    },
  ])("says whether a set left nothing: $label", ({ copies, nothing }) => {
    expect(seedSetLeftNothing(copies)).toBe(nothing);
    expect(seedSetLocked(copies)).toBe(!nothing);
  });

  it("counts a pass and retries only the copies that didn't send", () => {
    const pass = [
      copy("created"),
      copy("created"),
      copy("later"),
      copy("not-sent", "declined"),
      copy("wallet"),
    ];
    expect(countSeedCopies(pass)).toEqual({
      total: 5,
      created: 2,
      later: 1,
      notSent: 1,
      inFlight: 1,
    });
    expect(copiesToRetry(pass).map((row) => row.status)).toEqual(["not-sent"]);
  });

  it("bundles copies ten at a time, in order", () => {
    const ids = Array.from({ length: 21 }, (_, index) => index);
    expect(chunkCopies(ids).map((chunk) => chunk.length)).toEqual([10, 10, 1]);
    expect(chunkCopies(ids)[1]?.[0]).toBe(10);
  });
});
