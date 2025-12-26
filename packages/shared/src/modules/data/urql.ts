import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { offlineExchange } from "@urql/exchange-graphcache";
import { makeDefaultStorage } from "@urql/exchange-graphcache/default-storage";
import { getEasGraphqlUrl, getIndexerUrl } from "../../config/blockchain";

/** Vite environment interface for indexer URL access */
interface ViteEnv {
  VITE_ENVIO_INDEXER_URL?: string;
}

// IndexedDB storage for offline cache (24-hour TTL)
const createStorage = () =>
  makeDefaultStorage({
    idbName: "gg-urql-cache",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

// Offline-enabled exchanges with IndexedDB persistence
const createOfflineExchanges = () => {
  const storage = createStorage();
  return [offlineExchange({ storage }), fetchExchange];
};

// Fallback for SSR or non-browser environments
const fallbackExchanges = [cacheExchange, fetchExchange];

const getExchanges = () =>
  typeof window !== "undefined" ? createOfflineExchanges() : fallbackExchanges;

/** Creates a chain-specific URQL client for EAS GraphQL API */
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: getExchanges(),
  });
}

/** Creates a URQL client for the Green Goods indexer */
export function createIndexerClient(url: string) {
  return new Client({
    url,
    exchanges: getExchanges(),
  });
}

/** Creates a URQL client for the Green Goods indexer using environment config */
export function createGreenGoodsIndexerClient(env: ViteEnv, isDev: boolean) {
  return new Client({
    url: getIndexerUrl(env, isDev),
    exchanges: getExchanges(),
  });
}

/** Singleton Green Goods indexer client */
export const greenGoodsIndexer = createGreenGoodsIndexerClient(
  typeof import.meta !== "undefined" ? (import.meta.env as ViteEnv) : {},
  typeof import.meta !== "undefined" ? !!import.meta.env.DEV : false
);
