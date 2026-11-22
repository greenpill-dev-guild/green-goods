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
 * A tracked act signed with a wallet that is still waiting on it after
 * `WALLET_NUDGE_MS` turns slow, and its line offers Cancel: the line stops
 * waiting, and the wallet sender stops waiting for the wallet's answer
 * (PRD-1551). A passkey approves in the app and an embedded wallet asks
 * nobody, and a queued act keeps its own send, so none of those turns slow.
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
import { useOptionalAuthContext } from "../../providers/Auth";
import { isUnconfirmedTxError } from "../../utils/errors/tx-error-classifier";
import { useTimeout } from "../utils/useTimeout";

/**
 * The send callbacks an act forwards to the transaction sender, and `onUnconfirmed`, which the
 * act calls when the wallet's answer has no receipt and no Safe behind it, so it may still land.
 */
export type ActSendCallbacks = Pick<
  TransactionSendOptions,
  "onBroadcast" | "onAwaiting" | "signal"
> & { onUnconfirmed?: () => void };

/** The line an act moves: its events, the timer that marks a slow wallet, and what landing does. */
export interface ActLine {
  step: (event: TxActPhaseEvent) => void;
  /** Whether the act waits on a wallet the person must open: only then can it turn slow. */
  waitsOnWallet: boolean;
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
 * Runs `act` on its line: waiting on the wallet (slow past `WALLET_NUDGE_MS`, with Cancel, when
 * it `waitsOnWallet`), on the chain, then its ending. Cancel rejects the act with
 * `WalletAnswerAbandonedError`, and its sender's late events no longer move the line: a retry
 * under the same key is a new act, which an older one's answer must not move.
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
  let unconfirmed = false;
  // Once the wallet has answered there is nothing left to stop waiting for.
  let answered = false;
  line.step({
    type: "start",
    key,
    ...(line.waitsOnWallet ? { cancel: () => answered || cancel.abort() } : {}),
  });
  if (line.waitsOnWallet)
    line.setNudge(() => line.step({ type: "wallet-slow", key }), WALLET_NUDGE_MS);
  try {
    const result = await Promise.race([
      act({
        signal: cancel.signal,
        onBroadcast: async (hash) => {
          if (cancel.signal.aborted) return;
          answered = true;
          line.clearNudge();
          line.step({ type: "broadcast", key, hash });
        },
        onAwaiting: () => {
          if (cancel.signal.aborted) return;
          answered = true;
          awaitingSigners = true;
          line.step({ type: "safe-signers", key });
        },
        onUnconfirmed: () => {
          if (cancel.signal.aborted) return;
          answered = true;
          unconfirmed = true;
        },
      }),
      stopped,
    ]);
    // An answer with no receipt may still land, so it is held as still confirming (PRD-1574).
    if (unconfirmed) line.step({ type: "still-confirming", key });
    else if (!awaitingSigners) line.landed();
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
  const waitsOnWallet = useOptionalAuthContext()?.authMode === "wallet";

  const track = useCallback(
    <T>(key: string, act: (send: ActSendCallbacks) => Promise<T>): Promise<T> =>
      followAct(key, act, {
        step: dispatch,
        waitsOnWallet,
        setNudge,
        clearNudge,
        landed: () => dispatch({ type: "confirmed", key }),
      }),
    [waitsOnWallet, setNudge, clearNudge]
  );

  const trackReported = useCallback(
    <T>(key: string, act: (report: ActPhaseReport) => Promise<T>): Promise<T> => {
      let ended = false;
      return followAct(
        key,
        // A queued send keeps its own sender and its own stages, so its line never turns slow.
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
          waitsOnWallet: false,
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
