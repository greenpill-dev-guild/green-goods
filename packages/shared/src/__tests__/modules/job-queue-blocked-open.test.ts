/** A stale pre-Dexie tab cannot leave the queue's first live view loading forever. */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

const DB_NAME = "green-goods-job-queue";
let blocker: IDBDatabase | undefined;

function openLegacyBlocker(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 7);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("jobs")) {
        request.result.createObjectStore("jobs", { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

afterEach(async () => {
  blocker?.close();
  blocker = undefined;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => resolve();
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
  });
  vi.resetModules();
});

describe("job queue blocked upgrade", () => {
  it("reports the blocked open instead of leaving its live view pending", async () => {
    blocker = await openLegacyBlocker();
    // Model a suspended old tab that does not respond to the version-change request.
    blocker.onversionchange = () => undefined;
    const { jobQueueDB } = await import("../../modules/job-queue/db");
    const errors: unknown[] = [];
    const subscription = jobQueueDB
      .observeStats("0x0000000000000000000000000000000000000001")
      .subscribe({ error: (error) => errors.push(error) });

    await vi.waitFor(() =>
      expect(errors).toEqual([
        expect.objectContaining({ message: "job-queue-database-upgrade-blocked" }),
      ])
    );
    subscription.unsubscribe();
  });
});
