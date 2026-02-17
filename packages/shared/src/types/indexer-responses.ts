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

import type { Address } from "./domain";

// ============================================
// Garden Responses
// ============================================

export interface IndexerGarden {
  id: string;
  chainId: number;
  tokenAddress: Address;
  tokenID: string | bigint;
  name: string | null;
  description: string | null;
  location: string | null;
  bannerImage: string | null;
  gardeners: Address[] | null;
  operators: Address[] | null;
  evaluators: Address[] | null;
  owners: Address[] | null;
  funders: Address[] | null;
  communities: Address[] | null;
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
  firstGarden: Address | null;
  joinedVia: Address | null;
}

export interface IndexerGardenersResponse {
  Gardener: IndexerGardener[];
}
