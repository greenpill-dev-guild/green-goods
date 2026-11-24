import {
  type CommitmentReadModel,
  isCapturedCommitment,
} from "@green-goods/shared/commitment-pooling";

export type ConfirmCast = "offer" | "support" | "request" | "request-work" | "captured";

/**
 * What kind of commitment is being confirmed. Derivable from the record alone.
 * A request that is not garden work may ask for help ("a ride to the clinic")
 * or ask someone to do something ("complete the climate course"), and the
 * record can't tell which, so its words are the promise's own: kept or not yet.
 */
export function selectConfirmCast(commitment: CommitmentReadModel): ConfirmCast {
  if (isCapturedCommitment(commitment)) return "captured";
  if (commitment.direction === "REQUEST") {
    return commitment.commitmentType === "DOMAIN_IMPACT" ? "request-work" : "request";
  }
  return commitment.commitmentType === "SUPPORT_SERVICE" ? "support" : "offer";
}

/** The reasons each cast is most likely to give for Not yet, as chip ids. */
export const REASON_CHIPS: Record<ConfirmCast, string[]> = {
  offer: ["notFinished", "cantCheck", "looksOff"],
  support: ["notFinished", "anotherPass", "looksOff"],
  request: ["hasntHappened", "notFinished", "looksOff"],
  "request-work": ["notFinished", "cantCheck", "looksOff"],
  captured: ["hasntHappened", "cantCheck", "looksOff"],
};
