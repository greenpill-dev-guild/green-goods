import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolvePoolMemberHistoryDisclosure,
  selectPoolParticipationSummary,
  type PoolMemberHistory,
} from "../modules/commitment-pooling";

const MEMBER = "0x1111111111111111111111111111111111111111" as const;
const VIEWER = "0x2222222222222222222222222222222222222222" as const;
const history: PoolMemberHistory = {
  id: `42161-7-${MEMBER}`,
  chainId: 42161,
  poolId: 7n,
  account: MEMBER,
  leadAccepted: 2,
  leadFulfilled: 1,
  leadCancelled: 0,
  leadExpired: 0,
  contributorFulfilled: 3,
  receivedFulfilled: 1,
  confirmationsGiven: 4,
  disputesRaised: 0,
  updatedAt: 10,
};

function sourceContains(root: string, pattern: RegExp): boolean {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory() && sourceContains(path, pattern)) return true;
    if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      if (pattern.test(readFileSync(path, "utf8"))) return true;
    }
  }
  return false;
}

describe("pool member disclosure", () => {
  it("returns unauthenticated without a viewer", () => {
    expect(
      resolvePoolMemberHistoryDisclosure({
        viewer: undefined,
        account: MEMBER,
        history,
        isCurrentSteward: false,
      })
    ).toEqual({ status: "unauthenticated" });
  });

  it("hides another member from a non-steward", () => {
    expect(
      resolvePoolMemberHistoryDisclosure({
        viewer: VIEWER,
        account: MEMBER,
        history,
        isCurrentSteward: false,
      })
    ).toEqual({ status: "hidden" });
  });

  it("hides another member from a former steward whose current capability is false", () => {
    expect(
      resolvePoolMemberHistoryDisclosure({
        viewer: VIEWER,
        account: MEMBER,
        history,
        isCurrentSteward: false,
        wasSteward: true,
      })
    ).toEqual({ status: "hidden" });
  });

  it("shows the row to the current steward", () => {
    expect(
      resolvePoolMemberHistoryDisclosure({
        viewer: VIEWER,
        account: MEMBER,
        history,
        isCurrentSteward: true,
      })
    ).toEqual({ status: "visible", history });
  });

  it("shows the row to the subject regardless of steward capability", () => {
    expect(
      resolvePoolMemberHistoryDisclosure({
        viewer: MEMBER,
        account: MEMBER,
        history,
        isCurrentSteward: false,
      })
    ).toEqual({ status: "visible", history });
  });

  it("fails closed when an authorized history query returns no row or errors", () => {
    expect(
      resolvePoolMemberHistoryDisclosure({
        viewer: VIEWER,
        account: MEMBER,
        history: undefined,
        isCurrentSteward: true,
      })
    ).toEqual({ status: "hidden" });
  });
});

describe("participation editorial boundary", () => {
  it("returns pool-level counts and a rational promise-kept result only", () => {
    const result = selectPoolParticipationSummary({
      commitmentsAccepted: 6n,
      commitmentsFulfilled: 4n,
      commitmentsDue: 5n,
      commitmentsCancelled: 1n,
      commitmentsExpired: 0n,
    });
    expect(result.promiseKeptRate).toEqual({ fulfilled: 4n, due: 5n });
    expect(result).not.toHaveProperty("account");
    expect(result).not.toHaveProperty("history");
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("rank");
  });

  it("keeps raw PoolMemberHistory out of client and admin source", () => {
    for (const packageName of ["client", "admin"]) {
      const root = resolve(process.cwd(), `../${packageName}/src`);
      expect(sourceContains(root, /\bPoolMemberHistory\b|\bpoolMemberHistories?\b/)).toBe(false);
    }
  });
});
