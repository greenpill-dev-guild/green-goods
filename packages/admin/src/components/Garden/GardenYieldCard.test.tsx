import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    formatDate: (timestamp: number) => `date-${timestamp}`,
    formatTokenAmount: (value: bigint) => value.toString(),
  };
});

import { GardenYieldCard } from "./GardenYieldCard";

describe("GardenYieldCard", () => {
  it("renders cumulative totals from allocation history", () => {
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
    expect(screen.getByText("date-1700000000")).toBeTruthy();
  });
});
