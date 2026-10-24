import type { CommitmentDerivedState } from "@green-goods/shared/commitment-pooling";
import type { ItemRowDetail } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { IntlShape } from "react-intl";

/**
 * How a commitment's state and its due date are said in the member's own words.
 *
 * The machine vocabulary never reaches a member, so the contract's own state
 * names are translated rather than printed. How the reader is involved is said
 * on the promise itself, where the people are named from their seat.
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
 * "due 24 Oct": a row's due date in its short form, without the weekday and with the year
 * only when it is not this one, as a moment with the full date behind it.
 */
export function promiseDueDetail(
  intl: Pick<IntlShape, "formatDate" | "formatMessage">,
  dueDate: bigint | null | undefined,
  now: number = Date.now()
): ItemRowDetail | null {
  if (!dueDate) return null;
  const ms = Number(dueDate) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  const date = intl.formatDate(ms, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
  return {
    text: intl.formatMessage({ id: "app.commitments.row.due" }, { date }),
    dateTime: new Date(ms).toISOString(),
    title: intl.formatDate(ms, { dateStyle: "long" }),
  };
}
