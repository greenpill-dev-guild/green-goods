/**
 * Where a single-signature act stands, for the one line a steward reads while
 * it runs: waiting on the wallet, broadcast and waiting on the chain, done, or
 * failed. Each act carries a key (the row it was started from), so a list can
 * put the line on the right row, and an event for an older act never
 * overwrites the one that replaced it.
 *
 * `confirmed` means the receipt landed; the read models may still lag, so a
 * view keeps the act closed on that row until the record it reads moves on.
 * `queued` is an act the job queue kept on this device to send later: it did
 * not fail, and nothing says it landed.
 *
 * Waiting on the wallet past `WALLET_NUDGE_MS`, the act is `slow`, and an act
 * that can be cancelled carries its `cancel` (PRD-1551). Three endings never
 * read as failed: `still-confirming` (sent, its receipt outlasted the wait's
 * limit), `safe-signers` (the wallet answered with a Safe proposal) and
 * `stopped` (the person stopped waiting; the wallet may still hold the request).
 *
 * @module modules/transactions/act-phase
 */

import type { Hex } from "viem";

export type TxActPhase =
  | { status: "idle" }
  | { status: "signing"; key: string; slow?: true; cancel?: () => void }
  | { status: "confirming"; key: string; hash: Hex }
  | { status: "confirmed"; key: string; hash: Hex | null }
  | { status: "queued"; key: string }
  | { status: "still-confirming"; key: string }
  | { status: "safe-signers"; key: string }
  | { status: "stopped"; key: string }
  | { status: "failed"; key: string };

export type TxActPhaseEvent =
  | { type: "start"; key: string; cancel?: () => void }
  | { type: "wallet-slow"; key: string }
  | { type: "broadcast"; key: string; hash: Hex }
  | { type: "confirmed"; key: string }
  | { type: "queued"; key: string }
  | { type: "still-confirming"; key: string }
  | { type: "safe-signers"; key: string }
  | { type: "stopped"; key: string }
  | { type: "failed"; key: string };

/** What an act that reports its own ending says: broadcast, landed, or left queued. */
export type ActPhaseReportEvent =
  | { type: "broadcast"; hash: Hex }
  | { type: "confirmed" }
  | { type: "queued" };

export type ActPhaseReport = (event: ActPhaseReportEvent) => void;

export const IDLE_ACT_PHASE: TxActPhase = { status: "idle" };

export function actPhaseReducer(state: TxActPhase, event: TxActPhaseEvent): TxActPhase {
  if (event.type === "start")
    return { status: "signing", key: event.key, ...(event.cancel ? { cancel: event.cancel } : {}) };
  // Only the act that is running moves the line; a late event from an older
  // act, or one after the line settled, changes nothing.
  if (state.status === "idle" || state.key !== event.key) return state;
  const running = state.status === "signing" || state.status === "confirming";
  switch (event.type) {
    case "wallet-slow":
      return state.status === "signing" ? { ...state, slow: true } : state;
    case "broadcast":
      return state.status === "signing"
        ? { status: "confirming", key: state.key, hash: event.hash }
        : state;
    case "confirmed":
      return running
        ? {
            status: "confirmed",
            key: state.key,
            hash: state.status === "confirming" ? state.hash : null,
          }
        : state;
    case "stopped":
      return state.status === "signing" ? { status: "stopped", key: state.key } : state;
    case "queued":
    case "still-confirming":
    case "safe-signers":
    case "failed":
      return running ? { status: event.type, key: state.key } : state;
  }
}

/** The phase of the act started from `key`, or idle when another row holds the line. */
export function actPhaseFor(phase: TxActPhase, key: string): TxActPhase {
  return phase.status !== "idle" && phase.key === key ? phase : IDLE_ACT_PHASE;
}

/** The key for resuming a paused pool. */
export const RESUME_POOL_ACT_KEY = "resume-pool";

/** The key for sending one commitment for confirmation. */
export function sendForConfirmationActKey(commitmentId: bigint): string {
  return `send-for-confirmation:${commitmentId.toString()}`;
}

/** The key for accepting one claimant's request on one commitment. */
export function claimActKey(commitmentId: bigint, claimant: string): string {
  return `accept-claim:${commitmentId.toString()}:${claimant.toLowerCase()}`;
}
