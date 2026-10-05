/**
 * What Create Hypercert's one status row says on the Review (DL-080): what the
 * primary will do, which part of the mint is under way, and how it ended. One
 * function, so the row and the footer never read the same mint two ways.
 */

import type { MintingState } from "@green-goods/shared/stores/useHypercertWizardStore";
import type { FlowSendPhase, FlowSendStatus } from "@/components/Layout/FlowSendFooter";

type FormatMessage = (descriptor: { id: string; defaultMessage: string }) => string;

export function hypercertSendStatus(input: {
  phase: FlowSendPhase;
  /** The mint's own stage, which says what the row says while it sends. */
  stage: MintingState["status"];
  /**
   * How the failed mint reads, in the words the error itself gave: a declined
   * request as a warning, any other failure as an error.
   */
  failure: Pick<FlowSendStatus, "tone" | "title" | "description">;
  formatMessage: FormatMessage;
}): FlowSendStatus {
  const { phase, stage, failure, formatMessage } = input;
  switch (phase) {
    case "ready":
      return {
        phase,
        tone: "neutral",
        busy: false,
        title: formatMessage({
          id: "app.hypercerts.review.status.ready.title",
          defaultMessage: "Mints this hypercert on-chain",
        }),
        description: formatMessage({
          id: "app.hypercerts.review.status.ready.description",
          defaultMessage: "It can't be changed once it's minted.",
        }),
      };
    case "sending":
      return { phase, tone: "info", busy: true, ...sendingWords(stage, formatMessage) };
    case "sent":
      return {
        phase,
        tone: "success",
        busy: false,
        title: formatMessage({
          id: "app.hypercerts.review.status.sent.title",
          defaultMessage: "Hypercert minted",
        }),
        description: formatMessage({
          id: "app.hypercerts.review.status.sent.description",
          defaultMessage: "Done opens its record. It may take a moment to show everywhere.",
        }),
      };
    case "failed":
      return { phase, busy: false, ...failure };
  }
}

function sendingWords(
  stage: MintingState["status"],
  formatMessage: FormatMessage
): Pick<FlowSendStatus, "title" | "description"> {
  switch (stage) {
    case "building_userop":
    case "awaiting_signature":
      return {
        title: formatMessage({
          id: "app.hypercerts.review.status.signing.title",
          defaultMessage: "Approve in your wallet",
        }),
        description: formatMessage({
          id: "app.hypercerts.review.status.signing.description",
          defaultMessage: "The hypercert is minted once your wallet approves.",
        }),
      };
    case "submitting":
    case "pending":
      return {
        title: formatMessage({
          id: "app.hypercerts.review.status.confirming.title",
          defaultMessage: "Minting the hypercert",
        }),
        description: formatMessage({
          id: "app.hypercerts.review.status.confirming.description",
          defaultMessage: "Your wallet approved. Waiting for the chain to confirm.",
        }),
      };
    case "registering_proposal":
      return {
        title: formatMessage({
          id: "app.hypercerts.review.status.registering.title",
          defaultMessage: "Adding it to the garden's signal pool",
        }),
        description: formatMessage({
          id: "app.hypercerts.review.status.registering.description",
          defaultMessage: "The hypercert is minted. Your wallet may ask once more.",
        }),
      };
    default:
      return {
        title: formatMessage({
          id: "app.hypercerts.review.status.uploading.title",
          defaultMessage: "Preparing the hypercert",
        }),
        description: formatMessage({
          id: "app.hypercerts.review.status.uploading.description",
          defaultMessage: "Uploading its details to IPFS. Your wallet asks next.",
        }),
      };
  }
}
