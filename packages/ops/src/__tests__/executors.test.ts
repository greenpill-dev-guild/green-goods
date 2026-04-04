/**
 * Executor tests — job dispatch, executeJob routing
 *
 * Executors call external commands (forge, bun scripts) so we mock runCommand
 * at the module boundary. The real JobQueue is used per the task requirements.
 */

import { describe, expect, it, vi } from "vitest";
import { executeJob } from "../executors";
import { JobQueue } from "../job-queue";
import type { OpsJob, JobLogger } from "../types";

/**
 * Helper to create a minimal OpsJob for testing executeJob dispatch.
 */
function makeJob(type: OpsJob["type"], payload: Record<string, unknown>): OpsJob {
  return {
    id: "test-job-1",
    type,
    status: "running",
    requestedBy: "0xTestUser",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payload,
    result: null,
    error: null,
    logs: [],
  };
}

const noopLogger: JobLogger = {
  log: () => {},
};

describe("executeJob dispatch", () => {
  it("throws for unsupported job type", async () => {
    const job = makeJob("unknown-type" as OpsJob["type"], {});
    await expect(executeJob(job, noopLogger)).rejects.toThrow("Unsupported job type: unknown-type");
  });
});

describe("executeJob with real JobQueue", () => {
  it("job reaches succeeded state with a mock executor", async () => {
    const mockExecutor = vi.fn().mockResolvedValue({ deployed: true });
    const queue = new JobQueue(mockExecutor);

    const job = queue.create("deploy-plan", { network: "sepolia" }, "0xUser");

    await vi.waitFor(() => {
      expect(queue.get(job.id)!.status).toBe("succeeded");
    });

    expect(mockExecutor).toHaveBeenCalledTimes(1);
    expect(queue.get(job.id)!.result).toEqual({ deployed: true });
  });

  it("job reaches failed state when executor rejects", async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error("Deploy script failed"));
    const queue = new JobQueue(mockExecutor);

    const job = queue.create("deploy-plan", { network: "sepolia" }, "0xUser");

    await vi.waitFor(() => {
      expect(queue.get(job.id)!.status).toBe("failed");
    });

    expect(queue.get(job.id)!.error).toBe("Deploy script failed");
  });

  it("executor receives the job and logger arguments", async () => {
    const mockExecutor = vi.fn().mockImplementation(async (receivedJob: OpsJob, logger: JobLogger) => {
      expect(receivedJob.type).toBe("upgrade-plan");
      expect(receivedJob.payload).toEqual({ network: "sepolia", contract: "all" });
      expect(typeof logger.log).toBe("function");
      logger.log("system", "Test log from executor");
      return { upgraded: true };
    });

    const queue = new JobQueue(mockExecutor);
    const job = queue.create("upgrade-plan", { network: "sepolia", contract: "all" }, "0xOperator");

    await vi.waitFor(() => {
      expect(queue.get(job.id)!.status).toBe("succeeded");
    });

    const logs = queue.get(job.id)!.logs;
    expect(logs.some((l) => l.message === "Test log from executor")).toBe(true);
  });

  it("multiple jobs execute in sequence through the real queue", async () => {
    const executionOrder: string[] = [];
    const mockExecutor = vi.fn().mockImplementation(async (receivedJob: OpsJob) => {
      executionOrder.push(receivedJob.id);
      return {};
    });

    const queue = new JobQueue(mockExecutor);

    const job1 = queue.create("deploy-plan", {}, "0xUser");
    const job2 = queue.create("run-script", { scriptId: "deploy-status" }, "0xUser");
    const job3 = queue.create("upgrade-plan", { contract: "all" }, "0xUser");

    await vi.waitFor(() => {
      expect(queue.get(job3.id)!.status).toBe("succeeded");
    });

    expect(executionOrder).toEqual([job1.id, job2.id, job3.id]);
    expect(mockExecutor).toHaveBeenCalledTimes(3);
  });
});
