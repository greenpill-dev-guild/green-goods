import { ENV } from "../lib/env";
import { logger } from "../modules/app/logger";

const FALLBACK_CHAIN_ID = 42161;
const DEPLOYED_CHAIN_IDS = new Set([31337, 11155111, 42161, 42220]);

export function resolveDefaultChainId(chainId?: number | string): number {
  if (chainId === undefined || chainId === null || chainId === "") {
    return FALLBACK_CHAIN_ID;
  }

  const parsed = Number(chainId);
  return Number.isFinite(parsed) && DEPLOYED_CHAIN_IDS.has(parsed) ? parsed : FALLBACK_CHAIN_ID;
}

export const DEFAULT_CHAIN_ID = resolveDefaultChainId(ENV.VITE_CHAIN_ID);

const isVitest = typeof process !== "undefined" && process.env.VITEST === "true";

if (!isVitest) {
  const rawChainId = ENV.VITE_CHAIN_ID;
  const resolvedFromEnv =
    rawChainId !== undefined && rawChainId !== null && rawChainId !== ""
      ? Number(rawChainId)
      : undefined;

  if (resolvedFromEnv !== DEFAULT_CHAIN_ID) {
    logger.warn("[blockchain] VITE_CHAIN_ID missing or unresolved; using fallback", {
      source: "config/default-chain",
      rawChainId: rawChainId ?? null,
      fallbackChainId: DEFAULT_CHAIN_ID,
    });
  }
}
