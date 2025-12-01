import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { getEasGraphqlUrl, getIndexerUrl } from "../../config/blockchain";

/** Standard exchanges - deduplication is now built into the Client */
const standardExchanges = [cacheExchange, fetchExchange];

/** Creates a chain-specific URQL client for EAS GraphQL API */
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: standardExchanges,
  });
}

/**
 * Creates a URQL client for the Green Goods indexer
 * URL must be provided by the consuming app (client or admin)
 */
export function createIndexerClient(url: string) {
  return new Client({
    url,
    exchanges: standardExchanges,
  });
}

/** Creates a URQL client for the Green Goods indexer using environment config */
export function createGreenGoodsIndexerClient(env: ViteEnv, isDev: boolean) {
  return new Client({
    url: getIndexerUrl(env, isDev),
    exchanges: standardExchanges,
  });
}

/** Singleton Green Goods indexer client */
export const greenGoodsIndexer = createGreenGoodsIndexerClient(
  typeof import.meta !== "undefined" ? (import.meta.env as ViteEnv) : {},
  typeof import.meta !== "undefined" ? !!import.meta.env.DEV : false
);
