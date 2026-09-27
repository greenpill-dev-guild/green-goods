/**
 * The declared reward's units. The contract records the amount in the token's
 * base units; stewards read and type it in the token's own units. Every
 * conversion between the two lives here, so the field, the review, and the
 * Seed button agree on what a typed amount means.
 */

import { CELO_G_DOLLAR_TOKEN } from "@green-goods/shared/config/tokens";
import type { Erc20MetadataRead } from "@green-goods/shared/hooks/blockchain/useErc20Metadata";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import {
  formatTokenAmount,
  normalizeDecimalInput,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import { formatUnits, parseUnits } from "viem";

/** The units a declared reward is entered in, or why they are not known yet. */
export type RewardUnits =
  | { status: "none" }
  | { status: "ready"; decimals: number; symbol: string | null }
  | { status: "waiting"; reason: "noToken" | "loading" | "unreadable" };

/**
 * The units for the chosen rail. Celo settlement is always G$. An external
 * payout is in whatever token it names, known only once the token answers;
 * until then the amount waits rather than guessing 18 decimals.
 */
export function rewardUnitsFor(
  rail: CommitmentComposerValues["considerationRail"],
  externalToken: Erc20MetadataRead
): RewardUnits {
  if (rail === "CELO_SETTLEMENT") {
    return {
      status: "ready",
      decimals: CELO_G_DOLLAR_TOKEN.decimals,
      symbol: CELO_G_DOLLAR_TOKEN.symbol,
    };
  }
  if (rail !== "ARBITRUM_EXTERNAL") return { status: "none" };
  switch (externalToken.status) {
    case "idle":
      return { status: "waiting", reason: "noToken" };
    case "loading":
      return { status: "waiting", reason: "loading" };
    case "unreadable":
      return { status: "waiting", reason: "unreadable" };
    case "ready":
      return { status: "ready", ...externalToken.metadata };
  }
}

/** A row may be parked or sent only when its reward has known token units. */
export function seedRowRewardReady(
  values: Pick<CommitmentComposerValues, "considerationRail" | "considerationToken">,
  externalTokens: ReadonlyMap<string, Erc20MetadataRead>
): boolean {
  const token = externalTokens.get(values.considerationToken.trim().toLowerCase()) ?? {
    status: "idle" as const,
  };
  return rewardUnitsFor(values.considerationRail, token).status !== "waiting";
}

/** What the steward typed, as the base units the form stores; an i18n id when it cannot be. */
export function rewardAmountToBaseUnits(
  text: string,
  decimals: number
): { baseUnits: string; errorId: string | null } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { baseUnits: "", errorId: null };
  const errorId = validateDecimalInput(trimmed, decimals);
  if (errorId) return { baseUnits: "", errorId };
  try {
    return {
      baseUnits: parseUnits(normalizeDecimalInput(trimmed), decimals).toString(),
      errorId: null,
    };
  } catch {
    return { baseUnits: "", errorId: "app.treasury.invalidAmount" };
  }
}

/** A stored base-unit amount in the units the steward types; empty when there is none. */
export function rewardAmountFromBaseUnits(baseUnits: string, decimals: number): string {
  const trimmed = baseUnits.trim();
  return /^\d+$/.test(trimmed) ? formatUnits(BigInt(trimmed), decimals) : "";
}

/** A stored amount as the review shows it: token units and the token's symbol. */
export function formatRewardAmount(baseUnits: string, units: RewardUnits, locale: string): string {
  const trimmed = baseUnits.trim();
  if (units.status !== "ready" || !/^\d+$/.test(trimmed)) return "—";
  const amount = formatTokenAmount(BigInt(trimmed), units.decimals, units.decimals, locale);
  return units.symbol ? `${amount} ${units.symbol}` : amount;
}
