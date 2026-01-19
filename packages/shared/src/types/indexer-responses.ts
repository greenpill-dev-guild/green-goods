/**
 * Green Goods Indexer GraphQL Response Types
 *
 * Type definitions for the Green Goods indexer (Envio) GraphQL API responses.
 * Import these explicitly instead of relying on global declarations.
 *
 * @example
 * ```typescript
 * import type { IndexerGarden, IndexerGardensResponse } from '@green-goods/shared';
 * ```
 */

// ============================================
// Garden Responses
// ============================================

export interface IndexerGarden {
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

export interface IndexerGardensResponse {
  Garden: IndexerGarden[];
}

// ============================================
// Action Responses
// ============================================

export interface IndexerAction {
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

export interface IndexerActionsResponse {
  Action: IndexerAction[];
}

// ============================================
// Gardener Responses
// ============================================

export interface IndexerGardener {
  id: string;
  chainId: number;
  createdAt: number | null;
  firstGarden: string | null;
  joinedVia: string | null;
}

export interface IndexerGardenersResponse {
  Gardener: IndexerGardener[];
}
