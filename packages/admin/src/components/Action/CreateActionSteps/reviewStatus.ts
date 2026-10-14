/**
 * What Create Action's one status row says on the Review (DL-080): what the
 * primary will do, that it is sending, and how the send ended. One function, so
 * the row and the footer never read the same send two ways.
 */

import type { FlowSendPhase, FlowSendStatus } from "@/components/Layout/FlowSendFooter";

type FormatMessage = (descriptor: { id: string; defaultMessage: string }) => string;

export function actionSendStatus(input: {
  phase: FlowSendPhase;
  pending?: boolean;
  /**
   * How the failed send reads, in the words the error itself gave: a declined
   * request as a warning, any other failure as an error.
   */
  failure: Pick<FlowSendStatus, "tone" | "title" | "description">;
  formatMessage: FormatMessage;
}): FlowSendStatus {
  const { phase, failure, formatMessage } = input;
  if (input.pending)
    return {
      phase: "sending",
      tone: "info",
      busy: false,
      title: formatMessage({
        id: "app.account.transactionSubmitted",
        defaultMessage: "Transaction submitted",
      }),
      description: formatMessage({
        id: "app.account.transactionPending",
        defaultMessage: "Transaction submitted. Check its confirmation before trying again.",
      }),
    };
  switch (phase) {
    case "ready":
      return {
        phase,
        tone: "neutral",
        busy: false,
        title: formatMessage({
          id: "app.admin.actions.create.status.ready.title",
          defaultMessage: "Registers this action on-chain",
        }),
        description: formatMessage({
          id: "app.admin.actions.create.status.ready.description",
          defaultMessage: "Its title, timeline and media can be edited after it is registered.",
        }),
      };
    case "sending":
      return {
        phase,
        tone: "info",
        busy: true,
        title: formatMessage({
          id: "app.admin.actions.create.status.sending.title",
          defaultMessage: "Registering the action",
        }),
        description: formatMessage({
          id: "app.admin.actions.create.status.sending.description",
          defaultMessage:
            "Its media uploads first, then your wallet asks you to approve. This can take a minute.",
        }),
      };
    case "sent":
      return {
        phase,
        tone: "success",
        busy: false,
        title: formatMessage({
          id: "app.admin.actions.create.status.sent.title",
          defaultMessage: "Action registered",
        }),
        description: formatMessage({
          id: "app.admin.actions.create.status.sent.description",
          defaultMessage: "It may take a moment to show in the actions list.",
        }),
      };
    case "failed":
      return { phase, busy: false, ...failure };
  }
}
