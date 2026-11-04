/**
 * When a promise falls due, read the way the chain reads it (TerminalLib.sol,
 * `_effectiveDueDate`): its own due date governs, and a promise without one falls due when its
 * cycle ends. Past that second anyone may expire it, so the steward's due list and every surface
 * that offers a take-up ask this module, and a promise is past due on one rule wherever it shows.
 *
 * A season or campaign has ended on the same rule (DL-162): the chain still takes promises into
 * an Open cycle past its end, each past due as it is made, so the app reads the cycle as ended
 * from the second its promises fall due until a steward closes it.
 *
 * @module modules/commitment-pooling/due-dates
 */

import type { CommitmentCycleRecord, CommitmentReadModel } from "./types-core";

/** Decimal cycle id → that cycle's `endTime`, from the cycles already read. */
export type CycleEndTimes = ReadonlyMap<string, bigint | null>;

/** The chain's clock and the cycle ends that undated promises fall due at. */
export interface DueClock {
  /** Unix seconds, as `useExpiryClock` keeps it. */
  now: bigint;
  cycleEndTimes: CycleEndTimes;
}

type DueDated = Pick<CommitmentReadModel, "dueDate" | "cycleId">;

function ownDueDate(promise: DueDated): bigint | null {
  const { dueDate } = promise;
  return dueDate === null || dueDate === undefined || dueDate === 0n ? null : dueDate;
}

/** A cycle's last second, or null when it has none: the chain stores no end as zero. */
function cycleEnd(endTime: bigint | null | undefined): bigint | null {
  return endTime === null || endTime === undefined || endTime === 0n ? null : endTime;
}

/** Whether the clock is past a last second: strictly after it, as the chain reads a deadline. */
function isPast(second: bigint | null, now: bigint): boolean {
  return second !== null && now > second;
}

/** Whether a promise falls due when its cycle ends: it belongs to one and carries no due date. */
export function fallsDueWithItsCycle(promise: DueDated): boolean {
  return ownDueDate(promise) === null && promise.cycleId !== null && promise.cycleId !== 0n;
}

/**
 * The second after which the chain lets anyone expire a promise. Null when it has no due date
 * and no cycle, which never expires, or when its cycle is not among those read.
 */
export function effectiveDueDate(promise: DueDated, cycleEndTimes: CycleEndTimes): bigint | null {
  const own = ownDueDate(promise);
  if (own !== null || promise.cycleId === null || promise.cycleId === 0n) return own;
  return cycleEnd(cycleEndTimes.get(promise.cycleId.toString()));
}

/** Whether a promise is past due on the chain's clock: strictly after its due second. */
export function isPastDue(promise: DueDated, clock: DueClock): boolean {
  return isPast(effectiveDueDate(promise, clock.cycleEndTimes), clock.now);
}

/**
 * How a season or campaign reads, in the words of `app.pool.cycleState.*`: its on-chain state,
 * except that an Open cycle past its end is ended until a steward closes it (DL-162).
 */
export type CycleStanding =
  | "seeded"
  | "open"
  | "ended"
  | "reconciled"
  | "composted"
  | "cancelled"
  | "unknown";

const STANDING_BY_STATE = {
  UNKNOWN: "unknown",
  SEEDED: "seeded",
  OPEN: "open",
  RECONCILED: "reconciled",
  COMPOSTED: "composted",
  CANCELLED: "cancelled",
} as const satisfies Record<NonNullable<CommitmentCycleRecord["state"]>, CycleStanding>;

/**
 * A cycle's standing on the chain's clock (`now`, Unix seconds). An Open cycle has ended once the
 * clock is past its end, the second a promise that falls due with it is past due.
 */
export function cycleStanding(
  cycle: Pick<CommitmentCycleRecord, "state" | "endTime">,
  now: bigint
): CycleStanding {
  if (cycle.state === "OPEN" && isPast(cycleEnd(cycle.endTime), now)) return "ended";
  // `mapCycle` casts the indexer's state rather than checking it.
  return STANDING_BY_STATE[cycle.state ?? "UNKNOWN"] ?? "unknown";
}
