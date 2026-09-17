/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { jobQueueDB } from "../../modules/job-queue/db";
import { recoverStuckWork, stuckWorkReason } from "../../modules/job-queue/stuck-work-recovery";
import type { Job } from "../../types/job-queue";

let userAddress = "";
let sequence = 0;

beforeEach(() => {
  // A fresh address per test keeps each test's jobs to itself.
  sequence += 1;
  userAddress = `0xrecovery${sequence}`;
});

async function seed(
  kind: string,
  lastError: string,
  {
    payload = {},
    meta = {},
    attempts = 5,
  }: Partial<Pick<Job, "payload" | "meta" | "attempts">> = {}
): Promise<string> {
  const id = await jobQueueDB.addJob({
    kind,
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", ...(payload as object) },
    meta: { chainId: 11155111, ...meta },
    chainId: 11155111,
    userAddress,
  } as Parameters<typeof jobQueueDB.addJob>[0]);
  const job = await jobQueueDB.getJob(id);
  await jobQueueDB.updateJob({ ...job!, attempts, lastError });
  return id;
}

describe("recovering work earlier builds gave up on", () => {
  it("gives declined work its retries back and holds it for the person's upload", async () => {
    const cancelled = await seed("work", "cancelled");
    const rejected = await seed("work", "unavailable:User rejected the request.");

    await expect(recoverStuckWork(userAddress)).resolves.toEqual(
      expect.arrayContaining([cancelled, rejected])
    );

    for (const id of [cancelled, rejected]) {
      const job = await jobQueueDB.getJob(id);
      expect(job?.attempts).toBe(0);
      expect(job?.lastError).toBeUndefined();
      expect(job?.meta?.requiresExplicitSend).toBe(true);
      expect(job?.meta?.recoveryVersion).toBe(1);
    }
  });

  it("recovers a photo that failed as an unsupported type, and no other attachment limit", async () => {
    const heic = await seed("work", "unavailable:media-type");
    const tooLarge = await seed("work", "unavailable:media-type, media-size");

    await expect(recoverStuckWork(userAddress)).resolves.toEqual([heic]);
    expect((await jobQueueDB.getJob(tooLarge))?.lastError).toBe(
      "unavailable:media-type, media-size"
    );
  });

  it("recovers work and decisions retired after failed sends that never reached the network", async () => {
    const work = await seed("work", "Max retries (5) exceeded");
    const decision = await seed("approval", "Max retries (5) exceeded");

    await expect(recoverStuckWork(userAddress)).resolves.toEqual(
      expect.arrayContaining([work, decision])
    );
    expect((await jobQueueDB.getJob(decision))?.meta?.requiresExplicitSend).toBe(true);
  });

  it("never touches a send that may be on-chain, a reverted send, or a job still retrying", async () => {
    const sent = await seed("work", "Max retries (5) exceeded", {
      payload: { uploadCheckpoint: { submittedAt: "", files: {}, broadcastPending: true } },
    });
    const decided = await seed("approval", "Max retries (5) exceeded", {
      payload: { sendCheckpoint: { transactionHash: `0x${"ab".repeat(32)}` } },
    });
    const reverted = await seed("work", "unavailable:work-transaction-reverted", {
      meta: { workTransactionReverted: true },
    });
    const retrying = await seed("work", "cancelled", { attempts: 2 });

    await expect(recoverStuckWork(userAddress)).resolves.toEqual([]);
    for (const id of [sent, decided, reverted, retrying]) {
      expect((await jobQueueDB.getJob(id))?.lastError).toBeTruthy();
    }
  });

  it("lets a commitment link follow its recovered work, without holding it for a tap", async () => {
    const link = await seed("workLink", "identity_conflict:source-work-terminal");

    await expect(recoverStuckWork(userAddress)).resolves.toEqual([link]);
    const job = await jobQueueDB.getJob(link);
    expect(job?.attempts).toBe(0);
    expect(job?.meta?.requiresExplicitSend).toBeUndefined();
  });

  it("recovers a job only once", async () => {
    const id = await seed("work", "cancelled");
    await recoverStuckWork(userAddress);
    const recovered = await jobQueueDB.getJob(id);
    await jobQueueDB.updateJob({
      ...recovered!,
      attempts: 5,
      lastError: "Max retries (5) exceeded",
    });

    await expect(recoverStuckWork(userAddress)).resolves.toEqual([]);
    expect(stuckWorkReason((await jobQueueDB.getJob(id))!)).toBeNull();
  });

  it("keeps the job's stored photos while it recovers", async () => {
    const photo = new File(["jpeg-bytes"], "garden.jpg", { type: "image/jpeg" });
    const id = await jobQueueDB.addJob({
      kind: "work",
      payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", media: [photo] },
      meta: { chainId: 11155111 },
      chainId: 11155111,
      userAddress,
    } as Parameters<typeof jobQueueDB.addJob>[0]);
    await jobQueueDB.markJobTerminalFailed(id, "cancelled");

    await expect(recoverStuckWork(userAddress)).resolves.toEqual([id]);
    const images = await jobQueueDB.getImagesForJob(id);
    expect(images).toHaveLength(1);
    expect(images[0].file.name).toBe("garden.jpg");
    expect((await jobQueueDB.getJob(id))?.payload).toMatchObject({ gardenAddress: "0xgarden" });
  });
});
