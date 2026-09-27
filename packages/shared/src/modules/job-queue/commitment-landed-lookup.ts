/**
 * Whether a commitment act whose send lost its answer reached the chain
 *
 * A send intent is recorded just before the call can reach the network. When
 * no reference or receipt comes back (a tab that died with the wallet open, a
 * connection lost mid-send), the act is settled from what the chain recorded
 * instead: the pool's event log, as the indexer holds it, names who acted and
 * in which transaction. A work link is decided by the module's own record of
 * its operation key, because its event carries no link identity.
 *
 * An absence proves nothing until the stranded-intent grace window has passed,
 * so this answers "absent" freely; "unknown" means the log cannot say yet.
 *
 * @module modules/job-queue/commitment-landed-lookup
 */

import { zeroHash, type Hex } from "viem";
import type { Address } from "../../types/domain";
import type { Job } from "../../types/job-queue";
import { getCommitmentActivity } from "../commitment-pooling/data-activity";
import type { CommitmentEventRecord } from "../commitment-pooling/types";
import type { StrandedCommitmentLookup } from "../work/stranded-intent";

/** Rows read per lookup. A full page older than the send may hide the row, so it answers unknown. */
const ACTIVITY_LIMIT = 200;
/** `ClaimType.Garden`: the claimant is the garden, and the caller only requested it. */
const GARDEN_CLAIM = 0;
/**
 * How far a take-up's request may precede its job on the device's clock. The
 * chain names no job, so a request counts only once the job existed: an older
 * one belongs to an earlier ask, and a steward may have declined it since.
 */
const CLAIM_CLOCK_TOLERANCE_S = 120;

interface LookupDependencies {
  readWorkLinkPayloadHash: (caller: Address, operationKey: Hex) => Promise<Hex>;
  activity?: typeof getCommitmentActivity;
}

const same = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());

/**
 * The row that shows this act landed, newest first. A take-up landed when the
 * log holds its request or its acceptance from after the job was created,
 * whatever came next: a steward who declines it quickly still declined a
 * request that reached the chain, so it is never sent again.
 */
function landedRow(
  job: Job,
  payload: Record<string, unknown>,
  rows: readonly CommitmentEventRecord[]
): CommitmentEventRecord | undefined {
  const caller = job.userAddress;
  switch (job.kind) {
    case "claim": {
      const claimant =
        Number(payload.kind) === GARDEN_CLAIM ? String(payload.gardenContext) : caller;
      const floor = Math.floor(job.createdAt / 1000) - CLAIM_CLOCK_TOLERANCE_S;
      return rows.find(
        (row) =>
          row.timestamp >= floor &&
          ((row.eventType === "CLAIM_REQUESTED" && same(row.actor, caller)) ||
            (row.eventType === "ACCEPTED" && same(row.actor, claimant)))
      );
    }
    case "evidence":
      return rows.find(
        (row) =>
          row.eventType === "EVIDENCE_ATTACHED" &&
          same(row.actor, caller) &&
          typeof payload.cid === "string" &&
          row.data === payload.cid
      );
    case "workLink":
      return rows.find((row) => row.eventType === "WORK_LINKED" && same(row.actor, caller));
    case "confirmation":
      return payload.action === "submit"
        ? rows.find((row) => row.eventType === "READY_FOR_CONFIRMATION")
        : rows.find((row) => row.eventType === "CONFIRMATION_RECORDED" && same(row.actor, caller));
    default:
      return undefined;
  }
}

export function createCommitmentLandedLookup(deps: LookupDependencies): StrandedCommitmentLookup {
  return async ({ job, chainId, sinceMs }) => {
    const payload = job.payload as Record<string, unknown>;
    if (job.kind === "workLink") {
      const stored = await deps.readWorkLinkPayloadHash(
        job.userAddress as Address,
        payload.operationKey as Hex
      );
      if (stored === zeroHash) return { status: "absent" };
    }
    const rows = await (deps.activity ?? getCommitmentActivity)({
      chainId,
      commitmentId: BigInt(String(payload.commitmentId)),
      limit: ACTIVITY_LIMIT,
    });
    const since = Math.floor(sinceMs / 1000);
    const landed = landedRow(
      job,
      payload,
      rows.filter((row) => row.timestamp >= since)
    );
    if (landed) return { status: "found", transactionHash: landed.txHash as Hex };
    // The module holds the link, but the log has not indexed it yet.
    if (job.kind === "workLink") return { status: "unknown" };
    const oldest = rows.at(-1);
    if (rows.length >= ACTIVITY_LIMIT && oldest && oldest.timestamp >= since) {
      return { status: "unknown" };
    }
    return { status: "absent" };
  };
}
