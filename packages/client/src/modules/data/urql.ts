import { Client, cacheExchange, fetchExchange } from "@urql/core";

import { getEasGraphqlUrl, getIndexerUrl } from "@/config/blockchain";

/** Creates a typed URQL client targeting the chain-specific EAS GraphQL endpoint. */
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: [cacheExchange, fetchExchange],
  });
}

/** Shared URQL client for the Green Goods indexer API. */
export const greenGoodsIndexer = new Client({
  url: getIndexerUrl(),
  exchanges: [cacheExchange, fetchExchange],
});

/** Prefer `createEasClient(chainId)` for chain-aware EAS queries. */
