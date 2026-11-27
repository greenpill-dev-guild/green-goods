import {
  type CommitmentReadModel,
  writeWorkLinkIntent,
} from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Address } from "@green-goods/shared/types/domain";

export function parseCommitmentId(value: string | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/** Only the notification summary for this exact route can supply the offline preview. */
export function savedCommitmentForRoute(
  state: unknown,
  gardenAddress: string | undefined,
  commitmentId: bigint | null
): CommitmentReadModel | null {
  if (!state || typeof state !== "object") return null;
  const notification = state as { commitment?: CommitmentReadModel; commitmentGarden?: unknown };
  const saved = notification.commitment;
  return saved?.chainId === DEFAULT_CHAIN_ID &&
    saved.commitmentId === commitmentId &&
    typeof notification.commitmentGarden === "string" &&
    notification.commitmentGarden.toLowerCase() === gardenAddress?.toLowerCase()
    ? saved
    : null;
}

/**
 * Upload Work for one of a promise's required actions, carrying the way back to the promise; null
 * when the page can't name the promise's garden, the work's garden or the action.
 */
export function workSubmissionPath(input: {
  routeGarden: string | null | undefined;
  workGarden: Address | null | undefined;
  commitmentId: bigint;
  title: string;
  requirementIndex: number;
  actionUID: number | bigint;
}): string | null {
  const actionUID = Number(input.actionUID);
  if (!input.routeGarden || !input.workGarden || !Number.isSafeInteger(actionUID)) return null;
  const params = writeWorkLinkIntent(new URLSearchParams(), {
    commitmentId: input.commitmentId,
    requirementIndex: input.requirementIndex,
    actionUID,
    garden: input.workGarden,
    commitmentTitle: input.title,
    requirementLabel: String(input.requirementIndex + 1),
    returnTo: `/home/${input.routeGarden}/commitments/${input.commitmentId.toString()}`,
  });
  return `/home/garden?${params.toString()}`;
}
