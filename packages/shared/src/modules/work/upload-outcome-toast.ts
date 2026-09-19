/**
 * What the person is told after an Upload all tap. It ships in the shell with
 * the dashboard, so it takes only a type from the upload module, which loads on the tap.
 *
 * @module modules/work/upload-outcome-toast
 */

import type { UploadOutcome } from "./upload-queued-work";

type Tone = "success" | "info" | "error";
type Message = { id: string; values?: { count: number } };

const UPLOADED_TITLE = "app.uploads.uploadedTitle";

/** Tone, title and message for each way a tap ends, before what went or was flagged changes the message. */
const TOASTS: Record<Exclude<UploadOutcome["status"], "declined">, [Tone, string, string]> = {
  uploaded: ["success", UPLOADED_TITLE, "app.uploads.uploadedMessage"],
  "connection-unconfirmed": ["info", "app.offline.degraded", "app.uploads.connectionUnconfirmed"],
  "nothing-ready": ["info", "app.uploads.notUploadedTitle", "app.uploads.nothingReady"],
  // Every ready item was refused, or is held elsewhere: an upload of nothing is not a success.
  "nothing-sent": ["info", "app.uploads.notUploadedTitle", "app.uploads.nothingSentMessage"],
  reverted: ["error", "app.uploads.revertedTitle", "app.uploads.revertedMessage"],
  "send-unconfirmed": [
    "info",
    "app.uploads.sendUnconfirmedTitle",
    "app.uploads.sendUnconfirmedMessage",
  ],
  failed: ["error", "app.uploads.failedTitle", "app.uploads.failedMessage"],
};

/** `undefined` when nothing should be said: the person declined, and nothing had gone. */
export function uploadOutcomeToast(
  outcome: UploadOutcome
): { tone: Tone; title: Message; message: Message; error?: unknown } | undefined {
  const sent = "sent" in outcome ? outcome.sent : 0;
  const flagged = "flagged" in outcome ? outcome.flagged : 0;
  const uploaded = { id: UPLOADED_TITLE, values: { count: sent } };
  if (outcome.status === "declined") {
    // A long queue goes out in several calls, so an earlier one may already be signed.
    if (sent === 0) return undefined;
    return { tone: "success", title: uploaded, message: { id: "app.uploads.restWaitingMessage" } };
  }

  const [tone, title, rest] = TOASTS[outcome.status];
  // An upload that stops partway still sent what went before it. Saying nothing
  // was sent would deny a signature the person already gave.
  const stoppedPartway = tone === "error" && sent > 0;
  const needsAttention = tone !== "error" && flagged > 0;
  return {
    tone,
    title: title === UPLOADED_TITLE ? uploaded : { id: title },
    message: stoppedPartway
      ? { id: "app.uploads.partlySentMessage", values: { count: sent } }
      : needsAttention
        ? { id: "app.uploads.flaggedMessage", values: { count: flagged } }
        : { id: rest },
    ...(outcome.status === "failed" ? { error: outcome.error } : {}),
  };
}
