import { GraphQLClient, type RequestDocument } from "graphql-request";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { getEasGraphqlUrl, getIndexerUrl } from "../../config/blockchain";

/** Vite environment interface for indexer URL access */
interface ViteEnv {
  VITE_ENVIO_INDEXER_URL?: string;
}

/** Default network timeout for GraphQL queries (12 seconds) */
export const GRAPHQL_TIMEOUT_MS = 12_000;

/**
 * Custom timeout error for GraphQL operations
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

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within the specified duration.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = GRAPHQL_TIMEOUT_MS,
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

/**
 * Lightweight GraphQL client wrapper using graphql-request
 * Provides a consistent interface for all GraphQL operations
 */
export class GQLClient {
  private client: GraphQLClient;

  constructor(url: string) {
    this.client = new GraphQLClient(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Execute a GraphQL query with automatic timeout and error handling.
   * Works with both TypedDocumentNode and gql.tada documents.
   */
  async query<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
    document: TypedDocumentNode<TData, TVariables> | RequestDocument,
    variables?: TVariables,
    operationName?: string
  ): Promise<{ data: TData; error?: undefined } | { data?: undefined; error: Error }> {
    try {
      // Use explicit any to allow flexible variable passing - graphql-request handles the types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await withTimeout(
        this.client.request<TData>(document as any, variables as any),
        GRAPHQL_TIMEOUT_MS,
        operationName
      );
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Execute a GraphQL query and return data directly (throws on error).
   * Works with both TypedDocumentNode and gql.tada documents.
   */
  async request<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
    document: TypedDocumentNode<TData, TVariables> | RequestDocument,
    variables?: TVariables
  ): Promise<TData> {
    // Use explicit any to allow flexible variable passing - graphql-request handles the types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.client.request<TData>(document as any, variables as any);
  }
}

/** Creates a chain-specific GraphQL client for EAS GraphQL API */
export function createEasClient(chainId?: number | string): GQLClient {
  return new GQLClient(getEasGraphqlUrl(chainId));
}

/** Creates a GraphQL client for the Green Goods indexer */
export function createIndexerClient(url: string): GQLClient {
  return new GQLClient(url);
}

/** Creates a GraphQL client for the Green Goods indexer using environment config */
function createGreenGoodsIndexerClient(env: ViteEnv, isDev: boolean): GQLClient {
  return new GQLClient(getIndexerUrl(env, isDev));
}

/** Singleton Green Goods indexer client */
export const greenGoodsIndexer = createGreenGoodsIndexerClient(
  typeof import.meta !== "undefined" ? (import.meta.env as ViteEnv) : {},
  typeof import.meta !== "undefined" ? !!import.meta.env.DEV : false
);

// Re-export timeout constant with old name for backwards compatibility
export const INDEXER_TIMEOUT_MS = GRAPHQL_TIMEOUT_MS;
