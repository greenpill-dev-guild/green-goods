/** @vitest-environment node */
import { zeroHash } from "viem";
import { describe, expect, it, vi } from "vitest";

import { hashWorkLinkPayload } from "../../modules/commitment-pooling/job-identity";
import { createCommitmentLandedLookup } from "../../modules/job-queue/commitment-landed-lookup";
import type {
  CommitmentClaimRequestRecord,
  CommitmentEventRecord,
} from "../../modules/commitment-pooling/types";
import { STRANDED_INTENT_GRACE_MS } from "../../modules/work/stranded-intent";
import type { Job } from "../../types/job-queue";

const CALLER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const OTHER_GARDEN = "0x4444444444444444444444444444444444444444";
const TX = `0x${"ab".repeat(32)}` as const;
const OLD_TX = `0x${"cd".repeat(32)}` as const;
/** When the job was created and its send's intent recorded, on the device's clock. */
const CREATED_MS = 1_000_000_000;
/** The resolver's window reaches a day back, for devices whose clocks drift. */
const SINCE_MS = CREATED_MS - 24 * 60 * 60_000;
/** The lookup runs once the grace window has passed. */
const NOW_MS = CREATED_MS + STRANDED_INTENT_GRACE_MS + 10 * 60_000;
const AFTER = CREATED_MS / 1000 + 60;
const EARLIER_ASK = CREATED_MS / 1000 - 60 * 60;

function act(kind: string, payload: Record<string, unknown>): Job {
  return {
    id: `job-${kind}`,
    kind,
    payload: { commitmentId: 7n, gardenAddress: GARDEN, ...payload },
    userAddress: CALLER,
    createdAt: CREATED_MS,
    attempts: 0,
    synced: false,
  } as Job;
}

function row(
  eventType: string,
  actor: string | null,
  extra: Partial<CommitmentEventRecord> = {}
): CommitmentEventRecord {
  return {
    id: `${eventType}-${actor}`,
    chainId: 42161,
    poolId: 1n,
    cycleId: null,
    commitmentId: 7n,
    eventType,
    actor: actor as CommitmentEventRecord["actor"],
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: TX,
    timestamp: AFTER,
    ...extra,
  };
}

/** The indexer's record of one claimant's latest request. */
function request(extra: Partial<CommitmentClaimRequestRecord> = {}): CommitmentClaimRequestRecord {
  return {
    id: `42161-7-${CALLER}`,
    chainId: 42161,
    commitmentId: 7n,
    claimant: CALLER,
    requestSeen: true,
    requestedBy: CALLER,
    claimType: "INDIVIDUAL",
    gardenContext: GARDEN,
    state: "PENDING",
    reasonCID: null,
    resolutionCode: null,
    requestedAt: AFTER,
    resolvedAt: null,
    updatedAt: AFTER,
    ...extra,
  } as CommitmentClaimRequestRecord;
}

async function lookUp(
  job: Job,
  rows: CommitmentEventRecord[],
  chain: {
    requests?: CommitmentClaimRequestRecord[];
    storedLink?: `0x${string}`;
    /** The indexer's record of the link the operation key made. */
    link?: { linkedBy: `0x${string}`; blockNumber: bigint };
    /** The transaction the chain's WorkLinked log names, in the block the indexer gives. */
    linkTransaction?: `0x${string}` | null;
    /** How a deferred link's work resolves, from its client work id. */
    resolvedWork?: `0x${string}` | null;
    /** Seconds the device clock runs ahead of the chain's. */
    deviceAheadS?: number;
    /** Seconds the indexer's processed block trails the chain head. */
    indexerBehindS?: number;
    nowMs?: number;
  } = {}
) {
  const nowMs = chain.nowMs ?? NOW_MS;
  const chainNowS = nowMs / 1000 - (chain.deviceAheadS ?? 0);
  const lookup = createCommitmentLandedLookup({
    readWorkLinkPayloadHash: vi.fn().mockResolvedValue(chain.storedLink ?? zeroHash),
    activity: vi.fn(async ({ limit = 50, offset = 0 }) => rows.slice(offset, offset + limit)),
    claimRequests: vi.fn().mockResolvedValue(chain.requests ?? []),
    workLinkByOperation: vi.fn().mockResolvedValue(chain.link ?? null),
    readWorkLinkTransaction: vi.fn().mockResolvedValue(chain.linkTransaction ?? null),
    resolveWorkIdentity: vi
      .fn()
      .mockResolvedValue(
        chain.resolvedWork
          ? { status: "resolved", workUID: chain.resolvedWork }
          : { status: "waiting" }
      ),
    readIndexedBlock: vi.fn().mockResolvedValue(99n),
    readBlockTime: vi.fn(async (_chainId: number, block?: bigint) =>
      block === undefined ? chainNowS : chainNowS - (chain.indexerBehindS ?? 30)
    ),
    now: () => nowMs,
  });
  return lookup({ job, chainId: 42161, sinceMs: SINCE_MS });
}

const takeUp = act("claim", { kind: 1, gardenContext: GARDEN });
const gardenTakeUp = act("claim", { kind: 0, gardenContext: GARDEN });
const proof = act("evidence", { clientEvidenceId: "proof", cid: "bafy-proof" });
const confirm = act("confirmation", { action: "confirm" });
const submit = act("confirmation", { action: "submit" });
const asked = [row("CLAIM_REQUESTED", CALLER)];

describe("createCommitmentLandedLookup", () => {
  it.each([
    ["a take-up request by the reader", takeUp, asked, [request()], "found"],
    [
      "a garden take-up the garden was accepted for",
      gardenTakeUp,
      [row("ACCEPTED", GARDEN)],
      [],
      "found",
    ],
    [
      "a request a steward declined before the lookup ran",
      takeUp,
      [row("CLAIM_DECLINED", CALLER), row("CLAIM_REQUESTED", CALLER)],
      [request({ state: "DECLINED" })],
      "found",
    ],
    [
      "a request from an earlier ask, since declined",
      takeUp,
      [
        row("CLAIM_DECLINED", CALLER, { timestamp: EARLIER_ASK + 60, txHash: OLD_TX }),
        row("CLAIM_REQUESTED", CALLER, { timestamp: EARLIER_ASK, txHash: OLD_TX }),
      ],
      [request({ requestedAt: EARLIER_ASK, state: "DECLINED" })],
      "absent",
    ],
    [
      "someone else's request",
      takeUp,
      [row("CLAIM_REQUESTED", OTHER)],
      [request({ claimant: OTHER, requestedBy: OTHER })],
      "absent",
    ],
    [
      "the reader's request for another garden",
      gardenTakeUp,
      asked,
      [request({ claimant: OTHER_GARDEN, claimType: "GARDEN", gardenContext: OTHER_GARDEN })],
      "absent",
    ],
    [
      "the reader's request through another garden's membership",
      takeUp,
      asked,
      [request({ gardenContext: OTHER_GARDEN })],
      "absent",
    ],
    [
      "the proof's own CID",
      proof,
      [row("EVIDENCE_ATTACHED", CALLER, { data: "bafy-proof" })],
      [],
      "found",
    ],
    [
      "another proof by the same reader",
      proof,
      [row("EVIDENCE_ATTACHED", CALLER, { data: "bafy-other" })],
      [],
      "absent",
    ],
    ["the reader's confirmation", confirm, [row("CONFIRMATION_RECORDED", CALLER)], [], "found"],
    [
      "another confirmer's confirmation",
      confirm,
      [row("CONFIRMATION_RECORDED", OTHER)],
      [],
      "absent",
    ],
    [
      "a commitment sent for confirmation",
      submit,
      [row("READY_FOR_CONFIRMATION", null)],
      [],
      "found",
    ],
    [
      "a row from before the window",
      confirm,
      [row("CONFIRMATION_RECORDED", CALLER, { timestamp: SINCE_MS / 1000 - 1, txHash: OLD_TX })],
      [],
      "absent",
    ],
  ])("reads %s", async (_case, job, rows, requests, status) => {
    const result = await lookUp(job, rows, { requests });
    expect(result.status).toBe(status);
    if (status === "found") expect(result).toMatchObject({ transactionHash: TX });
  });

  it("sets the device clock against the chain's before matching a take-up to its send", async () => {
    // The device runs ten minutes ahead, so the request's chain time sits well
    // before the job's device time, and still after the send.
    const requestedAt = CREATED_MS / 1000 - 600 + 60;
    await expect(
      lookUp(takeUp, [row("CLAIM_REQUESTED", CALLER, { timestamp: requestedAt })], {
        requests: [request({ requestedAt })],
        deviceAheadS: 600,
      })
    ).resolves.toEqual({ status: "found", transactionHash: TX });
  });

  it("answers absent only once the indexer has processed past the send's grace window", async () => {
    // Twenty minutes behind, the indexer has not reached the window's end.
    await expect(lookUp(confirm, [], { indexerBehindS: 20 * 60 })).resolves.toEqual({
      status: "unknown",
    });
    // Nor has any indexer while the window is still open.
    await expect(
      lookUp(confirm, [], { nowMs: CREATED_MS + STRANDED_INTENT_GRACE_MS - 60_000 })
    ).resolves.toEqual({ status: "unknown" });
    await expect(lookUp(confirm, [], { indexerBehindS: 60 })).resolves.toEqual({
      status: "absent",
    });
  });

  it("pages through a busy window, and says unknown when the window outruns the pages it reads", async () => {
    const busy = Array.from({ length: 200 }, (_, index) =>
      row("UNITS_COMMITTED", OTHER, { id: `row-${index}` })
    );
    await expect(lookUp(confirm, [...busy, row("CONFIRMATION_RECORDED", CALLER)])).resolves.toEqual(
      { status: "found", transactionHash: TX }
    );

    const busier = Array.from({ length: 2_001 }, (_, index) =>
      row("UNITS_COMMITTED", OTHER, { id: `row-${index}` })
    );
    await expect(lookUp(confirm, busier)).resolves.toEqual({ status: "unknown" });
  });

  it("decides a work link by the module's record of its own payload, and names it by the chain's log", async () => {
    const WORK = `0x${"77".repeat(32)}` as const;
    const OTHER_WORK = `0x${"88".repeat(32)}` as const;
    const link = act("workLink", {
      clientOperationId: "op",
      operationKey: TX,
      requirementIndex: 0,
      workUID: WORK,
    });
    const stored = hashWorkLinkPayload(7n, WORK, 0);
    const indexed = { linkedBy: CALLER, blockNumber: 42n } as const;
    // Another link by the same reader, in a block with the same time and log index.
    const sameCursor = row("WORK_LINKED", CALLER, { id: `42161-${OLD_TX}-0`, txHash: OLD_TX });

    await expect(lookUp(link, [sameCursor])).resolves.toEqual({ status: "absent" });
    // The key carries another link: this one never landed, and sending it again will say why.
    await expect(
      lookUp(link, [sameCursor], {
        storedLink: hashWorkLinkPayload(7n, OTHER_WORK, 0),
        link: indexed,
        linkTransaction: OLD_TX,
      })
    ).resolves.toEqual({ status: "absent" });
    await expect(
      lookUp(link, [sameCursor], { storedLink: stored, link: indexed, linkTransaction: TX })
    ).resolves.toEqual({ status: "found", transactionHash: TX });
    // Landed, but not yet tied to a block, or the block's log not yet read.
    await expect(lookUp(link, [], { storedLink: stored })).resolves.toEqual({ status: "unknown" });
    await expect(lookUp(link, [], { storedLink: stored, link: indexed })).resolves.toEqual({
      status: "unknown",
    });

    // A deferred link learns its work from its client work id first.
    const deferred = act("workLink", {
      clientOperationId: "op",
      operationKey: TX,
      requirementIndex: 0,
      clientWorkId: "client-work",
    });
    await expect(
      lookUp(deferred, [], {
        storedLink: stored,
        link: indexed,
        linkTransaction: TX,
        resolvedWork: WORK,
      })
    ).resolves.toEqual({ status: "found", transactionHash: TX });
    await expect(
      lookUp(deferred, [], { storedLink: stored, link: indexed, linkTransaction: TX })
    ).resolves.toEqual({ status: "unknown" });
  });
});
