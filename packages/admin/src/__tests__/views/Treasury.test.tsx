import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const TEST_WETH = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";
const TEST_DAI = "0x68194a729c2450ad26072b3d33adacbcef39d574";

const mockUseGardens = vi.fn();
const mockUseGardenVaults = vi.fn();

vi.mock(import("@green-goods/shared"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useGardens: () => mockUseGardens(),
    useGardenVaults: (...args: unknown[]) => mockUseGardenVaults(...args),
    useDebouncedValue: <T,>(value: T) => value,
    getVaultAssetSymbol: (asset: string) => (asset.toLowerCase() === TEST_WETH ? "WETH" : "DAI"),
  };
});

vi.mock("wagmi", () => ({
  useReadContracts: () => ({
    data: [
      { result: 18, status: "success" },
      { result: 18, status: "success" },
    ],
  }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, state, children, ...props }: any) =>
    React.createElement(
      "a",
      { href: to, "data-state": JSON.stringify(state ?? null), ...props },
      children
    ),
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ title, toolbar }: { title: string; toolbar?: React.ReactNode }) =>
    React.createElement(
      "div",
      { "data-testid": "page-header" },
      React.createElement("h1", null, title),
      toolbar
    ),
}));

vi.mock("@/components/StatCard", () => ({
  StatCard: ({ label, value }: { label: string; value: React.ReactNode }) =>
    React.createElement(
      "div",
      null,
      React.createElement("span", null, label),
      React.createElement("span", null, value)
    ),
}));

import TreasuryOverview from "@/views/Treasury";

describe("TreasuryOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({
      data: [
        { id: "garden-1", name: "Alpha Garden", location: "One" },
        { id: "garden-2", name: "Beta Garden", location: "Two" },
      ],
      isLoading: false,
    });
    mockUseGardenVaults.mockReturnValue({
      vaults: [
        {
          id: "vault-1",
          chainId: 11155111,
          garden: "garden-1",
          asset: TEST_WETH,
          totalDeposited: 1000000000000000000n,
          totalWithdrawn: 0n,
          totalHarvestCount: 2,
        },
        {
          id: "vault-2",
          chainId: 11155111,
          garden: "garden-2",
          asset: TEST_DAI,
          totalDeposited: 2000000000000000000n,
          totalWithdrawn: 0n,
          totalHarvestCount: 3,
        },
      ],
      isLoading: false,
    });
  });

  it("avoids showing a misleading summed TVL when multiple assets are present", () => {
    renderWithProviders(<TreasuryOverview />);

    // With multiple asset types the TVL stat shows per-asset totals separated by " / "
    // instead of a single misleading sum. DAI sorts before WETH alphabetically.
    expect(screen.getByText("2 DAI / 1 WETH")).toBeInTheDocument();
    // The sort-by-TVL option is not offered when assets are heterogeneous
    expect(screen.queryByRole("option", { name: "Highest TVL" })).not.toBeInTheDocument();
  });
});
