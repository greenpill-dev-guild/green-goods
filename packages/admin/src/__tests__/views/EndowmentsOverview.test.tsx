import React from "react";
import { within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const TEST_WETH = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";
const TEST_DAI = "0x68194a729c2450ad26072b3d33adacbcef39d574";

const mockUseGardens = vi.fn();
const mockUseGardenVaults = vi.fn();
const mockUseHarvestableYield = vi.fn();
const mockUseMyVaultDeposits = vi.fn();
const mockUseVaultPreview = vi.fn();
const mockUseProtocolYieldSummary = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatAddress: (value: string) => value.slice(0, 6),
    formatTokenAmount: (value: bigint, decimals = 18, precision = 2) => {
      const amount = Number(value) / 10 ** decimals;
      return amount.toFixed(precision).replace(/\.?0+$/, "");
    },
    getNetDeposited: (deposited: bigint, withdrawn: bigint) => deposited - withdrawn,
    getVaultAssetSymbol: (asset: string) => (asset.toLowerCase() === TEST_WETH ? "WETH" : "DAI"),
    ImageWithFallback: ({ alt }: { alt: string }) => React.createElement("div", null, alt),
    useGardens: () => mockUseGardens(),
    useGardenVaults: (...args: unknown[]) => mockUseGardenVaults(...args),
    useHarvestableYield: (...args: unknown[]) => mockUseHarvestableYield(...args),
    useMyVaultDeposits: (...args: unknown[]) => mockUseMyVaultDeposits(...args),
    useUser: () => ({ primaryAddress: "0x1111111111111111111111111111111111111111" }),
    useVaultPreview: (...args: unknown[]) => mockUseVaultPreview(...args),
    useProtocolYieldSummary: (...args: unknown[]) => mockUseProtocolYieldSummary(...args),
  };
});

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }: any) =>
    React.createElement("a", { href: to, ...props }, children),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    React.createElement(
      "div",
      { "data-testid": "page-header" },
      React.createElement("h1", null, title),
      description ? React.createElement("p", null, description) : null
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

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) =>
    React.createElement("div", null, title, description),
}));

vi.mock("@/components/ui/ListToolbar", () => ({
  ListToolbar: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/SortSelect", () => ({
  SortSelect: () => React.createElement("div", null, "sort"),
}));

import EndowmentsOverview from "@/views/Endowments";

describe("EndowmentsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({
      data: [{ id: "garden-1", name: "Alpha Garden", location: "One" }],
      isLoading: false,
    });
    mockUseGardenVaults.mockReturnValue({
      vaults: [
        {
          id: "vault-1",
          chainId: 11155111,
          garden: "garden-1",
          asset: TEST_WETH,
          vaultAddress: "0x4444444444444444444444444444444444444444",
          totalDeposited: 1_000_000_000_000_000_000n,
          totalWithdrawn: 0n,
          totalHarvestCount: 3,
        },
        {
          id: "vault-2",
          chainId: 11155111,
          garden: "garden-1",
          asset: TEST_DAI,
          vaultAddress: "0x5555555555555555555555555555555555555555",
          totalDeposited: 2_000_000_000_000_000_000n,
          totalWithdrawn: 0n,
          totalHarvestCount: 1,
        },
      ],
      isLoading: false,
    });
    mockUseHarvestableYield.mockReturnValue({
      entries: [
        {
          vaultAddress: "0x4444444444444444444444444444444444444444",
          assetAddress: TEST_WETH,
          harvestable: 3_000_000_000_000_000_000n,
        },
        {
          vaultAddress: "0x5555555555555555555555555555555555555555",
          assetAddress: TEST_DAI,
          harvestable: 2_000_000_000_000_000_000n,
        },
      ],
      total: 5_000_000_000_000_000_000n,
      isLoading: false,
      isError: false,
    });
    mockUseMyVaultDeposits.mockReturnValue({
      deposits: [
        {
          id: "deposit-1",
          garden: "garden-1",
          asset: TEST_WETH,
          chainId: 11155111,
          vaultAddress: "0x4444444444444444444444444444444444444444",
          shares: 1_000_000_000_000_000_000n,
          totalDeposited: 1_000_000_000_000_000_000n,
          totalWithdrawn: 0n,
        },
      ],
      isLoading: false,
    });
    mockUseVaultPreview.mockReturnValue({
      preview: { previewAssets: 1_000_000_000_000_000_000n },
      isLoading: false,
    });
    mockUseProtocolYieldSummary.mockReturnValue({
      summary: {
        totalYield: 5_000_000_000_000_000_000n,
        totalCookieJar: 1_000_000_000_000_000_000n,
        totalFractions: 2_000_000_000_000_000_000n,
        totalJuicebox: 2_000_000_000_000_000_000n,
        allocationCount: 2,
        assets: [
          {
            assetAddress: TEST_WETH,
            totalYield: 3_000_000_000_000_000_000n,
            totalCookieJar: 1_000_000_000_000_000_000n,
            totalFractions: 1_000_000_000_000_000_000n,
            totalJuicebox: 1_000_000_000_000_000_000n,
            allocationCount: 1,
          },
          {
            assetAddress: TEST_DAI,
            totalYield: 2_000_000_000_000_000_000n,
            totalCookieJar: 0n,
            totalFractions: 1_000_000_000_000_000_000n,
            totalJuicebox: 1_000_000_000_000_000_000n,
            allocationCount: 1,
          },
        ],
      },
      isLoading: false,
    });
  });

  it("renders impact-vault wording for depositor positions", () => {
    renderWithProviders(<EndowmentsOverview />);

    expect(screen.getByText("Overview of gardens with active impact vaults.")).toBeInTheDocument();
    expect(screen.getByText("Current claim value")).toBeInTheDocument();
    expect(screen.getByText("Depositor value delta")).toBeInTheDocument();
    expect(
      screen.getByText(/Flat by design: harvest moves yield to gardens, not into depositor PPS/i)
    ).toBeInTheDocument();
  });

  it("renders protocol yield totals for WETH and DAI", () => {
    renderWithProviders(<EndowmentsOverview />);

    const totalYieldCard = screen.getByText("Total yield generated").parentElement;

    expect(totalYieldCard).not.toBeNull();
    expect(within(totalYieldCard as HTMLElement).getByText("3 WETH")).toBeInTheDocument();
    expect(within(totalYieldCard as HTMLElement).getByText("2 DAI")).toBeInTheDocument();
  });

  it("renders per-garden yield generated by asset", () => {
    renderWithProviders(<EndowmentsOverview />);

    expect(screen.getByText("Yield generated")).toBeInTheDocument();
    expect(screen.getByText("+3 WETH")).toBeInTheDocument();
    expect(screen.getByText("+2 DAI")).toBeInTheDocument();
  });

  it("shows extra precision for small non-zero yield values", () => {
    mockUseHarvestableYield.mockReturnValue({
      entries: [
        {
          vaultAddress: "0x4444444444444444444444444444444444444444",
          assetAddress: TEST_WETH,
          harvestable: 2_202_696_766_662_230n,
        },
        {
          vaultAddress: "0x5555555555555555555555555555555555555555",
          assetAddress: TEST_DAI,
          harvestable: 194_765_311_042_911_914n,
        },
      ],
      total: 196_968_007_809_574_144n,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<EndowmentsOverview />);

    const totalYieldCard = screen.getByText("Total yield generated").parentElement;

    expect(totalYieldCard).not.toBeNull();
    expect(within(totalYieldCard as HTMLElement).getByText("0.002203 WETH")).toBeInTheDocument();
    expect(within(totalYieldCard as HTMLElement).getByText("0.19 DAI")).toBeInTheDocument();
  });
});
