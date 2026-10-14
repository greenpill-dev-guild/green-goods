/**
 * The steward's decisions on waiting asks, shared by the Pool tab's Waiting
 * for approval card and the commitment inspector's waiting list, so an ask
 * approved in either reads the same in both (PRD-1025 D2, D4).
 *
 * One approval runs at a time, as the wallet asks one at a time: `phase` is
 * its line, keyed to the ask (`claimActKey`). An approval or a decline that
 * lands is kept as a decision until the next visit to a Pool tab begins, so a
 * row keeps its outcome after the index stops listing the ask. Nothing here
 * outlives the page.
 */

import { create } from "zustand";
import type {
  ClaimDecision,
  ClaimDecisions,
} from "../modules/commitment-pooling/waiting-for-approval";
import {
  actPhaseReducer,
  IDLE_ACT_PHASE,
  type TxActPhase,
  type TxActPhaseEvent,
} from "../modules/transactions/act-phase";

interface ClaimDecisionState {
  /** The pool whose tab is open, as `chainId:garden`. */
  visit: string | null;
  phase: TxActPhase;
  decisions: ClaimDecisions;
  /** A visit to a pool's tab starts with nothing decided and no line. */
  beginVisit: (visit: string) => void;
  step: (event: TxActPhaseEvent) => void;
  /** An act landed: its line settles and its decision is kept, in one update. */
  decide: (key: string, decision: ClaimDecision) => void;
}

export const useClaimDecisionStore = create<ClaimDecisionState>()((set) => ({
  visit: null,
  phase: IDLE_ACT_PHASE,
  decisions: {},
  beginVisit: (visit) => set({ visit, phase: IDLE_ACT_PHASE, decisions: {} }),
  step: (event) => set((state) => ({ phase: actPhaseReducer(state.phase, event) })),
  decide: (key, decision) =>
    set((state) => ({
      phase: actPhaseReducer(state.phase, { type: "confirmed", key }),
      decisions: { ...state.decisions, [key]: decision },
    })),
}));
