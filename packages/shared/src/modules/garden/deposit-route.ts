import {
  type BatchEnablement,
  type BatchRail,
  isBatchEnabled,
} from "../transactions/batch-enablement";
import type { BatchBudget } from "../transactions/batch-types";

const ARBITRUM_CEILINGS = {
  maxCalls: 3,
  maxCalldataBytes: 1_024,
  maxFeePerGas: "1000000000",
  maxFee: "1000000000000000",
};

/**
 * Ceilings for one signature, on the chains they were sized for. Sized from Arbitrum receipts, not
 * a fork run: a vault deposit used about 155k gas and a jar deposit about 94k, a strategy's
 * allocation can add several times that, and a passkey UserOperation adds about 730k. The first
 * live batch on each rail confirms them before that rail is listed.
 */
const DEPOSIT_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "3000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "1500000", sponsorship: "wallet" },
  },
};

export function depositBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return DEPOSIT_BUDGETS[chainId]?.[rail] ?? null;
}

/**
 * How this deposit goes on this rail, or null for today's flow. A passkey always sends one request;
 * a wallet does when it reports atomic, and otherwise keeps one signature per step, journaled all
 * the same. `walletAtomic` is unread until a wallet is listed at all, so no wallet hears from an
 * unlisted action.
 */
export function depositRoute(input: {
  action: BatchEnablement["action"];
  rail: BatchRail | null;
  passkeyProfile: BatchEnablement["profile"] | null | undefined;
  walletAtomic: boolean | undefined;
  chainId: number;
  asset: string;
}): { atomic: boolean } | null {
  const { action, rail, passkeyProfile, walletAtomic, chainId, asset } = input;
  if (!rail || !depositBudget(rail, chainId)) return null;
  const atomic = rail === "passkey" || walletAtomic === true;
  const profile = rail === "passkey" ? passkeyProfile : atomic ? "eip-5792" : "sequential";
  if (!profile || !isBatchEnabled({ action, rail, profile, chainId, asset })) return null;
  return { atomic };
}

/** Whether a wallet's capability can change the route: asked only then. */
export function walletRouteListed(
  input: Pick<BatchEnablement, "action" | "chainId" | "asset">
): boolean {
  return (["eip-5792", "sequential"] as const).some((profile) =>
    isBatchEnabled({ ...input, rail: "wallet", profile })
  );
}
