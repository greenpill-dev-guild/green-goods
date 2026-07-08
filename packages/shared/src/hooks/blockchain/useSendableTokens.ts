/**
 * Sendable-token balances for the client PWA "Send" flow.
 *
 * Resolves the GOODS token address from `GardensModule.goodsToken()` (module-level,
 * one GOODS per chain), builds the curated token list (GOODS + stablecoins), and
 * reads each balance in parallel. Uses `Promise.allSettled` so one reverting or
 * absent token never nukes the whole list (per-token `errored` flag instead).
 *
 * Balances are direct RPC reads (no indexer) — invalidate via `onTokenSent`.
 *
 * @module hooks/blockchain/useSendableTokens
 */

import { useQuery } from "@tanstack/react-query";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryKeys } from "../../config/query-keys";
import { STALE_TIME_FAST } from "../../config/query-keys/constants";
import { buildSendableTokens, type SendableToken } from "../../config/tokens";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI, GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";

export interface SendableTokenBalance extends SendableToken {
  /** Base-unit balance, or null when not read (unsupported) or errored. */
  balance: bigint | null;
  /** True when this token's balance read failed (others remain valid). */
  errored: boolean;
}

export interface UseSendableTokensResult {
  tokens: SendableTokenBalance[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

async function resolveGoodsAddress(
  client: ReturnType<typeof createPublicClientForChain>,
  chainId: number
): Promise<Address | null> {
  const gardensModule = getNetworkContracts(chainId).gardensModule;
  if (!gardensModule || isZeroAddress(gardensModule)) return null;
  try {
    const resolved = (await client.readContract({
      address: gardensModule,
      abi: GARDENS_MODULE_ABI,
      functionName: "goodsToken",
    })) as Address;
    return resolved && !isZeroAddress(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

export function useSendableTokens(
  account?: Address | null,
  chainId?: number
): UseSendableTokensResult {
  const accountKey = account?.toLowerCase() ?? "";
  const enabled = Boolean(account && chainId);

  const query = useQuery({
    queryKey: queryKeys.tokens.balances(accountKey, chainId ?? 0),
    enabled,
    staleTime: STALE_TIME_FAST,
    queryFn: async (): Promise<SendableTokenBalance[]> => {
      if (!account || !chainId) return [];
      const client = createPublicClientForChain(chainId);

      const goodsAddress = await resolveGoodsAddress(client, chainId);
      const tokens = buildSendableTokens(chainId, goodsAddress);

      const settled = await Promise.allSettled(
        tokens.map((token) =>
          token.supported
            ? (client.readContract({
                address: token.address,
                abi: ERC20_BALANCE_ABI,
                functionName: "balanceOf",
                args: [account],
              }) as Promise<bigint>)
            : Promise.resolve<bigint | null>(null)
        )
      );

      return tokens.map((token, index) => {
        const result = settled[index];
        if (result.status === "fulfilled") {
          return {
            ...token,
            balance: typeof result.value === "bigint" ? result.value : null,
            errored: false,
          };
        }
        return { ...token, balance: null, errored: true };
      });
    },
  });

  return {
    tokens: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
