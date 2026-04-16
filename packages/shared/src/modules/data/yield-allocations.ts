import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import { logger } from "../app/logger";
import { greenGoodsIndexer } from "./graphql-client";

const YIELD_ALLOCATION_FIELDS = `
  garden
  asset
  cookieJarAmount
  fractionsAmount
  juiceboxAmount
  totalAmount
  timestamp
  txHash
`;

const ALL_YIELD_ALLOCATIONS_QUERY = /* GraphQL */ `
  query AllYieldAllocations($chainId: Int!) {
    YieldAllocation(
      where: { chainId: { _eq: $chainId } }
      order_by: { timestamp: desc }
    ) {
      ${YIELD_ALLOCATION_FIELDS}
    }
  }
`;

const GARDEN_YIELD_ALLOCATIONS_QUERY = /* GraphQL */ `
  query GardenYieldAllocations($garden: String!, $chainId: Int!) {
    YieldAllocation(
      where: { garden: { _eq: $garden }, chainId: { _eq: $chainId } }
      order_by: { timestamp: desc }
    ) {
      ${YIELD_ALLOCATION_FIELDS}
    }
  }
`;

interface YieldAllocationRow {
  garden: string;
  asset: string;
  cookieJarAmount: string;
  fractionsAmount: string;
  juiceboxAmount: string;
  totalAmount: string;
  timestamp: number;
  txHash: string;
}

interface AllYieldAllocationsResponse {
  YieldAllocation?: YieldAllocationRow[];
}

interface GardenYieldAllocationsResponse {
  YieldAllocation?: YieldAllocationRow[];
}

function mapYieldAllocation(row: YieldAllocationRow): YieldAllocation {
  return {
    gardenAddress: row.garden.toLowerCase() as Address,
    assetAddress: row.asset.toLowerCase() as Address,
    cookieJarAmount: BigInt(row.cookieJarAmount),
    fractionsAmount: BigInt(row.fractionsAmount),
    juiceboxAmount: BigInt(row.juiceboxAmount),
    totalAmount: BigInt(row.totalAmount),
    timestamp: row.timestamp,
    txHash: row.txHash,
  };
}

/**
 * Fetch all yield allocation records across all gardens for a chain.
 * Used for protocol-wide yield aggregation.
 */
export async function getAllYieldAllocations(
  chainId: number = DEFAULT_CHAIN_ID
): Promise<YieldAllocation[]> {
  const { data, error } = await greenGoodsIndexer.query<AllYieldAllocationsResponse>(
    ALL_YIELD_ALLOCATIONS_QUERY,
    { chainId },
    "AllYieldAllocations"
  );

  if (error) {
    logger.error("[getAllYieldAllocations] Indexer query failed", {
      chainId,
      error: error.message,
    });
    throw new Error(`Failed to load yield allocations: ${error.message}`);
  }

  return (data?.YieldAllocation ?? []).map(mapYieldAllocation);
}

/**
 * Fetch all yield allocation records for a single garden on a chain.
 * Used for garden-scoped yield aggregation.
 */
export async function getGardenYieldAllocations(
  gardenAddress: Address,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<YieldAllocation[]> {
  const normalizedGarden = gardenAddress.toLowerCase() as Address;
  const { data, error } = await greenGoodsIndexer.query<GardenYieldAllocationsResponse>(
    GARDEN_YIELD_ALLOCATIONS_QUERY,
    { garden: normalizedGarden, chainId },
    "GardenYieldAllocations"
  );

  if (error) {
    logger.error("[getGardenYieldAllocations] Indexer query failed", {
      gardenAddress: normalizedGarden,
      chainId,
      error: error.message,
    });
    throw new Error(`Failed to load garden yield allocations: ${error.message}`);
  }

  return (data?.YieldAllocation ?? []).map(mapYieldAllocation);
}
