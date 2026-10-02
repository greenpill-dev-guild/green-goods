/**
 * Adding copies to a group
 *
 * Seed More Like This can add to a group instead of starting a new one
 * (PRD-1022 D4). The new copies take the group's terms, its deadline and its
 * current G$ amount, and the steward chooses only how many. The terms are read
 * from one copy already on chain, so nothing is typed again; and the copies
 * reuse the group's metadata document by its CID, so they carry its display
 * group and its reward record unchanged and nothing is published twice.
 * Adding is allowed only while the deadline is ahead (`mintGroupAddition`).
 *
 * The chain names whoever sends a creation as its creator, and the grouping
 * key includes the creator, so only the steward who created the group can add
 * to it and keep it one row. Anyone else starts a new group instead.
 *
 * @module modules/commitment-pooling/group-additions
 */

import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { CommitmentCreationPayload, DeclaredConsiderationInput } from "./job-types";
import type { CommitmentMetadataV1 } from "./metadata";

/** The creation terms of one copy, as `getCommitment` returns them. */
export interface GroupTemplateTerms {
  poolId: bigint;
  cycleId: bigint;
  commitmentSeriesId: bigint;
  creator: Address;
  direction: number;
  commitmentType: number;
  claimType: number;
  claimMode: number;
  contributorPolicy: number;
  requirements: readonly { actionUID: bigint; requiredCount: number }[];
  dueDate: bigint;
  unitLabel: string;
  targetUnits: bigint;
  confirmationThreshold: number;
  protocolFallbackEnabled: boolean;
  requiresAssessment: boolean;
  needUID: Hex;
  counterCommitmentId: bigint;
  metadataCID: string;
  consideration: DeclaredConsiderationInput;
  declaredUnitValue: bigint;
  declaredValueBasis: string;
}

export interface GroupTemplate {
  terms: GroupTemplateTerms;
  /** The named confirmer group, as `getConfirmers` returns it. */
  confirmers: readonly Address[];
}

/** A read of the pooling module: `getCommitment` or `getConfirmers`, for one commitment. */
export type GroupTemplateRead = (
  functionName: "getCommitment" | "getConfirmers",
  commitmentId: bigint
) => Promise<unknown>;

/** Read one copy's creation terms and confirmers from the chain. */
export async function readGroupTemplate(
  read: GroupTemplateRead,
  commitmentId: bigint
): Promise<GroupTemplate> {
  const [terms, confirmers] = await Promise.all([
    read("getCommitment", commitmentId),
    read("getConfirmers", commitmentId),
  ]);
  return {
    terms: terms as GroupTemplateTerms,
    confirmers: confirmers as readonly Address[],
  };
}

/** Whether this steward may add to the group and keep it one row: they created it. */
export function canAddToGroup(template: GroupTemplate, steward: Address | null): boolean {
  return steward !== null && template.terms.creator.toLowerCase() === steward.toLowerCase();
}

/**
 * One new copy of the group: the template's terms, deadline and reward, a new
 * creation id, and the group's metadata by its CID. `metadata` is the parsed
 * document behind that CID, carried for the pending row's title only.
 */
export function groupAdditionPayload(input: {
  template: GroupTemplate;
  metadata: CommitmentMetadataV1;
  clientCommitmentId: string;
  gardenAddress: Address;
}): Omit<CommitmentCreationPayload, "creationRequestKey"> {
  const { terms, confirmers } = input.template;
  if (!input.metadata.displayGroup) {
    throw new Error("Only a copy of a group can be added to");
  }
  return {
    clientCommitmentId: input.clientCommitmentId,
    poolId: terms.poolId,
    cycleId: terms.cycleId,
    commitmentSeriesId: terms.commitmentSeriesId,
    direction: terms.direction,
    commitmentType: terms.commitmentType,
    claimType: terms.claimType,
    claimMode: terms.claimMode,
    contributorPolicy: terms.contributorPolicy,
    // Seeding is direct creation; the contract derives the domains itself.
    onBehalfOf: "0x0000000000000000000000000000000000000000" as Address,
    domainTags: [],
    requirements: terms.requirements.map(({ actionUID, requiredCount }) => ({
      actionUID,
      requiredCount,
    })),
    unitLabel: terms.unitLabel,
    targetUnits: terms.targetUnits,
    requiresAssessment: terms.requiresAssessment,
    dueDate: terms.dueDate,
    metadataCID: terms.metadataCID,
    metadata: input.metadata,
    needUID: terms.needUID,
    counterCommitmentId: terms.counterCommitmentId,
    confirmers: [...confirmers],
    confirmationThreshold: terms.confirmationThreshold,
    protocolFallbackEnabled: terms.protocolFallbackEnabled,
    consideration: { ...terms.consideration },
    declaredUnitValue: terms.declaredUnitValue,
    declaredValueBasis: terms.declaredValueBasis,
    gardenAddress: input.gardenAddress,
  };
}
