import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";

export interface YieldAssetSummary {
  assetAddress: Address;
  totalYield: bigint;
  totalCookieJar: bigint;
  totalFractions: bigint;
  totalJuicebox: bigint;
  allocationCount: number;
}

export interface AggregateYieldSummary {
  assets: YieldAssetSummary[];
  allocationCount: number;
}

export const EMPTY_YIELD_SUMMARY: AggregateYieldSummary = {
  assets: [],
  allocationCount: 0,
};

export function summarizeYieldAllocations(
  allocations: YieldAllocation[] | undefined | null
): AggregateYieldSummary {
  if (!allocations || allocations.length === 0) return EMPTY_YIELD_SUMMARY;

  const assetMap = new Map<Address, YieldAssetSummary>();

  for (const allocation of allocations) {
    const existing = assetMap.get(allocation.assetAddress) ?? {
      assetAddress: allocation.assetAddress,
      totalYield: 0n,
      totalCookieJar: 0n,
      totalFractions: 0n,
      totalJuicebox: 0n,
      allocationCount: 0,
    };

    existing.totalYield += allocation.totalAmount;
    existing.totalCookieJar += allocation.cookieJarAmount;
    existing.totalFractions += allocation.fractionsAmount;
    existing.totalJuicebox += allocation.juiceboxAmount;
    existing.allocationCount += 1;

    assetMap.set(allocation.assetAddress, existing);
  }

  return {
    assets: Array.from(assetMap.values()).sort((a, b) =>
      a.assetAddress.localeCompare(b.assetAddress)
    ),
    allocationCount: allocations.length,
  };
}
