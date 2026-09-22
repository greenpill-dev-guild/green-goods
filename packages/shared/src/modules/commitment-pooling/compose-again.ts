/**
 * Composing a commitment again from one already made.
 *
 * The answers travel; the record does not. Who took it up, what was proved,
 * confirmed or paid, and every identity the chain gave it belong to the old
 * commitment alone. Its dates are left out too: a due date and a season are
 * chosen fresh, against the pool as it stands now.
 *
 * A composer is never handed an answer it cannot show. The member's composer has
 * no fields for a named confirmer group, a declared payment, a gated offer or a
 * season commitment (uiux-spec §6.3 keeps those to the steward's seeding wizard),
 * so copying a steward's into it would have a member promise money, or hand
 * confirmation to other people, without ever seeing either.
 *
 * @module modules/commitment-pooling/compose-again
 */

import type { CommitmentComposerValues } from "../../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../../types/domain";
import { isSameAccount } from "./selectors";
import type { CommitmentMetadataV1 } from "./metadata";
import type { CommitmentReadModel, CommitmentRequirementRecord } from "./types";

/** Which composer will show the result: the member's, or the steward's seeding wizard. */
export type ComposeAgainComposer = "member" | "steward";

export interface ComposeAgainInput {
  composer: ComposeAgainComposer;
  commitment: Pick<
    CommitmentReadModel,
    | "direction"
    | "commitmentType"
    | "unitLabel"
    | "targetUnits"
    | "claimMode"
    | "contributorPolicy"
    | "protocolFallbackEnabled"
    | "confirmers"
    | "confirmationThreshold"
    | "considerationRail"
    | "considerationSource"
    | "considerationToken"
    | "considerationAmount"
  >;
  /** The commitment's own words, or null when the document could not be read. */
  metadata: CommitmentMetadataV1 | null;
  /**
   * Who will make the new commitment. They are never copied into its own
   * confirmer group: the contract drops the provider from that group when the
   * commitment is taken up, and refuses it outright when too few are left.
   */
  creator?: Address | null;
  /**
   * The action UIDs a new commitment may still be kept by. Work is refused
   * outside an action's window, so a row naming a closed one could never be
   * met. Undefined copies every row, for a caller that has no catalog to check.
   */
  usableActionUIDs?: ReadonlySet<string>;
  requirements: readonly Pick<
    CommitmentRequirementRecord,
    "requirementIndex" | "actionUID" | "requiredCount"
  >[];
}

type ComposerKind = CommitmentComposerValues["kind"];

function composerKind(input: ComposeAgainInput): ComposerKind {
  const { commitmentType } = input.commitment;
  if (commitmentType === "DOMAIN_IMPACT") return "GARDEN_WORK";
  // A season or campaign commitment is the pool's own, seeded by a steward. The
  // nearest thing a member can make is a service, which is kept by proof as well.
  if (commitmentType === "SEASON_CAMPAIGN" && input.composer === "steward") {
    return "SEASON_CAMPAIGN";
  }
  return "SERVICE";
}

/** The steward's extras: a named confirmer group, and one consideration rail. */
function stewardExtras(input: ComposeAgainInput): Partial<CommitmentComposerValues> {
  const { commitment } = input;
  const extras: Partial<CommitmentComposerValues> = {};
  // Whoever makes this commitment cannot also confirm it, so copying them into
  // the group would leave a threshold the contract can never reach.
  const creator = input.creator;
  const named = creator
    ? commitment.confirmers.filter((confirmer) => !isSameAccount(confirmer, creator))
    : [...commitment.confirmers];
  if (named.length > 0) {
    extras.confirmers = [...named];
    extras.confirmationThreshold = Math.min(commitment.confirmationThreshold ?? 1, named.length);
  }

  const rail = commitment.considerationRail;
  const amount = commitment.considerationAmount;
  if ((rail === "ARBITRUM_EXTERNAL" || rail === "CELO_SETTLEMENT") && amount) {
    extras.considerationRail = rail;
    extras.considerationAmount = amount.toString();
    // A Celo settlement stores zero-address sentinels and the module supplies the
    // real Safe and token, so only an external rail carries its own.
    if (rail === "ARBITRUM_EXTERNAL") {
      if (commitment.considerationSource)
        extras.considerationSource = commitment.considerationSource;
      if (commitment.considerationToken) extras.considerationToken = commitment.considerationToken;
    }
  }
  return extras;
}

/**
 * The composer answers a commitment was made with, for a composer to start from.
 *
 * Partial on purpose: whatever is missing keeps the composer's own default, so a
 * record the indexer has only half seen still opens a usable form.
 */
export function composerValuesFromCommitment(
  input: ComposeAgainInput
): Partial<CommitmentComposerValues> {
  const { commitment, metadata, composer } = input;
  const kind = composerKind(input);
  const isRequest = commitment.direction === "REQUEST";
  const values: Partial<CommitmentComposerValues> = {
    direction: isRequest ? "REQUEST" : "OFFER",
    kind,
    // Only an asker chooses who may take it up; an offer is gated only when a
    // steward seeds it, which is how the payload builder reads the same field.
    claimMode:
      commitment.claimMode === "APPROVAL_GATED" && (isRequest || composer === "steward")
        ? "APPROVAL_GATED"
        : "OPEN",
    openTeam: commitment.contributorPolicy !== "LEAD_MANAGED",
  };

  if (metadata) {
    values.title = metadata.title;
    if (metadata.note) values.note = metadata.note;
    values.links = (metadata.links ?? []).map((link) => link.url);
  }
  if (commitment.unitLabel) values.unitLabel = commitment.unitLabel;
  if (commitment.targetUnits > 0n && commitment.targetUnits <= BigInt(Number.MAX_SAFE_INTEGER)) {
    values.targetUnits = Number(commitment.targetUnits);
  }
  if (typeof commitment.protocolFallbackEnabled === "boolean") {
    values.protocolFallbackEnabled = commitment.protocolFallbackEnabled;
  }
  if (kind === "GARDEN_WORK") {
    values.requirements = [...input.requirements]
      .sort((left, right) => left.requirementIndex - right.requirementIndex)
      .map((row) => ({ actionUID: row.actionUID.toString(), requiredCount: row.requiredCount }))
      .filter((row) => input.usableActionUIDs?.has(row.actionUID) ?? true);
  }

  return composer === "steward" ? { ...values, ...stewardExtras(input) } : values;
}
