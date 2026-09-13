/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Garden } from "../../types/domain";
import {
  selectPreparationTargets,
  displayImageUrl,
  OFFLINE_READING_BUDGET,
} from "../../modules/offline-content/policy";
import { OfflineDownloadCoordinator } from "../../modules/offline-content/coordinator";
import {
  evictPreparedContent,
  getOfflineContentSnapshot,
  readingBytes,
  updateDownloadManifest,
  verifyPreparedContent,
} from "../../modules/offline-content/store";
import { emptyDownloadManifest } from "../../modules/offline-content/types";
import { worksKeys } from "../../config/query-keys/work";

const account = "0x123";
const chainId = 11155111;
function garden(id: string): Garden {
  return { id, chainId, gardeners: [account], owners: [], stewards: [] } as unknown as Garden;
}
function response(bytes = 12) {
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/jpeg" } });
}
let cache: Map<string, Response>;
beforeEach(async () => {
  cache = new Map();
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async (url: string) => cache.get(url)?.clone(),
      put: async (url: string, value: Response) => {
        cache.set(url, value.clone());
      },
      delete: async (url: string) => cache.delete(url),
    }),
  });
  await updateDownloadManifest(() => emptyDownloadManifest());
});

describe("offline preparation policy", () => {
  it("orders active then joined gardens, limiting outside visits to five", () => {
    const visits = Array.from({ length: 8 }, (_, i) => ({
      address: `other-${i}`,
      chainId,
      visitedAt: i,
    }));
    const selected = selectPreparationTargets(
      [garden("joined")],
      account,
      chainId,
      visits,
      "other-7"
    );
    expect(selected.map((item) => item.address)).toEqual([
      "other-7",
      "joined",
      "other-6",
      "other-5",
      "other-4",
      "other-3",
    ]);
    expect(selected.map((item) => item.limit)).toEqual([20, 50, 20, 20, 20, 20]);
    expect(OFFLINE_READING_BUDGET).toBe(150 * 1024 * 1024);
  });
  it("preserves URL variants and makes display optimization idempotent", () => {
    const optimized = displayImageUrl("https://greengoods.mypinata.cloud/ipfs/cid?token=abc");
    expect(displayImageUrl(optimized)).toBe(optimized);
    expect(optimized).toContain("token=abc");
    expect(displayImageUrl("https://avatar.example/user?size=96")).toContain("size=96");
  });
});

function coordinator(client: QueryClient, overrides = {}) {
  return new OfflineDownloadCoordinator({
    client,
    persistQueries: vi.fn(async () => {}),
    canRun: () => true,
    getWorks: vi.fn(async () => [{ id: "work", metadata: "", media: [] }] as never),
    getDetails: vi.fn(async () => ({ reads: [], photos: ["https://media.example/photo"] })),
    getApprovals: vi.fn(async () => ({ key: worksKeys.approvals(undefined, chainId), data: [] })),
    workKey: worksKeys.preparedRecent,
    fetchMedia: vi.fn(async () => response()),
    ...overrides,
  });
}
const targets = [{ address: "garden", chainId, limit: 50, visitedAt: 1, priority: 0 }];

describe("verified download coverage", () => {
  it("does not declare readiness when a query write fails", async () => {
    const client = new QueryClient();
    const run = coordinator(client, {
      persistQueries: vi.fn(async () => {
        throw new Error("quota");
      }),
    });
    await run.prepare(account, targets);
    expect(Object.values(getOfflineContentSnapshot().gardens)[0].state).toBe("partial");
    expect(Object.values(getOfflineContentSnapshot().queries)).toEqual([]);
    client.clear();
  });
  it("verifies local bytes after restoration and downgrades an evicted image", async () => {
    const client = new QueryClient();
    await coordinator(client).prepare(account, targets);
    expect(Object.values(getOfflineContentSnapshot().gardens)[0].state).toBe("ready");
    cache.clear();
    await verifyPreparedContent(client);
    expect(Object.values(getOfflineContentSnapshot().gardens)[0].state).toBe("partial");
    client.clear();
  });
  it("evicts lower-priority browsing photos while protecting profile bytes", async () => {
    const client = new QueryClient();
    const run = coordinator(client);
    await run.prepare(account, targets);
    await run.prepareEssentials(
      "profile",
      [{ key: worksKeys.approvals(undefined, chainId), data: [] }],
      ["https://profile.example/avatar"]
    );
    const bytes = readingBytes(getOfflineContentSnapshot());
    await evictPreparedContent(client, 0, bytes - 1);
    expect(cache.has("https://profile.example/avatar")).toBe(true);
    expect(cache.has("https://media.example/photo")).toBe(false);
    expect(Object.values(getOfflineContentSnapshot().gardens)[0].state).toBe("unavailable");
    client.clear();
  });
  it("leaves higher-priority prepared work intact when a lower-priority download cannot fit", async () => {
    const client = new QueryClient();
    await coordinator(client).prepare(account, targets);
    const [activeKey, active] = Object.entries(getOfflineContentSnapshot().gardens)[0];
    const visitorKey = "visitor";
    await updateDownloadManifest((manifest) => ({
      ...manifest,
      gardens: {
        ...manifest.gardens,
        [visitorKey]: {
          ...active,
          address: "visitor",
          priority: 2,
          workIds: [],
          queries: [],
          assets: [],
        },
      },
    }));
    const budget = readingBytes(getOfflineContentSnapshot());
    expect(await evictPreparedContent(client, 100, budget, visitorKey)).toBe(false);
    expect(getOfflineContentSnapshot().gardens[activeKey].state).toBe("ready");
    expect(cache.has("https://media.example/photo")).toBe(true);
    client.clear();
  });
  it("reclaims superseded unowned profile queries without any garden downloads", async () => {
    const client = new QueryClient();
    const run = coordinator(client);
    const oldKey = ["greengoods", "ens", "name", "old"];
    const newKey = ["greengoods", "ens", "name", "current"];
    const photo = ["https://profile.example/avatar"];
    await run.prepareEssentials("old", [{ key: oldKey, data: "x".repeat(2048) }], photo);
    await run.prepareEssentials("current", [{ key: newKey, data: "current" }], photo);
    const budget = readingBytes(getOfflineContentSnapshot()) - 1;
    expect(await evictPreparedContent(client, 0, budget)).toBe(true);
    expect(client.getQueryData(oldKey)).toBeUndefined();
    expect(client.getQueryData(newKey)).toBe("current");
    expect(getOfflineContentSnapshot().essentialReady).toBe(true);
    client.clear();
  });
  it("bounds automatic history reads to 500 records", async () => {
    const client = new QueryClient();
    const getWorks = vi.fn(async (address: string, limit: number) =>
      Array.from({ length: limit }, (_, i) => ({ id: `${address}-${i}`, metadata: "", media: [] }))
    );
    const run = coordinator(client, {
      getWorks,
      getDetails: async () => ({ reads: [], photos: [] }),
    });
    await run.prepare(
      account,
      Array.from({ length: 12 }, (_, i) => ({ ...targets[0], address: `garden-${i}` }))
    );
    expect(getWorks.mock.calls.reduce((sum, call) => sum + call[1], 0)).toBe(500);
    expect(
      Object.values(getOfflineContentSnapshot().gardens).filter(
        (entry) => entry.state === "partial"
      )
    ).toHaveLength(2);
    client.clear();
  });
  it("downgrades a persisted record snapshot that no longer matches verified content", async () => {
    const client = new QueryClient();
    await coordinator(client).prepare(account, targets);
    client.setQueryData(worksKeys.preparedRecent("garden", chainId), [
      { id: "different-snapshot" },
    ]);
    await verifyPreparedContent(client);
    expect(Object.values(getOfflineContentSnapshot().gardens)[0].state).toBe("partial");
    expect(
      client.getQueryCache().find({ queryKey: worksKeys.preparedRecent("garden", chainId) })?.meta
        ?.offlinePrepared
    ).not.toBe(true);
    client.clear();
  });
  it("refreshes active priorities even when already-prepared content is reused", async () => {
    const client = new QueryClient();
    const run = coordinator(client);
    const two = [
      { ...targets[0], address: "a" },
      { ...targets[0], address: "b", priority: 1 },
    ];
    await run.prepare(account, two);
    await run.prepare(account, [
      { ...two[1], priority: 0, visitedAt: 3 },
      { ...two[0], priority: 1, visitedAt: 2 },
    ]);
    const entries = Object.values(getOfflineContentSnapshot().gardens);
    expect(entries.find((item) => item.address === "a")?.priority).toBe(1);
    expect(entries.find((item) => item.address === "b")?.priority).toBe(0);
    client.clear();
  });
  it("limits concurrent downloads to two and resumes an interrupted preparation", async () => {
    const client = new QueryClient();
    let downloading = 0;
    let max = 0;
    let enabled = true;
    const run = coordinator(client, {
      canRun: () => enabled,
      getWorks: async () => [1, 2, 3].map((id) => ({ id: String(id), media: [], metadata: "" })),
      getDetails: async (work: { id: string }) => ({
        reads: [],
        photos: [`https://media.example/${work.id}`],
      }),
      fetchMedia: async () => {
        downloading++;
        max = Math.max(max, downloading);
        await new Promise((resolve) => setTimeout(resolve, 5));
        downloading--;
        return response();
      },
    });
    await run.prepare(account, targets);
    expect(max).toBe(2);
    enabled = false;
    run.pause();
    enabled = true;
    await run.prepareEssentials(
      "profile",
      [{ key: worksKeys.approvals(undefined, chainId), data: [] }],
      ["https://avatar.example/avatar"]
    );
    expect(getOfflineContentSnapshot().essentialReady).toBe(true);
    client.clear();
  });
  it("serializes two competing cache writes at the 150 MiB boundary", async () => {
    const client = new QueryClient();
    await updateDownloadManifest((manifest) => ({
      ...manifest,
      assets: {
        "https://profile.example/protected": {
          url: "https://profile.example/protected",
          bytes: OFFLINE_READING_BUDGET - 5000,
          protected: true,
          accessedAt: 1,
          owners: ["essential:profile"],
          intent: "display",
        },
      },
    }));
    const run = coordinator(client, {
      getWorks: async () => [1, 2].map((id) => ({ id: String(id), media: [], metadata: "" })),
      getDetails: async (work: { id: string }) => ({
        reads: [],
        photos: [`https://media.example/${work.id}`],
      }),
      fetchMedia: async () => response(3000),
    });
    await run.prepare(account, targets);
    expect(readingBytes(getOfflineContentSnapshot())).toBeLessThanOrEqual(OFFLINE_READING_BUDGET);
    expect(
      [...cache.keys()].filter((url) => url.startsWith("https://media.example/"))
    ).toHaveLength(1);
    expect(Object.values(getOfflineContentSnapshot().gardens)[0].state).toBe("partial");
    client.clear();
  });
  it("releases superseded photos only after replacement coverage commits", async () => {
    const client = new QueryClient();
    let version = 1;
    const run = coordinator(client, {
      getWorks: async () => [{ id: String(version), media: [], metadata: "" }],
      getDetails: async (work: { id: string }) => ({
        reads: [],
        photos: [`https://media.example/${work.id}`],
      }),
    });
    await run.prepare(account, targets);
    expect(cache.has("https://media.example/1")).toBe(true);
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 300001);
    version = 2;
    await run.prepare(account, targets);
    expect(cache.has("https://media.example/1")).toBe(false);
    expect(cache.has("https://media.example/2")).toBe(true);
    clock.mockRestore();
    client.clear();
  });
  it("removes orphaned prepared flags after an interrupted eviction", async () => {
    const client = new QueryClient();
    const key = worksKeys.online("orphan", chainId);
    client.setQueryData(key, [{ id: "old" }]);
    const query = client.getQueryCache().find({ queryKey: key })!;
    query.setOptions({ ...query.options, meta: { offlinePrepared: true } });
    await verifyPreparedContent(client);
    expect(client.getQueryData(key)).toBeUndefined();
    client.clear();
  });
});

it("keeps missing essential images and failed required profile reads partial after restart", async () => {
  const client = new QueryClient();
  const run = coordinator(client);
  const reads = [{ key: ["greengoods", "profile", "current"], data: { name: "Garden keeper" } }];
  const avatar = "https://media.example/avatar";
  const actionPhoto = "https://media.example/action";
  await run.prepareEssentials("account:chain", reads, [avatar], [actionPhoto]);
  expect(getOfflineContentSnapshot().essentialReady).toBe(true);
  cache.delete(actionPhoto);
  await verifyPreparedContent(client);
  expect(getOfflineContentSnapshot().essentialReady).toBe(false);
  await verifyPreparedContent(client);
  expect(getOfflineContentSnapshot().essentialReady).toBe(false);
  await run.prepareEssentials("account:chain", reads, [avatar], [], false);
  await verifyPreparedContent(client);
  expect(getOfflineContentSnapshot().essentialReady).toBe(false);
});
