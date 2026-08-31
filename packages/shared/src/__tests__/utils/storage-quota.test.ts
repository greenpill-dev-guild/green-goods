/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupRefetchableStorage,
  isPersistedQueryClientExpired,
  requestPersistentStorageOnce,
  retryOnceAfterQuotaCleanup,
} from "../../utils/storage/quota";

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");

function installStorageEstimate(percentages: number[]) {
  const estimate = vi.fn(async () => {
    const percent = percentages.shift() ?? 0;
    return { usage: percent, quota: 100 };
  });
  const persisted = vi.fn().mockResolvedValue(false);
  const persist = vi.fn().mockResolvedValue(true);
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { estimate, persisted, persist },
  });
  return { estimate, persisted, persist };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(navigator, "storage", originalStorage);
  else Reflect.deleteProperty(navigator, "storage");
  if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
  else Reflect.deleteProperty(globalThis, "caches");
});

describe("storage quota protection", () => {
  it("only treats persisted query snapshots older than their max age as evictable", () => {
    const now = Date.now();
    expect(isPersistedQueryClientExpired({ timestamp: now - 24 * 60 * 60 * 1000 }, now)).toBe(
      false
    );
    expect(isPersistedQueryClientExpired({ timestamp: now - 24 * 60 * 60 * 1000 - 1 }, now)).toBe(
      true
    );
  });

  it("requests persistence once after a meaningful storage reason", async () => {
    const { persist, persisted } = installStorageEstimate([]);

    await expect(requestPersistentStorageOnce("work-draft")).resolves.toBe(true);
    await expect(requestPersistentStorageOnce("offline-job")).resolves.toBe(false);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persisted).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("gg-persistent-storage-requested")).toBe("work-draft");
  });

  it("evicts refetchable caches in priority order until usage is below 65%", async () => {
    installStorageEstimate([80, 75, 64]);
    const deleted: string[] = [];
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        delete: vi.fn(async (cacheName: string) => {
          deleted.push(cacheName);
          return true;
        }),
      },
    });

    const result = await cleanupRefetchableStorage();

    expect(deleted).toEqual(["indexer-cache", "graphql-cache", "image-cache"]);
    expect(deleted).not.toContain("ipfs-cache");
    expect(deleted).not.toContain("gg-job-queue");
    expect(deleted).not.toContain("gg-drafts");
    expect(result.afterPercentUsed).toBe(64);
  });

  it("cleans refetchable data and retries a quota failure exactly once", async () => {
    installStorageEstimate([90, 0]);
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { delete: vi.fn().mockResolvedValue(true) },
    });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new DOMException("full", "QuotaExceededError"))
      .mockResolvedValueOnce("saved");

    await expect(retryOnceAfterQuotaCleanup(operation)).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
