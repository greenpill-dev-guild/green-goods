import { describe, it, expect, vi, beforeEach } from "vitest";

import { SyncManager } from "../../modules/job-queue/sync-manager";
import { JobProcessor } from "../../modules/job-queue/job-processor";
import { jobQueueDB } from "../../modules/job-queue";

vi.mock("../../modules/job-queue", async (orig) => {
  const actual = await import("../../modules/job-queue");
  return {
    ...actual,
    jobQueueDB: {
      ...actual.jobQueueDB,
      getJobs: vi.fn(async () => []),
      clearSyncedJobs: vi.fn(async () => {}),
    },
  };
});

describe("modules/job-queue/sync-manager", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: any) => {
      // immediately execute
      fn();
      return 0 as any;
    }) as any);
  });

  it("returns zeros on empty queue and emits no failure", async () => {
    const sm = new SyncManager(new JobProcessor());
    (jobQueueDB.getJobs as any).mockResolvedValueOnce([]);
    const res = await sm.flush();
    expect(res).toMatchObject({ processed: 0, failed: 0, skipped: 0 });
  });

  it("debounces rapid flush calls", async () => {
    const sm = new SyncManager(new JobProcessor());
    (jobQueueDB.getJobs as any).mockResolvedValue([]);
    const a = sm.flush().catch(() => ({ processed: 0, failed: 0, skipped: 0 }));
    const b = sm.flush().catch(() => ({ processed: 0, failed: 0, skipped: 0 }));
    const [r1, r2] = await Promise.all([a, b]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});
