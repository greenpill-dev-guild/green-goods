import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { getEasGraphqlUrl, getIndexerUrl } from "../../config/blockchain";

/** Vite environment interface for indexer URL access */
interface ViteEnv {
  VITE_ENVIO_INDEXER_URL?: string;
}

/** Default network timeout for GraphQL queries (12 seconds) */
export const INDEXER_TIMEOUT_MS = 12_000;

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within the specified duration.
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = INDEXER_TIMEOUT_MS,
  operationName: string = "Operation"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Standard exchanges - cacheExchange provides in-memory deduplication
// Offline persistence handled by Service Worker (StaleWhileRevalidate) and TanStack Query (IndexedDB)
const standardExchanges = [cacheExchange, fetchExchange];

/** Creates a chain-specific URQL client for EAS GraphQL API */
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: standardExchanges,
  });
}

/** Creates a URQL client for the Green Goods indexer */
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
