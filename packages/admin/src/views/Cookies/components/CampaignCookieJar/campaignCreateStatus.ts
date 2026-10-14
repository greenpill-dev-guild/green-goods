/**
 * What Create Cookie Jar's one status row says on the Review (DL-080): what the
 * primary will do, that it is sending, and how the send ended. One function, so
 * the row and the footer never read the same send two ways.
 */

import type { FlowSendPhase, FlowSendStatus } from "@/components/Layout/FlowSendFooter";

type FormatMessage = (descriptor: { id: string; defaultMessage: string }) => string;

export function campaignCreateStatus(input: {
  phase: FlowSendPhase;
  /**
   * The wallet submitted the create without naming the jar it made (a
   * Safe-style queue), so the steward supplies the address once it runs.
   */
  awaitingJarAddress: boolean;
  /**
   * How the failed send reads, in the words the error itself gave: a declined
   * request as a warning, any other failure as an error.
   */
  failure: Pick<FlowSendStatus, "tone" | "title" | "description">;
  formatMessage: FormatMessage;
}): FlowSendStatus {
  const { phase, awaitingJarAddress, failure, formatMessage } = input;
  switch (phase) {
    case "ready":
      return {
        phase,
        tone: "neutral",
        busy: false,
        title: formatMessage({
          id: "cockpit.community.cookies.status.ready.title",
          defaultMessage: "Creates this cookie jar on-chain",
        }),
        description: formatMessage({
          id: "cockpit.community.cookies.status.ready.description",
          defaultMessage: "Check the payout and the gardens before you create it.",
        }),
      };
    case "sending":
      return {
        phase,
        tone: "info",
        busy: true,
        title: formatMessage({
          id: "cockpit.community.cookies.status.sending.title",
          defaultMessage: "Creating the cookie jar",
        }),
        description: formatMessage({
          id: "cockpit.community.cookies.status.sending.description",
          defaultMessage: "Approve the request when your wallet asks. This can take a minute.",
        }),
      };
    case "sent":
      return awaitingJarAddress
        ? {
            phase,
            tone: "info",
            busy: false,
            title: formatMessage({
              id: "cockpit.community.cookies.createSubmitted",
              defaultMessage: "Creation submitted",
            }),
            description: formatMessage({
              id: "cockpit.community.cookies.status.submitted.description",
              defaultMessage: "Paste the jar's address below once the transaction runs.",
            }),
          }
        : {
            phase,
            tone: "success",
            busy: false,
            title: formatMessage({
              id: "cockpit.community.cookies.createCompleteTitle",
              defaultMessage: "Cookie jar created",
            }),
            description: formatMessage({
              id: "cockpit.community.cookies.status.created.description",
              defaultMessage: "It may take a moment to show in the campaign list.",
            }),
          };
    case "failed":
      return { phase, busy: false, ...failure };
  }
}
