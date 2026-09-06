import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPublicClientForChain } from "../../../config/pimlico";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { STALE_TIME_FAST, STALE_TIME_MEDIUM } from "../../../config/query-keys/constants";
import { tokensKeys } from "../../../config/query-keys/tokens";
import { CELO_G_DOLLAR_TOKEN } from "../../../config/tokens";
import { getGardenerSettlementHistory } from "../../../modules/commitment-pooling/data-gardener-settlement";
import { getGardenerDeliveryEnabled } from "../../../modules/commitment-pooling/data-settlement";
import type { GardenerSettlementReceipt } from "../../../modules/commitment-pooling/types-settlement";
import type { SmartAccountClientResolver } from "../../../types/auth";
import { ERC20_BALANCE_ABI } from "../../../utils/blockchain/abis/erc20";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useUser } from "../../auth/useUser";
import type { SendableTokenBalance } from "../../blockchain/useSendableTokens";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";

type CeloWalletReadiness =
  | "loading"
  | "ready"
  | "policy-unavailable"
  | "address-mismatch"
  | "unavailable";

export function useCeloWallet() {
  const { primaryAddress, authMode, ready, resolveSmartAccountClient } = useUser();
  const online = useOnlineStatus();
  const account = primaryAddress?.toLowerCase() ?? "";
  const enabled = Boolean(primaryAddress && ready);
  const [retry, setRetry] = useState(0);
  const [clientState, setClientState] = useState<{
    resolver: SmartAccountClientResolver | null;
    account: string;
    readiness: CeloWalletReadiness;
  } | null>(null);

  useEffect(() => {
    if (authMode !== "passkey" || !enabled || !resolveSmartAccountClient || !online) return;
    let active = true;
    const update = (readiness: CeloWalletReadiness) => {
      if (active) setClientState({ resolver: resolveSmartAccountClient, account, readiness });
    };
    update("loading");
    void resolveSmartAccountClient(42220).then(
      (client) => {
        if (client.account?.address.toLowerCase() !== account) update("address-mismatch");
        else if (client.chain?.id !== 42220) update("unavailable");
        else update("ready");
      },
      (error: unknown) => {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        update(
          code === "address_mismatch"
            ? "address-mismatch"
            : code === "policy_unavailable"
              ? "policy-unavailable"
              : "unavailable"
        );
      }
    );
    return () => {
      active = false;
    };
  }, [account, authMode, enabled, online, resolveSmartAccountClient, retry]);

  const delivery = useQuery({
    queryKey: commitmentPoolingKeys.gardenerDelivery(42161, 42220),
    queryFn: getGardenerDeliveryEnabled,
    enabled: enabled && online,
    staleTime: STALE_TIME_MEDIUM,
  });
  const balance = useQuery({
    queryKey: tokensKeys.celoBalance(account),
    enabled: enabled && online,
    staleTime: STALE_TIME_FAST,
    queryFn: async () => {
      if (!primaryAddress) throw new Error("Wallet address is unavailable");
      const value = await createPublicClientForChain(42220).readContract({
        address: CELO_G_DOLLAR_TOKEN.address,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [primaryAddress],
      });
      if (typeof value !== "bigint" || value < 0n) throw new Error("Celo balance is unavailable");
      return value;
    },
  });
  const history = useQuery({
    queryKey: commitmentPoolingKeys.gardenerSettlementHistory(42161, account),
    enabled: enabled && online,
    staleTime: STALE_TIME_MEDIUM,
    queryFn: () => {
      if (!primaryAddress) throw new Error("Wallet address is unavailable");
      return getGardenerSettlementHistory(42161, primaryAddress);
    },
  });
  const metadata = useCommitmentMetadata(history.data ?? []);
  const receipts: GardenerSettlementReceipt[] = (history.data ?? []).map((receipt) => {
    const title = receipt.metadataCID
      ? (metadata.byCID.get(receipt.metadataCID)?.title ?? null)
      : null;
    return {
      ...receipt,
      title,
      metadataUnavailable:
        receipt.metadataUnavailable ||
        Boolean(receipt.metadataCID && !title && !metadata.isLoading),
    };
  });
  const readiness: CeloWalletReadiness = !ready
    ? "loading"
    : !enabled || !authMode
      ? "unavailable"
      : authMode !== "passkey"
        ? "ready"
        : !resolveSmartAccountClient
          ? "unavailable"
          : clientState?.resolver === resolveSmartAccountClient && clientState.account === account
            ? clientState.readiness
            : "loading";
  const deliveryEnabled =
    enabled && online && delivery.data === true && !delivery.isError && !delivery.isStale;
  const token: SendableTokenBalance = {
    ...CELO_G_DOLLAR_TOKEN,
    balance: balance.data ?? null,
    errored: balance.isError,
  };

  return {
    token,
    balanceLoading: enabled && balance.isPending,
    balanceError: balance.error,
    deliveryEnabled,
    deliveryLoading: enabled && delivery.isPending,
    deliveryError: delivery.error,
    readiness,
    receipts,
    historyLoading: enabled && history.isPending,
    historyError: history.error,
    canSend: deliveryEnabled && readiness === "ready" && token.balance !== null && !token.errored,
    isOffline: !online,
    refetch: async () => {
      setRetry((value) => value + 1);
      if (online) await Promise.all([delivery.refetch(), balance.refetch(), history.refetch()]);
    },
  };
}
