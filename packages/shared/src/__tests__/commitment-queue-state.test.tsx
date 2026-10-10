/** @vitest-environment happy-dom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentQueueState } from "../hooks/commitment-pooling/useCommitmentQueueState";
import { jobQueueEventBus } from "../modules/job-queue/event-bus";
import type { Job } from "../types/job-queue";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;

const mocks = vi.hoisted(() => ({ getJobs: vi.fn() }));

vi.mock("../modules/job-queue/db", () => ({
  jobQueueDB: { getJobs: (input: unknown) => mocks.getJobs(input) },
}));

function creation(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    kind: "commitment",
    payload: { poolId: 7n, direction: 0, metadata: { title: "Prune" } },
    meta: {},
    chainId: 42161,
    userAddress: VIEWER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    ...overrides,
  };
}

describe("useCommitmentQueueState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("distinguishes expired unsent group copies from recorded sends that still need recovery", async () => {
    const payload = {
      poolId: 7n,
      direction: 0,
      dueDate: 1n,
      metadata: { title: "Prune", displayGroup: { version: 1, id: "group-1" } },
    };
    mocks.getJobs.mockResolvedValue([
      creation({ id: "unsent", payload }),
      creation({ id: "recorded", payload, meta: { submittedTxHash: `0x${"44".repeat(32)}` } }),
      creation({ id: "legacy", payload: { poolId: 7n, direction: 0, dueDate: 1n } }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingCreates).toHaveLength(3));
    expect(result.current.pendingCreates.find((row) => row.jobId === "unsent")).toMatchObject({
      groupDueDate: "1",
      hasRecordedSend: false,
      discardable: true,
    });
    expect(result.current.pendingCreates.find((row) => row.jobId === "recorded")).toMatchObject({
      groupDueDate: "1",
      hasRecordedSend: true,
      discardable: false,
    });
    expect(
      result.current.pendingCreates.find((row) => row.jobId === "legacy")?.groupDueDate
    ).toBeUndefined();
  });

  it("re-reads the stored job when a flush ends without completing or failing it", async () => {
    // A flush that only parks a creation on its membership preflight rewrites
    // the record without a completed or failed event. The query never goes
    // stale on its own, so the one signal every flush emits has to refresh it,
    // or the row keeps saying "waiting to send" when it is waiting for a hat.
    mocks.getJobs.mockResolvedValueOnce([creation()]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingCreates).toHaveLength(1));
    expect(result.current.pendingCreates[0]?.waitingForMembership).toBe(false);

    mocks.getJobs.mockResolvedValueOnce([
      creation({
        meta: { waitingForDependency: true, waitingReason: "membership-unavailable" },
      }),
    ]);
    jobQueueEventBus.emit("queue:sync-completed", {
      result: { processed: 0, failed: 0, skipped: 1 },
    });

    await waitFor(() => expect(result.current.pendingCreates[0]?.waitingForMembership).toBe(true));
  });

  it("preserves terminal link causes and does not offer an impossible retry", async () => {
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "link-1",
        kind: "workLink",
        payload: { commitmentId: 9n },
        attempts: 5,
        lastError: "identity_conflict:membership-lost",
      }),
    ]);

    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));

    await waitFor(() => expect(result.current.failedCount).toBe(1));
    expect(result.current.failedJobs.get("9")).toEqual({
      jobId: "link-1",
      kind: "workLink",
      at: expect.any(Number),
      discardable: true,
      reason: "membershipLost",
      retryable: false,
    });
  });

  it("names the act still on this phone for its commitment, with why it waits", async () => {
    // A wallet reader has no background flush, so the screen needs the job
    // itself to offer Send Now and Discard, not only the fact that one exists.
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "claim-1",
        kind: "claim",
        payload: { commitmentId: 9n, gardenAddress: VIEWER },
        meta: { waitingForDependency: true, waitingReason: "membership-unavailable" },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingCommitmentIds.has("9")).toBe(true));
    expect(result.current.pendingActs.get("9")).toMatchObject({
      jobId: "claim-1",
      kind: "claim",
      waitingReason: "membership-unavailable",
      discardable: true,
    });
    // A creation names no commitment yet, so it is a pending create, not an act.
    expect(result.current.pendingActs.size).toBe(1);
  });

  it("preserves submission and confirmation as distinct pending operations", async () => {
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "submit-9",
        kind: "confirmation",
        payload: { action: "submit", commitmentId: 9n },
      }),
      creation({
        id: "confirm-10",
        kind: "confirmation",
        payload: { action: "confirm", commitmentId: 10n },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingActs.size).toBe(2));
    expect(result.current.pendingActs.get("9")).toMatchObject({
      jobId: "submit-9",
      confirmationAction: "submit",
      discardable: true,
    });
    expect(result.current.pendingActs.get("10")).toMatchObject({
      jobId: "confirm-10",
      confirmationAction: "confirm",
      discardable: true,
    });
  });

  it("says why a queued act's last send failed, in copy a row can show", async () => {
    // A wallet reader's act waits for their own send, so the row has to say what
    // went wrong the last time: the network it needed, or the kind of failure.
    mocks.getJobs.mockResolvedValue([
      // A declined network switch: the queue marks the act as it marks a declined
      // signature, and the reason says it was the network.
      creation({
        id: "claim-1",
        kind: "claim",
        payload: { commitmentId: 9n, gardenAddress: VIEWER },
        attempts: 1,
        meta: { requiresExplicitSend: true },
        lastError:
          "Network switch rejected. Approve the wallet prompt to switch to Arbitrum One before continuing.",
      }),
      creation({ id: "create-1", attempts: 1, lastError: "HTTP request failed: Failed to fetch" }),
      creation({ id: "create-2" }),
      // A creation that gave up says so in its own words, not as a failed send.
      creation({ id: "create-3", attempts: 5, lastError: "Max retries (5) exceeded" }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingCreates).toHaveLength(3));

    expect(result.current.pendingActs.get("9")).toMatchObject({
      waitingReason: "send-intent-expired",
      sendFailure: {
        messageId: "app.errors.wallet.wrongNetwork.message",
        values: { network: "Arbitrum One" },
        walletNetwork: true,
      },
    });
    const failureOf = (jobId: string) =>
      result.current.pendingCreates.find((row) => row.jobId === jobId)?.sendFailure;
    expect(failureOf("create-1")).toEqual({ messageId: "app.errors.blockchain.network.message" });
    expect(failureOf("create-2")).toBeUndefined();
    expect(failureOf("create-3")).toBeUndefined();
  });

  it("holds Discard back from an act whose send is on record, and says it is confirming", async () => {
    // The transaction may still land; dropping the job would lose its only
    // local record, so the row confirms it instead.
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "claim-2",
        kind: "claim",
        payload: {
          commitmentId: 9n,
          gardenAddress: VIEWER,
          sendCheckpoint: { broadcastPending: false, transactionHash: `0x${"44".repeat(32)}` },
        },
        attempts: 1,
        lastError: "receipt timeout",
      }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingActs.has("9")).toBe(true));
    expect(result.current.pendingActs.get("9")).toMatchObject({
      discardable: false,
      waitingReason: "awaiting-confirmation",
    });
  });

  it("reads a declined proof as a send that never went, so the promise offers it again", async () => {
    // Nothing was sent, and no flush sends it without the person: the notice
    // says the signature was cancelled and offers Send Now and Discard.
    mocks.getJobs.mockResolvedValue([
      creation({
        id: "proof-1",
        kind: "evidence",
        payload: { commitmentId: 9n, clientEvidenceId: "proof-1" },
        meta: { requiresExplicitSend: true },
        attempts: 1,
        lastError: "User rejected the request",
      }),
    ]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingActs.has("9")).toBe(true));
    expect(result.current.pendingActs.get("9")).toMatchObject({
      kind: "evidence",
      discardable: true,
      waitingReason: "send-intent-expired",
    });
  });

  it("leaves the promise to its proof while Add and Send's send waits behind it", async () => {
    const proof = creation({
      id: "proof-1",
      kind: "evidence",
      payload: { commitmentId: 9n, clientEvidenceId: "proof-1" },
    });
    const send = creation({
      id: "send-1",
      kind: "confirmation",
      payload: { action: "submit", commitmentId: 9n, afterEvidenceJobId: "proof-1" },
    });
    mocks.getJobs.mockResolvedValueOnce([proof, send]);
    const { result } = renderHookWithProviders(() => useCommitmentQueueState(VIEWER));
    await waitFor(() => expect(result.current.pendingActs.get("9")?.jobId).toBe("proof-1"));

    // Landed, the proof has left the queue, and the send is what the promise holds.
    mocks.getJobs.mockResolvedValueOnce([send]);
    jobQueueEventBus.emit("queue:sync-completed", {
      result: { processed: 1, failed: 0, skipped: 0 },
    });
    await waitFor(() => expect(result.current.pendingActs.get("9")?.jobId).toBe("send-1"));
  });
});
