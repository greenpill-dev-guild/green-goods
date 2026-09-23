/**
 * Settlement eligibility
 *
 * Whether a commitment can carry a G$ payout plan at all, and which shape the
 * settlement module will give it. Split from the workflow selectors so each
 * module stays within the source-structure ceiling.
 *
 * @module modules/commitment-pooling/settlement-eligibility
 */

import { isZeroAddress } from "../../utils/blockchain/address";
import type { CommitmentPoolingAvailability, CommitmentReadModel } from "./types-core";

export type SettlementPayoutKind = "GARDEN_BENEFICIARY" | "CONTRIBUTOR_CONSIDERATION";

/**
 * PlanLib.createCommitmentPayoutPlan derives the shape from the record and it
 * can never be edited: a Request a garden took up pays that garden's Safe;
 * every other combination pays the contributors.
 */
export function selectSettlementPayoutKind(
  commitment: Pick<CommitmentReadModel, "direction" | "counterpartyKind">
): SettlementPayoutKind {
  return commitment.direction === "REQUEST" && commitment.counterpartyKind === "GARDEN"
    ? "GARDEN_BENEFICIARY"
    : "CONTRIBUTOR_CONSIDERATION";
}

export type SettlementEligibilityBlocker =
  | "pooling-unavailable"
  | "not-fulfilled"
  | "no-celo-consideration"
  | "payer-garden-unknown";

export interface SettlementEligibility {
  eligible: boolean;
  kind: SettlementPayoutKind | null;
  blockers: SettlementEligibilityBlocker[];
}

/**
 * Whether a commitment can carry a G$ payout plan at all: the capability
 * ledger must serve pooling here, the record must be Fulfilled, priced on the
 * Celo rail, and name the garden that pays (PlanLib.sol:150-163).
 */
export function selectSettlementEligibility(input: {
  commitment: Pick<
    CommitmentReadModel,
    | "onchainState"
    | "considerationRail"
    | "considerationAmount"
    | "payerGarden"
    | "direction"
    | "counterpartyKind"
    | "payoutPlanId"
  > | null;
  availability: CommitmentPoolingAvailability;
}): SettlementEligibility {
  const blockers: SettlementEligibilityBlocker[] = [];
  if (input.availability.status !== "available") blockers.push("pooling-unavailable");
  const commitment = input.commitment;
  if (!commitment) {
    return { eligible: false, kind: null, blockers: [...blockers, "not-fulfilled"] };
  }
  // A plan the module already recorded proves every creation gate passed, so an
  // index that trails the fork (amount or payer not yet mirrored) never hides a
  // payout that must be resumed.
  if (commitment.payoutPlanId && commitment.payoutPlanId !== 0n) {
    return {
      eligible: blockers.length === 0,
      kind: selectSettlementPayoutKind(commitment),
      blockers,
    };
  }
  if (commitment.onchainState !== "FULFILLED") blockers.push("not-fulfilled");
  if (
    commitment.considerationRail !== "CELO_SETTLEMENT" ||
    !commitment.considerationAmount ||
    commitment.considerationAmount <= 0n
  ) {
    blockers.push("no-celo-consideration");
  }
  if (!commitment.payerGarden || isZeroAddress(commitment.payerGarden)) {
    blockers.push("payer-garden-unknown");
  }
  return {
    eligible: blockers.length === 0,
    kind: selectSettlementPayoutKind(commitment),
    blockers,
  };
}
