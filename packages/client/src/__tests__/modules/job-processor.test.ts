import { describe, it, expect, vi } from "vitest";

vi.mock("../../modules/job-queue/db", () => ({
  jobQueueDB: {
    getJob: vi.fn(async () => ({
      id: "j1",
      kind: "approval",
      payload: {},
      chainId: 84532,
      attempts: 0,
      synced: false,
    })),
    markJobSynced: vi.fn(async () => {}),
    markJobFailed: vi.fn(async () => {}),
  },
}));

vi.mock("../../modules/job-queue/processors/approval", () => ({
  approvalProcessor: {
    encodePayload: vi.fn(async () => ({})),
    execute: vi.fn(async () => "0xabc"),
  },
}));

import { JobProcessor } from "../../modules/job-queue/job-processor";
import { jobQueueDB } from "../../modules/job-queue/db";

describe("modules/job-queue/job-processor", () => {
  it("returns error when smart account client is missing", async () => {
    const jp = new JobProcessor();
    const res = await jp.processJob("j1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Smart account client not available");
  });

  it("processes approval job when client present", async () => {
    const jp = new JobProcessor();
    const client = {
      sendTransaction: vi.fn(async () => "0xabc"),
      getAddress: vi.fn(async () => "0x0"),
      isConnected: () => true,
    } as any;
    jp.setSmartAccountClient(client);
    const res = await jp.processJob("j1");
    expect(res.success).toBe(true);
    expect(res.txHash).toBe("0xabc");
    expect(jobQueueDB.markJobSynced as any).toHaveBeenCalled();
  });
});
