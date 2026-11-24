/**
 * Whether the chain can still keep a promise that has not reached it
 *
 * The contract makes a promise that names a closed action, and one in a season or campaign past
 * its end: it checks only that each action exists and that the cycle is Open. Work.sol refuses
 * Work outside an action's window, so nobody could keep the first. A promise with no due date of
 * its own falls due when its cycle ends, so the second lands past due (DL-162). The composer stops
 * offering both, but a promise placed offline, or still queued when one of them ends, waits past
 * that point. So before a promise's first send the queue reads the chain, and refuses a promise the
 * chain can no longer keep. The member is told why, and Discard is all that is left (PRD-1004).
 * Only a window check in the contract would close this for good.
 *
 * The executor reads this only after its creation request finds nothing on the chain and no send
 * of it is on record, so a window that closes after a promise was made never unmakes it.
 *
 * @module modules/commitment-pooling/creation-standing
 */

import { hasActionEnded } from "../../utils/action/window";
import { logger } from "../app/logger";
import { type CycleStanding, cycleStanding } from "./due-dates";
import {
  CREATION_REFUSALS,
  type CommitmentCreationPayload,
  type CommitmentJobExecutionDependencies,
  type CreationRefusal,
} from "./job-types";

/** A season or campaign takes no new promise once it has ended or a steward has closed it. */
const CLOSED_TO_PROMISES: ReadonlySet<CycleStanding> = new Set<CycleStanding>([
  "ended",
  "reconciled",
  "composted",
  "cancelled",
]);

/** The chain's seconds as the milliseconds `utils/action/window` reads a window in. */
const inMs = (seconds: bigint | number) => Number(seconds) * 1000;

/**
 * Read the chain's clock and what it holds for each action and the season or campaign a promise
 * names, then judge them on that clock: Work.sol reads an action's window on it, and a promise
 * falls due on it. Anything that can't be read leaves the promise unreadable, which holds its send.
 * An action that hasn't opened yet doesn't stop it, since work can keep the promise once it opens.
 * A season that hasn't opened yet is left to the chain.
 */
export async function readCreationStanding(
  payload: Pick<CommitmentCreationPayload, "requirements" | "cycleId">,
  reads: Pick<
    CommitmentJobExecutionDependencies,
    "readActionWindow" | "readCycleWindow" | "readChainHead"
  >
): Promise<"open" | CreationRefusal | "unreadable"> {
  const { readChainHead } = reads;
  if (!readChainHead) return "unreadable";
  const actionUIDs = [...new Set(payload.requirements.map((row) => row.actionUID))];
  try {
    const [head, windows, cycle] = await Promise.all([
      readChainHead(),
      Promise.all(actionUIDs.map((actionUID) => reads.readActionWindow(actionUID))),
      payload.cycleId === 0n ? null : reads.readCycleWindow(payload.cycleId),
    ]);
    const now = BigInt(head.timestamp);
    const closed = windows.some((window) =>
      hasActionEnded(
        { startTime: inMs(window.startTime), endTime: inMs(window.endTime) },
        inMs(now)
      )
    );
    if (closed) return "action-closed";
    if (cycle && CLOSED_TO_PROMISES.has(cycleStanding(cycle, now))) return "cycle-ended";
    return "open";
  } catch (error) {
    logger.warn("[commitment-pooling] Could not read a queued promise's windows", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return "unreadable";
  }
}

/**
 * Why the queue refused a promise, read off the error it gave up with. The queue records a
 * refusal as having given up on something outside it (`unavailable:<reason>`); any other end
 * reads as null.
 */
export function creationRefusalOf(error: string | null | undefined): CreationRefusal | null {
  const reason = error?.startsWith("unavailable:") ? error.slice("unavailable:".length) : null;
  return CREATION_REFUSALS.find((refusal) => refusal === reason) ?? null;
}
