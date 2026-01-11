/**
 * DEPRECATED: Global indexer response types
 *
 * These global declarations are kept for backward compatibility only.
 * Import from '@green-goods/shared' instead:
 *
 * @example
 * ```typescript
 * import type { IndexerGarden, IndexerAction, IndexerGardener } from '@green-goods/shared';
 * ```
 *
 * This file will be removed in a future version.
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
