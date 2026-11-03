import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { batchKeys } from "../../config/query-keys/garden";
import type { PasskeyAccountProfileId } from "../../modules/auth/account-profile";
import {
  type BatchEnablement,
  type BatchRail,
  type DepositAction,
  isBatchEnabled,
} from "../../modules/transactions/batch-enablement";
import type { TransactionSender } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";

/**
 * Whether an action's fixed calls go under one signature from this account now. A passkey does once
 * its profile is listed for the action. A wallet must be listed and say it runs atomic calls, and it
 * is asked only once it is listed, so no wallet hears from an action nobody has proven on it.
 * Deposits name an asset as well, so they take their own route.
 */
export function useAtomicBatchRoute(input: {
  action: Exclude<BatchEnablement["action"], DepositAction>;
  sender: TransactionSender | null;
  account: Address | null;
  passkeyProfile: PasskeyAccountProfileId | null | undefined;
  chainId: number;
  /** Whether this rail has ceilings sized on this chain. */
  budgeted: (rail: BatchRail) => boolean;
  enabled?: boolean;
}): {
  rail: BatchRail | null;
  atomic: boolean;
  /** The wallet has not said what it can do yet, so no signature count can be promised. */
  unread: boolean;
} {
  const { action, sender, account, passkeyProfile, chainId, budgeted, enabled = true } = input;
  const { connector } = useAccount();
  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const walletListed =
    rail === "wallet" && isBatchEnabled({ action, rail, profile: "eip-5792", chainId });
  const { data: walletAtomic } = useQuery({
    queryKey: batchKeys.capability(account ?? "", chainId, connector?.uid ?? ""),
    queryFn: async () => (await sender!.getBatchCapability!({ account: account!, chainId })).atomic,
    enabled: enabled && walletListed && Boolean(account && sender?.getBatchCapability),
    retry: false,
  });
  const profile =
    rail === "passkey" ? passkeyProfile : walletAtomic === "supported" ? "eip-5792" : null;
  return {
    rail,
    atomic: Boolean(
      rail &&
        profile &&
        account &&
        budgeted(rail) &&
        isBatchEnabled({ action, rail, profile, chainId })
    ),
    unread: walletListed && (walletAtomic === undefined || walletAtomic === "unknown"),
  };
}
