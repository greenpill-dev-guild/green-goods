/**
 * What a failed send means for the work it carried.
 *
 * A send intent is recorded immediately before a call can reach the network
 * (`onBeforeBroadcast`). A failure before that point never sent anything. After
 * it, only a refusal that came back from the person or the network proves the
 * call was not broadcast; a lost response may hide a send that landed, so the
 * intent is kept for reconciliation instead of risking a second attestation.
 *
 * @module modules/work/send-outcome
 */

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
 * invalid input (-32000), invalid params (-32602), and the ERC-4337 bundler
 * rejections (-32500 to -32599). An internal error (-32603) is not included: a
 * wallet can report one after its own broadcast.
 */
function isRefusedByNetwork(code: number): boolean {
  return code === -32000 || code === -32602 || (code <= -32500 && code >= -32599);
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

export function classifySendFailure(
  error: unknown,
  context: { intentRecorded: boolean; broadcastKnown: boolean }
): SendFailure {
  const cancelled = isWorkSubmissionCancelled(error);
  // An acknowledged broadcast outranks everything, including a sender that
  // never reported its intent.
  if (context.broadcastKnown) return { kind: "may-have-sent" };
  if (!context.intentRecorded) return { kind: "not-sent", cancelled };
  if (cancelled || hasNetworkRefusal(error)) return { kind: "not-sent", cancelled };
  return { kind: "may-have-sent" };
}
