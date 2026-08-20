import type {
  CommitmentDerivedState,
  CommitmentReadModel,
  CommitmentSeat,
} from "@green-goods/shared";

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
  titleId: string;
  bodyId: string;
  tone: BandTone;
}

const key = (seat: CommitmentSeat, phase: CommitmentDerivedState) => `${seat}:${phase}`;

const BANDS: Record<string, StatusBand> = {
  // The provider's own arc.
  "provider:OFFERED": {
    titleId: "app.commitment.band.provider.offered.t",
    bodyId: "app.commitment.band.provider.offered.b",
    tone: "waiting",
  },
  "provider:ACCEPTED": {
    titleId: "app.commitment.band.provider.accepted.t",
    bodyId: "app.commitment.band.provider.accepted.b",
    tone: "attention",
  },
  "provider:ACTIVE": {
    titleId: "app.commitment.band.provider.active.t",
    bodyId: "app.commitment.band.provider.active.b",
    tone: "attention",
  },
  "provider:PARTIALLY_APPROVED": {
    titleId: "app.commitment.band.provider.partial.t",
    bodyId: "app.commitment.band.provider.partial.b",
    tone: "attention",
  },
  "provider:EVIDENCE_SUBMITTED": {
    titleId: "app.commitment.band.provider.evidence.t",
    bodyId: "app.commitment.band.provider.evidence.b",
    tone: "attention",
  },
  // The costliest one to get wrong: their part is done and they cannot confirm it.
  "provider:READY_FOR_CONFIRMATION": {
    titleId: "app.commitment.band.provider.ready.t",
    bodyId: "app.commitment.band.provider.ready.b",
    tone: "waiting",
  },
  "provider:FULFILLED": {
    titleId: "app.commitment.band.provider.fulfilled.t",
    bodyId: "app.commitment.band.provider.fulfilled.b",
    tone: "kept",
  },
  "provider:RECONCILED": {
    titleId: "app.commitment.band.provider.reconciled.t",
    bodyId: "app.commitment.band.provider.reconciled.b",
    tone: "kept",
  },
  "provider:EXPIRED": {
    titleId: "app.commitment.band.provider.expired.t",
    bodyId: "app.commitment.band.provider.expired.b",
    tone: "neutral",
  },
  "provider:CANCELLED": {
    titleId: "app.commitment.band.provider.cancelled.t",
    bodyId: "app.commitment.band.provider.cancelled.b",
    tone: "neutral",
  },
  "provider:DISPUTED": {
    titleId: "app.commitment.band.disputed.t",
    bodyId: "app.commitment.band.disputed.b",
    tone: "attention",
  },

  // The confirmer waits, then decides, then has decided.
  "confirmer:REQUESTED": {
    titleId: "app.commitment.band.confirmer.requested.t",
    bodyId: "app.commitment.band.confirmer.requested.b",
    tone: "waiting",
  },
  "confirmer:ACCEPTED": {
    titleId: "app.commitment.band.confirmer.accepted.t",
    bodyId: "app.commitment.band.confirmer.accepted.b",
    tone: "waiting",
  },
  "confirmer:ACTIVE": {
    titleId: "app.commitment.band.confirmer.active.t",
    bodyId: "app.commitment.band.confirmer.active.b",
    tone: "waiting",
  },
  "confirmer:PARTIALLY_APPROVED": {
    titleId: "app.commitment.band.confirmer.active.t",
    bodyId: "app.commitment.band.confirmer.active.b",
    tone: "waiting",
  },
  "confirmer:EVIDENCE_SUBMITTED": {
    titleId: "app.commitment.band.confirmer.active.t",
    bodyId: "app.commitment.band.confirmer.active.b",
    tone: "waiting",
  },
  "confirmer:READY_FOR_CONFIRMATION": {
    titleId: "app.commitment.band.confirmer.ready.t",
    bodyId: "app.commitment.band.confirmer.ready.b",
    tone: "attention",
  },
  // Never "you did the work": they said it was kept, which is a different act.
  "confirmer:FULFILLED": {
    titleId: "app.commitment.band.confirmer.fulfilled.t",
    bodyId: "app.commitment.band.confirmer.fulfilled.b",
    tone: "kept",
  },
  "confirmer:RECONCILED": {
    titleId: "app.commitment.band.confirmer.fulfilled.t",
    bodyId: "app.commitment.band.confirmer.fulfilled.b",
    tone: "kept",
  },
  "confirmer:CANCELLED": {
    titleId: "app.commitment.band.confirmer.cancelled.t",
    bodyId: "app.commitment.band.confirmer.cancelled.b",
    tone: "neutral",
  },
  "confirmer:DISPUTED": {
    titleId: "app.commitment.band.disputed.t",
    bodyId: "app.commitment.band.disputed.b",
    tone: "attention",
  },

  // On the team, not leading it, and never confirming it.
  "contributor:ACTIVE": {
    titleId: "app.commitment.band.contributor.active.t",
    bodyId: "app.commitment.band.contributor.active.b",
    tone: "attention",
  },
  "contributor:PARTIALLY_APPROVED": {
    titleId: "app.commitment.band.contributor.active.t",
    bodyId: "app.commitment.band.contributor.active.b",
    tone: "attention",
  },
  "contributor:EVIDENCE_SUBMITTED": {
    titleId: "app.commitment.band.contributor.sent.t",
    bodyId: "app.commitment.band.contributor.sent.b",
    tone: "waiting",
  },
  "contributor:READY_FOR_CONFIRMATION": {
    titleId: "app.commitment.band.contributor.ready.t",
    bodyId: "app.commitment.band.contributor.ready.b",
    tone: "waiting",
  },
  "contributor:FULFILLED": {
    titleId: "app.commitment.band.contributor.fulfilled.t",
    bodyId: "app.commitment.band.contributor.fulfilled.b",
    tone: "kept",
  },

  // No relationship yet. What they read is an invitation or a plain report.
  "bystander:OFFERED": {
    titleId: "app.commitment.band.bystander.offered.t",
    bodyId: "app.commitment.band.bystander.offered.b",
    tone: "neutral",
  },
  "bystander:REQUESTED": {
    titleId: "app.commitment.band.bystander.requested.t",
    bodyId: "app.commitment.band.bystander.requested.b",
    tone: "neutral",
  },
  "bystander:ACCEPTED": {
    titleId: "app.commitment.band.bystander.taken.t",
    bodyId: "app.commitment.band.bystander.taken.b",
    tone: "neutral",
  },
  "bystander:ACTIVE": {
    titleId: "app.commitment.band.bystander.taken.t",
    bodyId: "app.commitment.band.bystander.taken.b",
    tone: "neutral",
  },
};

/** A phase with no seat-specific sentence states the fact and claims nothing. */
const NEUTRAL_FALLBACK: Record<string, StatusBand> = {
  DISPUTED: {
    titleId: "app.commitment.band.disputed.t",
    bodyId: "app.commitment.band.disputed.b",
    tone: "attention",
  },
  CANCELLED: {
    titleId: "app.commitment.band.any.cancelled.t",
    bodyId: "app.commitment.band.any.cancelled.b",
    tone: "neutral",
  },
  EXPIRED: {
    titleId: "app.commitment.band.any.expired.t",
    bodyId: "app.commitment.band.any.expired.b",
    tone: "neutral",
  },
  FULFILLED: {
    titleId: "app.commitment.band.any.fulfilled.t",
    bodyId: "app.commitment.band.any.fulfilled.b",
    tone: "kept",
  },
  RECONCILED: {
    titleId: "app.commitment.band.any.fulfilled.t",
    bodyId: "app.commitment.band.any.fulfilled.b",
    tone: "kept",
  },
};

export function selectStatusBand(input: {
  commitment: Pick<CommitmentReadModel, "derivedState">;
  seat: CommitmentSeat | null;
}): StatusBand | null {
  const { commitment, seat } = input;
  const phase = commitment.derivedState;
  if (seat) {
    const seated = BANDS[key(seat, phase)];
    if (seated) return seated;
  }
  return NEUTRAL_FALLBACK[phase] ?? null;
}
