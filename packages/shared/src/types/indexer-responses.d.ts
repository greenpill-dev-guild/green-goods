/**
 * Green Goods Indexer GraphQL Response Types
 *
 * Type definitions for the Green Goods indexer (Envio) GraphQL API responses.
 */

/**
 * Raw garden entity from indexer
 */
declare interface IndexerGarden {
  id: string;
  chainId: number;
  tokenAddress: string;
  tokenID: string | bigint;
  name: string | null;
  description: string | null;
  location: string | null;
  bannerImage: string | null;
  gardeners: string[] | null;
  operators: string[] | null;
  createdAt: number | null;
}

/**
 * Response from Garden query
 */
declare interface IndexerGardensResponse {
  Garden: IndexerGarden[];
}

/**
 * Raw action entity from indexer
 */
declare interface IndexerAction {
  id: string;
  chainId: number;
  startTime: string | number | null;
  endTime: string | number | null;
  title: string;
  instructions: string | null;
  capitals: (string | number)[] | null;
  media: string[] | null;
  createdAt: number | null;
}

/**
 * Response from Action query
 */
declare interface IndexerActionsResponse {
  Action: IndexerAction[];
}

/**
 * Raw gardener entity from indexer
 */
declare interface IndexerGardener {
  id: string;
  chainId: number;
  createdAt: number | null;
  firstGarden: string | null;
  joinedVia: string | null;
}

/**
 * Response from Gardener query
 */
declare interface IndexerGardenersResponse {
  Gardener: IndexerGardener[];
}

/**
 * Vite environment interface for type-safe env access
 */
declare interface ViteEnv {
  VITE_INDEXER_URL?: string;
  VITE_INDEXER_URL_DEV?: string;
  DEV?: boolean;
}
