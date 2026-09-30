/**
 * Waiting for approval (PRD-1025): the asks a steward decides on the Pool tab,
 * held steady for one visit.
 *
 * Every ask seen during a visit keeps its place, in the order it was first
 * seen, and one that arrives after the visit's first read joins the end marked
 * new, so nothing under the pointer moves (rule 4). An ask decided here stays
 * as its outcome until the steward leaves the tab, even after the index stops
 * listing it (rule 3, D2); approving one closes the others on the same promise,
 * which read "not chosen". An ask that leaves the list with no decision here
 * was settled elsewhere, and stays as gone.
 *
 * @module modules/commitment-pooling/waiting-for-approval
 */

import { claimActKey, type TxActPhase } from "../transactions/act-phase";
import type { PoolClaimRequestRow } from "./types-core";

/** A decision this steward made on one ask this visit. */
export interface ClaimDecision {
  kind: "approved" | "declined";
  /** The promise the ask was for, so an approval can close its siblings. */
  commitmentId: string;
  /** When it landed, in milliseconds. */
  at: number;
}

/** Decisions by `claimActKey`. */
export type ClaimDecisions = Readonly<Record<string, ClaimDecision>>;

export interface WaitingVisitEntry {
  key: string;
  /** The ask as last read, kept once the index stops listing it. */
  row: PoolClaimRequestRow;
  /** It arrived after the visit's first read. */
  isNew: boolean;
}

export interface WaitingVisit {
  entries: readonly WaitingVisitEntry[];
  /** The first read is in: asks seen after it are new. */
  started: boolean;
}

export const EMPTY_WAITING_VISIT: WaitingVisit = { entries: [], started: false };

export type WaitingRowState =
  | { status: "waiting"; isNew: boolean }
  | { status: "signing" }
  | { status: "confirming" }
  | { status: "failed" }
  | { status: "approved"; at: number }
  | { status: "declined"; at: number }
  | { status: "not-chosen"; at: number }
  | { status: "gone" };

/** The key an ask's act, and its decision, go by. */
export function claimRowKey(row: PoolClaimRequestRow): string {
  return claimActKey(row.claim.commitmentId, row.claim.claimant);
}

/**
 * The visit after a settled read: known asks keep their place with the row as
 * now read, and asks not seen before join the end, new once the visit started.
 */
export function reconcileWaitingVisit(
  visit: WaitingVisit,
  live: readonly PoolClaimRequestRow[]
): WaitingVisit {
  const byKey = new Map(live.map((row) => [claimRowKey(row), row]));
  const entries = visit.entries.map((entry) => {
    const row = byKey.get(entry.key);
    return row && row !== entry.row ? { ...entry, row } : entry;
  });
  const known = new Set(entries.map((entry) => entry.key));
  for (const [key, row] of byKey) {
    if (!known.has(key)) entries.push({ key, row, isNew: visit.started });
  }
  return { entries, started: true };
}

/**
 * Where one ask stands this visit. `phase` is the approval line for this ask
 * (`actPhaseFor` over its key), idle when another ask holds the line.
 */
export function waitingRowState(
  entry: WaitingVisitEntry,
  input: { live: ReadonlySet<string>; decisions: ClaimDecisions; phase: TxActPhase }
): WaitingRowState {
  const decision = input.decisions[entry.key];
  if (decision) return { status: decision.kind, at: decision.at };
  const commitmentId = entry.row.claim.commitmentId.toString();
  const chosen = Object.values(input.decisions).find(
    (other) => other.kind === "approved" && other.commitmentId === commitmentId
  );
  if (chosen) return { status: "not-chosen", at: chosen.at };
  const { status } = input.phase;
  if (status === "signing" || status === "confirming" || status === "failed") return { status };
  if (!input.live.has(entry.key)) return { status: "gone" };
  return { status: "waiting", isNew: entry.isNew };
}

/** An ask still open to a decision: waiting, in flight, or back after a failure. */
export function isStillWaiting(state: WaitingRowState): boolean {
  return (
    state.status === "waiting" ||
    state.status === "signing" ||
    state.status === "confirming" ||
    state.status === "failed"
  );
}
