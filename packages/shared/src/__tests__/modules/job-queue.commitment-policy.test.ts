import { describe, expect, it } from "vitest";

import {
  COMMITMENT_WAITING_REPROBE_MS,
  isTerminallyFailedJob,
  isWaitingReprobeThrottled,
} from "../../modules/job-queue";
import type { Job } from "../../types/job-queue";

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "job-1",
  kind: "commitmentSeries",
  payload: { clientSeriesId: "series-1" },
  meta: {},
  createdAt: 1,
  attempts: 0,
  synced: false,
  chainId: 42161,
  userAddress: "0x0000000000000000000000000000000000000001",
  ...overrides,
});

describe("commitment queue retry policy", () => {
  it("classifies exhausted unsynced jobs as terminal so they cannot win identity dedupe", () => {
    expect(isTerminallyFailedJob(job({ attempts: 5 }))).toBe(true);
    expect(isTerminallyFailedJob(job({ attempts: 4 }))).toBe(false);
    expect(isTerminallyFailedJob(job({ attempts: 5, synced: true }))).toBe(false);
  });

  it("throttles dependency probes without consuming the retry budget", () => {
    const waiting = job({
      meta: { waitingForDependency: true },
      lastAttemptAt: 10_000,
    });
    expect(isWaitingReprobeThrottled(waiting, 10_000 + COMMITMENT_WAITING_REPROBE_MS - 1)).toBe(
      true
    );
    expect(isWaitingReprobeThrottled(waiting, 10_000 + COMMITMENT_WAITING_REPROBE_MS)).toBe(false);
    expect(waiting.attempts).toBe(0);
  });
});
