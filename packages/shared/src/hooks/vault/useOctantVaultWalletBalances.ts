import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_FAST } from "../../config/query-keys/constants";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI } from "../../utils/blockchain/abis";

export interface UseOctantVaultWalletBalancesOptions {
  owner?: Address | null;
  chainId?: number;
  assetAddress?: Address | null;
  enabled?: boolean;
}

export interface OctantVaultWalletBalancesResult {
  nativeBalance: bigint | null;
  assetBalance: bigint | null;
  /**
   * Current network gas price (wei), for sizing a wrap+approve+deposit gas
   * reserve so a wrap never strands the follow-on deposit. `null` if unread.
   */
  gasPrice: bigint | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

export function useOctantVaultWalletBalances({
  owner,
  chainId,
  assetAddress,
  enabled = true,
}: UseOctantVaultWalletBalancesOptions): OctantVaultWalletBalancesResult {
  const ownerKey = owner?.toLowerCase() ?? "";
  const assetKey = assetAddress?.toLowerCase() ?? "";
  const queryEnabled = enabled && Boolean(owner && chainId && assetAddress);

  const query = useQuery({
    queryKey: queryKeys.vaults.octantWalletBalances(ownerKey, chainId ?? 0, assetKey),
    enabled: queryEnabled,
    staleTime: STALE_TIME_FAST,
    queryFn: async () => {
      if (!owner || !chainId || !assetAddress) {
        return { nativeBalance: null, assetBalance: null, gasPrice: null };
      }

      const publicClient = createPublicClientForChain(chainId);
      const [nativeBalance, assetBalanceResult, gasPriceResult] = await Promise.all([
        publicClient.getBalance({ address: owner }),
        publicClient.readContract({
          address: assetAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [owner],
        }),
        // Gas price is best-effort: a failure must not hide the balances.
        publicClient.getGasPrice().catch(() => null),
      ]);

      return {
        nativeBalance,
        assetBalance: typeof assetBalanceResult === "bigint" ? assetBalanceResult : 0n,
        gasPrice: typeof gasPriceResult === "bigint" ? gasPriceResult : null,
      };
    },
  });

  return {
    nativeBalance: query.data?.nativeBalance ?? null,
    assetBalance: query.data?.assetBalance ?? null,
    gasPrice: query.data?.gasPrice ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
