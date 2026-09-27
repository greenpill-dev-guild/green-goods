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
import { getCommitmentActivity } from "../commitment-pooling/data-activity";
import type { CommitmentEventRecord } from "../commitment-pooling/types";
import type { StrandedCommitmentLookup } from "../work/stranded-intent";

/** Rows read per lookup. A full page older than the send may hide the row, so it answers unknown. */
const ACTIVITY_LIMIT = 200;
/** `ClaimType.Garden`: the claimant is the garden, and the caller only requested it. */
const GARDEN_CLAIM = 0;
const CLAIM_LIFECYCLE = new Set(["CLAIM_REQUESTED", "ACCEPTED", "CLAIM_DECLINED"]);

interface LookupDependencies {
  readWorkLinkPayloadHash: (caller: Address, operationKey: Hex) => Promise<Hex>;
  activity?: typeof getCommitmentActivity;
}

const same = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());

/**
 * The row that shows this act landed, newest first. A take-up is decided by
 * the reader's latest claim event, so a request a steward has since declined
 * does not count for a later ask.
 */
function landedRow(
  kind: string,
  payload: Record<string, unknown>,
  caller: string,
  rows: readonly CommitmentEventRecord[]
): CommitmentEventRecord | undefined {
  switch (kind) {
    case "claim": {
      const claimant =
        Number(payload.kind) === GARDEN_CLAIM ? String(payload.gardenContext) : caller;
      const latest = rows.find(
        (row) =>
          CLAIM_LIFECYCLE.has(row.eventType) &&
          (row.eventType === "CLAIM_REQUESTED"
            ? same(row.actor, caller)
            : same(row.actor, claimant))
      );
      return latest && latest.eventType !== "CLAIM_DECLINED" ? latest : undefined;
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
      job.kind,
      payload,
      job.userAddress,
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
