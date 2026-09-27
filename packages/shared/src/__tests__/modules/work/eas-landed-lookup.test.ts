/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import type { WorkDecision, WorkSubmission } from "../../../modules/data/eas-sent-attestations";
import { createEasLandedLookup } from "../../../modules/work/eas-landed-lookup";
import {
  resolveStrandedDecisionIntent,
  resolveStrandedWorkIntent,
  STRANDED_INTENT_GRACE_MS,
} from "../../../modules/work/stranded-intent";
import type {
  ApprovalJobPayload,
  Job,
  SendCheckpoint,
  WorkJobPayload,
} from "../../../types/job-queue";

const GARDEN = "0x2222222222222222222222222222222222222222";
const GARDENER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"ab".repeat(32)}` as const;
const EARLIER_TX = `0x${"cd".repeat(32)}` as const;
const WORK_UID = `0x${"44".repeat(32)}`;
/** When the send's intent was recorded, on the device's clock. */
const SENT_MS = 1_790_000_000_000;
/** The lookup runs once the grace window has passed. */
const NOW_MS = SENT_MS + STRANDED_INTENT_GRACE_MS + 10 * 60_000;
const GRACE_S = STRANDED_INTENT_GRACE_MS / 1000;
const DAY_MS = 24 * 60 * 60_000;

function indexedWork(clientWorkId: string, id = WORK_UID): WorkSubmission {
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
  } as WorkSubmission;
}

function indexedDecision(
  approved: boolean,
  made: Partial<WorkDecision["decision"]> = {},
  transactionHash: `0x${string}` = TX
): WorkDecision {
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
      ...made,
    },
    transactionHash,
  } as WorkDecision;
}

/**
 * EAS as the lookup sees it. `indexedThroughS` is the chain time of the last
 * block EAS processed; the device's clock runs `clockAheadS` ahead of the chain.
 */
function easAt(chain: {
  submissions?: WorkSubmission[];
  decisions?: WorkDecision[];
  indexedThroughS?: number | null;
  indexedFails?: boolean;
  clockAheadS?: number;
  calls?: string[];
}) {
  const chainNowS = NOW_MS / 1000 - (chain.clockAheadS ?? 0);
  const submissions = vi.fn(async () => {
    chain.calls?.push("attestations");
    return chain.submissions ?? [];
  });
  const decisions = vi.fn(async () => {
    chain.calls?.push("attestations");
    return chain.decisions ?? [];
  });
  const lookup = createEasLandedLookup({
    submissions,
    decisions,
    readIndexedBlock: vi.fn(async () => {
      chain.calls?.push("indexed");
      if (chain.indexedFails) throw new Error("easscan unavailable");
      return chain.indexedThroughS === null ? null : 99n;
    }),
    readBlockTime: vi.fn(async (_chainId: number, block?: bigint) =>
      block === undefined ? chainNowS : (chain.indexedThroughS ?? chainNowS)
    ),
    now: () => NOW_MS,
  });
  return { lookup, submissions, decisions, chainNowS };
}

const workSend = {
  clientWorkId: "client-1",
  chainId: 42161,
  garden: GARDEN,
  caller: GARDENER,
  sinceMs: SENT_MS - DAY_MS,
  sentAtMs: SENT_MS,
} as const;
const decisionSend = {
  decision: {
    actionUID: 1,
    workUID: WORK_UID,
    approved: true,
    confidence: 2,
    verificationMethod: 1,
  },
  chainId: 42161,
  steward: GARDENER,
  sinceMs: SENT_MS - DAY_MS,
  sentAtMs: SENT_MS,
} as const;
/** The intent on the chain's clock, when the device's clock matches it. */
const SENT_S = SENT_MS / 1000;

describe("whether a lost work or decision send reached the chain", () => {
  it("finds the gardener's own work by its client work id, with the transaction that carried it", async () => {
    const { lookup, submissions } = easAt({
      submissions: [indexedWork("another-client", `0x${"55".repeat(32)}`), indexedWork("client-1")],
    });

    await expect(lookup.work(workSend)).resolves.toEqual({ status: "found", transactionHash: TX });
    expect(submissions).toHaveBeenCalledWith({
      attester: GARDENER,
      garden: GARDEN,
      chainId: 42161,
      sinceSeconds: (SENT_MS - DAY_MS) / 1000,
    });
  });

  it("finds the steward's own decision on that work, and never the opposite one", async () => {
    const landed = easAt({ decisions: [indexedDecision(false), indexedDecision(true)] });
    await expect(landed.lookup.decision(decisionSend)).resolves.toEqual({
      status: "found",
      transactionHash: TX,
    });

    const opposite = easAt({
      decisions: [indexedDecision(false)],
      indexedThroughS: SENT_S + GRACE_S + 60,
    });
    await expect(opposite.lookup.decision(decisionSend)).resolves.toEqual({ status: "absent" });
  });

  it.each([
    ["work", (lookup: ReturnType<typeof easAt>["lookup"]) => lookup.work(workSend)],
    ["decision", (lookup: ReturnType<typeof easAt>["lookup"]) => lookup.decision(decisionSend)],
  ])("reads a %s as absent only once EAS has processed past the send's grace window", async (_kind, ask) => {
    // Processed a minute past the window, on the chain's clock: nothing landed.
    const caughtUp = easAt({ indexedThroughS: SENT_S + GRACE_S + 60 });
    await expect(ask(caughtUp.lookup)).resolves.toEqual({ status: "absent" });

    // EAS trails the chain: the send's block may not be written yet.
    const trailing = easAt({ indexedThroughS: SENT_S + GRACE_S - 60 });
    await expect(ask(trailing.lookup)).resolves.toEqual({ status: "unknown" });

    // EAS keeps no mark, or cannot be read: nothing proves the absence.
    await expect(ask(easAt({ indexedThroughS: null }).lookup)).resolves.toEqual({
      status: "unknown",
    });
    await expect(ask(easAt({ indexedFails: true }).lookup)).resolves.toEqual({
      status: "unknown",
    });
  });

  it("reads how far EAS has indexed before it reads the attestations", async () => {
    // EAS writes a range's attestations before it moves its mark, so a mark
    // read first covers every attestation the next read can miss.
    const calls: string[] = [];
    const { lookup } = easAt({ indexedThroughS: SENT_S + GRACE_S + 60, calls });

    await lookup.work(workSend);
    await lookup.decision(decisionSend);

    expect(calls).toEqual(["indexed", "attestations", "indexed", "attestations"]);
  });

  it("still finds a landed send when EAS cannot say how far it has indexed", async () => {
    const { lookup } = easAt({ submissions: [indexedWork("client-1")], indexedFails: true });

    await expect(lookup.work(workSend)).resolves.toEqual({ status: "found", transactionHash: TX });
  });

  it("never reads two works claiming one client work id as absent", async () => {
    const { lookup } = easAt({
      submissions: [indexedWork("client-1"), indexedWork("client-1", `0x${"55".repeat(32)}`)],
      indexedThroughS: SENT_S + GRACE_S + 60,
    });

    await expect(lookup.work(workSend)).resolves.toEqual({ status: "unknown" });
  });

  it("times the send on the chain's clock, setting the device's clock against the chain's now", async () => {
    // On a device an hour ahead, the send happened an hour earlier on the chain.
    const intentOnChainS = SENT_S - 3600;
    const caughtUp = easAt({ clockAheadS: 3600, indexedThroughS: intentOnChainS + GRACE_S + 60 });
    await expect(caughtUp.lookup.work(workSend)).resolves.toEqual({ status: "absent" });

    const trailing = easAt({ clockAheadS: 3600, indexedThroughS: intentOnChainS + GRACE_S - 60 });
    await expect(trailing.lookup.work(workSend)).resolves.toEqual({ status: "unknown" });
  });
});

let sequence = 0;
/** A send record whose answer was lost when its intent was recorded. */
const lostRecord = (record: Partial<SendCheckpoint> = {}): SendCheckpoint => ({
  broadcastPending: true,
  broadcastPendingAt: new Date(SENT_MS).toISOString(),
  ...record,
});

/** A work whose send lost its answer. */
function lostWork(record: Partial<SendCheckpoint> = {}): Job<WorkJobPayload> {
  sequence += 1;
  return {
    id: `lost-work-${sequence}`,
    kind: "work",
    chainId: 42161,
    userAddress: GARDENER,
    createdAt: SENT_MS,
    attempts: 0,
    synced: false,
    payload: {
      clientWorkId: "client-1",
      actionUID: 1,
      gardenAddress: GARDEN,
      feedback: "",
      uploadCheckpoint: {
        submittedAt: new Date(SENT_MS).toISOString(),
        files: {},
        ...lostRecord(record),
      },
    },
  } as Job<WorkJobPayload>;
}

/** A decision whose send lost its answer. */
function lostDecision(fields: Partial<ApprovalJobPayload> = {}): Job<ApprovalJobPayload> {
  sequence += 1;
  return {
    id: `lost-decision-${sequence}`,
    kind: "approval",
    chainId: 42161,
    userAddress: GARDENER,
    createdAt: SENT_MS,
    attempts: 0,
    synced: false,
    payload: {
      actionUID: 1,
      workUID: WORK_UID,
      gardenAddress: GARDEN,
      gardenerAddress: GARDENER,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
      sendCheckpoint: lostRecord(),
      ...fields,
    },
  } as Job<ApprovalJobPayload>;
}

describe("settling a lost decision with the steward's decisions on that work", () => {
  const settle = (job: Job<ApprovalJobPayload>, eas: ReturnType<typeof easAt>) =>
    resolveStrandedDecisionIntent(job, 42161, {
      lookUp: eas.lookup.decision,
      now: () => NOW_MS,
      persist: vi.fn(),
    });

  it.each([
    ["feedback", { feedback: "Mulch spread along the north beds" }],
    ["confidence", { confidence: 3 }],
    ["verification method", { verificationMethod: 3 }],
    ["review notes", { reviewNotesCID: "bafy-review-notes" }],
    ["action", { actionUID: 2 }],
  ])("never takes an earlier decision with another %s for the one the send carried", async (_field, sent) => {
    // The steward decided this work before, and EAS has processed past the window.
    const eas = easAt({
      decisions: [indexedDecision(true)],
      indexedThroughS: SENT_S + GRACE_S + 60,
    });

    await expect(settle(lostDecision(sent), eas)).resolves.toEqual({ status: "reopened" });
  });

  it("completes it with the steward's decision that carries every field it sent", async () => {
    const sent = {
      feedback: "Mulch spread along the north beds",
      reviewNotesCID: "bafy-review-notes",
    };
    const eas = easAt({
      decisions: [indexedDecision(true, {}, EARLIER_TX), indexedDecision(true, sent)],
    });

    await expect(settle(lostDecision(sent), eas)).resolves.toEqual({
      status: "landed",
      transactionHash: TX,
    });
  });
});

describe("timing a lost send by the chain's time it kept", () => {
  const deps = <Lookup>(eas: ReturnType<typeof easAt>, lookUp: Lookup) => ({
    lookUp,
    now: () => NOW_MS,
    persist: vi.fn(),
    chainTime: async () => eas.chainNowS,
  });
  /** The chain's time at the intent, with the device's time at it. */
  const kept = (recordedAtMs = SENT_MS) => ({
    intentChainTime: SENT_S,
    broadcastPendingAt: new Date(recordedAtMs).toISOString(),
  });

  it.each([
    [
      "work",
      (eas: ReturnType<typeof easAt>, recordedAtMs?: number) =>
        resolveStrandedWorkIntent(lostWork(kept(recordedAtMs)), 42161, deps(eas, eas.lookup.work)),
    ],
    [
      "decision",
      (eas: ReturnType<typeof easAt>, recordedAtMs?: number) =>
        resolveStrandedDecisionIntent(
          lostDecision({ sendCheckpoint: lostRecord(kept(recordedAtMs)) }),
          42161,
          deps(eas, eas.lookup.decision)
        ),
    ],
  ] as const)("times a lost %s on the chain's clock, whichever way the device's clock moved", async (_kind, settle) => {
    // The device's clock moved half an hour forward after the send, so only ten
    // minutes have passed on the chain, and EAS has processed nine of them.
    const early = easAt({ clockAheadS: 1800, indexedThroughS: SENT_S + 540 });
    await expect(settle(early)).resolves.toEqual({ status: "waiting" });

    // Once EAS has processed past the window on the chain's clock, the send is missing.
    const caughtUp = easAt({ indexedThroughS: SENT_S + GRACE_S + 60 });
    await expect(settle(caughtUp)).resolves.toEqual({ status: "reopened" });

    // The device's clock ran two hours fast when the send was recorded and has
    // since been set right, so by the device the send has not happened yet. The
    // chain's clock still says the window has passed.
    await expect(settle(caughtUp, SENT_MS + 2 * 60 * 60_000)).resolves.toEqual({
      status: "reopened",
    });
  });
});
