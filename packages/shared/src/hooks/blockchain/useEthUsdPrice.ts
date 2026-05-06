/**
 * Read the Chainlink ETH/USD price feed for the active chain.
 *
 * Returns the raw bigint answer + freshness metadata so callers can render
 * "≈ 0.0054 WETH at $3,712/ETH" or fall back to native units when the feed
 * is missing or stale.
 *
 * Stale-handling policy: we surface staleness as a flag rather than refusing
 * to convert. The Fund card uses this to show a small "Price last updated X
 * minutes ago" subtitle; conversion still works because outdated data is
 * better than blocking a donation. If the chain has no canonical feed at all
 * (Celo today), `hasFeed` is false and the caller should hide $-entry.
 *
 * @module hooks/blockchain/useEthUsdPrice
 */

import { useReadContract } from "wagmi";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { AGGREGATOR_V3_ABI } from "../../utils/blockchain/abis";
import {
  getEthUsdFeedAddress,
  PRICE_FEED_STALE_THRESHOLD_S,
} from "../../utils/blockchain/price-feeds";
import { useCurrentChain } from "./useChainConfig";

interface UseEthUsdPriceOptions {
  enabled?: boolean;
  /** Override the chain — useful for tests or cross-chain reads. */
  chainId?: number;
}

export interface EthUsdPriceState {
  /** Raw price answer (price × 10^8). Zero when unavailable. */
  priceAnswer: bigint;
  /** Unix seconds when the feed was last updated. Zero when unavailable. */
  updatedAt: number;
  /** True when the price is older than PRICE_FEED_STALE_THRESHOLD_S. */
  isStale: boolean;
  /** True while the read is in flight. */
  isLoading: boolean;
  /** True when the active chain has a canonical ETH/USD feed configured. */
  hasFeed: boolean;
  /** True when the read errored (missing feed, RPC failure, etc). */
  isError: boolean;
}

/**
 * Read ETH/USD from Chainlink with auto-refresh every 60s. When the active
 * chain has no canonical feed (Celo), returns `{ hasFeed: false }` and the
 * caller should hide $-presentation for native tokens.
 */
export function useEthUsdPrice(options: UseEthUsdPriceOptions = {}): EthUsdPriceState {
  const activeChainId = useCurrentChain();
  const chainId = options.chainId ?? activeChainId;
  const feedAddress = getEthUsdFeedAddress(chainId);
  const enabled = (options.enabled ?? true) && Boolean(feedAddress);

  const { data, isLoading, isError } = useReadContract({
    address: feedAddress,
    abi: AGGREGATOR_V3_ABI,
    functionName: "latestRoundData",
    chainId,
    query: {
      enabled,
      staleTime: STALE_TIME_MEDIUM,
      refetchInterval: 60_000,
    },
  });

  if (!feedAddress) {
    return {
      priceAnswer: 0n,
      updatedAt: 0,
      isStale: false,
      isLoading: false,
      hasFeed: false,
      isError: false,
    };
  }

  if (!data) {
    return {
      priceAnswer: 0n,
      updatedAt: 0,
      isStale: false,
      isLoading,
      hasFeed: true,
      isError,
    };
  }

  const [, answer, , updatedAtBig] = data;
  const updatedAt = Number(updatedAtBig);
  const ageSeconds = Math.floor(Date.now() / 1000) - updatedAt;
  const isStale = ageSeconds > PRICE_FEED_STALE_THRESHOLD_S;

  return {
    priceAnswer: answer,
    updatedAt,
    isStale,
    isLoading,
    hasFeed: true,
    isError,
  };
}
