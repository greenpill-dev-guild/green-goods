import type { Address, CommitmentEventRecord, CommitmentReadModel } from "@green-goods/shared";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

/** Which of the panel's dialogs is on screen, and who a decline is about. */
export type OpenDialog =
  | "cancel"
  | "mark-ready"
  | "raise-dispute"
  | "resolve-dispute"
  | "fallback-confirm"
  | "attach-assessment"
  | { kind: "decline-claim"; claimant: Address }
  | null;

/** The panel's workspace tone, forwarded to every dialog it opens. */
export type CommitmentDialogTone = "garden" | "hub" | "community";

/** The confirmation path when the ordinary one is unreachable, else null. */
export type FallbackPath = "POOL_FALLBACK" | "PROTOCOL_FALLBACK" | null;

/** The lifecycle stops the panel walks a reader through. */
export const STAGES = ["open", "accepted", "proof", "ready", "kept"] as const;

/** How far along the lifecycle a record stands, or -1 when it left it. */
export function stageIndex(state: string, evidenceCount: number): number {
  switch (state) {
    case "OFFERED":
    case "REQUESTED":
      return 0;
    case "ACCEPTED":
      return evidenceCount > 0 ? 2 : 1;
    case "READY_FOR_CONFIRMATION":
    case "DISPUTED":
      return 3;
    case "FULFILLED":
      return 4;
    default:
      return -1;
  }
}

/** The five lifecycle stops, named as the record's direction makes them read. */
export function stageLabels(
  direction: CommitmentReadModel["direction"],
  formatMessage: FormatMessage
): Record<(typeof STAGES)[number], string> {
  return {
    open:
      direction === "REQUEST"
        ? formatMessage({
            id: "cockpit.garden.pool.commitment.stage.requested",
            defaultMessage: "Requested",
          })
        : formatMessage({
            id: "cockpit.garden.pool.commitment.stage.offered",
            defaultMessage: "Offered",
          }),
    accepted: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.accepted",
      defaultMessage: "Accepted",
    }),
    proof: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.proof",
      defaultMessage: "Proof in",
    }),
    ready: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.ready",
      defaultMessage: "Ready",
    }),
    kept: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.kept",
      defaultMessage: "Kept",
    }),
  };
}

/** One timeline entry in member words, or the raw type lowered when unknown. */
export function eventLabel(event: CommitmentEventRecord, formatMessage: FormatMessage): string {
  const labels: Record<string, { id: string; defaultMessage: string }> = {
    CREATED: { id: "cockpit.garden.pool.commitment.event.created", defaultMessage: "Created" },
    CLAIM_REQUESTED: {
      id: "cockpit.garden.pool.commitment.event.claimRequested",
      defaultMessage: "Asked to take it up",
    },
    CLAIM_DECLINED: {
      id: "cockpit.garden.pool.commitment.event.claimDeclined",
      defaultMessage: "Request declined",
    },
    ACCEPTED: { id: "cockpit.garden.pool.commitment.event.accepted", defaultMessage: "Taken up" },
    CONTRIBUTOR_ADDED: {
      id: "cockpit.garden.pool.commitment.event.contributorAdded",
      defaultMessage: "Joined the team",
    },
    CONTRIBUTOR_REMOVED: {
      id: "cockpit.garden.pool.commitment.event.contributorRemoved",
      defaultMessage: "Left the team",
    },
    CONTRIBUTOR_ROSTER_FROZEN: {
      id: "cockpit.garden.pool.commitment.event.rosterFrozen",
      defaultMessage: "Team settled",
    },
    WORK_LINKED: {
      id: "cockpit.garden.pool.commitment.event.workLinked",
      defaultMessage: "Work linked",
    },
    WORK_UNLINKED: {
      id: "cockpit.garden.pool.commitment.event.workUnlinked",
      defaultMessage: "Work unlinked",
    },
    APPROVED_WORK_COUNTED: {
      id: "cockpit.garden.pool.commitment.event.workApproved",
      defaultMessage: "Work approved",
    },
    EVIDENCE_ATTACHED: {
      id: "cockpit.garden.pool.commitment.event.evidence",
      defaultMessage: "Proof added",
    },
    ASSESSMENT_ATTACHED: {
      id: "cockpit.garden.pool.commitment.event.assessment",
      defaultMessage: "Assessment attached",
    },
    READY_FOR_CONFIRMATION: {
      id: "cockpit.garden.pool.commitment.event.ready",
      defaultMessage: "Sent for confirmation",
    },
    CONFIRMATION_RECORDED: {
      id: "cockpit.garden.pool.commitment.event.confirmation",
      defaultMessage: "Confirmation recorded",
    },
    FULFILLED: { id: "cockpit.garden.pool.commitment.event.fulfilled", defaultMessage: "Kept" },
    CANCELLED: {
      id: "cockpit.garden.pool.commitment.event.cancelled",
      defaultMessage: "Cancelled",
    },
    EXPIRED: { id: "cockpit.garden.pool.commitment.event.expired", defaultMessage: "Expired" },
    DISPUTED: {
      id: "cockpit.garden.pool.commitment.event.disputed",
      defaultMessage: "Under review by stewards",
    },
    DISPUTE_RESOLVED: {
      id: "cockpit.garden.pool.commitment.event.disputeResolved",
      defaultMessage: "Review resolved",
    },
    CONSIDERATION_DECLARED: {
      id: "cockpit.garden.pool.commitment.event.consideration",
      defaultMessage: "Reward declared",
    },
    CONSIDERATION_PAID: {
      id: "cockpit.garden.pool.commitment.event.considerationPaid",
      defaultMessage: "Payout recorded",
    },
    CONFIRMER_RULE_SET: {
      id: "cockpit.garden.pool.commitment.event.confirmerRule",
      defaultMessage: "Confirmers set",
    },
  };
  const descriptor = labels[event.eventType];
  return descriptor ? formatMessage(descriptor) : event.eventType.toLowerCase().replace(/_/g, " ");
}

/** How a reward would be paid out, if at all. */
export function railLabel(
  rail: CommitmentReadModel["considerationRail"],
  formatMessage: FormatMessage
): string {
  return rail === "ARBITRUM_EXTERNAL"
    ? formatMessage({
        id: "cockpit.garden.pool.seed.rail.external",
        defaultMessage: "External payout record",
      })
    : rail === "CELO_SETTLEMENT"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.rail.celo",
          defaultMessage: "Celo G$ settlement",
        })
      : formatMessage({ id: "cockpit.garden.pool.seed.rail.none", defaultMessage: "None" });
}
