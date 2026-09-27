/**
 * Whether a commitment act whose send lost its answer reached the chain
 *
 * A send intent is recorded just before the call can reach the network. When
 * no reference or receipt comes back (a tab that died with the wallet open, a
 * connection lost mid-send), or the reference is one no receipt answers (a
 * Safe's own transaction id), the act is settled from what the chain recorded
 * instead: the pool's event log, as the indexer holds it, names who acted and
 * in which transaction. A take-up is matched by its whole identity, which the
 * indexer keeps for each claimant's latest request. A work link is decided by
 * the module's own record of its operation key, which must hold this link's
 * own payload, and named by the chain's WorkLinked log in the block the
 * indexer gives, since the log's row carries no link identity.
 *
 * "Found" needs the landed row. "Absent" needs the log read back to the start
 * of the window, and the indexer's processed block, timed on the chain itself,
 * past the send's grace window: an indexer that trails or stalls holds no row
 * for a send it has not reached. Short of that the answer is "unknown", which
 * keeps the act waiting.
 *
 * @module modules/job-queue/commitment-landed-lookup
 */

import { getBlock } from "@wagmi/core";
import { zeroHash, type Hex } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";
import {
  getCommitmentActivity,
  getWorkLinkByOperation,
  type IndexedWorkLink,
} from "../commitment-pooling/data-activity";
import { getCommitmentClaimRequests } from "../commitment-pooling/data-commitments";
import { queryProcessedBlocks } from "../commitment-pooling/data-pool-funding-indexed-queries";
import { hashWorkLinkPayload } from "../commitment-pooling/job-identity";
import type { CommitmentEventRecord } from "../commitment-pooling/types";
import { resolveDeferredWorkIdentity } from "../commitment-pooling/work-identity";
import { greenGoodsIndexer } from "../data/graphql-client";
import {
  STRANDED_INTENT_GRACE_MS,
  type StrandedCommitmentLookup,
  type StrandedLookupResult,
} from "../work/stranded-intent";
import type { CommitmentChainReads } from "./commitment-chain-reads";
import type { CommitmentQueueExecutorDeps } from "./job-executors";
import { sendCheckpointOf } from "./queue-policy";

/** Rows read per page of the pool's log. */
const PAGE_SIZE = 200;
/** Pages read before a window counts as too busy to settle: unknown, never absent. */
const MAX_PAGES = 10;
/** `ClaimType.Garden`: the claimant is the garden, and the caller only requested it. */
const GARDEN_CLAIM = 0;
/**
 * How far before its intent a take-up's request may sit, in chain seconds. The
 * device clock is set against the chain's first, so this absorbs only the
 * latest block's age and the time the read took.
 */
const CLAIM_CLOCK_TOLERANCE_S = 120;

interface LookupDependencies {
  readWorkLinkPayloadHash: (caller: Address, operationKey: Hex) => Promise<Hex>;
  activity?: typeof getCommitmentActivity;
  claimRequests?: typeof getCommitmentClaimRequests;
  workLinkByOperation?: (
    chainId: number,
    caller: Address,
    operationKey: string
  ) => Promise<IndexedWorkLink | null>;
  /** The executor's chain read of a link's WorkLinked log; without it a link is never named. */
  readWorkLinkTransaction?: CommitmentChainReads["readWorkLinkTransaction"];
  resolveWorkIdentity?: CommitmentQueueExecutorDeps["resolveWorkIdentity"];
  /** The chain's time at a block, in seconds: the latest block when none is named. */
  readBlockTime?: (chainId: number, blockNumber?: bigint) => Promise<number>;
  /** The last block the indexer processed on a chain, or null when it cannot say. */
  readIndexedBlock?: (chainId: number) => Promise<bigint | null>;
  now?: () => number;
}

type RowMatch = (row: CommitmentEventRecord) => boolean;

const same = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());

async function chainBlockTime(chainId: number, blockNumber?: bigint): Promise<number> {
  const block = await getBlock(getWagmiConfig(), {
    chainId,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });
  return Number(block.timestamp);
}

async function indexedBlock(chainId: number): Promise<bigint | null> {
  return (await queryProcessedBlocks(greenGoodsIndexer, [chainId]))?.[0]?.block ?? null;
}

/** When the send's intent was recorded, on the device's clock. */
function intentAtMs(job: Job): number {
  const recorded = Date.parse(sendCheckpointOf(job)?.broadcastPendingAt ?? "");
  return Number.isFinite(recorded) ? recorded : job.createdAt;
}

/**
 * A take-up landed when the indexer's record of its claimant's request matches
 * it whole (who asked, as what, through which garden) and follows its intent on
 * the chain's clock. An earlier request belongs to an earlier ask, which a
 * steward may have declined since; a later decline of this one does not matter.
 * The request's row names its transaction. An acceptance of the claimant after
 * the intent counts too: an accepted commitment takes no other claim, so
 * sending again could only revert.
 */
async function takeUpMatch(
  job: Job,
  payload: Record<string, unknown>,
  chainId: number,
  claimRequests: typeof getCommitmentClaimRequests,
  intentOnChainS: () => Promise<number>
): Promise<{ recorded: boolean; matches: RowMatch }> {
  const caller = job.userAddress;
  const byGarden = Number(payload.kind) === GARDEN_CLAIM;
  const gardenContext = String(payload.gardenContext);
  const claimant = byGarden ? gardenContext : caller;
  const floor = (await intentOnChainS()) - CLAIM_CLOCK_TOLERANCE_S;
  const requests = await claimRequests(chainId, BigInt(String(payload.commitmentId)));
  const request = requests.find(
    (record) =>
      same(record.claimant, claimant) &&
      same(record.requestedBy, caller) &&
      record.claimType === (byGarden ? "GARDEN" : "INDIVIDUAL") &&
      same(record.gardenContext, gardenContext) &&
      record.requestedAt >= floor
  );
  return {
    recorded: request !== undefined,
    matches: (row) =>
      (request !== undefined &&
        row.eventType === "CLAIM_REQUESTED" &&
        same(row.actor, caller) &&
        row.timestamp === request.requestedAt) ||
      (row.eventType === "ACCEPTED" && same(row.actor, claimant) && row.timestamp >= floor),
  };
}

/** The work a link names: on the job, or, for a deferred link, from its client work id. */
async function linkedWork(
  job: Job,
  payload: Record<string, unknown>,
  chainId: number,
  resolve: NonNullable<LookupDependencies["resolveWorkIdentity"]>
): Promise<Hex | null> {
  const known = (payload.workUID ?? payload.resolvedWorkUID) as Hex | undefined;
  if (known) return known;
  if (typeof payload.clientWorkId !== "string") return null;
  const identity = await resolve({
    clientWorkId: payload.clientWorkId,
    chainId,
    garden: payload.gardenAddress as Hex,
    caller: job.userAddress as Hex,
  });
  return identity.status === "resolved" ? identity.workUID : null;
}

/**
 * A work link landed when the module's record of its operation key holds this
 * link's own payload. A key that holds another link never carried this one,
 * and sending again will say so (`work-link-payload-mismatch`). The link is
 * named by the chain's WorkLinked log in the block the indexer gives, matched
 * by the key the event carries: another link in a block with the same time
 * and log index never stands in for it.
 */
async function workLinkLanded(
  job: Job,
  payload: Record<string, unknown>,
  chainId: number,
  deps: LookupDependencies
): Promise<StrandedLookupResult> {
  const caller = job.userAddress as Address;
  const operationKey = payload.operationKey as Hex;
  const stored = await deps.readWorkLinkPayloadHash(caller, operationKey);
  if (stored === zeroHash) return { status: "absent" };
  const workUID = await linkedWork(
    job,
    payload,
    chainId,
    deps.resolveWorkIdentity ?? resolveDeferredWorkIdentity
  );
  if (!workUID) return { status: "unknown" };
  const commitmentId = BigInt(String(payload.commitmentId));
  if (stored !== hashWorkLinkPayload(commitmentId, workUID, Number(payload.requirementIndex)))
    return { status: "absent" };
  const link = await (deps.workLinkByOperation ?? getWorkLinkByOperation)(
    chainId,
    caller,
    operationKey
  );
  if (!link || !deps.readWorkLinkTransaction) return { status: "unknown" };
  const transactionHash = await deps.readWorkLinkTransaction({
    blockNumber: link.blockNumber,
    commitmentId,
    workUID,
    operationKey,
    linker: caller,
  });
  return transactionHash ? { status: "found", transactionHash } : { status: "unknown" };
}

function actMatch(job: Job, payload: Record<string, unknown>): RowMatch {
  const caller = job.userAddress;
  switch (job.kind) {
    case "evidence":
      return (row) =>
        row.eventType === "EVIDENCE_ATTACHED" &&
        same(row.actor, caller) &&
        typeof payload.cid === "string" &&
        row.data === payload.cid;
    case "confirmation":
      return payload.action === "submit"
        ? (row) => row.eventType === "READY_FOR_CONFIRMATION"
        : (row) => row.eventType === "CONFIRMATION_RECORDED" && same(row.actor, caller);
    default:
      return () => false;
  }
}

/**
 * Reads the commitment's log newest first, a page at a time, until a row
 * matches or a page reaches back past the window. A window busier than the
 * pages read stays incomplete, and an incomplete read proves no absence.
 */
async function findInLog(
  activity: typeof getCommitmentActivity,
  chainId: number,
  commitmentId: bigint,
  sinceS: number,
  matches: RowMatch
): Promise<{ row?: CommitmentEventRecord; complete: boolean }> {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await activity({
      chainId,
      commitmentId,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    const row = rows.find((candidate) => candidate.timestamp >= sinceS && matches(candidate));
    if (row) return { row, complete: true };
    const oldest = rows.at(-1);
    if (rows.length < PAGE_SIZE || !oldest || oldest.timestamp < sinceS) return { complete: true };
  }
  return { complete: false };
}

export function createCommitmentLandedLookup(deps: LookupDependencies): StrandedCommitmentLookup {
  const activity = deps.activity ?? getCommitmentActivity;
  const claimRequests = deps.claimRequests ?? getCommitmentClaimRequests;
  const blockTime = deps.readBlockTime ?? chainBlockTime;
  const readIndexedBlock = deps.readIndexedBlock ?? indexedBlock;
  const now = deps.now ?? Date.now;
  return async ({ job, chainId, sinceMs }) => {
    const payload = job.payload as Record<string, unknown>;
    if (job.kind === "workLink") return workLinkLanded(job, payload, chainId, deps);
    const checkedAt = now();
    const sentAt = intentAtMs(job);
    // The intent on the chain's clock: the device clock is set against the
    // latest block, as that block is read.
    let onChain: Promise<number> | undefined;
    const intentOnChainS = () =>
      (onChain ??= blockTime(chainId).then(
        (chainNowS) => sentAt / 1000 - (now() / 1000 - chainNowS)
      ));
    const landed =
      job.kind === "claim"
        ? await takeUpMatch(job, payload, chainId, claimRequests, intentOnChainS)
        : { recorded: false, matches: actMatch(job, payload) };
    const log = await findInLog(
      activity,
      chainId,
      BigInt(String(payload.commitmentId)),
      Math.floor(sinceMs / 1000),
      landed.matches
    );
    if (log.row) return { status: "found", transactionHash: log.row.txHash as Hex };
    // The indexer's record holds the take-up, but the log has not named its transaction.
    if (landed.recorded) return { status: "unknown" };
    if (!log.complete || checkedAt - sentAt < STRANDED_INTENT_GRACE_MS)
      return { status: "unknown" };
    const indexed = await readIndexedBlock(chainId);
    if (indexed === null) return { status: "unknown" };
    const indexedThroughS = await blockTime(chainId, indexed);
    return indexedThroughS >= (await intentOnChainS()) + STRANDED_INTENT_GRACE_MS / 1000
      ? { status: "absent" }
      : { status: "unknown" };
  };
}
