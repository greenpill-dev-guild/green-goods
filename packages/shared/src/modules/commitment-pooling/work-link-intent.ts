import { isAddress, type Address } from "viem";

import type { DraftWorkLink } from "../../types/job-queue";
import type { WorkLinkJobPayload } from "./job-types";
import type { CommitmentReadModel } from "./types-core";

export interface WorkLinkIntent {
  commitmentId: bigint;
  requirementIndex: number;
  actionUID: number;
  garden: Address;
  commitmentTitle: string;
  requirementLabel: string;
  returnTo: string;
  /**
   * An Open ask the member takes up in the same tap that logs the work (decision 18). The page and
   * a draft keep it with the link, so a resumed draft can say so before the live asks are read;
   * it takes no part in the link's identity, and only the live asks decide that Submit takes it up.
   */
  takesUp?: true;
}

/** Read-only choice details; they do not participate in link identity or URL persistence. */
export interface WorkLinkChoice extends WorkLinkIntent {
  approvedCount?: number;
  requiredCount?: number;
  dueDate?: bigint | null;
  direction?: CommitmentReadModel["direction"];
}

/**
 * A promise the account can work on in a garden: the requirements it can link work to, and
 * whether it can add evidence, each by the promise's own act rules (`canLinkWork`, Add Proof).
 */
export interface WorkablePromise {
  commitmentId: bigint;
  title: string;
  direction: CommitmentReadModel["direction"];
  state: CommitmentReadModel["derivedState"];
  dueDate: bigint | null;
  /** What it promises, for a promise that counts no approvals. */
  targetUnits: bigint;
  unitLabel: string | null;
  /**
   * Its approvals against every requirement's count, each capped at its count as the contract
   * counts progress; null for a promise that counts no approvals.
   */
  progress: { approved: number; required: number } | null;
  /** One choice per requirement the account can link work to; none when it cannot link work. */
  choices: readonly WorkLinkChoice[];
  /** The account can add evidence to it: the promise offers them Add Proof. */
  takesEvidence: boolean;
}

/** One operation identity shared by admission, the wizard and queue recovery. */
export function dependentWorkLinkPayload(
  clientWorkId: string,
  target: Pick<WorkLinkIntent, "commitmentId" | "requirementIndex" | "garden">,
  sourceWorkJobId?: string
): Omit<Extract<WorkLinkJobPayload, { clientWorkId: string }>, "operationKey"> {
  return {
    clientOperationId: `work-link:${clientWorkId}:${target.commitmentId}:${target.requirementIndex}`,
    commitmentId: target.commitmentId,
    clientWorkId,
    ...(sourceWorkJobId ? { sourceWorkJobId } : {}),
    requirementIndex: target.requirementIndex,
    gardenAddress: target.garden,
  };
}

/** The same requirement of the same promise, for the same action in the same garden. */
export function sameWorkLinkIdentity(left: WorkLinkIntent, right: WorkLinkIntent): boolean {
  return (
    left.commitmentId === right.commitmentId &&
    left.requirementIndex === right.requirementIndex &&
    left.actionUID === right.actionUID &&
    left.garden.toLowerCase() === right.garden.toLowerCase()
  );
}

/** The link as a work draft keeps it. */
export function toDraftWorkLink(intent: WorkLinkIntent): DraftWorkLink {
  // A live choice may carry progress and dates; only the intent belongs in a draft.
  return {
    commitmentId: intent.commitmentId.toString(),
    requirementIndex: intent.requirementIndex,
    actionUID: intent.actionUID,
    garden: intent.garden,
    commitmentTitle: intent.commitmentTitle,
    requirementLabel: intent.requirementLabel,
    returnTo: intent.returnTo,
    ...(intent.takesUp ? { takesUp: true as const } : {}),
  };
}

/**
 * A draft's kept link, read back through the page's own parser so a stored
 * link gets no shortcut past it; null when it no longer reads as one.
 */
export function fromDraftWorkLink(link: DraftWorkLink): WorkLinkIntent | null {
  return parseWorkLinkIntent(
    new URLSearchParams({
      [PARAMS.commitmentId]: String(link.commitmentId),
      [PARAMS.requirementIndex]: String(link.requirementIndex),
      [PARAMS.actionUID]: String(link.actionUID),
      [PARAMS.garden]: String(link.garden),
      [PARAMS.commitmentTitle]: String(link.commitmentTitle),
      [PARAMS.requirementLabel]: String(link.requirementLabel),
      [PARAMS.returnTo]: String(link.returnTo),
      ...(link.takesUp ? { [PARAMS.takesUp]: TAKES_UP } : {}),
    })
  );
}

/** Extracts the route garden only from the canonical commitment detail route. */
export function workLinkReturnGarden(intent: WorkLinkIntent): Address | null {
  const match = intent.returnTo.match(/^\/home\/(0x[0-9a-fA-F]{40})\/commitments\/(\d+)$/);
  if (!match || BigInt(match[2]) !== intent.commitmentId || !isAddress(match[1])) return null;
  return match[1] as Address;
}

const PARAMS = {
  commitmentId: "linkCommitmentId",
  requirementIndex: "linkRequirementIndex",
  actionUID: "linkActionUID",
  garden: "linkGarden",
  commitmentTitle: "linkCommitmentTitle",
  requirementLabel: "linkRequirementLabel",
  returnTo: "returnTo",
  takesUp: "linkTakesUp",
} as const;
const TAKES_UP = "1";

export function hasWorkLinkIntentParams(params: URLSearchParams): boolean {
  return Object.values(PARAMS).some((key) => params.has(key));
}

/** Parses only a complete, same-app Work-link intent. Partial or unsafe input is ignored. */
export function parseWorkLinkIntent(params: URLSearchParams): WorkLinkIntent | null {
  try {
    const commitmentIdValue = params.get(PARAMS.commitmentId);
    const requirementIndexValue = params.get(PARAMS.requirementIndex);
    const actionUIDValue = params.get(PARAMS.actionUID);
    if (!commitmentIdValue || requirementIndexValue === null || actionUIDValue === null)
      return null;
    const commitmentId = BigInt(commitmentIdValue);
    const requirementIndex = Number(requirementIndexValue);
    const actionUID = Number(actionUIDValue);
    const garden = params.get(PARAMS.garden) ?? "";
    const commitmentTitle = params.get(PARAMS.commitmentTitle)?.trim() ?? "";
    const requirementLabel = params.get(PARAMS.requirementLabel)?.trim() ?? "";
    const returnTo = params.get(PARAMS.returnTo) ?? "";
    if (
      commitmentId <= 0n ||
      !Number.isSafeInteger(requirementIndex) ||
      requirementIndex < 0 ||
      !Number.isSafeInteger(actionUID) ||
      actionUID < 0 ||
      !isAddress(garden) ||
      !commitmentTitle ||
      !requirementLabel ||
      !returnTo.startsWith("/") ||
      returnTo.startsWith("//")
    )
      return null;
    return {
      commitmentId,
      requirementIndex,
      actionUID,
      garden,
      commitmentTitle,
      requirementLabel,
      returnTo,
      ...(params.get(PARAMS.takesUp) === TAKES_UP ? { takesUp: true as const } : {}),
    };
  } catch {
    return null;
  }
}

export function writeWorkLinkIntent(params: URLSearchParams, intent: WorkLinkIntent | null) {
  const next = new URLSearchParams(params);
  for (const key of Object.values(PARAMS)) next.delete(key);
  if (!intent) return next;
  next.set(PARAMS.commitmentId, intent.commitmentId.toString());
  next.set(PARAMS.requirementIndex, String(intent.requirementIndex));
  next.set(PARAMS.actionUID, String(intent.actionUID));
  next.set(PARAMS.garden, intent.garden);
  next.set(PARAMS.commitmentTitle, intent.commitmentTitle);
  next.set(PARAMS.requirementLabel, intent.requirementLabel);
  next.set(PARAMS.returnTo, intent.returnTo);
  if (intent.takesUp) next.set(PARAMS.takesUp, TAKES_UP);
  return next;
}
