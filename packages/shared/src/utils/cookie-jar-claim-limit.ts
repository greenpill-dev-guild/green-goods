import { parseUnits } from "viem";
import type { CookieJar } from "../types/cookie-jar";
import { getVaultAssetSymbol } from "./blockchain/vaults";

/**
 * The per-claim limit a garden jar should carry, by asset. Every garden jar launched with one
 * asset-agnostic 0.01 default, which is sensible for WETH and one cent for DAI. Below `floor` a
 * limit reads as that misconfiguration rather than a steward's choice; `suggested` is what the
 * editor offers and what new jars get.
 *
 * The jar chip, the steward alert, the deposit warning and the gardener message all read this
 * one rule.
 */
const CLAIM_LIMIT_BY_ASSET: Record<string, { floor: string; suggested: string }> = {
  DAI: { floor: "4", suggested: "10" },
  WETH: { floor: "0.004", suggested: "0.01" },
};

/** `item` value that opens a jar's limit editor on Community → Payouts: prefix + jar address. */
export const JAR_LIMIT_ROUTE_ITEM_PREFIX = "jar-limit-";

type JarLimitInput = Pick<CookieJar, "assetAddress" | "decimals" | "maxWithdrawal">;

export interface JarClaimLimitGuidance {
  floor: bigint;
  suggested: bigint;
}

/** Null for an asset the rule has no opinion on. */
export function getJarClaimLimitGuidance(
  jar: Pick<JarLimitInput, "assetAddress" | "decimals">,
  chainId?: number
): JarClaimLimitGuidance | null {
  const guidance = CLAIM_LIMIT_BY_ASSET[getVaultAssetSymbol(jar.assetAddress, chainId)];
  if (!guidance) return null;
  return {
    floor: parseUnits(guidance.floor, jar.decimals),
    suggested: parseUnits(guidance.suggested, jar.decimals),
  };
}

/** A zero limit is a read that failed to load, not a configured value, so it never reads as low. */
export function isJarClaimLimitLow(jar: JarLimitInput, chainId?: number): boolean {
  const guidance = getJarClaimLimitGuidance(jar, chainId);
  return guidance !== null && jar.maxWithdrawal > 0n && jar.maxWithdrawal < guidance.floor;
}

/** How many claims at `limit` it takes to move `balance` out of the jar, rounded up. */
export function claimsToEmptyJar(balance: bigint, limit: bigint): bigint {
  if (balance <= 0n || limit <= 0n) return 0n;
  return (balance + limit - 1n) / limit;
}

type FormatMessage = (descriptor: { id: string }, values?: Record<string, any>) => string;

/** A jar's cooldown as how often one gardener can claim: "once a day", "once every 12 hours". */
export function formatClaimCadence(formatMessage: FormatMessage, cooldownSeconds: bigint): string {
  const seconds = Number(cooldownSeconds);
  if (seconds <= 0) return formatMessage({ id: "app.cookieJar.cadence.none" });
  if (seconds % 86_400 === 0) {
    return formatMessage({ id: "app.cookieJar.cadence.days" }, { count: seconds / 86_400 });
  }
  if (seconds % 3_600 === 0) {
    return formatMessage({ id: "app.cookieJar.cadence.hours" }, { count: seconds / 3_600 });
  }
  return formatMessage(
    { id: "app.cookieJar.cadence.minutes" },
    { count: Math.max(1, Math.round(seconds / 60)) }
  );
}
