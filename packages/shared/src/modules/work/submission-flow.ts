import { type NormalizeWorkMediaOptions, normalizeWorkMediaFiles } from "./media-processing";
import { isGardenHiddenEverywhere } from "../../config/garden-visibility";
import { WorkTab } from "../../stores/workFlowTypes";
import type { Domain } from "../../types/domain";
import { compareAddresses } from "../../utils/blockchain/address";
import { hasDomain } from "../../utils/domain";

const WORK_SUBMISSION_TAB_ORDER = [
  WorkTab.Intro,
  WorkTab.Media,
  WorkTab.Details,
  WorkTab.Review,
] as const;

export interface WorkSubmissionProgress {
  tab: WorkTab;
  gardenAddress: string | null;
  /** The garden can take the chosen action (`isSubmissionGardenSettled`). */
  gardenSettled: boolean;
  actionUID: number | null;
  imageCount: number;
  minRequired: number;
  isValid: boolean;
  isSubmitting: boolean;
  isMutationPending: boolean;
  bypassMediaRequirement?: boolean;
}

/**
 * How many times one submission asks the member to sign, said before the first prompt (decision
 * 18; a write that needs several signatures says how many up front): the work, its link when it
 * is for a promise, and the take-up first when the same tap takes that promise up.
 */
export function submissionPromptCount(input: { linksPromise: boolean; takesUp: boolean }): number {
  return 1 + (input.linksPromise ? 1 : 0) + (input.linksPromise && input.takesUp ? 1 : 0);
}

export function canProceedWithWorkSubmission(progress: WorkSubmissionProgress): boolean {
  switch (progress.tab) {
    case WorkTab.Intro:
      // A garden hidden everywhere is not in the picker, so it is not a choice to proceed with;
      // nor is one the member cannot submit work to or that does not take the action, which
      // reopens the picker for a garden that can.
      return Boolean(
        progress.gardenAddress &&
          progress.gardenSettled &&
          !isGardenHiddenEverywhere(progress.gardenAddress) &&
          typeof progress.actionUID === "number"
      );
    case WorkTab.Media:
      return Boolean(
        progress.bypassMediaRequirement || progress.imageCount >= progress.minRequired
      );
    case WorkTab.Details:
      return progress.isValid;
    case WorkTab.Review:
      return progress.isValid && !progress.isSubmitting && !progress.isMutationPending;
  }
}

/**
 * What can name the garden a submission goes to (PWA Home decision 28). A promise link wins, then
 * a resumed draft, then a garden passed in navigation state, and the active garden comes last.
 */
export interface SubmissionGardenSources {
  /** The flow's garden now. */
  current: string | null;
  /** The page names a promise: its garden once the link is confirmed, null while it is checked. */
  promise: { garden: string | null } | null;
  /** The work has a draft, resumed or saved during this visit, and `current` is its garden. */
  hasDraft: boolean;
  /** A garden passed in navigation state. */
  navigation: string | null;
  /** The active garden, when the account can submit work to it. */
  active: string | null;
}

/**
 * The garden the flow should hold. It never clears a garden, and the active garden never moves
 * work that has a garden of its own: drafts, queued jobs and promise links keep theirs.
 */
export function resolveSubmissionGarden({
  current,
  promise,
  hasDraft,
  navigation,
  active,
}: SubmissionGardenSources): string | null {
  // A promise names its own garden, and while its link is checked nothing takes its place.
  if (promise) return promise.garden ?? current;
  // A draft keeps the garden it was saved with. One without a garden, such as a draft whose garden
  // was curated away, waits for the member to choose one: no source picks it for them.
  if (hasDraft) return current;
  // Until the work has a draft, its garden follows the sources rather than an earlier visit's.
  return navigation ?? active ?? current;
}

/**
 * Whether the Start step can leave the garden question out: the flow's garden is one the member
 * can submit work to, and it takes the chosen action. A garden with no domains set takes every
 * action, as does an action whose domain this client does not know.
 */
export function isSubmissionGardenSettled({
  gardenAddress,
  gardens,
  action,
}: {
  gardenAddress: string | null;
  /** The gardens the member can submit work to. */
  gardens: readonly { id: string; domainMask?: number }[];
  action: { domain?: Domain | null } | null;
}): boolean {
  const garden = gardens.find((candidate) => compareAddresses(candidate.id, gardenAddress));
  if (!garden) return false;
  if (action?.domain === null || action?.domain === undefined || !garden.domainMask) return true;
  return hasDomain(garden.domainMask, action.domain);
}

export function adjacentWorkSubmissionTab(tab: WorkTab, direction: "next" | "previous") {
  const index = WORK_SUBMISSION_TAB_ORDER.indexOf(tab);
  const nextIndex = direction === "next" ? index + 1 : index - 1;
  return WORK_SUBMISSION_TAB_ORDER[nextIndex] ?? tab;
}

export async function prepareWorkSubmission(files: File[], options?: NormalizeWorkMediaOptions) {
  return normalizeWorkMediaFiles(files, options);
}
