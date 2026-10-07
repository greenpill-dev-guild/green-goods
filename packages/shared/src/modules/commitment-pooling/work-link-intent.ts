import { isAddress, type Address } from "viem";

import type { DraftWorkLink } from "../../types/job-queue";
import type { WorkLinkJobPayload } from "./job-types";

export interface WorkLinkIntent {
  commitmentId: bigint;
  requirementIndex: number;
  actionUID: number;
  garden: Address;
  commitmentTitle: string;
  requirementLabel: string;
  returnTo: string;
}

export type WorkLinkChoice = WorkLinkIntent;

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
  return { ...intent, commitmentId: intent.commitmentId.toString() };
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
} as const;

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
  return next;
}
