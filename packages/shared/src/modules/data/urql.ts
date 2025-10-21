import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { getEasGraphqlUrl, getIndexerUrl } from "../../config/blockchain";

/** Creates a chain-specific URQL client for EAS GraphQL API */
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: [cacheExchange, fetchExchange],
  });
}

/**
 * Creates a URQL client for the Green Goods indexer
 * URL must be provided by the consuming app (client or admin)
 */
export function createIndexerClient(url: string) {
  return new Client({
    url,
    exchanges: [cacheExchange, fetchExchange],
  });
}

/** Creates a URQL client for the Green Goods indexer using environment config */
export function createGreenGoodsIndexerClient(env: any, isDev: boolean) {
  return new Client({
    url: getIndexerUrl(env, isDev),
    exchanges: [cacheExchange, fetchExchange],
  });
}

/** Singleton Green Goods indexer client */
export const greenGoodsIndexer = createGreenGoodsIndexerClient(
  typeof import.meta !== 'undefined' ? import.meta.env : {},
  typeof import.meta !== 'undefined' ? import.meta.env.DEV : false
);

