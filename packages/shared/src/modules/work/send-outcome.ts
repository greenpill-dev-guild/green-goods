/**
 * What a failed send means for the work it carried.
 *
 * A send intent is recorded immediately before a call can reach the network
 * (`onBeforeBroadcast`). A failure before that point never sent anything. After
 * it, only a refusal that came back from the person or the network proves the
 * call was not broadcast, or an estimate the contract refused, or a refusal for
 * the wallet's network or for who is connected, since nothing is signed after
 * any of them; a lost response may hide a send that landed, so the intent is
 * kept for reconciliation instead of risking a second attestation.
 *
 * @module modules/work/send-outcome
 */

import { refusedForWalletNetwork } from "../../utils/errors/wallet-network-refusal";
import { isWorkSubmissionCancelled } from "./work-confirmation";

export type SendFailure = { kind: "not-sent"; cancelled: boolean } | { kind: "may-have-sent" };

/** The person declined to send; the work stays queued for them to send later. */
export class WorkSendCancelledError extends Error {
  /** EIP-1193 user rejection, so every cancellation check recognises it. */
  readonly code = 4001;

  constructor(message = "The send was cancelled before anything was broadcast.") {
    super(message);
    this.name = "WorkSendCancelledError";
  }
}

/**
 * JSON-RPC errors that mean the node or bundler refused the call outright:
 * invalid params (-32602) and the ERC-4337 bundler rejections (-32500 to
 * -32599). Two codes are deliberately left out because a node can return them
 * after its own broadcast: the generic server error (-32000), which also
 * carries "already known" and "nonce too low", and the internal error (-32603).
 */
function isRefusedByNetwork(code: number): boolean {
  return code === -32602 || (code <= -32500 && code >= -32599);
}

function hasNetworkRefusal(error: unknown): boolean {
  const seen = new Set<object>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    const code = "code" in cause ? Number((cause as { code: unknown }).code) : Number.NaN;
    if (Number.isInteger(code) && isRefusedByNetwork(code)) return true;
    cause = "cause" in cause ? (cause as { cause: unknown }).cause : undefined;
  }
  return false;
}

/**
 * An estimate the contract refused: viem's own estimate (it throws
 * `EstimateGasExecutionError` only from estimating), or a wallet's, which
 * answers JSON-RPC 3, "execution reverted", from running the call. Submitting a
 * signed transaction never runs it, so nothing was signed or broadcast. The
 * chain can move between a preflight and the wallet's estimate.
 */
function refusedWhileEstimating(error: unknown): boolean {
  const seen = new Set<object>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if ("name" in cause && cause.name === "EstimateGasExecutionError") return true;
    if ("code" in cause && Number((cause as { code: unknown }).code) === 3) return true;
    cause = "cause" in cause ? (cause as { cause: unknown }).cause : undefined;
  }
  return false;
}

/**
 * The sender's own refusal for who is connected. It compares the connected
 * address with the one the send is for before it asks the wallet anything, so
 * nothing was signed or broadcast. A bundle records its jobs' intents before
 * the batch makes that check.
 */
function refusedForConnectedAccount(error: unknown): boolean {
  const seen = new Set<object>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if ("name" in cause && cause.name === "WalletAccountMismatchError") return true;
    cause = "cause" in cause ? (cause as { cause: unknown }).cause : undefined;
  }
  return false;
}

export function classifySendFailure(
  error: unknown,
  context: { intentRecorded: boolean; broadcastKnown: boolean }
): SendFailure {
  const cancelled = isWorkSubmissionCancelled(error);
  // An acknowledged broadcast outranks everything, including a sender that
  // never reported its intent.
  if (context.broadcastKnown) return { kind: "may-have-sent" };
  if (!context.intentRecorded) return { kind: "not-sent", cancelled };
  if (
    cancelled ||
    hasNetworkRefusal(error) ||
    refusedWhileEstimating(error) ||
    // The sender retries once when the wallet's network moved; the retry's own
    // network check and a second refusal both land here with nothing signed.
    refusedForWalletNetwork(error) ||
    refusedForConnectedAccount(error)
  )
    return { kind: "not-sent", cancelled };
  return { kind: "may-have-sent" };
}
