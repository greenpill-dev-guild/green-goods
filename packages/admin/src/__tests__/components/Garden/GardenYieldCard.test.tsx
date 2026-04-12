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

import { GardenYieldCard } from "../../../components/Garden/GardenYieldCard";

describe("GardenYieldCard", () => {
  it("derives cumulative totals from allocation history", () => {
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
      />
    );

    expect(screen.getAllByText("600")).toHaveLength(2);
    expect(screen.getByText("date-1700000000")).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });
});
