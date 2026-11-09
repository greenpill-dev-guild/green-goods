import type { CommitmentReadModel } from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";

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
