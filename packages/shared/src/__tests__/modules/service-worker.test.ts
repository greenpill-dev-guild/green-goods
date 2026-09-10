/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceWorkerManager } from "../../modules/app/service-worker";

describe("modules/service-worker", () => {
  beforeEach(() => {
    // Use Object.defineProperty to mock navigator.serviceWorker
    // since it's a read-only property in modern browsers
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockRejectedValue(new Error("no sw in tests")),
        ready: Promise.resolve({}) as any,
        addEventListener: vi.fn(),
        controller: undefined,
      },
      configurable: true,
      writable: true,
    });
  });

  it("exposes status shape", () => {
    const status = serviceWorkerManager.getStatus();
    expect(status).toHaveProperty("isSupported");
    expect(status).toHaveProperty("isRegistered");
  });

  it("preserves query snapshots, drafts, jobs, share inbox and the offline shell", async () => {
    localStorage.setItem("__rq_pc__", JSON.stringify({ timestamp: Date.now() }));

    const deleteDatabase = vi.spyOn(indexedDB, "deleteDatabase");
    const removeCache = vi.fn(async (_key: string) => true);
    vi.stubGlobal("caches", {
      keys: async () => [
        "gg-pwa-shell-current",
        "gg-pwa-shell-meta",
        "gg-js-runtime",
        "workbox-precache-v2",
        "gg-share-inbox-v1",
        "image-cache",
        "ipfs-cache",
        "indexer-cache",
        "graphql-cache",
        "js-cache",
      ],
      delete: removeCache,
    });
    await serviceWorkerManager.clearAllCaches();
    expect(localStorage.getItem("__rq_pc__")).not.toBeNull();
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(removeCache.mock.calls.map(([key]) => key)).toEqual([
      "indexer-cache",
      "graphql-cache",
      "js-cache",
    ]);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
