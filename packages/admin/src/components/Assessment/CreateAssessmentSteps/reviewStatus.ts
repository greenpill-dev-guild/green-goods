/**
 * What Create Assessment's one status row says on the Review (DL-080): what the
 * primary will do, that it is sending, and how the send ended. One function, so
 * the row and the footer never read the same send two ways.
 */

import type { FlowSendPhase, FlowSendStatus } from "@/components/Layout/FlowSendFooter";

type FormatMessage = (descriptor: { id: string; defaultMessage: string }) => string;

export function assessmentSendStatus(input: {
  phase: FlowSendPhase;
  /**
   * How the failed send reads, in the words the error itself gave: a declined
   * request as a warning, any other failure as an error.
   */
  failure: Pick<FlowSendStatus, "tone" | "title" | "description">;
  formatMessage: FormatMessage;
}): FlowSendStatus {
  const { phase, failure, formatMessage } = input;
  switch (phase) {
    case "ready":
      return {
        phase,
        tone: "neutral",
        busy: false,
        title: formatMessage({
          id: "app.assessment.status.ready.title",
          defaultMessage: "Records this assessment on-chain",
        }),
        description: formatMessage({
          id: "app.assessment.status.ready.description",
          defaultMessage: "It can't be changed once it's submitted.",
        }),
      };
    case "sending":
      return {
        phase,
        tone: "info",
        busy: true,
        title: formatMessage({
          id: "app.assessment.status.sending.title",
          defaultMessage: "Submitting the assessment",
        }),
        description: formatMessage({
          id: "app.assessment.status.sending.description",
          defaultMessage: "Approve the request when your wallet asks. This can take a minute.",
        }),
      };
    case "sent":
      return {
        phase,
        tone: "success",
        busy: false,
        title: formatMessage({
          id: "app.assessment.submitted",
          defaultMessage: "Assessment submitted",
        }),
        description: formatMessage({
          id: "app.assessment.submittedMessage",
          defaultMessage: "Your assessment has been recorded on-chain",
        }),
      };
    case "failed":
      return { phase, busy: false, ...failure };
  }
}
