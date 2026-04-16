import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import type { JobLogEntry, JobLogger, JobStatus, JobType, LogStream, OpsJob } from "./types";

export class JobQueue {
  private readonly jobs = new Map<string, OpsJob>();
  private readonly queue: string[] = [];
  private readonly events = new EventEmitter();
  private running = false;
  private logCursor = 0;

  constructor(private readonly executeJob: (job: OpsJob, logger: JobLogger) => Promise<Record<string, unknown>>) {
    this.events.setMaxListeners(0);
  }

  create(type: JobType, payload: Record<string, unknown>, requestedBy: string): OpsJob {
    const now = new Date().toISOString();
    const job: OpsJob = {
      id: randomUUID(),
      type,
      status: "queued",
      requestedBy,
      createdAt: now,
      updatedAt: now,
      payload,
      result: null,
      error: null,
      logs: [],
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.emitStatus(job);
    this.run();

    return job;
  }

  list(): OpsJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(jobId: string): OpsJob | undefined {
    return this.jobs.get(jobId);
  }

  onLog(jobId: string, listener: (entry: JobLogEntry) => void): () => void {
    const key = `log:${jobId}`;
    this.events.on(key, listener);
    return () => this.events.off(key, listener);
  }

  onStatus(jobId: string, listener: (job: OpsJob) => void): () => void {
    const key = `status:${jobId}`;
    this.events.on(key, listener);
    return () => this.events.off(key, listener);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift();
      if (!jobId) continue;

      const job = this.jobs.get(jobId);
      if (!job) continue;

      this.setStatus(job, "running");

      const logger: JobLogger = {
        log: (stream, message) => this.appendLog(job, stream, message),
      };

      try {
        const result = await this.executeJob(job, logger);
        job.result = result;
        this.setStatus(job, "succeeded");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        job.error = message;
        this.appendLog(job, "system", `ERROR: ${message}`);
        this.setStatus(job, "failed");
      }
    }

    this.running = false;
  }

  private setStatus(job: OpsJob, status: JobStatus): void {
    job.status = status;
    job.updatedAt = new Date().toISOString();
    this.emitStatus(job);
  }

  private emitStatus(job: OpsJob): void {
    this.events.emit(`status:${job.id}`, job);
  }

  private appendLog(job: OpsJob, stream: LogStream, message: string): void {
    const lines = message.split(/\r?\n/).map((line) => line.trimEnd());
    for (const line of lines) {
      if (!line) continue;
      const entry: JobLogEntry = {
        id: ++this.logCursor,
        at: new Date().toISOString(),
        stream,
        message: line,
      };
      job.logs.push(entry);
      if (job.logs.length > 2000) {
        job.logs.shift();
      }
      this.events.emit(`log:${job.id}`, entry);
    }
  }
}
