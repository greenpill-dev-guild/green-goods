import { isAddress, type Address } from "viem";

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
