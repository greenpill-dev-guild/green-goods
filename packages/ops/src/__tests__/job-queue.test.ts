/**
 * JobQueue tests — job lifecycle, pub/sub, sequential execution, log management
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobQueue } from "../job-queue";
import type { OpsJob, JobLogger, JobLogEntry } from "../types";

describe("JobQueue", () => {
  let executeFn: ReturnType<typeof vi.fn>;
  let queue: InstanceType<typeof JobQueue>;

  beforeEach(() => {
    executeFn = vi.fn().mockResolvedValue({ ok: true });
    queue = new JobQueue(executeFn as (job: OpsJob, logger: JobLogger) => Promise<Record<string, unknown>>);
  });

  describe("create", () => {
    it("creates a job with correct fields and begins processing", () => {
      // Note: run() executes synchronously until first await, so by the time
      // create() returns, the job status may already be "running" (or even
      // "succeeded" for instant resolvers). We verify the structural fields.
      const job = queue.create("deploy-plan", { network: "sepolia" }, "0xUser");

      expect(job.id).toBeDefined();
      expect(job.type).toBe("deploy-plan");
      // Status transitions synchronously from "queued" -> "running" during create()
      // because run() executes until its first await
      expect(["queued", "running", "succeeded"]).toContain(job.status);
      expect(job.requestedBy).toBe("0xUser");
      expect(job.payload).toEqual({ network: "sepolia" });
    });

    it("assigns unique ids to each job", () => {
      const job1 = queue.create("deploy-plan", {}, "0xUser");
      const job2 = queue.create("deploy-plan", {}, "0xUser");

      expect(job1.id).not.toBe(job2.id);
    });

    it("sets createdAt and updatedAt to ISO timestamps", () => {
      const job = queue.create("deploy-plan", {}, "0xUser");

      expect(new Date(job.createdAt).getTime()).not.toBeNaN();
      expect(new Date(job.updatedAt).getTime()).not.toBeNaN();
    });
  });

  describe("list", () => {
    it("returns all jobs sorted by createdAt descending", async () => {
      // Create jobs with slight delay to ensure different timestamps
      const job1 = queue.create("deploy-plan", { order: 1 }, "0xUser");
      // Wait a tick to ensure different timestamp
      await new Promise((r) => setTimeout(r, 5));
      const job2 = queue.create("run-script", { order: 2 }, "0xUser");

      const jobs = queue.list();
      expect(jobs).toHaveLength(2);
      // Most recent first
      expect(jobs[0].id).toBe(job2.id);
      expect(jobs[1].id).toBe(job1.id);
    });

    it("returns empty array when no jobs exist", () => {
      expect(queue.list()).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns a job by id", () => {
      const job = queue.create("deploy-plan", {}, "0xUser");
      const retrieved = queue.get(job.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(job.id);
    });

    it("returns undefined for unknown id", () => {
      expect(queue.get("nonexistent")).toBeUndefined();
    });
  });

  describe("execution lifecycle", () => {
    it("transitions through running to succeeded", async () => {
      const statusHistory: string[] = [];

      // Use a delayed executor so we can observe the "running" state
      let resolveExecution: () => void;
      executeFn.mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          resolveExecution = resolve;
        });
        return { done: true };
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      // By now, run() has synchronously set status to "running" and is awaiting the executor
      queue.onStatus(job.id, (updatedJob) => {
        statusHistory.push(updatedJob.status);
      });

      // Job should be running (executor is blocked)
      expect(queue.get(job.id)!.status).toBe("running");

      // Unblock the executor
      resolveExecution!();

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      expect(statusHistory).toContain("succeeded");
    });

    it("transitions to failed when executor throws", async () => {
      executeFn.mockRejectedValue(new Error("Deployment failed"));

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("failed");
      });

      const failedJob = queue.get(job.id)!;
      expect(failedJob.error).toBe("Deployment failed");
    });

    it("logs system error message on failure", async () => {
      executeFn.mockRejectedValue(new Error("Script crashed"));

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("failed");
      });

      const failedJob = queue.get(job.id)!;
      const systemLogs = failedJob.logs.filter((l) => l.stream === "system");
      expect(systemLogs.some((l) => l.message.includes("ERROR: Script crashed"))).toBe(true);
    });

    it("stores result on success", async () => {
      executeFn.mockResolvedValue({ chainId: 11155111, txCount: 5 });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      expect(queue.get(job.id)!.result).toEqual({ chainId: 11155111, txCount: 5 });
    });

    it("passes a logger to the executor", async () => {
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        logger.log("stdout", "Building contracts...");
        logger.log("stderr", "Warning: gas estimate");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      const logs = queue.get(job.id)!.logs;
      expect(logs).toHaveLength(2);
      expect(logs[0].stream).toBe("stdout");
      expect(logs[0].message).toBe("Building contracts...");
      expect(logs[1].stream).toBe("stderr");
      expect(logs[1].message).toBe("Warning: gas estimate");
    });
  });

  describe("sequential execution", () => {
    it("executes jobs one at a time in order", async () => {
      const executionOrder: number[] = [];
      let resolvers: Array<() => void> = [];

      executeFn.mockImplementation(async (job: OpsJob) => {
        const order = job.payload.order as number;
        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
        executionOrder.push(order);
        return {};
      });

      const job1 = queue.create("deploy-plan", { order: 1 }, "0xUser");
      const job2 = queue.create("run-script", { order: 2 }, "0xUser");
      const job3 = queue.create("deploy-plan", { order: 3 }, "0xUser");

      // Wait for first job to start
      await vi.waitFor(() => {
        expect(resolvers.length).toBe(1);
      });

      // Job 1 is running, 2 and 3 should still be queued
      expect(queue.get(job1.id)!.status).toBe("running");
      expect(queue.get(job2.id)!.status).toBe("queued");
      expect(queue.get(job3.id)!.status).toBe("queued");

      // Resolve job 1
      resolvers[0]();

      // Wait for job 2 to start
      await vi.waitFor(() => {
        expect(resolvers.length).toBe(2);
      });

      expect(queue.get(job1.id)!.status).toBe("succeeded");
      expect(queue.get(job2.id)!.status).toBe("running");

      // Resolve job 2
      resolvers[1]();

      // Wait for job 3 to start and resolve it
      await vi.waitFor(() => {
        expect(resolvers.length).toBe(3);
      });
      resolvers[2]();

      await vi.waitFor(() => {
        expect(queue.get(job3.id)!.status).toBe("succeeded");
      });

      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe("pub/sub events", () => {
    it("onLog receives log entries as they are added", async () => {
      const receivedLogs: JobLogEntry[] = [];

      // Block the executor so we can register the listener before logs are emitted
      let resolveExecution: () => void;
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        await new Promise<void>((resolve) => {
          resolveExecution = resolve;
        });
        logger.log("stdout", "Step 1");
        logger.log("stdout", "Step 2");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");
      queue.onLog(job.id, (entry) => receivedLogs.push(entry));

      // Unblock
      resolveExecution!();

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      expect(receivedLogs).toHaveLength(2);
      expect(receivedLogs[0].message).toBe("Step 1");
      expect(receivedLogs[1].message).toBe("Step 2");
    });

    it("onLog returns an unsubscribe function", async () => {
      const receivedLogs: JobLogEntry[] = [];

      let resolveExecution: () => void;
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        await new Promise<void>((resolve) => {
          resolveExecution = resolve;
        });
        logger.log("stdout", "Before unsubscribe");
        // Yield to allow unsubscribe to take effect
        await new Promise((r) => setTimeout(r, 10));
        logger.log("stdout", "After unsubscribe");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");
      const unsubscribe = queue.onLog(job.id, (entry) => {
        receivedLogs.push(entry);
        // Unsubscribe after first log
        unsubscribe();
      });

      // Unblock
      resolveExecution!();

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      expect(receivedLogs).toHaveLength(1);
      expect(receivedLogs[0].message).toBe("Before unsubscribe");
    });

    it("onStatus receives status changes", async () => {
      const statuses: string[] = [];

      // Block the executor so the listener is registered while running
      let resolveExecution: () => void;
      executeFn.mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          resolveExecution = resolve;
        });
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");
      // Register listener before execution completes
      queue.onStatus(job.id, (updatedJob) => {
        statuses.push(updatedJob.status);
      });

      // Unblock
      resolveExecution!();

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      expect(statuses).toContain("succeeded");
    });

    it("onStatus unsubscribe stops further notifications", async () => {
      const statuses: string[] = [];

      let resolvePhase1!: () => void;
      let resolvePhase2!: () => void;
      let phase2Ready!: Promise<void>;
      const phase1Ready = new Promise<void>((ready) => {
        executeFn.mockImplementation(async () => {
          await new Promise<void>((resolve) => {
            resolvePhase1 = resolve;
            ready();
          });
          phase2Ready = new Promise<void>((resolve) => {
            resolvePhase2 = resolve;
          });
          await phase2Ready;
          return {};
        });
      });

      const job = queue.create("deploy-plan", {}, "0xUser");
      await phase1Ready;

      const unsubscribe = queue.onStatus(job.id, (updatedJob) => {
        statuses.push(updatedJob.status);
        unsubscribe();
      });

      // Resolve phase 1 and wait a tick for phase 2 gate to be set up
      resolvePhase1();
      await vi.waitFor(() => expect(resolvePhase2).toBeDefined());
      resolvePhase2();

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      expect(statuses.length).toBeLessThanOrEqual(1);
    });
  });

  describe("log management", () => {
    it("assigns incrementing log ids", async () => {
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        logger.log("stdout", "Line 1");
        logger.log("stdout", "Line 2");
        logger.log("stdout", "Line 3");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      const logs = queue.get(job.id)!.logs;
      expect(logs[0].id).toBeLessThan(logs[1].id);
      expect(logs[1].id).toBeLessThan(logs[2].id);
    });

    it("splits multi-line messages into separate entries", async () => {
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        logger.log("stdout", "Line 1\nLine 2\nLine 3");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      const logs = queue.get(job.id)!.logs;
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe("Line 1");
      expect(logs[1].message).toBe("Line 2");
      expect(logs[2].message).toBe("Line 3");
    });

    it("skips empty lines in multi-line messages", async () => {
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        logger.log("stdout", "Line 1\n\nLine 3");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      const logs = queue.get(job.id)!.logs;
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe("Line 1");
      expect(logs[1].message).toBe("Line 3");
    });

    it("caps logs at 2000 entries (evicts oldest)", async () => {
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        for (let i = 0; i < 2010; i++) {
          logger.log("stdout", `Log line ${i}`);
        }
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      const logs = queue.get(job.id)!.logs;
      expect(logs).toHaveLength(2000);
      // First 10 should have been evicted
      expect(logs[0].message).toBe("Log line 10");
      expect(logs[logs.length - 1].message).toBe("Log line 2009");
    });

    it("includes ISO timestamp on each log entry", async () => {
      executeFn.mockImplementation(async (_job: OpsJob, logger: JobLogger) => {
        logger.log("stdout", "timestamped");
        return {};
      });

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("succeeded");
      });

      const entry = queue.get(job.id)!.logs[0];
      expect(new Date(entry.at).getTime()).not.toBeNaN();
    });
  });

  describe("error handling edge cases", () => {
    it("handles non-Error throws (string)", async () => {
      executeFn.mockRejectedValue("string error");

      const job = queue.create("deploy-plan", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job.id)!.status).toBe("failed");
      });

      expect(queue.get(job.id)!.error).toBe("string error");
    });

    it("continues processing queue after a job fails", async () => {
      let callCount = 0;
      executeFn.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("First fails");
        return { ok: true };
      });

      const job1 = queue.create("deploy-plan", {}, "0xUser");
      const job2 = queue.create("run-script", {}, "0xUser");

      await vi.waitFor(() => {
        expect(queue.get(job2.id)!.status).toBe("succeeded");
      });

      expect(queue.get(job1.id)!.status).toBe("failed");
      expect(queue.get(job2.id)!.status).toBe("succeeded");
    });
  });
});
