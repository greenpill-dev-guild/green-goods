import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const TEST_WETH = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";

const mockUseGardens = vi.fn();
const mockUseGardenVaults = vi.fn();
const mockUseMyVaultDeposits = vi.fn();
const mockUseVaultPreview = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatAddress: (value: string) => value.slice(0, 6),
    formatTokenAmount: (value: bigint) => (value === 0n ? "0" : `${Number(value) / 10 ** 18}`),
    getNetDeposited: (deposited: bigint, withdrawn: bigint) => deposited - withdrawn,
    getVaultAssetSymbol: (asset: string) => (asset.toLowerCase() === TEST_WETH ? "WETH" : "DAI"),
    ImageWithFallback: ({ alt }: { alt: string }) => React.createElement("div", null, alt),
    useDebouncedValue: <T,>(value: T) => value,
    useGardens: () => mockUseGardens(),
    useGardenVaults: (...args: unknown[]) => mockUseGardenVaults(...args),
    useMyVaultDeposits: (...args: unknown[]) => mockUseMyVaultDeposits(...args),
    useUser: () => ({ primaryAddress: "0x1111111111111111111111111111111111111111" }),
    useVaultPreview: (...args: unknown[]) => mockUseVaultPreview(...args),
  };
});

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }: any) =>
    React.createElement("a", { href: to, ...props }, children),
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
      ],
      isLoading: false,
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
});
