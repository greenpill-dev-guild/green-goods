/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { demoAware, demoDocumentFor } from "../modules/commitment-pooling/demo/demo-gate";
import {
  DEMO_VIEWER_ADDRESSES,
  demoViewer,
  isDemoPoolingActive,
} from "../modules/commitment-pooling/demo/demo-mode";
import { getCommitments } from "../modules/commitment-pooling/demo/demo-reads";
import {
  buildDemoWorld,
  DEMO_GARDEN,
  DEMO_GARDEN_POOL_ID,
  ROSA,
} from "../modules/commitment-pooling/demo/demo-world";
import { DEV_MOCK_AUTH_ADDRESSES } from "../providers/DevAuthProvider";
import type { Address } from "../types/domain";

/** The shared setup stubs window.location as a plain object, so the search is set directly. */
function visit(search: string) {
  (window.location as unknown as { search: string }).search = search;
}

describe("demo pooling mode", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    visit("");
  });

  it("is off until the flag is on the URL, then sticks for the tab", () => {
    expect(isDemoPoolingActive()).toBe(false);
    visit("?mockPooling=1");
    expect(isDemoPoolingActive()).toBe(true);
    visit("");
    expect(isDemoPoolingActive()).toBe(true);
    visit("?mockPooling=0");
    expect(isDemoPoolingActive()).toBe(false);
    visit("");
    expect(isDemoPoolingActive()).toBe(false);
  });

  it("writes the world around the signed-in mock identity", () => {
    expect(DEMO_VIEWER_ADDRESSES).toEqual(DEV_MOCK_AUTH_ADDRESSES);
    visit("?mockAuth=deployer");
    expect(demoViewer()).toBe(DEV_MOCK_AUTH_ADDRESSES.deployer);
    visit("");
    window.sessionStorage.setItem("greengoods_dev_mock_auth", "user");
    expect(demoViewer()).toBe(DEV_MOCK_AUTH_ADDRESSES.user);
  });

  it("answers from the real reader unless the flag is on", async () => {
    const real = vi.fn(async () => ["real"]);
    const wrapped = demoAware("getCommitmentPools", real as never);
    expect(await wrapped(42161)).toEqual(["real"]);
    visit("?mockPooling=1");
    const pools = await wrapped(42161);
    expect(real).toHaveBeenCalledTimes(1);
    expect(pools.map((pool) => pool.poolId)).toContain(DEMO_GARDEN_POOL_ID);
    expect(await demoDocumentFor("bafy-demo-season-7")).toEqual({
      version: 1,
      name: "Spring 2026",
    });
    expect(await demoDocumentFor("bafyreal")).toBeNull();
  });

  it("filters the world the way the indexer query would", async () => {
    visit("?mockAuth=deployer&mockPooling=1");
    const viewer = DEV_MOCK_AUTH_ADDRESSES.deployer as Address;
    const world = buildDemoWorld(viewer);
    const mine = await getCommitments({ chainId: 42161, account: viewer });
    // Every row the reader is a party to, and nothing they are not.
    expect(mine.length).toBeGreaterThan(0);
    for (const row of mine) {
      const party =
        [row.creator, row.leadProvider, row.counterparty, ...row.confirmers].some(
          (entry) => entry?.toLowerCase() === viewer.toLowerCase()
        ) ||
        world.contributors.some(
          (entry) =>
            entry.commitmentId === row.commitmentId &&
            entry.active &&
            entry.contributor.toLowerCase() === viewer.toLowerCase()
        );
      expect(party).toBe(true);
    }
    const rosas = await getCommitments({ chainId: 42161, account: ROSA, state: "OFFERED" });
    expect(rosas.every((row) => row.onchainState === "OFFERED")).toBe(true);
    const gardenClaims = await getCommitments({
      chainId: 42161,
      account: DEMO_GARDEN,
      state: "READY_FOR_CONFIRMATION",
    });
    expect(gardenClaims.map((row) => row.commitmentId)).toEqual([1020n]);
  });
});
