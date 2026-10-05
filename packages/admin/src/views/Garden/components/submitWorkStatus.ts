/**
 * What Submit Work's one status row says on the Review (DL-080): what the
 * primary will do, which stage the send is on, and how it ended. One function,
 * so the row and the footer never read the same send two ways.
 */

import type { FlowSendPhase, FlowSendStatus } from "@/components/Layout/FlowSendFooter";

type FormatMessage = (descriptor: { id: string; defaultMessage: string }) => string;

export function submitWorkSendStatus(input: {
  phase: FlowSendPhase;
  /** The stage the send says it is on (uploading, the wallet, the chain); empty between stages. */
  progressMessage: string;
  formatMessage: FormatMessage;
}): FlowSendStatus {
  const { phase, progressMessage, formatMessage } = input;
  switch (phase) {
    case "ready":
      return {
        phase,
        tone: "neutral",
        busy: false,
        title: formatMessage({
          id: "app.admin.work.submit.status.ready.title",
          defaultMessage: "Submits this work for review",
        }),
        description: formatMessage({
          id: "app.admin.work.submit.status.ready.description",
          defaultMessage: "It can't be changed once it's submitted.",
        }),
      };
    case "sending":
      return {
        phase,
        tone: "info",
        busy: true,
        title: formatMessage({
          id: "app.admin.work.submit.status.sending.title",
          defaultMessage: "Submitting the work",
        }),
        description:
          progressMessage ||
          formatMessage({
            id: "app.admin.work.submit.status.sending.description",
            defaultMessage: "Approve the request when your wallet asks.",
          }),
      };
    case "sent":
      return {
        phase,
        tone: "success",
        busy: false,
        title: formatMessage({
          id: "app.admin.work.submit.success",
          defaultMessage: "Work submitted successfully",
        }),
        description: formatMessage({
          id: "app.admin.work.submit.status.sent.description",
          defaultMessage: "It now waits for review.",
        }),
      };
    case "failed":
      return {
        phase,
        tone: "error",
        busy: false,
        title: formatMessage({
          id: "app.admin.work.submit.failureTitle",
          defaultMessage: "Work wasn't submitted",
        }),
        description: formatMessage({
          id: "app.admin.work.submit.failureMessage",
          defaultMessage:
            "The work submission didn't go through. Check your wallet connection — you may need to reconnect — then try again.",
        }),
      };
  }
}
