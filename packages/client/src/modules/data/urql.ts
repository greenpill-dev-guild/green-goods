import { Client, cacheExchange, fetchExchange } from "@urql/core";

import { getEasGraphqlUrl, getIndexerUrl } from "@/config/blockchain";

// Create EAS client for a specific chain
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: [cacheExchange, fetchExchange],
  });
}

export const greenGoodsIndexer = new Client({
  url: getIndexerUrl(),
  exchanges: [cacheExchange, fetchExchange],
});

// Prefer using createEasClient(chainId) for chain-aware requests.
