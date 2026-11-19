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
 * Either way, an act still waiting on the wallet after `WALLET_NUDGE_MS` turns
 * slow, and its line offers Cancel: the line stops waiting, and the wallet
 * sender stops waiting for the wallet's answer (PRD-1551).
 *
 * @module hooks/blockchain/useTxActPhase
 */

import { useCallback, useReducer } from "react";
import {
  type ActPhaseReport,
  actPhaseReducer,
  IDLE_ACT_PHASE,
  type TxActPhase,
  type TxActPhaseEvent,
} from "../../modules/transactions/act-phase";
import { WALLET_NUDGE_MS } from "../../modules/transactions/send-stage";
import {
  type TransactionSendOptions,
  WalletAnswerAbandonedError,
} from "../../modules/transactions/types";
import { isUnconfirmedTxError } from "../../utils/errors/tx-error-classifier";
import { useTimeout } from "../utils/useTimeout";

/** The send callbacks an act forwards to the transaction sender. */
export type ActSendCallbacks = Pick<
  TransactionSendOptions,
  "onBroadcast" | "onAwaiting" | "signal"
>;

/** The line an act moves: its events, the timer that marks a slow wallet, and what landing does. */
export interface ActLine {
  step: (event: TxActPhaseEvent) => void;
  setNudge: (callback: () => void, delay: number) => void;
  clearNudge: () => void;
  /** The act landed (not a Safe proposal): `confirmed` by default, or the caller's own. */
  landed: () => void;
}

/** How an act that did not land ended. One that may still land never reads as failed. */
function endingOf(error: unknown): "stopped" | "still-confirming" | "failed" {
  if (error instanceof WalletAnswerAbandonedError) return "stopped";
  return isUnconfirmedTxError(error) ? "still-confirming" : "failed";
}

/**
 * Runs `act` on its line: waiting on the wallet (slow past `WALLET_NUDGE_MS`, with Cancel), on
 * the chain, then its ending. Cancel rejects the act with `WalletAnswerAbandonedError` even when
 * its sender cannot stop asking, and the sender's late events no longer move the line.
 */
export async function followAct<T>(
  key: string,
  act: (send: ActSendCallbacks) => Promise<T>,
  line: ActLine
): Promise<T> {
  const cancel = new AbortController();
  const stopped = new Promise<never>((_, reject) => {
    cancel.signal.addEventListener("abort", () => reject(new WalletAnswerAbandonedError()), {
      once: true,
    });
  });
  let awaitingSigners = false;
  line.step({ type: "start", key, cancel: () => cancel.abort() });
  line.setNudge(() => line.step({ type: "wallet-slow", key }), WALLET_NUDGE_MS);
  try {
    const result = await Promise.race([
      act({
        signal: cancel.signal,
        onBroadcast: async (hash) => {
          line.clearNudge();
          line.step({ type: "broadcast", key, hash });
        },
        onAwaiting: () => {
          awaitingSigners = true;
          line.step({ type: "safe-signers", key });
        },
      }),
      stopped,
    ]);
    if (!awaitingSigners) line.landed();
    return result;
  } catch (error) {
    line.step({ type: endingOf(error), key });
    throw error;
  } finally {
    line.clearNudge();
  }
}

export function useTxActPhase(): {
  phase: TxActPhase;
  track: <T>(key: string, act: (send: ActSendCallbacks) => Promise<T>) => Promise<T>;
  trackReported: <T>(key: string, act: (report: ActPhaseReport) => Promise<T>) => Promise<T>;
} {
  const [phase, dispatch] = useReducer(actPhaseReducer, IDLE_ACT_PHASE);
  const { set: setNudge, clear: clearNudge } = useTimeout();

  const track = useCallback(
    <T>(key: string, act: (send: ActSendCallbacks) => Promise<T>): Promise<T> =>
      followAct(key, act, {
        step: dispatch,
        setNudge,
        clearNudge,
        landed: () => dispatch({ type: "confirmed", key }),
      }),
    [setNudge, clearNudge]
  );

  const trackReported = useCallback(
    <T>(key: string, act: (report: ActPhaseReport) => Promise<T>): Promise<T> => {
      let ended = false;
      return followAct(
        key,
        // A queued send keeps its own sender; Cancel stops only this line's wait for it.
        () =>
          act((event) => {
            if (event.type === "broadcast") {
              clearNudge();
              dispatch({ type: "broadcast", key, hash: event.hash });
              return;
            }
            ended = true;
            dispatch({ type: event.type, key });
          }),
        {
          step: dispatch,
          setNudge,
          clearNudge,
          // Resolved without saying how it ended: it did not fail, and nothing
          // says it landed, so it reads as left to send later.
          landed: () => {
            if (!ended) dispatch({ type: "queued", key });
          },
        }
      );
    },
    [setNudge, clearNudge]
  );

  return { phase, track, trackReported };
}
