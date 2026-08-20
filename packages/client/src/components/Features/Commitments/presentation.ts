import type {
  CommitmentDerivedState,
  CommitmentReadModel,
  CommitmentSeat,
} from "@green-goods/shared";

/**
 * How a commitment's state and the reader's relationship to it are said in the
 * member's own words.
 *
 * Two rules from the design language hold here. The machine vocabulary never
 * reaches a member, so the contract's own state names are translated rather
 * than printed. And the sentence is written from the reader's seat: the same
 * commitment reads "you offered this" to one person and "you took this up" to
 * another, and getting that backwards is the defect this whole axis exists to
 * prevent.
 */

type BadgeTone = "success" | "warning" | "error" | "info" | "neutral";

export interface StatePresentation {
  /** i18n key for the member-facing label. */
  labelId: string;
  tone: BadgeTone;
}

const STATE_PRESENTATION: Record<CommitmentDerivedState, StatePresentation> = {
  OFFERED: { labelId: "app.commitments.state.offered", tone: "info" },
  REQUESTED: { labelId: "app.commitments.state.requested", tone: "info" },
  ACCEPTED: { labelId: "app.commitments.state.inProgress", tone: "info" },
  ACTIVE: { labelId: "app.commitments.state.inProgress", tone: "info" },
  EVIDENCE_SUBMITTED: { labelId: "app.commitments.state.proofAdded", tone: "info" },
  PARTIALLY_APPROVED: { labelId: "app.commitments.state.partlyApproved", tone: "info" },
  READY_FOR_CONFIRMATION: {
    labelId: "app.commitments.state.awaitingConfirmation",
    tone: "warning",
  },
  FULFILLED: { labelId: "app.commitments.state.kept", tone: "success" },
  RECONCILED: { labelId: "app.commitments.state.kept", tone: "success" },
  CANCELLED: { labelId: "app.commitments.state.withdrawn", tone: "neutral" },
  EXPIRED: { labelId: "app.commitments.state.lapsed", tone: "neutral" },
  // The steward ceiling: a member never reads the contract's own word for this.
  DISPUTED: { labelId: "app.commitments.state.underReview", tone: "warning" },
  DRAFT: { labelId: "app.commitments.state.beingSetUp", tone: "neutral" },
  UNKNOWN: { labelId: "app.commitments.state.beingSetUp", tone: "neutral" },
};

export function presentState(state: CommitmentDerivedState): StatePresentation {
  return STATE_PRESENTATION[state] ?? STATE_PRESENTATION.UNKNOWN;
}

/**
 * The reader's relationship, as a sentence about them.
 *
 * Direction decides the verb and seat decides the side, which is why both are
 * needed: a provider on an Offer made it, a provider on a Request answered one.
 */
export function relationshipLabelId(
  seat: CommitmentSeat | null,
  direction: CommitmentReadModel["direction"]
): string | null {
  const isRequest = direction === "REQUEST";
  switch (seat) {
    case "provider":
      return isRequest
        ? "app.commitments.relationship.providerOnRequest"
        : "app.commitments.relationship.providerOnOffer";
    case "confirmer":
      return isRequest
        ? "app.commitments.relationship.confirmerOnRequest"
        : "app.commitments.relationship.confirmerOnOffer";
    case "contributor":
      return "app.commitments.relationship.contributor";
    default:
      return null;
  }
}
