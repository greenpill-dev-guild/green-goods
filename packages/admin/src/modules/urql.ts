import { Client, cacheExchange, fetchExchange } from "@urql/core";

import { getEasGraphqlUrl } from "@/config";

export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: [cacheExchange, fetchExchange],
  });
}
