/**
 * useWaitingForApproval Hook
 *
 * The rows of the Pool tab's Waiting for approval card for one visit
 * (PRD-1025 rules 2–4, `modules/commitment-pooling/waiting-for-approval`):
 * every ask seen this visit, in the order first seen, with where it stands
 * now. The visit is this hook's state, so it lasts while the card is mounted
 * and starts over on the next visit or another pool.
 *
 * @module hooks/admin-ui/pool/useWaitingForApproval
 */

import { useState } from "react";
import {
  askState,
  claimRowKey,
  EMPTY_WAITING_VISIT,
  isStillWaiting,
  reconcileWaitingVisit,
  type WaitingRowState,
  waitingRowState,
} from "../../../modules/commitment-pooling/waiting-for-approval";
import type { PoolClaimRequestRow } from "../../../modules/commitment-pooling/types-core";
import type { PoolConsoleController, TxActPhase } from "./controller.types";

/**
 * The same reading for the promise's own inspector, where every ask on it is
 * listed (`askState`); the key an ask's approval and decision go by, for a
 * caller that seeds them; and whether a state is still open to a decision.
 */
export { askState, claimRowKey, isStillWaiting };
export type { WaitingRowState };

export interface WaitingRow {
  key: string;
  row: PoolClaimRequestRow;
  /** This ask's approval line, for the progress in its action slot. */
  phase: TxActPhase;
  state: WaitingRowState;
}

export interface WaitingForApproval {
  rows: WaitingRow[];
  /** Asks still open to a decision. */
  waiting: number;
  /** Asks decided this visit, here or elsewhere. */
  decided: number;
}

type WaitingSource = Pick<
  PoolConsoleController,
  "chainId" | "garden" | "claims" | "claimDecisions" | "claimPhase" | "isLoading"
>;

export function useWaitingForApproval(pool: WaitingSource): WaitingForApproval {
  const pooled = `${pool.chainId}:${pool.garden.toLowerCase()}`;
  const [visit, setVisit] = useState({ pool: pooled, read: "", ...EMPTY_WAITING_VISIT });
  // Only a settled read moves the visit: the first read takes the asks already
  // waiting, and each later one appends what is new. Taken while rendering,
  // so a row never flashes in after the card has drawn without it.
  const read = pool.claims.map(claimRowKey).join("|");
  if (!pool.isLoading && (visit.pool !== pooled || visit.read !== read || !visit.started)) {
    const from = visit.pool === pooled ? visit : EMPTY_WAITING_VISIT;
    setVisit({ pool: pooled, read, ...reconcileWaitingVisit(from, pool.claims) });
  }

  const live = new Map(pool.claims.map((row) => [claimRowKey(row), row]));
  const liveKeys = new Set(live.keys());
  const rows = (visit.pool === pooled ? visit.entries : []).map((entry) => {
    const row = live.get(entry.key) ?? entry.row;
    const phase = pool.claimPhase(row.claim.commitmentId, row.claim.claimant);
    return {
      key: entry.key,
      row,
      phase,
      state: waitingRowState(entry, { live: liveKeys, decisions: pool.claimDecisions, phase }),
    };
  });
  const waiting = rows.filter((row) => isStillWaiting(row.state)).length;
  return { rows, waiting, decided: rows.length - waiting };
}
