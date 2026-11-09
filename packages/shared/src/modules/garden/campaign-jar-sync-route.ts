import type { PasskeyAccountProfileId } from "../auth/account-profile";
import { type BatchRail, isBatchEnabled } from "../transactions/batch-enablement";
import type { BatchBudget } from "../transactions/batch-types";

const ARBITRUM_CEILINGS = {
  maxCalls: 3,
  maxCalldataBytes: 16_384,
  maxFeePerGas: "1000000000",
  maxFee: "2000000000000000",
};

/**
 * Ceilings for one signature, on the chains they were sized for. Sized from Arbitrum receipts and
 * the jar's code, not a fork run: a grant of one address used 78k gas, an `updateMetadata` used 143k
 * to 156k for 0.4 to 1 KB of metadata, each further address granted fills two storage slots (about
 * 50k), and a passkey UserOperation adds about 730k for validation and sponsorship. Past them a sync
 * goes step by step. The first live batch on each rail confirms them before that rail is listed.
 */
const CAMPAIGN_JAR_SYNC_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "8000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "7000000", sponsorship: "wallet" },
  },
};

export function campaignJarSyncBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return CAMPAIGN_JAR_SYNC_BUDGETS[chainId]?.[rail] ?? null;
}

/**
 * The rail a sync goes as one request on, or null for today's flow, one signature per step. Its
 * writes are separate calls on two contracts, so a wallet batches only when it reports atomic calls.
 */
export function campaignJarSyncRoute(input: {
  rail: BatchRail | null;
  passkeyProfile: PasskeyAccountProfileId | null | undefined;
  walletAtomic: boolean;
  chainId: number;
}): BatchRail | null {
  const { rail, passkeyProfile, walletAtomic, chainId } = input;
  if (!rail || !campaignJarSyncBudget(rail, chainId)) return null;
  const profile = rail === "passkey" ? passkeyProfile : walletAtomic ? "eip-5792" : null;
  if (!profile) return null;
  return isBatchEnabled({ action: "campaign-jar-sync", rail, profile, chainId }) ? rail : null;
}
