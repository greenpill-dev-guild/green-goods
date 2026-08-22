import { describe, expect, it } from "vitest";

import {
  COMMITMENT_WAITING_REPROBE_MS,
  isTerminallyFailedJob,
  isWaitingReprobeThrottled,
} from "../../modules/job-queue";
import { isDiscardableJob } from "../../modules/job-queue/job-recovery";
import { commitmentJobIdentity } from "../../modules/job-queue/queue-policy";
import type { Job } from "../../types/job-queue";

const GARDEN = "0x2222222222222222222222222222222222222222";

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

  it.each([
    ["claim", { commitmentId: 9n, kind: 1, gardenContext: GARDEN }],
    ["evidence", { commitmentId: 9n, cid: "bafy", creditedContributors: [] }],
    [
      "workLink",
      {
        clientOperationId: "op",
        commitmentId: 9n,
        workUID: "0x1",
        requirementIndex: 0,
        operationKey: "0xkey",
      },
    ],
    ["confirmation", { action: "confirm", commitmentId: 9n }],
  ] as const)("keeps the %s identity the same whether or not the garden rides along, so old and new jobs dedupe together", (kind, payload) => {
    const before = commitmentJobIdentity(kind, payload);
    const after = commitmentJobIdentity(kind, { ...payload, gardenAddress: GARDEN });
    expect(before).not.toBeNull();
    expect(after).toBe(before);
  });

  it("tells two pieces of proof for one commitment apart before either has a CID", () => {
    const first = commitmentJobIdentity("evidence", { commitmentId: 9n, clientEvidenceId: "p-1" });
    const second = commitmentJobIdentity("evidence", { commitmentId: 9n, clientEvidenceId: "p-2" });
    expect(first).not.toBe(second);
    // The same proof enqueued twice is one job, whether or not its CID exists yet.
    expect(
      commitmentJobIdentity("evidence", { commitmentId: 9n, clientEvidenceId: "p-1", cid: "bafy" })
    ).toBe(first);
    // A record queued before client ids existed keeps its CID identity.
    expect(commitmentJobIdentity("evidence", { commitmentId: 9n, cid: "bafy" })).toBe(
      "evidence:9:bafy"
    );
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

describe("discard safety", () => {
  it("refuses to throw away a job whose transaction was already broadcast", () => {
    // The record carries the creation request key. Deleting it means composing
    // again files a second commitment once the first one materializes.
    expect(isDiscardableJob(job({ meta: { submittedTxHash: "0xabc" } }))).toBe(false);
    expect(isDiscardableJob(job({ meta: {} }))).toBe(true);
    expect(isDiscardableJob(job({ synced: true, meta: {} }))).toBe(false);
  });
});
