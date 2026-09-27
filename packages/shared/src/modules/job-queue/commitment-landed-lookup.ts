/**
 * Whether a commitment act whose send lost its answer reached the chain
 *
 * A send intent is recorded just before the call can reach the network. When
 * no reference or receipt comes back (a tab that died with the wallet open, a
 * connection lost mid-send), or the reference is one no receipt answers (a
 * Safe's own transaction id), the act is settled from what the chain recorded
 * instead: the pool's event log, as the indexer holds it, names who acted and
 * in which transaction. A take-up is confirmed by its row's receipt, which holds
 * its whole identity, in a block after the head its intent recorded. A work
 * link is decided by
 * the module's own record of its operation key, which must hold this link's
 * own payload, and named by the caller's WorkLinked row whose receipt carries
 * that key, since the row itself carries no link identity.
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
import { logger } from "../app/logger";
import { getCommitmentActivity } from "../commitment-pooling/data-activity";
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

interface LookupDependencies {
  readWorkLinkPayloadHash: (caller: Address, operationKey: Hex) => Promise<Hex>;
  activity?: typeof getCommitmentActivity;
  /** The executor's check of a link's receipt; without it a link is never named. */
  transactionMadeWorkLink?: CommitmentChainReads["transactionMadeWorkLink"];
  /** The executor's check of a take-up's receipt, giving its block. */
  transactionMadeClaim?: CommitmentChainReads["transactionMadeClaim"];
  resolveWorkIdentity?: CommitmentQueueExecutorDeps["resolveWorkIdentity"];
  /** The chain's time at a block, in seconds: the latest block when none is named. */
  readBlockTime?: (chainId: number, blockNumber?: bigint) => Promise<number>;
  /** The last block the indexer processed on a chain, or null when it cannot say. */
  readIndexedBlock?: (chainId: number) => Promise<bigint | null>;
  now?: () => number;
}

/** Whether a row shows the act landed; "unverified" when its receipt could not be read. */
type RowMatch = (
  row: CommitmentEventRecord
) => boolean | "unverified" | Promise<boolean | "unverified">;

/** A receipt check that answers "unverified" when the receipt cannot be read. */
async function checked(read: () => Promise<boolean>): Promise<boolean | "unverified"> {
  try {
    return await read();
  } catch (error) {
    logger.warn("[StrandedIntent] Could not read the receipt of a commitment act's row", {
      error,
    });
    return "unverified";
  }
}

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
 * A take-up landed when a request or acceptance row's receipt holds its own
 * event, matched whole, in a block after the head its intent recorded. That
 * block was already sealed, so an earlier ask sits in it or before, whatever
 * its time, and a later decline of this one does not matter.
 */
function takeUpByReceipt(
  job: Job,
  payload: Record<string, unknown>,
  intentBlock: bigint,
  madeClaim: NonNullable<LookupDependencies["transactionMadeClaim"]>
): RowMatch {
  const caller = job.userAddress as Address;
  const byGarden = Number(payload.kind) === GARDEN_CLAIM;
  const gardenContext = String(payload.gardenContext) as Address;
  const claim = {
    commitmentId: BigInt(String(payload.commitmentId)),
    claimant: byGarden ? gardenContext : caller,
    requestedBy: caller,
    kind: Number(payload.kind),
    gardenContext,
  };
  return (row) =>
    (row.eventType === "CLAIM_REQUESTED" && same(row.actor, caller)) ||
    (row.eventType === "ACCEPTED" && same(row.actor, claim.claimant))
      ? checked(async () => {
          const block = await madeClaim(row.txHash as Hex, claim);
          return block !== null && block > intentBlock;
        })
      : false;
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
 * named by the caller's WorkLinked row whose receipt carries that key. The
 * log keeps every link, so a work relinked under another key since is still
 * found, and another link at the same time or position never stands in for it.
 */
async function workLinkLanded(
  job: Job,
  payload: Record<string, unknown>,
  input: { chainId: number; sinceS: number },
  deps: LookupDependencies
): Promise<StrandedLookupResult> {
  const { chainId, sinceS } = input;
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
  const madeLink = deps.transactionMadeWorkLink;
  if (!madeLink) return { status: "unknown" };
  const log = await findInLog(
    deps.activity ?? getCommitmentActivity,
    chainId,
    commitmentId,
    sinceS,
    (row) =>
      row.eventType === "WORK_LINKED" && same(row.actor, caller)
        ? // A newer row whose receipt cannot be read does not end the search.
          checked(() =>
            madeLink(row.txHash as Hex, { commitmentId, workUID, operationKey, linker: caller })
          )
        : false
  );
  // Landed on the module's word, but the log has not named its row yet.
  return log.row
    ? { status: "found", transactionHash: log.row.txHash as Hex }
    : { status: "unknown" };
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
  // A row whose receipt could not be read leaves the read incomplete: it may be the one.
  let unverified = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await activity({
      chainId,
      commitmentId,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    for (const row of rows) {
      if (row.timestamp < sinceS) continue;
      const match = await matches(row);
      if (match === true) return { row, complete: true };
      if (match === "unverified") unverified = true;
    }
    const oldest = rows.at(-1);
    if (rows.length < PAGE_SIZE || !oldest || oldest.timestamp < sinceS)
      return { complete: !unverified };
  }
  return { complete: false };
}

export function createCommitmentLandedLookup(deps: LookupDependencies): StrandedCommitmentLookup {
  const activity = deps.activity ?? getCommitmentActivity;
  const blockTime = deps.readBlockTime ?? chainBlockTime;
  const readIndexedBlock = deps.readIndexedBlock ?? indexedBlock;
  const now = deps.now ?? Date.now;
  return async ({ job, chainId, sinceMs }) => {
    const payload = job.payload as Record<string, unknown>;
    const recordedChainTime = sendCheckpointOf(job)?.intentChainTime;
    // The window opens at the intent on the chain's clock, when it was kept:
    // nothing this send did can land before it. A window read off the device's
    // clock would open after the send's own row on a device running days ahead.
    const sinceS = recordedChainTime ?? Math.floor(sinceMs / 1000);
    if (job.kind === "workLink") return workLinkLanded(job, payload, { chainId, sinceS }, deps);
    const checkedAt = now();
    const sentAt = intentAtMs(job);
    const intentBlock = sendCheckpointOf(job)?.intentBlock;
    // The intent on the chain's clock: kept with the intent, or, for a record
    // kept without it, the device clock set against the latest block as read.
    let onChain: Promise<number> | undefined;
    const intentOnChainS = () =>
      (onChain ??=
        recordedChainTime !== undefined
          ? Promise.resolve(recordedChainTime)
          : blockTime(chainId).then((chainNowS) => sentAt / 1000 - (now() / 1000 - chainNowS)));
    // A take-up kept without its head block cannot be ordered against an earlier
    // ask, so the log never settles it. Every send since the head was kept has one.
    if (job.kind === "claim" && (intentBlock === undefined || !deps.transactionMadeClaim))
      return { status: "unknown" };
    const matches =
      job.kind === "claim" && intentBlock !== undefined && deps.transactionMadeClaim
        ? takeUpByReceipt(job, payload, intentBlock, deps.transactionMadeClaim)
        : actMatch(job, payload);
    const log = await findInLog(
      activity,
      chainId,
      BigInt(String(payload.commitmentId)),
      sinceS,
      matches
    );
    if (log.row) return { status: "found", transactionHash: log.row.txHash as Hex };
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
