import { toastService } from "../toast.service";
import type { FormatMessageFn } from "./types";

/** One toast for one proof's send: each stage replaces the last. */
const PROOF_TOAST_ID = "proof-send";

/**
 * The toasts that follow a proof from Add This Proof to the promise, as work's
 * follow an upload (D18): adding, confirming, and how it ended. They carry the
 * news once the page has moved on, so each says where the proof is now.
 */
export function createProofToasts(formatMessage: FormatMessageFn) {
  const say = (id: string) => formatMessage({ id: `app.toast.proof.${id}` });
  return {
    /** The prompt is about to open; with Add and Send, twice. */
    adding: ({ sendToo }: { sendToo: boolean }) =>
      toastService.loading({
        id: PROOF_TOAST_ID,
        title: say("adding.title"),
        message: say(sendToo ? "adding.messageSendToo" : "adding.message"),
        context: "proof",
        suppressLogging: true,
      }),

    /** Signed: the chain is confirming it, and nothing needs this screen. */
    confirming: () =>
      toastService.loading({
        id: PROOF_TOAST_ID,
        title: say("adding.title"),
        message: say("confirming.message"),
        context: "proof",
        suppressLogging: true,
      }),

    /** Landed; sent too, or waiting for whoever leads to send it. */
    added: ({ sent, leads }: { sent: boolean; leads: boolean }) =>
      toastService.success({
        id: PROOF_TOAST_ID,
        title: say(sent ? "sent.title" : "added.title"),
        message: say(sent ? "sent.message" : leads ? "added.message" : "added.messageTeammate"),
        context: "proof",
        suppressLogging: true,
      }),

    savedOffline: () =>
      toastService.info({
        id: PROOF_TOAST_ID,
        title: say("savedOffline.title"),
        message: say("savedOffline.message"),
        context: "proof",
        suppressLogging: true,
      }),

    /** The signature was declined: nothing was sent, and the proof waits on the phone. */
    notAdded: () =>
      toastService.info({
        id: PROOF_TOAST_ID,
        title: say("notAdded.title"),
        message: say("notAdded.message"),
        context: "proof",
        suppressLogging: true,
      }),

    /** It left the phone and no answer came yet; the queue keeps checking. */
    takingLonger: () =>
      toastService.info({
        id: PROOF_TOAST_ID,
        title: say("takingLonger.title"),
        message: say("takingLonger.message"),
        context: "proof",
        suppressLogging: true,
      }),

    couldNotAdd: (openYourWork?: () => void) =>
      toastService.error({
        id: PROOF_TOAST_ID,
        title: say("couldNotAdd.title"),
        message: say("couldNotAdd.message"),
        context: "proof",
        suppressLogging: true,
        ...(openYourWork
          ? {
              action: {
                label: formatMessage({ id: "app.workDashboard.openButton" }),
                onClick: openYourWork,
              },
            }
          : {}),
      }),

    dismiss: () => toastService.dismiss(PROOF_TOAST_ID),
  };
}

export type ProofToasts = ReturnType<typeof createProofToasts>;
