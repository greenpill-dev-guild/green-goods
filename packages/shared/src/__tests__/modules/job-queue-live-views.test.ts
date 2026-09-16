/**
 * The queue's live views keep re-emitting.
 *
 * These subscribe before anything has opened the database, which is what a
 * component mounting during boot does. Opening runs the version upgrade — a
 * readwrite transaction — and Dexie refuses one inside a live query, so a
 * querier that had to open the database threw and its view froze at the first
 * value it emitted. In the app that was the offline sync bar reading zero with
 * work queued in front of it, and whether it happened came down to which view
 * subscribed first.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobQueueDB } from "../../modules/job-queue/db";
import type { Job } from "../../types/job-queue";

/** One account per case: the database persists across cases in this file. */
let accountSeed = 0;
function nextAccount(): string {
  accountSeed += 1;
  return `0x${accountSeed.toString(16).padStart(40, "0")}`;
}
const subscriptions: Array<{ unsubscribe: () => void }> = [];

afterEach(() => {
  for (const subscription of subscriptions.splice(0)) subscription.unsubscribe();
  vi.restoreAllMocks();
});

function queueWork(userAddress: string) {
  return jobQueueDB.addJob({
    kind: "work",
    userAddress,
    payload: { gardenAddress: "0xgarden" },
  } as unknown as Omit<Job, "id" | "createdAt" | "attempts" | "synced">);
}

/** Wait for the observable to report `expected`, rather than for a fixed delay. */
async function settlesAt(seen: number[], expected: number): Promise<number | undefined> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (seen.at(-1) === expected) return seen.at(-1);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return seen.at(-1);
}

describe("job queue live views", () => {
  it("re-emits a job added after the first emission", async () => {
    const account = nextAccount();
    const seen: number[] = [];
    subscriptions.push(
      jobQueueDB
        .observeJobs({ userAddress: account, kind: "work", synced: false })
        .subscribe({ next: (jobs) => seen.push(jobs.length) })
    );

    expect(await settlesAt(seen, 0)).toBe(0);
    await queueWork(account);

    expect(await settlesAt(seen, 1)).toBe(1);
  });

  it("re-emits queue statistics as work is queued", async () => {
    const account = nextAccount();
    const seen: number[] = [];
    subscriptions.push(
      jobQueueDB.observeStats(account).subscribe({ next: (stats) => seen.push(stats.pending) })
    );

    expect(await settlesAt(seen, 0)).toBe(0);
    await queueWork(account);

    expect(await settlesAt(seen, 1)).toBe(1);
  });

  it("stops emitting once unsubscribed", async () => {
    const account = nextAccount();
    const seen: number[] = [];
    const subscription = jobQueueDB
      .observeJobs({ userAddress: account, kind: "work", synced: false })
      .subscribe({ next: (jobs) => seen.push(jobs.length) });

    await settlesAt(seen, 0);
    subscription.unsubscribe();
    const countAtUnsubscribe = seen.length;

    await queueWork(account);
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(seen.length).toBe(countAtUnsubscribe);
  });

  it("reports a database-open failure after one retry", async () => {
    const failure = new Error("database blocked");
    const init = vi.spyOn(jobQueueDB, "init").mockRejectedValue(failure);
    const errors: unknown[] = [];
    subscriptions.push(
      jobQueueDB.observeStats(nextAccount()).subscribe({ error: (error) => errors.push(error) })
    );

    await vi.waitFor(() => expect(errors).toEqual([failure]));
    expect(init).toHaveBeenCalledTimes(2);
  });
});
