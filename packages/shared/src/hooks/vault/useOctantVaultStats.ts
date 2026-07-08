/**
 * Read public, on-chain stats for an Octant V2 vault campaign so the public
 * `/vaults` browse cards can show "how much support is in the vault" without a
 * wallet runtime.
 *
 * These campaign vaults live on Ethereum mainnet while the rest of the app targets
 * a different chain, and the public browse page has no wagmi context — so this hook
 * reads through a read-only viem public client (`createPublicClientForChain`),
 * never a connected wallet. It degrades gracefully: a missing vault, a chain
 * without a price feed, or an RPC error simply yields `null`/`isError` and the
 * card hides the affected figure rather than breaking.
 *
 * Donor / supporter counts are intentionally out of scope here — they are not
 * indexed for these mainnet vaults today and would need a dedicated stats source.
 *
 * @module hooks/vault/useOctantVaultStats
 */

import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import { AGGREGATOR_V3_ABI, OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { getEthUsdFeedAddress } from "../../utils/blockchain/price-feeds";

interface UseOctantVaultStatsOptions {
  vaultAddress?: Address;
  chainId?: number;
  /** Vault asset decimals (WETH = 18). Used for the USD conversion. */
  decimals?: number;
  enabled?: boolean;
}

export interface OctantVaultStats {
  /** Total assets held by the vault, in base units (e.g. WETH wei). Zero until loaded. */
  totalAssets: bigint;
  /** USD value of `totalAssets` in cents, or null when no price feed is available. */
  usdCents: bigint | null;
  /** True while the read is in flight. */
  isLoading: boolean;
  /** True when the read errored (RPC failure, unsupported chain, etc). */
  isError: boolean;
}

const PRICE_FEED_DECIMALS = 8n;

/**
 * Read a campaign vault's `totalAssets()` and (when a feed exists) its ETH/USD
 * price, returning the vault balance plus a USD-cents estimate.
 */
export function useOctantVaultStats(options: UseOctantVaultStatsOptions = {}): OctantVaultStats {
  const { vaultAddress, chainId, decimals = 18 } = options;
  const enabled = (options.enabled ?? true) && Boolean(vaultAddress && chainId);

  const { data, isLoading, isError } = useQuery({
    queryKey:
      vaultAddress && chainId
        ? queryKeys.vaults.campaignStats(vaultAddress, chainId)
        : (["greengoods", "vaults", "campaignStats", "disabled"] as const),
    enabled,
    staleTime: STALE_TIME_MEDIUM,
    queryFn: async () => {
      if (!vaultAddress || !chainId) return null;
      const publicClient = createPublicClientForChain(chainId);

      const totalAssetsResult = await publicClient.readContract({
        address: vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "totalAssets",
      });
      const totalAssets =
        typeof totalAssetsResult === "bigint"
          ? totalAssetsResult
          : BigInt(String(totalAssetsResult ?? "0"));

      let priceAnswer = 0n;
      const feedAddress = getEthUsdFeedAddress(chainId);
      if (feedAddress) {
        try {
          const roundData = await publicClient.readContract({
            address: feedAddress,
            abi: AGGREGATOR_V3_ABI,
            functionName: "latestRoundData",
          });
          const answer = Array.isArray(roundData) ? roundData[1] : undefined;
          if (typeof answer === "bigint" && answer > 0n) priceAnswer = answer;
        } catch (error) {
          logger.error("[useOctantVaultStats] ETH/USD feed read failed", {
            error,
            chainId,
            vaultAddress,
            feedAddress,
          });
          priceAnswer = 0n;
        }
      }

      return { totalAssets, priceAnswer };
    },
  });

  const totalAssets = data?.totalAssets ?? 0n;
  const priceAnswer = data?.priceAnswer ?? 0n;
  const usdCents =
    priceAnswer > 0n
      ? (totalAssets * priceAnswer * 100n) / (10n ** BigInt(decimals) * 10n ** PRICE_FEED_DECIMALS)
      : null;

  return { totalAssets, usdCents, isLoading, isError };
}
