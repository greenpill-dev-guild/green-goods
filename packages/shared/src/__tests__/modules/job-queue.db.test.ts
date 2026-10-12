import { describe, expect, it, vi } from "vitest";

// Ensure fake-indexeddb is loaded before job-queue module
import "fake-indexeddb/auto";

// Import directly from db.ts to avoid EAS SDK dependency chain
import { jobQueueDB } from "../../modules/job-queue/db";
import { retireWorkCompletionSnapshots } from "../../modules/job-queue/work-completions";
import { resolveDeferredWorkIdentity } from "../../modules/commitment-pooling/work-identity";

// Test user address for scoped queue operations
const TEST_USER_ADDRESS = "0xTestUser123";

/**
 * Creates a mock File with arrayBuffer support for Node.js test environment.
 * Node's File class may not have arrayBuffer() method in all environments.
 */
function createMockFile(content: string, name: string, type: string): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });

  // Ensure arrayBuffer is available (polyfill for test environments)
  if (!file.arrayBuffer) {
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => {
        const reader = new FileReader();
        return new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });
      },
    });
  }

  return file;
}

describe("modules/job-queue/db", () => {
  it("adds and retrieves a job, manages images URLs", async () => {
    // fake-indexeddb is already installed via setupTests
    // Polyfill URL.createObjectURL if missing
    if (!global.URL.createObjectURL) {
      (global.URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(
        () => `blob:mock-${Math.random()}`
      );
      (global.URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    }

    const mockFile = createMockFile("x", "x.jpg", "image/jpeg");

    const id = await jobQueueDB.addJob({
      kind: "work",
      payload: { media: [mockFile] },
      meta: { chainId: 11155111 },
      chainId: 11155111,
      userAddress: TEST_USER_ADDRESS,
    } as Parameters<typeof jobQueueDB.addJob>[0]);

    expect(typeof id).toBe("string");
    const job = await jobQueueDB.getJob(id);
    expect(job?.kind).toBe("work");
    expect(job?.userAddress).toBe(TEST_USER_ADDRESS.toLowerCase());

    const images = await jobQueueDB.getImagesForJob(id);
    expect(images.length).toBe(1);

    await jobQueueDB.deleteJob(id);
    const after = await jobQueueDB.getJob(id);
    expect(after).toBeUndefined();
  });

  it("does not count a retained synced job as failed", async () => {
    const id = await jobQueueDB.addJob({
      kind: "approval",
      payload: {},
      meta: { chainId: 11155111 },
      chainId: 11155111,
      userAddress: TEST_USER_ADDRESS,
    } as Parameters<typeof jobQueueDB.addJob>[0]);

    await jobQueueDB.markJobFailed(id, "temporary network failure");
    await jobQueueDB.markJobSynced(id, "0xcompleted");

    const retained = await jobQueueDB.getJob(id);
    expect(retained?.synced).toBe(true);
    expect(retained?.lastError).toBeUndefined();
    await expect(jobQueueDB.getStats(TEST_USER_ADDRESS)).resolves.toMatchObject({
      pending: 0,
      failed: 0,
      synced: 1,
    });

    await jobQueueDB.deleteJob(id);
  });
});

describe("durable work admission", () => {
  const address = "0x123456789012345678901234567890123456789a" as const;
  const draft = (clientWorkId: string, chainId = 11155111, userAddress: string = address) =>
    ({
      kind: "work",
      chainId,
      userAddress,
      payload: { clientWorkId, feedback: "work", media: [] },
    }) as Parameters<typeof jobQueueDB.addJob>[0];
  it("admits concurrent submissions once despite account casing", async () => {
    const clientWorkId = crypto.randomUUID();
    const ids = await Promise.all([
      jobQueueDB.addJob(draft(clientWorkId)),
      jobQueueDB.addJob(draft(clientWorkId, 11155111, address.toUpperCase())),
    ]);
    expect(ids[0]).toBe(ids[1]);
    expect(await jobQueueDB.getJobs({ userAddress: address.toUpperCase() })).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids[0] })])
    );
  });
  it("retains completion after cleanup and permits the same id only in a different scope", async () => {
    const clientWorkId = crypto.randomUUID();
    const id = await jobQueueDB.addJob(draft(clientWorkId));
    await jobQueueDB.storeClientWorkIdMapping(clientWorkId, "0xcompleted", id);
    await jobQueueDB.deleteJob(id);
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60 * 24 * 60 * 60 * 1000);
    try {
      await jobQueueDB.cleanupOldMappings();
    } finally {
      now.mockRestore();
    }
    expect(await jobQueueDB.addJob(draft(clientWorkId))).toBe(id);
    expect(await jobQueueDB.getWorkCompletion(address, 11155111, clientWorkId)).toMatchObject({
      transactionHash: "0xcompleted",
    });
    expect(await jobQueueDB.addJob(draft(clientWorkId, 42161))).not.toBe(id);
  });
  it("allows only one claim token and prevents another token from releasing it", async () => {
    const id = crypto.randomUUID();
    expect(await jobQueueDB.acquireExecutionClaim([id], "first")).toBe(true);
    expect(await jobQueueDB.acquireExecutionClaim([id], "second")).toBe(false);
    await jobQueueDB.releaseExecutionClaim([id], "second");
    expect(await jobQueueDB.acquireExecutionClaim([id], "second")).toBe(false);
    await jobQueueDB.releaseExecutionClaim([id], "first");
    expect(await jobQueueDB.acquireExecutionClaim([id], "second")).toBe(true);
    await jobQueueDB.releaseExecutionClaim([id], "second");
  });
  it("keeps legacy hash mappings unresolved with durable evidence instead of inferring a completed account", async () => {
    const clientWorkId = crypto.randomUUID();
    const db = await jobQueueDB.init();
    await db.client_work_id_mappings.put({
      clientWorkId,
      attestationId: "0xlegacy",
      jobId: "removed-legacy-job",
      createdAt: Date.now(),
    });
    expect(await jobQueueDB.getWorkCompletion(address, 11155111, clientWorkId)).toBeUndefined();
    const id = await jobQueueDB.addJob(draft(clientWorkId));
    expect(await jobQueueDB.getJob(id)).toMatchObject({
      synced: false,
      meta: { legacyConfirmation: true },
      payload: { uploadCheckpoint: { transactionHash: "0xlegacy" } },
    });
  });
  it("does not let a repeated admission replace a newer broadcast checkpoint", async () => {
    const clientWorkId = crypto.randomUUID();
    const id = await jobQueueDB.addJob(draft(clientWorkId));
    const current = (await jobQueueDB.getJob(id))!;
    (current.payload as { uploadCheckpoint?: unknown }).uploadCheckpoint = {
      files: {},
      submittedAt: "2026-09-12",
      broadcast: { kind: "user-operation", hash: "0xnew" },
    };
    await jobQueueDB.updateJob(current);
    await jobQueueDB.addJob({
      ...draft(clientWorkId),
      payload: {
        clientWorkId,
        uploadCheckpoint: { files: {}, submittedAt: "2026-09-01", transactionHash: "0xold" },
      },
    });
    expect((await jobQueueDB.getJob(id))?.payload).toMatchObject({
      uploadCheckpoint: { broadcast: { kind: "user-operation", hash: "0xnew" } },
    });
  });
});

it("retains the receipt-confirmed card after queue and photo cleanup", async () => {
  const address = "0x1111111111111111111111111111111111111111" as const;
  const garden = "0x2222222222222222222222222222222222222222" as const;
  const work = {
    id: `0x${"ab".repeat(32)}`,
    gardenerAddress: address,
    gardenAddress: garden,
    actionUID: 1,
    title: "Planting",
    feedback: "Completed",
    metadata: '{"clientWorkId":"confirmed-copy"}',
    media: ["uploaded-photo"],
    createdAt: 1800000000,
    status: "pending" as const,
  };
  const id = await jobQueueDB.addJob({
    kind: "work",
    chainId: 11155111,
    userAddress: address,
    payload: {
      clientWorkId: "confirmed-copy",
      confirmedWork: work,
      gardenAddress: garden,
      actionUID: 1,
      feedback: "Completed",
    },
  });
  await jobQueueDB.storeClientWorkIdMapping("confirmed-copy", `0x${"cd".repeat(32)}`, id);
  const originalJob = (await jobQueueDB.getJob(id))!;
  await jobQueueDB.deleteJob(id);
  expect((await jobQueueDB.getWorkCompletion(address, 11155111, "confirmed-copy"))?.work).toEqual(
    work
  );
  expect(await jobQueueDB.getWorkCompletion(address, 42161, "confirmed-copy")).toBeUndefined();
  expect(await jobQueueDB.getWorkCompletion(garden, 11155111, "confirmed-copy")).toBeUndefined();
  const resolveConfirmed = () =>
    resolveDeferredWorkIdentity({
      clientWorkId: "confirmed-copy",
      caller: address,
      chainId: 11155111,
      garden,
      dependencies: { getWorksByGardener: async () => [] },
    });
  await expect(resolveConfirmed()).resolves.toEqual({ status: "resolved", workUID: work.id });
  // Real completion records in neighbouring account/chain scopes must not leak
  // through the live read that backs Your Work.
  for (const scope of [
    { userAddress: address, chainId: 42161 },
    { userAddress: garden, chainId: 11155111 },
  ]) {
    const otherId = await jobQueueDB.addJob({
      kind: "work",
      ...scope,
      payload: {
        clientWorkId: "confirmed-copy",
        gardenAddress: garden,
        actionUID: 1,
        feedback: "Other",
        confirmedWork: { ...work, gardenerAddress: scope.userAddress },
      },
    });
    await jobQueueDB.storeClientWorkIdMapping("confirmed-copy", "0xother", otherId);
    await jobQueueDB.deleteJob(otherId);
  }
  const observed = await new Promise<unknown>((resolve, reject) => {
    const subscription = jobQueueDB
      .observeWorkCompletions(address.toUpperCase(), 11155111)
      .subscribe({
        next: (rows) => {
          subscription.unsubscribe();
          resolve(rows);
        },
        error: (error) => {
          subscription.unsubscribe();
          reject(error);
        },
      });
  });
  expect(observed).toEqual([expect.objectContaining({ clientWorkId: "confirmed-copy", work })]);
  await retireWorkCompletionSnapshots(jobQueueDB, address.toUpperCase(), 11155111, [
    work.id.toUpperCase(),
  ]);
  expect(await jobQueueDB.getWorkCompletion(address, 11155111, "confirmed-copy")).toMatchObject({
    clientWorkId: "confirmed-copy",
    transactionHash: `0x${"cd".repeat(32)}`,
    workUID: work.id,
    gardenAddress: garden,
    indexedAt: expect.any(Number),
  });
  expect(
    (await jobQueueDB.getWorkCompletion(address, 11155111, "confirmed-copy"))?.work
  ).toBeUndefined();
  await expect(resolveConfirmed()).resolves.toEqual({ status: "resolved", workUID: work.id });
  expect((await jobQueueDB.getWorkCompletion(address, 42161, "confirmed-copy"))?.work).toEqual({
    ...work,
    gardenerAddress: address,
  });
  expect((await jobQueueDB.getWorkCompletion(garden, 11155111, "confirmed-copy"))?.work).toEqual({
    ...work,
    gardenerAddress: garden,
  });
  // A late duplicate completion write cannot restore a retired card.
  const db = await jobQueueDB.init();
  await db.jobs.put(originalJob);
  await jobQueueDB.storeClientWorkIdMapping("confirmed-copy", `0x${"cd".repeat(32)}`, id);
  expect(
    (await jobQueueDB.getWorkCompletion(address, 11155111, "confirmed-copy"))?.work
  ).toBeUndefined();
  await jobQueueDB.deleteJob(id);
});
