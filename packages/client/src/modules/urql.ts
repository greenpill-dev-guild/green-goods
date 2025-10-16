import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { createEasClient as baseCreateEasClient } from "@green-goods/eas-shared";

import { getEasGraphqlUrl, getIndexerUrl } from "@/config";

export function createEasClient(chainId?: number | string) {
  return baseCreateEasClient({ chainId, resolveUrl: getEasGraphqlUrl });
}

export const greenGoodsIndexer = new Client({
  url: getIndexerUrl(),
  exchanges: [cacheExchange, fetchExchange],
});

// Prefer using createEasClient(chainId) for chain-aware requests.
