import { Client, cacheExchange, fetchExchange } from "@urql/core";

import { getEasGraphqlUrl, getIndexerUrl } from "@/config";

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

export const easClient = new Client({
  url: getEasGraphqlUrl(),
  exchanges: [cacheExchange, fetchExchange],
});
