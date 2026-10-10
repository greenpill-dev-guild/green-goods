/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobQueueDB } from "../../modules/job-queue/db";
import {
  acquireAvailableWorkJobs,
  holdWorkClaims,
  releaseWorkClaims,
  saveUnderClaim,
} from "../../modules/job-queue/work-claims";
import {
  hasActiveWorkExecution,
  subscribeToWorkExecution,
} from "../../modules/work/execution-state";
import { acquireWorkJobs } from "../../modules/work/work-confirmation";

let sequence = 0;
async function queuedWork(): Promise<string> {
  sequence += 1;
  return jobQueueDB.addJob({
    kind: "work",
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", title: `Work ${sequence}` },
    meta: { chainId: 11155111 },
    chainId: 11155111,
    userAddress: "0xclaims",
  } as Parameters<typeof jobQueueDB.addJob>[0]);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("claims for preparing and uploading queued work", () => {
  it("claims the free jobs and leaves a busy one to its holder", async () => {
    const [free, busy] = [await queuedWork(), await queuedWork()];
    const other = await acquireWorkJobs([busy]);

    const claims = await acquireAvailableWorkJobs([free, busy]);

    expect([...claims.keys()]).toEqual([free]);
    await releaseWorkClaims(claims.values());
    await other?.release();
  });

  it("saves a job only while the claim is still this holder's", async () => {
    const id = await queuedWork();
    const [claim] = (await acquireAvailableWorkJobs([id])).values();

    await saveUnderClaim(claim, id, (stored) => {
      stored.meta = { ...stored.meta, preparation: { status: "ready", checkedAt: "now" } };
    });
    expect((await jobQueueDB.getJob(id))?.meta?.preparation).toEqual({
      status: "ready",
      checkedAt: "now",
    });

    // Another holder takes the job once this claim is gone.
    await claim.release();
    const other = await acquireWorkJobs([id]);
    await expect(
      saveUnderClaim(claim, id, (stored) => {
        stored.meta = { ...stored.meta, preparation: undefined };
      })
    ).rejects.toThrow("submission-ownership-changed");
    expect((await jobQueueDB.getJob(id))?.meta?.preparation).toBeDefined();
    await other?.release();
  });

  it("stays this tab's until storage has let go of it, and lets go even when storage refuses", async () => {
    const id = await queuedWork();
    const claim = await acquireWorkJobs([id]);
    const heard = vi.fn();
    const leave = subscribeToWorkExecution(heard);

    // Storage is slow to let go, as it is on a busy phone.
    const releaseStored = jobQueueDB.releaseExecutionClaim.bind(jobQueueDB);
    let finish = () => {};
    const stored = vi.spyOn(jobQueueDB, "releaseExecutionClaim");
    stored.mockImplementationOnce(async (ids, token) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      await releaseStored(ids, token);
    });
    const released = claim?.release();

    // The claim still holds back an app update and keeps a second holder in this tab out. A
    // restart let through here would leave the stored claim to shut the job out of the next page.
    expect(hasActiveWorkExecution()).toBe(true);
    expect(heard).not.toHaveBeenCalled();
    expect(await acquireWorkJobs([id])).toBeNull();

    finish();
    await released;
    expect(hasActiveWorkExecution()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);

    // Storage that refuses the release must not leave this tab holding the job for good.
    const next = await acquireWorkJobs([id]);
    stored.mockRejectedValueOnce(new Error("storage refused"));
    await expect(next?.release()).rejects.toThrow("storage refused");
    expect(hasActiveWorkExecution()).toBe(false);

    leave();
    await releaseStored([id], next?.token ?? "");
  });

  it("keeps a claim alive until it is stopped", async () => {
    vi.useFakeTimers();
    const assertOwned = vi.fn().mockResolvedValue(undefined);
    const stop = holdWorkClaims([{ token: "t", assertOwned, release: vi.fn() }], 20_000);

    await vi.advanceTimersByTimeAsync(40_000);
    expect(assertOwned).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(assertOwned).toHaveBeenCalledTimes(2);
  });
});
