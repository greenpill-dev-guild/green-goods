/** @vitest-environment node */
import { zeroHash } from "viem";
import { describe, expect, it, vi } from "vitest";

import { hashWorkLinkPayload } from "../../modules/commitment-pooling/job-identity";
import { createCommitmentLandedLookup } from "../../modules/job-queue/commitment-landed-lookup";
import type { CommitmentEventRecord } from "../../modules/commitment-pooling/types";
import { STRANDED_INTENT_GRACE_MS } from "../../modules/work/stranded-intent";
import type { Job } from "../../types/job-queue";

const CALLER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
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

async function lookUp(
  job: Job,
  rows: CommitmentEventRecord[],
  chain: {
    storedLink?: `0x${string}`;
    /** Transactions whose receipts carry this link's own WorkLinked event. */
    linkedIn?: readonly string[];
    /** Transactions whose receipts cannot be read. */
    unreadable?: readonly string[];
    /** The block of each transaction whose receipt carries this take-up's own event. */
    claimedIn?: Readonly<Record<string, bigint>>;
    /** How a deferred link's work resolves, from its client work id. */
    resolvedWork?: `0x${string}` | null;
    /** Seconds the indexer's processed block trails the chain head. */
    indexerBehindS?: number;
    /** Seconds the device's clock runs ahead of the chain's. */
    clockAheadS?: number;
    nowMs?: number;
    /** Stands in for the indexer's log, to change it between page reads. */
    activity?: (input: {
      limit?: number;
      offset?: number;
      before?: { timestamp: number; id: string };
    }) => Promise<CommitmentEventRecord[]>;
  } = {}
) {
  const nowMs = chain.nowMs ?? NOW_MS;
  const chainNowS = nowMs / 1000 - (chain.clockAheadS ?? 0);
  const lookup = createCommitmentLandedLookup({
    readWorkLinkPayloadHash: vi.fn().mockResolvedValue(chain.storedLink ?? zeroHash),
    activity: vi.fn(chain.activity ?? (async (input) => page(rows, input))),
    transactionMadeWorkLink: vi.fn(async (hash: string) => {
      if (chain.unreadable?.includes(hash)) throw new Error("receipt unavailable");
      return (chain.linkedIn ?? []).includes(hash);
    }),
    transactionMadeClaim: vi.fn(async (hash: string) => {
      if (chain.unreadable?.includes(hash)) throw new Error("receipt unavailable");
      return chain.claimedIn?.[hash] ?? null;
    }),
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

/**
 * One page of a log held in the query's order, newest first and then by id. A
 * cursor keeps the rows strictly before it in that order, as the indexer's
 * predicate does; without one, the page starts at a count.
 */
function page(
  rows: CommitmentEventRecord[],
  {
    limit = 50,
    offset = 0,
    before,
  }: { limit?: number; offset?: number; before?: { timestamp: number; id: string } }
): CommitmentEventRecord[] {
  const rest = before
    ? rows.filter(
        (row) =>
          row.timestamp < before.timestamp ||
          (row.timestamp === before.timestamp && row.id < before.id)
      )
    : rows.slice(offset);
  return rest.slice(0, limit);
}

/** Rows that fill the log ahead of the act, ids falling as the query orders them. */
function busyRows(count: number): CommitmentEventRecord[] {
  return Array.from({ length: count }, (_, index) =>
    row("UNITS_COMMITTED", OTHER, { id: `busy-${String(count - index).padStart(5, "0")}` })
  );
}

/** A take-up's send record keeps the head block its intent read: block 100. */
const intent = {
  broadcastPending: true,
  broadcastPendingAt: new Date(CREATED_MS).toISOString(),
  intentChainTime: CREATED_MS / 1000,
  intentBlock: 100n,
};
const takeUp = act("claim", { kind: 1, gardenContext: GARDEN, sendCheckpoint: intent });
const gardenTakeUp = act("claim", { kind: 0, gardenContext: GARDEN, sendCheckpoint: intent });
/** This take-up's own request or acceptance, in the block after the head. */
const madeHere = { [TX]: 101n };
const proof = act("evidence", { clientEvidenceId: "proof", cid: "bafy-proof" });
const confirm = act("confirmation", { action: "confirm" });
const submit = act("confirmation", { action: "submit" });
const asked = [row("CLAIM_REQUESTED", CALLER)];

describe("createCommitmentLandedLookup", () => {
  it.each([
    ["a take-up request by the reader", takeUp, asked, madeHere, "found"],
    [
      "a garden take-up the garden was accepted for",
      gardenTakeUp,
      [row("ACCEPTED", GARDEN)],
      madeHere,
      "found",
    ],
    [
      "a request a steward declined before the lookup ran",
      takeUp,
      [row("CLAIM_DECLINED", CALLER), row("CLAIM_REQUESTED", CALLER)],
      madeHere,
      "found",
    ],
    [
      "a request from an earlier ask, since declined",
      takeUp,
      [
        row("CLAIM_DECLINED", CALLER, { timestamp: EARLIER_ASK + 60, txHash: OLD_TX }),
        row("CLAIM_REQUESTED", CALLER, { timestamp: EARLIER_ASK, txHash: OLD_TX }),
      ],
      { [OLD_TX]: 90n },
      "absent",
    ],
    // Not a candidate: someone else asked.
    ["someone else's request", takeUp, [row("CLAIM_REQUESTED", OTHER)], madeHere, "absent"],
    // The reader's request, whose receipt holds another take-up: another garden, or another
    // garden's membership. The receipt check matches the whole identity.
    ["the reader's request for another take-up", gardenTakeUp, asked, {}, "absent"],
    [
      "the proof's own CID",
      proof,
      [row("EVIDENCE_ATTACHED", CALLER, { data: "bafy-proof" })],
      {},
      "found",
    ],
    [
      "another proof by the same reader",
      proof,
      [row("EVIDENCE_ATTACHED", CALLER, { data: "bafy-other" })],
      {},
      "absent",
    ],
    ["the reader's confirmation", confirm, [row("CONFIRMATION_RECORDED", CALLER)], {}, "found"],
    [
      "another confirmer's confirmation",
      confirm,
      [row("CONFIRMATION_RECORDED", OTHER)],
      {},
      "absent",
    ],
    [
      "a commitment sent for confirmation",
      submit,
      [row("READY_FOR_CONFIRMATION", null)],
      {},
      "found",
    ],
    [
      "a row from before the window",
      confirm,
      [row("CONFIRMATION_RECORDED", CALLER, { timestamp: SINCE_MS / 1000 - 1, txHash: OLD_TX })],
      {},
      "absent",
    ],
  ])("reads %s", async (_case, job, rows, claimedIn, status) => {
    const result = await lookUp(job, rows, { claimedIn });
    expect(result.status).toBe(status);
    if (status === "found") expect(result).toMatchObject({ transactionHash: TX });
  });

  it("orders a take-up by its receipt's block, after the head its intent recorded", async () => {
    // The earlier ask and its decline share the block the retry read as its head.
    const intentAt = CREATED_MS / 1000;
    const retry = act("claim", {
      kind: 1,
      gardenContext: GARDEN,
      sendCheckpoint: {
        broadcastPending: true,
        broadcastPendingAt: new Date(CREATED_MS).toISOString(),
        intentChainTime: intentAt,
        intentBlock: 100n,
      },
    });
    const earlierAsk = [
      row("CLAIM_DECLINED", CALLER, { timestamp: intentAt, txHash: OLD_TX }),
      row("CLAIM_REQUESTED", CALLER, { timestamp: intentAt, txHash: OLD_TX }),
    ];
    await expect(lookUp(retry, earlierAsk, { claimedIn: { [OLD_TX]: 100n } })).resolves.toEqual({
      status: "absent",
    });
    await expect(
      lookUp(retry, [row("CLAIM_REQUESTED", CALLER, { timestamp: intentAt }), ...earlierAsk], {
        claimedIn: { [TX]: 101n, [OLD_TX]: 100n },
      })
    ).resolves.toEqual({ status: "found", transactionHash: TX });
    // A receipt that cannot be read proves nothing either way.
    await expect(lookUp(retry, earlierAsk, { unreadable: [OLD_TX] })).resolves.toEqual({
      status: "unknown",
    });
    // Nor can a take-up kept without its head block be ordered against an earlier ask.
    const unordered = act("claim", { kind: 1, gardenContext: GARDEN });
    await expect(lookUp(unordered, asked, { claimedIn: madeHere })).resolves.toEqual({
      status: "unknown",
    });
  });

  it("opens its window at the intent's chain time, so a device clock days ahead still finds the act", async () => {
    // Two days fast, the device's day-back window opens after the act's own row.
    const aheadS = 2 * 24 * 60 * 60;
    const intentAt = CREATED_MS / 1000 - aheadS;
    const record = {
      broadcastPending: true,
      broadcastPendingAt: new Date(CREATED_MS).toISOString(),
      intentChainTime: intentAt,
      intentBlock: 100n,
    };
    const landed = { timestamp: intentAt + 60 };
    const confirmed = act("confirmation", { action: "confirm", sendCheckpoint: record });
    await expect(
      lookUp(confirmed, [row("CONFIRMATION_RECORDED", CALLER, landed)], { clockAheadS: aheadS })
    ).resolves.toEqual({ status: "found", transactionHash: TX });

    const WORK = `0x${"77".repeat(32)}` as const;
    const link = act("workLink", {
      clientOperationId: "op",
      operationKey: TX,
      requirementIndex: 0,
      workUID: WORK,
      sendCheckpoint: record,
    });
    await expect(
      lookUp(link, [row("WORK_LINKED", CALLER, landed)], {
        clockAheadS: aheadS,
        storedLink: hashWorkLinkPayload(7n, WORK, 0),
        linkedIn: [TX],
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

  it("reads how far the indexer has processed before it reads the log", async () => {
    // A trailing indexer's next batch carries the act's row and moves it past
    // the window. It lands right after the lookup's first read: a log read
    // first misses the row, and a processed block read after it covers it.
    const createdS = CREATED_MS / 1000;
    const graceS = STRANDED_INTENT_GRACE_MS / 1000;
    let landed = false;
    const firstRead = <T>(value: T) => {
      landed = true;
      return value;
    };
    const lookup = createCommitmentLandedLookup({
      readWorkLinkPayloadHash: vi.fn(),
      activity: vi.fn(async () => firstRead(landed ? [row("CONFIRMATION_RECORDED", CALLER)] : [])),
      readIndexedBlock: vi.fn(async () => firstRead(landed ? 120n : 99n)),
      readBlockTime: vi.fn(async (_chainId: number, block?: bigint) =>
        block === undefined ? NOW_MS / 1000 : createdS + graceS + (block === 120n ? 60 : -60)
      ),
      now: () => NOW_MS,
    });

    await expect(lookup({ job: confirm, chainId: 42161, sinceMs: SINCE_MS })).resolves.toEqual({
      status: "found",
      transactionHash: TX,
    });
  });

  it("pages through a busy window, and says unknown when the window outruns the pages it reads", async () => {
    await expect(
      lookUp(confirm, [...busyRows(200), row("CONFIRMATION_RECORDED", CALLER)])
    ).resolves.toEqual({ status: "found", transactionHash: TX });

    await expect(lookUp(confirm, busyRows(2_001))).resolves.toEqual({ status: "unknown" });
  });

  it("keeps its place by cursor, so a row rolled back between pages never hides the act", async () => {
    // Same-second rows, ordered by id as the indexer orders them; the act's row comes last.
    const log = [...busyRows(200), row("CONFIRMATION_RECORDED", CALLER)];
    let reads = 0;
    const activity = async (input: {
      limit?: number;
      offset?: number;
      before?: { timestamp: number; id: string };
    }) => {
      reads += 1;
      // After the first page, the indexer rolls back a row above the act's.
      if (reads === 2) log.splice(0, 1);
      return page(log, input);
    };
    await expect(lookUp(confirm, log, { activity })).resolves.toEqual({
      status: "found",
      transactionHash: TX,
    });
  });

  it("decides a work link by the module's record of its own payload, and names it from its own event", async () => {
    const WORK = `0x${"77".repeat(32)}` as const;
    const OTHER_WORK = `0x${"88".repeat(32)}` as const;
    const link = act("workLink", {
      clientOperationId: "op",
      operationKey: TX,
      requirementIndex: 0,
      workUID: WORK,
    });
    const stored = hashWorkLinkPayload(7n, WORK, 0);
    // Two links by the same reader: another work's, newer, and this one. Only
    // this one's receipt carries its operation key, whatever the rows' times.
    const otherLink = row("WORK_LINKED", CALLER, {
      id: `42161-${OLD_TX}-0`,
      txHash: OLD_TX,
      timestamp: AFTER + 30,
    });
    const linked = row("WORK_LINKED", CALLER, { id: `42161-${TX}-0`, txHash: TX });
    const history = [otherLink, linked];

    await expect(lookUp(link, history)).resolves.toEqual({ status: "absent" });
    // The key carries another link: this one never landed, and sending it again will say why.
    await expect(
      lookUp(link, history, {
        storedLink: hashWorkLinkPayload(7n, OTHER_WORK, 0),
        linkedIn: [OLD_TX],
      })
    ).resolves.toEqual({ status: "absent" });
    // Named from the log's own history, even once the work has been relinked
    // under another key and the indexer's attribution has moved on.
    await expect(lookUp(link, history, { storedLink: stored, linkedIn: [TX] })).resolves.toEqual({
      status: "found",
      transactionHash: TX,
    });
    // Landed, but the log has not indexed its row yet.
    await expect(
      lookUp(link, [otherLink], { storedLink: stored, linkedIn: [TX] })
    ).resolves.toEqual({ status: "unknown" });
    // A newer row whose receipt cannot be read does not end the search.
    await expect(
      lookUp(link, history, { storedLink: stored, linkedIn: [TX], unreadable: [OLD_TX] })
    ).resolves.toEqual({ status: "found", transactionHash: TX });

    // A deferred link learns its work from its client work id first.
    const deferred = act("workLink", {
      clientOperationId: "op",
      operationKey: TX,
      requirementIndex: 0,
      clientWorkId: "client-work",
    });
    await expect(
      lookUp(deferred, history, { storedLink: stored, linkedIn: [TX], resolvedWork: WORK })
    ).resolves.toEqual({ status: "found", transactionHash: TX });
    await expect(
      lookUp(deferred, history, { storedLink: stored, linkedIn: [TX] })
    ).resolves.toEqual({ status: "unknown" });
  });
});
