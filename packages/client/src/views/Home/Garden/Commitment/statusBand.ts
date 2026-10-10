import type {
  CommitmentActKind,
  CommitmentDerivedState,
  CommitmentReadModel,
  CommitmentSeat,
} from "@green-goods/shared/commitment-pooling";

/**
 * What this commitment says to the person reading it, right now.
 *
 * The band is the screen's scan layer: where this stands, in a sentence written
 * from the reader's own seat. The same commitment says "waiting on them to
 * confirm" to one person and "you can confirm this now" to another, and the
 * audit found six shipped defects that all came from getting that backwards —
 * including congratulating a confirmer for work somebody else did, and telling
 * a provider they had been named to confirm a commitment they are forbidden
 * from confirming.
 *
 * So the lookup is keyed on seat FIRST. A phase that has no entry for a seat
 * falls back to a neutral statement of fact, never to another seat's sentence.
 */

export type BandTone = "neutral" | "waiting" | "attention" | "kept";

export interface StatusBand {
  /** The one sentence the status block says, from the reader's seat. */
  bodyId: string;
  /**
   * The same sentence naming who acts next (`{name}`), for when one person does:
   * whoever confirms it, or, once it is kept, whoever confirmed it.
   */
  named?: { bodyId: string; who: "confirmer" | "keptBy" };
  tone: BandTone;
}

const key = (seat: CommitmentSeat, phase: CommitmentDerivedState) => `${seat}:${phase}`;

const BANDS: Record<string, StatusBand> = {
  // The provider's own arc.
  "provider:OFFERED": {
    bodyId: "app.commitment.band.provider.offered.b",
    tone: "waiting",
  },
  "provider:ACCEPTED": {
    bodyId: "app.commitment.band.provider.accepted.b",
    tone: "attention",
  },
  "provider:ACTIVE": {
    bodyId: "app.commitment.band.provider.active.b",
    named: { bodyId: "app.commitment.band.provider.active.named", who: "confirmer" },
    tone: "attention",
  },
  "provider:PARTIALLY_APPROVED": {
    bodyId: "app.commitment.band.provider.partial.b",
    tone: "attention",
  },
  "provider:EVIDENCE_SUBMITTED": {
    bodyId: "app.commitment.band.provider.evidence.b",
    named: { bodyId: "app.commitment.band.provider.evidence.named", who: "confirmer" },
    tone: "attention",
  },
  // The costliest one to get wrong: their part is done and they cannot confirm it.
  "provider:READY_FOR_CONFIRMATION": {
    bodyId: "app.commitment.band.provider.ready.b",
    named: { bodyId: "app.commitment.band.provider.ready.named", who: "confirmer" },
    tone: "waiting",
  },
  "provider:FULFILLED": {
    bodyId: "app.commitment.band.provider.fulfilled.b",
    named: { bodyId: "app.commitment.band.provider.fulfilled.named", who: "keptBy" },
    tone: "kept",
  },
  "provider:RECONCILED": {
    bodyId: "app.commitment.band.provider.reconciled.b",
    tone: "kept",
  },
  "provider:EXPIRED": {
    bodyId: "app.commitment.band.provider.expired.b",
    tone: "neutral",
  },
  "provider:CANCELLED": {
    bodyId: "app.commitment.band.provider.cancelled.b",
    tone: "neutral",
  },
  "provider:DISPUTED": {
    bodyId: "app.commitment.band.disputed.b",
    tone: "attention",
  },

  // The confirmer waits, then decides, then has decided.
  "confirmer:REQUESTED": {
    bodyId: "app.commitment.band.confirmer.requested.b",
    tone: "waiting",
  },
  "confirmer:ACCEPTED": {
    bodyId: "app.commitment.band.confirmer.accepted.b",
    tone: "waiting",
  },
  "confirmer:ACTIVE": {
    bodyId: "app.commitment.band.confirmer.active.b",
    tone: "waiting",
  },
  "confirmer:PARTIALLY_APPROVED": {
    bodyId: "app.commitment.band.confirmer.active.b",
    tone: "waiting",
  },
  "confirmer:EVIDENCE_SUBMITTED": {
    bodyId: "app.commitment.band.confirmer.active.b",
    tone: "waiting",
  },
  "confirmer:READY_FOR_CONFIRMATION": {
    bodyId: "app.commitment.band.confirmer.ready.b",
    tone: "attention",
  },
  // Never "you did the work": they said it was kept, which is a different act.
  "confirmer:FULFILLED": {
    bodyId: "app.commitment.band.confirmer.fulfilled.b",
    tone: "kept",
  },
  "confirmer:RECONCILED": {
    bodyId: "app.commitment.band.confirmer.fulfilled.b",
    tone: "kept",
  },
  "confirmer:CANCELLED": {
    bodyId: "app.commitment.band.confirmer.cancelled.b",
    tone: "neutral",
  },
  "confirmer:DISPUTED": {
    bodyId: "app.commitment.band.disputed.b",
    tone: "attention",
  },

  // On the team, not leading it, and never confirming it.
  "contributor:ACTIVE": {
    bodyId: "app.commitment.band.contributor.active.b",
    tone: "attention",
  },
  "contributor:PARTIALLY_APPROVED": {
    bodyId: "app.commitment.band.contributor.active.b",
    tone: "attention",
  },
  "contributor:EVIDENCE_SUBMITTED": {
    bodyId: "app.commitment.band.contributor.sent.b",
    tone: "waiting",
  },
  "contributor:READY_FOR_CONFIRMATION": {
    bodyId: "app.commitment.band.contributor.ready.b",
    tone: "waiting",
  },
  "contributor:FULFILLED": {
    bodyId: "app.commitment.band.contributor.fulfilled.b",
    tone: "kept",
  },

  // No relationship yet. What they read is an invitation or a plain report.
  "bystander:OFFERED": {
    bodyId: "app.commitment.band.bystander.offered.b",
    tone: "neutral",
  },
  "bystander:REQUESTED": {
    bodyId: "app.commitment.band.bystander.requested.b",
    tone: "neutral",
  },
  "bystander:ACCEPTED": {
    bodyId: "app.commitment.band.bystander.taken.b",
    tone: "neutral",
  },
  "bystander:ACTIVE": {
    bodyId: "app.commitment.band.bystander.taken.b",
    tone: "neutral",
  },
};

/** A phase with no seat-specific sentence states the fact and claims nothing. */
const NEUTRAL_FALLBACK: Record<string, StatusBand> = {
  DISPUTED: {
    bodyId: "app.commitment.band.disputed.b",
    tone: "attention",
  },
  CANCELLED: {
    bodyId: "app.commitment.band.any.cancelled.b",
    tone: "neutral",
  },
  EXPIRED: {
    bodyId: "app.commitment.band.any.expired.b",
    tone: "neutral",
  },
  FULFILLED: {
    bodyId: "app.commitment.band.any.fulfilled.b",
    tone: "kept",
  },
  RECONCILED: {
    bodyId: "app.commitment.band.any.fulfilled.b",
    tone: "kept",
  },
};

export function selectStatusBand(input: {
  commitment: Pick<CommitmentReadModel, "derivedState"> &
    Partial<Pick<CommitmentReadModel, "commitmentType">>;
  hasLinkedWork?: boolean;
  requiredWorkApproved?: boolean;
  seat: CommitmentSeat | null;
  /**
   * The one act this reader is offered. The provider's lapsed band promises
   * "you can offer it again", and that act belongs to whoever made the
   * commitment, not to whoever took up somebody else's request.
   */
  actKind?: CommitmentActKind | null;
}): StatusBand | null {
  const { commitment, seat } = input;
  const phase = commitment.derivedState;
  if (
    commitment.commitmentType === "DOMAIN_IMPACT" &&
    ["ACCEPTED", "ACTIVE", "PARTIALLY_APPROVED", "EVIDENCE_SUBMITTED"].includes(phase)
  ) {
    if (seat === "provider" || seat === "contributor") {
      return {
        bodyId: input.requiredWorkApproved
          ? "app.commitment.band.work.approved"
          : input.hasLinkedWork
            ? "app.commitment.band.work.linked"
            : "app.commitment.band.work.required",
        tone: input.hasLinkedWork || input.requiredWorkApproved ? "waiting" : "attention",
      };
    }
    if (seat === "confirmer")
      return { bodyId: "app.commitment.band.work.reviewer", tone: "waiting" };
  }
  const promisesAnActNotOffered =
    seat === "provider" && phase === "EXPIRED" && input.actKind !== "offerAgain";
  if (seat && !promisesAnActNotOffered) {
    const seated = BANDS[key(seat, phase)];
    if (seated) return seated;
  }
  return NEUTRAL_FALLBACK[phase] ?? null;
}
