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
import type { Address } from "../../types/domain";
import type {
  CommitmentClaimRequestRecord,
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "./types-core";

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

/** This visit's decision on an ask, or an approval that closed it; null when neither. */
function decidedHere(
  key: string,
  commitmentId: bigint,
  decisions: ClaimDecisions
): WaitingRowState | null {
  const decision = decisions[key];
  if (decision) return { status: decision.kind, at: decision.at };
  const promise = commitmentId.toString();
  const chosen = Object.values(decisions).find(
    (other) => other.kind === "approved" && other.commitmentId === promise
  );
  return chosen ? { status: "not-chosen", at: chosen.at } : null;
}

/** An approval with the wallet or the chain, or one that failed and left the ask waiting. */
function onTheLine(phase: TxActPhase): WaitingRowState | null {
  const { status } = phase;
  return status === "signing" || status === "confirming" || status === "failed" ? { status } : null;
}

/**
 * Where one ask stands this visit. `phase` is the approval line for this ask
 * (`actPhaseFor` over its key), idle when another ask holds the line.
 */
export function waitingRowState(
  entry: WaitingVisitEntry,
  input: { live: ReadonlySet<string>; decisions: ClaimDecisions; phase: TxActPhase }
): WaitingRowState {
  return (
    decidedHere(entry.key, entry.row.claim.commitmentId, input.decisions) ??
    onTheLine(input.phase) ??
    (input.live.has(entry.key) ? { status: "waiting", isNew: entry.isNew } : { status: "gone" })
  );
}

/**
 * Where an ask stands in its promise's inspector (D4): this visit's decision
 * first, as it lands before the index moves; then the index's answer, which
 * keeps a decided ask listed after the visit; then the approval line.
 */
export function askState(
  claim: CommitmentClaimRequestRecord,
  input: { decisions: ClaimDecisions; phase: TxActPhase }
): WaitingRowState {
  const here = decidedHere(
    claimActKey(claim.commitmentId, claim.claimant),
    claim.commitmentId,
    input.decisions
  );
  if (here) return here;
  const at = (claim.resolvedAt ?? claim.updatedAt) * 1000;
  if (claim.state === "ACCEPTED") return { status: "approved", at };
  if (claim.state === "DECLINED") return { status: "declined", at };
  if (claim.state === "SUPERSEDED") return { status: "not-chosen", at };
  return onTheLine(input.phase) ?? { status: "waiting", isNew: false };
}

/** What an asker already does in a pool: open promises they lead, against the limit, and kept ones. */
export interface ClaimantStanding {
  holding: number;
  /** The pool's limit on open promises per person; 0 when none is set. */
  cap: number;
  kept: number;
}

const HELD: ReadonlySet<CommitmentReadModel["onchainState"]> = new Set([
  "ACCEPTED",
  "READY_FOR_CONFIRMATION",
  "DISPUTED",
]);

/**
 * The asker's standing as a provider in the pool, for deciding a request (D4):
 * how many promises they lead that are still open, which is what the pool's
 * limit counts, and how many they have kept.
 */
export function claimantStanding(
  commitments: readonly CommitmentReadModel[],
  claimant: Address,
  cap: bigint | number
): ClaimantStanding {
  const who = claimant.toLowerCase();
  let holding = 0;
  let kept = 0;
  for (const commitment of commitments) {
    if (commitment.leadProvider?.toLowerCase() !== who) continue;
    if (HELD.has(commitment.onchainState)) holding += 1;
    if (commitment.onchainState === "FULFILLED") kept += 1;
  }
  return { holding, cap: Number(cap), kept };
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
