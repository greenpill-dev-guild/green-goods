import { type NormalizeWorkMediaOptions, normalizeWorkMediaFiles } from "./media-processing";
import { isGardenHiddenEverywhere } from "../../config/garden-visibility";
import type { WorkablePromise } from "../commitment-pooling/work-link-intent";
import { WorkTab } from "../../stores/workFlowTypes";
import type { Action, Domain } from "../../types/domain";
import { parseActionUID } from "../../utils/action/parsers";
import { compareAddresses } from "../../utils/blockchain/address";
import { expandDomainMask, hasDomain } from "../../utils/domain";

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

/**
 * The garden's actions the Start step offers (DL-131): live now, with an id the flow can keep,
 * and in one of the garden's domains. A garden with no domains set takes every live action, and
 * an action whose domain this client does not know is offered too, never filed under a known one.
 */
export function listGardenActions(
  actions: readonly Action[],
  garden: { domainMask?: number } | null,
  now: number
): Action[] {
  const mask = garden?.domainMask;
  return actions.filter(
    (action) =>
      now >= action.startTime &&
      now <= action.endTime &&
      parseActionUID(action.id) !== null &&
      (action.domain === null || !mask || hasDomain(mask, action.domain))
  );
}

/** The domains the Start step's chips filter by: the garden's own, else its actions' domains. */
export function gardenActionDomains(
  garden: { domainMask?: number } | null,
  actions: readonly Pick<Action, "domain">[]
): Domain[] {
  if (garden?.domainMask) return expandDomainMask(garden.domainMask);
  const own = new Set(
    actions.map((action) => action.domain).filter((domain): domain is Domain => domain !== null)
  );
  return Array.from(own).sort((a, b) => a - b);
}

/** What a promise picked at Start leads to: its actions, its evidence, or a choice of both. */
export type StartPromiseKind = "actions" | "evidence" | "both";

export function startPromiseKind(
  promise: Pick<WorkablePromise, "choices" | "takesEvidence">
): StartPromiseKind | null {
  if (promise.choices.length > 0) return promise.takesEvidence ? "both" : "actions";
  return promise.takesEvidence ? "evidence" : null;
}

/**
 * The promises the Start step lists, each with one choice per action the garden offers: a
 * requirement still short of its count, since a met one is done (its promise's page can still
 * link more work to it). Evidence is offered only where none already waits to send on this phone,
 * or the queue cannot be read (`evidencePending`): a second proof would duplicate the first. A
 * promise left with nothing the member can do here drops.
 */
export function listStartPromises(
  promises: readonly WorkablePromise[],
  offeredActionUIDs: ReadonlySet<number>,
  evidencePending: (commitmentId: bigint) => boolean
): WorkablePromise[] {
  return promises.flatMap((promise) => {
    const byAction = new Map<number, WorkablePromise["choices"][number]>();
    for (const choice of promise.choices) {
      const open = (choice.approvedCount ?? 0) < (choice.requiredCount ?? 0);
      if (open && offeredActionUIDs.has(choice.actionUID) && !byAction.has(choice.actionUID))
        byAction.set(choice.actionUID, choice);
    }
    const listed = {
      ...promise,
      choices: Array.from(byAction.values()),
      takesEvidence: promise.takesEvidence && !evidencePending(promise.commitmentId),
    };
    return startPromiseKind(listed) ? [listed] : [];
  });
}

/** Where a work's promise link stands: the controller's reading of the page's link. */
export type WorkLinkStatus = "none" | "validating" | "valid" | "invalid" | "unavailable";

/** The member's promises in the flow's garden, as far as the read can say. */
export type StartPromisesRead =
  | { status: "loading" }
  | { status: "unknown" }
  | { status: "ready"; count: number };

/** What the Start step does: wait for an answer, skip to Media, or stay for the member. */
export type StartStepAnswer =
  | { kind: "wait" }
  | { kind: "skip"; actionUID: number | null }
  | { kind: "stay" };

/**
 * Whether the Start step has anything to ask (DL-131, decision 17). It is skipped when the answer
 * is known: a promise link the page was opened with, once confirmed (the link names the action),
 * or a garden with one action, nothing owed and no Open ask listed (the flow picks that action).
 * An Open ask listed is a choice to make, so the step stays. A link chosen at Start, or one that
 * no longer holds, never skips it, and promises that could not be read are never taken as none.
 * Work that already holds another action stays too: the flow never replaces the member's choice.
 */
export function answerStartStep(input: {
  link: { status: WorkLinkStatus; atEntry: boolean };
  /** The flow's garden is one the member can submit work to (`isSubmissionGardenSettled`). */
  gardenSettled: boolean;
  promises: StartPromisesRead;
  /** The garden's Open asks the step lists beside the member's promises. */
  openAsks: number;
  /** The actions the garden offers (`listGardenActions`), by UID; null while they are read. */
  actionUIDs: readonly number[] | null;
  /** The action the work already holds, chosen or from a draft; the flow's own pick is none. */
  heldActionUID: number | null;
}): StartStepAnswer {
  const { link, promises } = input;
  if (!input.gardenSettled) return { kind: "stay" };
  if (link.status !== "none") {
    if (link.status === "validating") return link.atEntry ? { kind: "wait" } : { kind: "stay" };
    return link.status === "valid" && link.atEntry
      ? { kind: "skip", actionUID: null }
      : { kind: "stay" };
  }
  if (promises.status === "loading" || input.actionUIDs === null) return { kind: "wait" };
  if (promises.status === "unknown" || promises.count > 0 || input.openAsks > 0)
    return { kind: "stay" };
  const [only] = input.actionUIDs;
  return input.actionUIDs.length === 1 &&
    (input.heldActionUID === null || input.heldActionUID === only)
    ? { kind: "skip", actionUID: only }
    : { kind: "stay" };
}

export function adjacentWorkSubmissionTab(tab: WorkTab, direction: "next" | "previous") {
  const index = WORK_SUBMISSION_TAB_ORDER.indexOf(tab);
  const nextIndex = direction === "next" ? index + 1 : index - 1;
  return WORK_SUBMISSION_TAB_ORDER[nextIndex] ?? tab;
}

export async function prepareWorkSubmission(files: File[], options?: NormalizeWorkMediaOptions) {
  return normalizeWorkMediaFiles(files, options);
}
