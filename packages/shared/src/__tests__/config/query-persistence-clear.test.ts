/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPersistedQueryClient } from "../../config/query-persistence-clear";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("cache-only boot recovery", () => {
  it("clears current and legacy IndexedDB reading caches", async () => {
    const names = [crypto.randomUUID(), crypto.randomUUID()];
    for (const name of names)
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    await clearPersistedQueryClient({
      dbName: names[0],
      legacy: { dbName: names[1], storeName: "rq" },
    });
    const remaining = (await indexedDB.databases()).map((db) => db.name);
    for (const name of names) expect(remaining).not.toContain(name);
  });

  it("removes only reading-cache records and retains auth, drafts and preferences", async () => {
    const kept = [
      "greengoods_auth_mode",
      "greengoods_credential",
      "greengoods_signed_out",
      "gg-work-drafts",
      "gg-language",
    ];
    for (const key of kept) localStorage.setItem(key, "kept");
    localStorage.setItem("__rq_pc__", "old cache");
    localStorage.setItem('gg-["greengoods","gardens"]', "cached read");
    await clearPersistedQueryClient({ dbName: crypto.randomUUID() });
    expect(localStorage.length).toBe(kept.length);
    for (const key of kept) expect(localStorage.getItem(key)).toBe("kept");
  });

  it("clears web cache even when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    localStorage.setItem('gg-["greengoods","works"]', "cached read");
    await expect(clearPersistedQueryClient({ dbName: "absent" })).resolves.toBeUndefined();
    expect(localStorage.length).toBe(0);
  });

  it("remains usable when browser storage access is refused", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    await expect(
      clearPersistedQueryClient({ dbName: crypto.randomUUID() })
    ).resolves.toBeUndefined();
  });
});
