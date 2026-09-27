/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import type { WorkDecision, WorkSubmission } from "../../../modules/data/eas-sent-attestations";
import { createEasLandedLookup } from "../../../modules/work/eas-landed-lookup";
import { STRANDED_INTENT_GRACE_MS } from "../../../modules/work/stranded-intent";

const GARDEN = "0x2222222222222222222222222222222222222222";
const GARDENER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"ab".repeat(32)}` as const;
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

function indexedDecision(approved: boolean): WorkDecision {
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
  return { lookup, submissions, decisions };
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
  workUID: WORK_UID,
  approved: true,
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
