/**
 * When a promise falls due, read the way the chain reads it (TerminalLib.sol,
 * `_effectiveDueDate`): its own due date governs, and a promise without one falls due when its
 * cycle ends. Past that second anyone may expire it, so the steward's due list and every surface
 * that offers a take-up ask this module, and a promise is past due on one rule wherever it shows.
 *
 * @module modules/commitment-pooling/due-dates
 */

import type { CommitmentReadModel } from "./types-core";

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
  const end = cycleEndTimes.get(promise.cycleId.toString()) ?? null;
  return end === 0n ? null : end;
}

/** Whether a promise is past due on the chain's clock: strictly after its due second. */
export function isPastDue(promise: DueDated, clock: DueClock): boolean {
  const due = effectiveDueDate(promise, clock.cycleEndTimes);
  return due !== null && clock.now > due;
}
