/**
 * useTxActPhase Hook
 *
 * Tracks one single-signature act at a time through `actPhaseReducer`, so the
 * row it started from can say where it stands: waiting on the wallet, waiting
 * on the chain, done, or failed. `track` hands the act the send callbacks that
 * move the line and passes its result or error straight through, so the
 * caller's own error handling (the mutation's toast) is unchanged.
 *
 * `trackReported` is for an act that says how it ended, such as a job-queue
 * send, which can land or stay queued on this device without failing.
 *
 * @module hooks/blockchain/useTxActPhase
 */

import { useCallback, useReducer } from "react";
import {
  type ActPhaseReport,
  actPhaseReducer,
  IDLE_ACT_PHASE,
  type TxActPhase,
} from "../../modules/transactions/act-phase";
import type { TransactionSendOptions } from "../../modules/transactions/types";

/** The send callbacks an act forwards to the transaction sender. */
export type ActSendCallbacks = Pick<TransactionSendOptions, "onBroadcast">;

export function useTxActPhase(): {
  phase: TxActPhase;
  track: <T>(key: string, act: (send: ActSendCallbacks) => Promise<T>) => Promise<T>;
  trackReported: <T>(key: string, act: (report: ActPhaseReport) => Promise<T>) => Promise<T>;
} {
  const [phase, dispatch] = useReducer(actPhaseReducer, IDLE_ACT_PHASE);

  const track = useCallback(
    async <T>(key: string, act: (send: ActSendCallbacks) => Promise<T>): Promise<T> => {
      dispatch({ type: "start", key });
      try {
        const result = await act({
          onBroadcast: async (hash) => dispatch({ type: "broadcast", key, hash }),
        });
        dispatch({ type: "confirmed", key });
        return result;
      } catch (error) {
        dispatch({ type: "failed", key });
        throw error;
      }
    },
    []
  );

  const trackReported = useCallback(
    async <T>(key: string, act: (report: ActPhaseReport) => Promise<T>): Promise<T> => {
      dispatch({ type: "start", key });
      let ended = false;
      try {
        const result = await act((event) => {
          if (event.type === "broadcast") {
            dispatch({ type: "broadcast", key, hash: event.hash });
            return;
          }
          ended = true;
          dispatch({ type: event.type, key });
        });
        // Resolved without saying how it ended: it did not fail, and nothing
        // says it landed, so it reads as left to send later.
        if (!ended) dispatch({ type: "queued", key });
        return result;
      } catch (error) {
        dispatch({ type: "failed", key });
        throw error;
      }
    },
    []
  );

  return { phase, track, trackReported };
}
