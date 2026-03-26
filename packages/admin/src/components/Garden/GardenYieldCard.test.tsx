import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    formatDate: (timestamp: number) => `date-${timestamp}`,
    formatTokenAmount: (value: bigint) => value.toString(),
    getVaultAssetSymbol: (asset: string) =>
      asset.toLowerCase() === "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" ? "WETH" : "DAI",
    summarizeYieldAllocations: (allocations: Array<any>) => ({
      assets: allocations.map((allocation) => ({
        assetAddress: allocation.assetAddress,
        totalYield: allocation.totalAmount,
        totalCookieJar: allocation.cookieJarAmount,
        totalFractions: allocation.fractionsAmount,
        totalJuicebox: allocation.juiceboxAmount,
        allocationCount: 1,
      })),
      allocationCount: allocations.length,
    }),
    useCurrentChain: () => 42161,
  };
});

import { GardenYieldCard } from "./GardenYieldCard";

describe("GardenYieldCard", () => {
  it("falls back to allocation history while the unlimited summary is still loading", () => {
    renderWithProviders(
      <GardenYieldCard
        allocations={[
          {
            gardenAddress: "0x1111111111111111111111111111111111111111",
            assetAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            cookieJarAmount: 100n,
            fractionsAmount: 200n,
            juiceboxAmount: 300n,
            totalAmount: 600n,
            timestamp: 1700000000,
            txHash: "0xabc",
          },
        ]}
        allocationsLoading={false}
        summary={{ assets: [], allocationCount: 0 }}
        summaryLoading
      />
    );

    expect(screen.getAllByText("600 WETH")).toHaveLength(2);
    expect(screen.queryByText(/^0 WETH$/)).not.toBeInTheDocument();
  });
});
