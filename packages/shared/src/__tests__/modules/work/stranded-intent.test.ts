/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../../types/job-queue";
import type { WorkUploadCheckpoint } from "../../../types/work-media";

const indexer = vi.hoisted(() => ({
  getWorkSubmissionsSince: vi.fn(),
  getWorkDecisionsSince: vi.fn(),
}));
vi.mock("../../../modules/data/eas-sent-attestations", () => indexer);
vi.mock("../../../modules/job-queue/db", () => ({ jobQueueDB: { updateJob: vi.fn() } }));

import {
  STRANDED_INTENT_GRACE_MS,
  StrandedSendReopened,
  isStrandedIntentCandidate,
  resolveStrandedCommitmentIntent,
  resolveStrandedDecisionIntent,
  resolveStrandedWorkIntent,
  settleStrandedWorkIntent,
} from "../../../modules/work/stranded-intent";
import {
  AwaitingWorkConfirmation,
  rememberWorkBroadcast,
  retainedWorkBroadcast,
} from "../../../modules/work/work-confirmation";
import { hasRecordedSend } from "../../../modules/job-queue/queue-policy";

const NOW = Date.parse("2026-09-16T12:00:00Z");
const GARDEN = "0x2222222222222222222222222222222222222222";
const GARDENER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"ab".repeat(32)}` as const;
const OPERATION = `0x${"cd".repeat(32)}` as const;
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

let sequence = 0;
function strandedWork(checkpoint: Partial<WorkUploadCheckpoint>): Job<WorkJobPayload> {
  // A fresh id per job, so one test's lookup never throttles another's.
  sequence += 1;
  return {
    id: `stranded-${sequence}`,
    kind: "work",
    chainId: 42161,
    userAddress: GARDENER,
    createdAt: NOW - 45 * 60_000,
    attempts: 0,
    synced: false,
    payload: {
      actionUID: 1,
      gardenAddress: GARDEN,
      feedback: "",
      title: "Weeding",
      clientWorkId: "client-1",
      uploadCheckpoint: { submittedAt: minutesAgo(50), files: {}, ...checkpoint },
    },
  } as Job<WorkJobPayload>;
}

function indexedWork(clientWorkId: string, id = `0x${"44".repeat(32)}`) {
  return {
    work: {
      id,
      gardenerAddress: GARDENER,
      gardenAddress: GARDEN,
      actionUID: 1,
      title: "Weeding",
      feedback: "",
      metadata: JSON.stringify({ clientWorkId }),
      media: [],
      createdAt: 1,
    },
    transactionHash: TX,
  };
}

const deps = (lookUp = vi.fn()) => ({ now: () => NOW, lookUp, persist: vi.fn() });

beforeEach(() => {
  indexer.getWorkSubmissionsSince.mockReset();
  indexer.getWorkDecisionsSince.mockReset();
});

const WORK_UID = `0x${"44".repeat(32)}`;
function strandedDecision(approved: boolean, broadcastPendingAt: string): Job<ApprovalJobPayload> {
  sequence += 1;
  return {
    id: `decision-${sequence}`,
    kind: "approval",
    chainId: 42161,
    userAddress: GARDENER,
    createdAt: NOW - 45 * 60_000,
    attempts: 0,
    synced: false,
    payload: {
      actionUID: 1,
      workUID: WORK_UID,
      gardenAddress: GARDEN,
      gardenerAddress: GARDENER,
      approved,
      confidence: 2,
      verificationMethod: 1,
      sendCheckpoint: { broadcastPending: true, broadcastPendingAt },
    },
  } as Job<ApprovalJobPayload>;
}

function indexedDecision(approved: boolean) {
  return {
    decision: {
      id: `0x${"77".repeat(32)}`,
      stewardAddress: GARDENER,
      gardenerAddress: GARDENER,
      actionUID: 1,
      workUID: WORK_UID,
      approved,
      feedback: "",
      confidence: 2,
      verificationMethod: 1,
      reviewNotesCID: "",
      createdAt: 1,
    },
    transactionHash: TX,
  };
}

describe("settling a send no receipt can", () => {
  it("never treats a transaction hash as stranded, since it may be a Safe transaction still collecting signatures", async () => {
    expect(isStrandedIntentCandidate({ broadcastPending: true })).toBe(true);
    expect(
      isStrandedIntentCandidate({
        broadcast: { kind: "user-operation", hash: OPERATION },
      })
    ).toBe(true);
    expect(
      isStrandedIntentCandidate({
        broadcast: { kind: "transaction", hash: TX },
        broadcastPending: true,
      })
    ).toBe(false);
    expect(
      isStrandedIntentCandidate({
        broadcastPending: true,
        transactionHash: TX,
      })
    ).toBe(false);

    const safe = strandedWork({
      broadcast: { kind: "transaction", hash: TX },
      broadcastPendingAt: minutesAgo(120),
    });
    const lookUp = vi.fn();
    await expect(resolveStrandedWorkIntent(safe, 42161, deps(lookUp))).resolves.toEqual({
      status: "waiting",
    });
    expect(lookUp).not.toHaveBeenCalled();
  });

  it("starts the grace window for an intent an earlier build recorded without a time", async () => {
    const work = strandedWork({ broadcastPending: true });
    const dependencies = deps();

    await expect(resolveStrandedWorkIntent(work, 42161, dependencies)).resolves.toEqual({
      status: "waiting",
    });

    expect(work.payload.uploadCheckpoint?.broadcastPendingAt).toBe(new Date(NOW).toISOString());
    expect(dependencies.persist).toHaveBeenCalledWith(work);
    expect(dependencies.lookUp).not.toHaveBeenCalled();
  });

  it("does not look up a send the indexer may not have caught up with yet", async () => {
    const work = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(1) });
    const dependencies = deps();

    await expect(resolveStrandedWorkIntent(work, 42161, dependencies)).resolves.toEqual({
      status: "waiting",
    });
    expect(dependencies.lookUp).not.toHaveBeenCalled();
  });

  it("completes work that landed, with the transaction that carried it", async () => {
    const work = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(10) });
    const dependencies = deps(vi.fn().mockResolvedValue({ status: "found", transactionHash: TX }));

    await expect(resolveStrandedWorkIntent(work, 42161, dependencies)).resolves.toEqual({
      status: "landed",
      transactionHash: TX,
    });
    expect(dependencies.lookUp).toHaveBeenCalledWith({
      clientWorkId: "client-1",
      chainId: 42161,
      garden: GARDEN,
      caller: GARDENER,
      sinceMs: NOW - 45 * 60_000 - 24 * 60 * 60_000,
    });
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it("keeps waiting while absent work is still inside the grace window", async () => {
    const work = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(10) });
    const dependencies = deps(vi.fn().mockResolvedValue({ status: "absent" }));

    await expect(resolveStrandedWorkIntent(work, 42161, dependencies)).resolves.toEqual({
      status: "waiting",
    });
    expect(work.payload.uploadCheckpoint?.broadcastPending).toBe(true);
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it("reopens work still absent after the grace window, for the person to send again", async () => {
    const minutes = STRANDED_INTENT_GRACE_MS / 60_000 + 1;
    const work = strandedWork({
      broadcast: { kind: "user-operation", hash: OPERATION },
      broadcastPending: true,
      broadcastPendingAt: minutesAgo(minutes),
    });
    rememberWorkBroadcast(work.id, { kind: "user-operation", hash: OPERATION });
    const dependencies = deps(vi.fn().mockResolvedValue({ status: "absent" }));

    await expect(resolveStrandedWorkIntent(work, 42161, dependencies)).resolves.toEqual({
      status: "reopened",
    });

    const checkpoint = work.payload.uploadCheckpoint;
    expect(checkpoint?.broadcastPending).toBeUndefined();
    expect(checkpoint?.broadcastPendingAt).toBeUndefined();
    expect(checkpoint?.broadcast).toBeUndefined();
    expect(work.meta?.requiresExplicitSend).toBe(true);
    expect(retainedWorkBroadcast(work.id)).toBeUndefined();
    expect(dependencies.persist).toHaveBeenCalledOnce();
  });

  it("never reopens work on an uncertain answer", async () => {
    const unknown = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(45) });
    const failing = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(45) });
    const uncertain = deps(vi.fn().mockResolvedValue({ status: "unknown" }));
    const offline = deps(vi.fn().mockRejectedValue(new Error("indexer unavailable")));

    await expect(resolveStrandedWorkIntent(unknown, 42161, uncertain)).resolves.toEqual({
      status: "waiting",
    });
    await expect(resolveStrandedWorkIntent(failing, 42161, offline)).resolves.toEqual({
      status: "waiting",
    });
    expect(unknown.payload.uploadCheckpoint?.broadcastPending).toBe(true);
    expect(failing.payload.uploadCheckpoint?.broadcastPending).toBe(true);
    expect(uncertain.persist).not.toHaveBeenCalled();
    expect(offline.persist).not.toHaveBeenCalled();
  });

  it("looks one job up at most every five minutes", async () => {
    const work = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(10) });
    const lookUp = vi.fn().mockResolvedValue({ status: "absent" });
    const at = (offsetMs: number) => ({ now: () => NOW + offsetMs, lookUp, persist: vi.fn() });

    await resolveStrandedWorkIntent(work, 42161, at(0));
    await resolveStrandedWorkIntent(work, 42161, at(60_000));
    expect(lookUp).toHaveBeenCalledOnce();

    await resolveStrandedWorkIntent(work, 42161, at(5 * 60_000));
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  it("finds the gardener's own attestation by its client work id", async () => {
    indexer.getWorkSubmissionsSince.mockResolvedValue([
      indexedWork("another-client", `0x${"55".repeat(32)}`),
      indexedWork("client-1"),
    ]);
    const work = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(10) });

    await expect(
      resolveStrandedWorkIntent(work, 42161, { now: () => NOW, persist: vi.fn() })
    ).resolves.toEqual({ status: "landed", transactionHash: TX });
    expect(indexer.getWorkSubmissionsSince).toHaveBeenCalledWith({
      attester: GARDENER,
      garden: GARDEN,
      chainId: 42161,
      sinceSeconds: (NOW - 45 * 60_000 - 24 * 60 * 60_000) / 1000,
    });
  });

  it("reopens only when the indexer shows no attestation with that client work id", async () => {
    indexer.getWorkSubmissionsSince.mockResolvedValue([indexedWork("another-client")]);
    const absent = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(45) });
    await expect(
      resolveStrandedWorkIntent(absent, 42161, { now: () => NOW, persist: vi.fn() })
    ).resolves.toEqual({ status: "reopened" });

    // Two attestations claiming one client work id prove the work landed, not that it is absent.
    indexer.getWorkSubmissionsSince.mockResolvedValue([
      indexedWork("client-1"),
      indexedWork("client-1", `0x${"55".repeat(32)}`),
    ]);
    const duplicated = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(45) });
    await expect(
      resolveStrandedWorkIntent(duplicated, 42161, { now: () => NOW, persist: vi.fn() })
    ).resolves.toEqual({ status: "waiting" });
  });

  it("tells the executor what to do next", async () => {
    const landed = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(10) });
    await expect(
      settleStrandedWorkIntent(
        landed,
        42161,
        "0x",
        deps(vi.fn().mockResolvedValue({ status: "found", transactionHash: TX }))
      )
    ).resolves.toBe(TX);

    const absent = strandedWork({ broadcastPending: true, broadcastPendingAt: minutesAgo(45) });
    await expect(
      settleStrandedWorkIntent(
        absent,
        42161,
        "0x",
        deps(vi.fn().mockResolvedValue({ status: "absent" }))
      )
    ).rejects.toBeInstanceOf(StrandedSendReopened);

    const young = strandedWork({
      broadcast: { kind: "user-operation", hash: OPERATION },
      broadcastPendingAt: minutesAgo(1),
    });
    const waiting = settleStrandedWorkIntent(young, 42161, OPERATION, deps());
    await expect(waiting).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
    await expect(waiting).rejects.toMatchObject({ hash: OPERATION });
  });

  it("finds the steward's own decision on that work", async () => {
    indexer.getWorkDecisionsSince.mockResolvedValue([
      indexedDecision(false),
      indexedDecision(true),
    ]);
    const approval = strandedDecision(true, minutesAgo(10));

    await expect(
      resolveStrandedDecisionIntent(approval, 42161, { now: () => NOW, persist: vi.fn() })
    ).resolves.toEqual({ status: "landed", transactionHash: TX });
    expect(indexer.getWorkDecisionsSince).toHaveBeenCalledWith({
      attester: GARDENER,
      workUID: WORK_UID,
      chainId: 42161,
      sinceSeconds: (NOW - 45 * 60_000 - 24 * 60 * 60_000) / 1000,
    });
  });

  it("reopens a decision still absent after the grace window, for the next pass to send", async () => {
    // Only the opposite decision landed, so this one did not.
    indexer.getWorkDecisionsSince.mockResolvedValue([indexedDecision(false)]);
    const approval = strandedDecision(true, minutesAgo(45));
    const persist = vi.fn();

    await expect(
      resolveStrandedDecisionIntent(approval, 42161, { now: () => NOW, persist })
    ).resolves.toEqual({ status: "reopened" });
    expect(approval.payload.sendCheckpoint).toBeUndefined();
    // Decisions have no send control of their own yet, so nothing holds it for a tap.
    expect(approval.meta?.requiresExplicitSend).toBeUndefined();
    expect(persist).toHaveBeenCalledWith(approval);
  });
});

describe("settling a commitment act no receipt can", () => {
  function strandedTakeUp(broadcastPendingAt: string, record: object = {}): Job {
    sequence += 1;
    return {
      id: `take-up-${sequence}`,
      kind: "claim",
      chainId: 42161,
      userAddress: GARDENER,
      createdAt: NOW - 45 * 60_000,
      attempts: 0,
      synced: false,
      payload: {
        commitmentId: 7n,
        kind: 1,
        gardenContext: GARDEN,
        gardenAddress: GARDEN,
        sendCheckpoint: { broadcastPending: true, broadcastPendingAt, ...record },
      },
    } as Job;
  }
  const pastGrace = () => new Date(NOW - STRANDED_INTENT_GRACE_MS - 60_000).toISOString();

  it("completes a take-up the chain shows landed, and asks with the act and its window", async () => {
    const act = strandedTakeUp(minutesAgo(10));
    const lookUp = vi.fn().mockResolvedValue({ status: "found", transactionHash: TX });

    await expect(
      resolveStrandedCommitmentIntent(act, 42161, { ...deps(lookUp), lookUp })
    ).resolves.toEqual({ status: "landed", transactionHash: TX });
    expect(lookUp).toHaveBeenCalledWith(
      expect.objectContaining({ job: act, chainId: 42161, sinceMs: expect.any(Number) })
    );
  });

  it("waits while an absence is young, then reopens it for the person to send", async () => {
    const young = strandedTakeUp(minutesAgo(10));
    const lookUp = vi.fn().mockResolvedValue({ status: "absent" });
    await expect(
      resolveStrandedCommitmentIntent(young, 42161, { ...deps(lookUp), lookUp })
    ).resolves.toEqual({ status: "waiting" });

    const old = strandedTakeUp(new Date(NOW - STRANDED_INTENT_GRACE_MS - 60_000).toISOString());
    const persist = vi.fn();
    await expect(
      resolveStrandedCommitmentIntent(old, 42161, { now: () => NOW, lookUp, persist })
    ).resolves.toEqual({ status: "reopened" });
    // The record is gone, so Discard and Send Now both work; nothing sends on its own.
    expect((old.payload as { sendCheckpoint?: unknown }).sendCheckpoint).toBeUndefined();
    expect(old.meta?.requiresExplicitSend).toBe(true);
    expect(persist).toHaveBeenCalledWith(old);
  });

  it("completes a transaction no receipt answers once the act lands, and never reopens it", async () => {
    // A Safe's own transaction id never produces a receipt, and the Safe may
    // still be collecting signatures, so only the act's landing settles it.
    const safeId = `0x${"5a".repeat(20)}` as const;
    const record = { broadcastPending: false, transactionHash: safeId };
    const absent = vi.fn().mockResolvedValue({ status: "absent" });
    const unanswered = strandedTakeUp(pastGrace(), record);
    await expect(
      resolveStrandedCommitmentIntent(unanswered, 42161, { ...deps(absent), lookUp: absent })
    ).resolves.toEqual({ status: "waiting" });
    expect((unanswered.payload as { sendCheckpoint?: object }).sendCheckpoint).toMatchObject(
      record
    );

    const found = vi.fn().mockResolvedValue({ status: "found", transactionHash: TX });
    const executed = strandedTakeUp(pastGrace(), record);
    await expect(
      resolveStrandedCommitmentIntent(executed, 42161, { ...deps(found), lookUp: found })
    ).resolves.toEqual({ status: "landed", transactionHash: TX });
  });

  it("offers a transaction the wallet saw replaced again once nothing landed in its place", async () => {
    // Unlike a Safe's id, a replaced transaction can never be included.
    const absent = vi.fn().mockResolvedValue({ status: "absent" });
    const replaced = strandedTakeUp(pastGrace(), {
      broadcastPending: false,
      transactionHash: TX,
      transactionReplaced: true,
    });
    await expect(
      resolveStrandedCommitmentIntent(replaced, 42161, { ...deps(absent), lookUp: absent })
    ).resolves.toEqual({ status: "reopened" });
    expect(hasRecordedSend(replaced)).toBe(false);
  });

  it("keeps an act waiting while another tab still holds its send, since that prompt may yet go out", async () => {
    const lookUp = vi.fn().mockResolvedValue({ status: "absent" });
    const held = strandedTakeUp(pastGrace());
    await expect(
      resolveStrandedCommitmentIntent(held, 42161, {
        ...deps(lookUp),
        lookUp,
        stillSending: async () => true,
      })
    ).resolves.toEqual({ status: "waiting" });
    expect(hasRecordedSend(held)).toBe(true);

    const released = strandedTakeUp(pastGrace());
    await expect(
      resolveStrandedCommitmentIntent(released, 42161, {
        ...deps(lookUp),
        lookUp,
        stillSending: async () => false,
      })
    ).resolves.toEqual({ status: "reopened" });
  });
});
