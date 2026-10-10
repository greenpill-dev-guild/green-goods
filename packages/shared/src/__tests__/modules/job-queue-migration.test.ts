/**
 * In-place upgrade of the jobs database from the shapes shipped builds wrote.
 *
 * Production is at IndexedDB version 5 and staging at 7; Dexie's declared
 * version 8 opens both at 80. The drafts equivalent lives in
 * `draft-migration.test.ts`; the jobs database had no such coverage, which is
 * how an upgrade that could not open it reached this branch.
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { JobQueueDatabase } from "../../modules/job-queue/db-schema";

const opened: Dexie[] = [];

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

/** Seed a database the way an `idb`-era build left it, then close it. */
async function seedLegacyJobs(
  name: string,
  version: number,
  stores: Record<string, string | null>,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const seed = new Dexie(name);
  seed.version(version).stores(stores);
  await seed.open();
  await seed.table("jobs").bulkPut(rows);
  seed.close();
}

function uniqueName(): string {
  return `green-goods-job-queue-${Math.random().toString(36).slice(2)}`;
}

describe("job queue in-place upgrade", () => {
  it("opens a production-era database and lowercases the addresses", async () => {
    const name = uniqueName();
    await seedLegacyJobs(
      name,
      5,
      {
        jobs: "id, kind, createdAt, userAddress",
        job_images: "id, jobId, createdAt",
        cached_work: "id, gardenAddress, gardenerAddress",
        client_work_id_mappings: "clientWorkId, attestationId, jobId, createdAt",
      },
      [
        {
          id: "w1",
          kind: "work",
          createdAt: 1,
          userAddress: "0xAbCdEf0000000000000000000000000000000001",
        },
      ]
    );

    const db = new JobQueueDatabase(name);
    opened.push(db);
    await db.open();

    expect(db.verno).toBe(8);
    const job = await db.jobs.get("w1");
    expect(job?.userAddress).toBe("0xabcdef0000000000000000000000000000000001");
  });

  it("opens a database holding a job written before userAddress existed", async () => {
    // Version 5 added the field and its index but never backfilled, so an
    // unsent job from an older build still has none. Throwing on it aborts the
    // version change, and every later open fails the same way — the queue and
    // the work inside it would be unreachable for good.
    const name = uniqueName();
    await seedLegacyJobs(
      name,
      5,
      { jobs: "id, kind, createdAt", job_images: "id, jobId, createdAt" },
      [
        { id: "ancient", kind: "work", createdAt: 1 },
        { id: "recent", kind: "work", createdAt: 2, userAddress: "0xAAAA" },
      ]
    );

    const db = new JobQueueDatabase(name);
    opened.push(db);
    await expect(db.open()).resolves.toBeDefined();

    // Neither row is dropped: the queue holds work the steward has not sent.
    expect(await db.jobs.count()).toBe(2);
    expect((await db.jobs.get("ancient"))?.userAddress).toBeUndefined();
    expect((await db.jobs.get("recent"))?.userAddress).toBe("0xaaaa");
  });

  it("keeps queued photos byte-for-byte across the upgrade", async () => {
    const name = uniqueName();
    const seed = new Dexie(name);
    seed.version(7).stores({
      jobs: "id, kind, createdAt, userAddress",
      job_images: "id, jobId, createdAt",
    });
    await seed.open();
    await seed.table("jobs").put({ id: "w1", kind: "work", createdAt: 1, userAddress: "0xAA" });
    await seed.table("job_images").put({
      id: "i1",
      jobId: "w1",
      createdAt: 1,
      fileData: { data: new Uint8Array([7, 8, 9]).buffer },
    });
    seed.close();

    const db = new JobQueueDatabase(name);
    opened.push(db);
    await db.open();

    const image = (await db.job_images.get("i1")) as unknown as {
      fileData: { data: ArrayBuffer };
    };
    expect([...new Uint8Array(image.fileData.data)]).toEqual([7, 8, 9]);
  });

  it("is a no-op on a fresh install", async () => {
    const db = new JobQueueDatabase(uniqueName());
    opened.push(db);
    await db.open();

    expect(db.verno).toBe(8);
    expect(await db.jobs.count()).toBe(0);
  });
});
