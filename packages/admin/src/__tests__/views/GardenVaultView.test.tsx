import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mockUseGardens = vi.fn();
const mockUseGardenVaults = vi.fn();
const mockUseGardenPermissions = vi.fn();
const mockUseLocation = vi.fn();
const mockRouteParams = { current: { id: "garden-1" } as { id?: string } };
const mockSelectedGarden = {
  current: { id: "garden-1", tokenAddress: "garden-1", name: "Alpha Garden" },
};

vi.mock("@green-goods/shared", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  adminRoutes: {
    communityTreasury: (search?: Record<string, string>) => {
      const query = search ? new URLSearchParams(search).toString() : "";
      return query ? `/community/treasury?${query}` : "/community/treasury";
    },
  },
  useAdminStore: (selector: (state: any) => any) =>
    selector({
      selectedGarden: mockSelectedGarden.current,
    }),
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: mockSelectedGarden.current,
  }),
  useGardens: () => mockUseGardens(),
  useGardenVaults: (...args: unknown[]) => mockUseGardenVaults(...args),
  useGardenPermissions: () => mockUseGardenPermissions(),
  useUser: () => ({ primaryAddress: "0x1234567890123456789012345678901234567890" }),
  useCurrentChain: () => 11155111,
  getNetworkContracts: () => ({ octantModule: "0x1111111111111111111111111111111111111111" }),
  OCTANT_MODULE_ABI: [],
  getNetDeposited: (deposited: bigint, withdrawn: bigint) =>
    deposited > withdrawn ? deposited - withdrawn : 0n,
  formatTokenAmount: (value: bigint, decimals = 18) =>
    `${Number(value) / 10 ** decimals}`.replace(/\.0$/, ""),
  getVaultAssetSymbol: () => "WETH",
}));

vi.mock("wagmi", () => ({
  useReadContract: () => ({ data: "0x1234567890123456789012345678901234567890" }),
  useReadContracts: () => ({ data: [] }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => mockRouteParams.current,
  useLocation: () => mockUseLocation(),
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ backLink, description }: { backLink?: { to: string }; description?: string }) =>
    React.createElement("div", {
      "data-testid": "page-header",
      "data-back-link": backLink?.to ?? "",
      "data-description": description ?? "",
    }),
}));

vi.mock("@/components/Vault", () => ({
  DepositModal: () => null,
  WithdrawModal: () => null,
  PositionCard: () => null,
  VaultEventHistory: () => null,
}));

import GardenVaultView from "@/views/Garden/Vault";

describe("GardenVaultView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteParams.current = { id: "garden-1" };
    mockSelectedGarden.current = { id: "garden-1", tokenAddress: "garden-1", name: "Alpha Garden" };
    mockUseGardenPermissions.mockReturnValue({
      canManageGarden: () => false,
      isOwnerOfGarden: () => false,
    });
    mockUseGardens.mockReturnValue({
      data: [{ id: "garden-1", name: "Alpha Garden" }],
      isLoading: false,
    });
    mockUseGardenVaults.mockReturnValue({
      vaults: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    });
  });

  it("links back to community treasury when opened from the treasury card", () => {
    mockUseLocation.mockReturnValue({ state: { returnTo: "/community/treasury" } });

    renderWithProviders(<GardenVaultView />);

    expect(screen.getByTestId("page-header")).toHaveAttribute(
      "data-back-link",
      "/community/treasury"
    );
  });

  it("defaults back to the selected garden treasury card without explicit return state", () => {
    mockUseLocation.mockReturnValue({ state: null });

    renderWithProviders(<GardenVaultView />);

    expect(screen.getByTestId("page-header")).toHaveAttribute(
      "data-back-link",
      "/community/treasury?gardenAddress=garden-1"
    );
  });

  it("matches the route garden case-insensitively before using the selected fallback", () => {
    mockRouteParams.current = { id: "GARDEN-1" };
    mockSelectedGarden.current = {
      id: "garden-2",
      tokenAddress: "garden-2",
      name: "Beta Garden",
    };
    mockUseLocation.mockReturnValue({ state: null });
    mockUseGardens.mockReturnValue({
      data: [{ id: "garden-1", name: "Alpha Garden" }],
      isLoading: false,
    });

    renderWithProviders(<GardenVaultView />);

    expect(screen.getByTestId("page-header")).toHaveAttribute(
      "data-description",
      "Manage direct endowment positions and impact-yield routing for Alpha Garden."
    );
    expect(mockUseGardenVaults).toHaveBeenCalledWith("garden-1", { enabled: true });
  });

  it("renders the selected garden vault context when the base garden list is stale", () => {
    mockRouteParams.current = {};
    mockSelectedGarden.current = {
      id: "garden-2",
      tokenAddress: "garden-2",
      name: "Beta Garden",
    };
    mockUseLocation.mockReturnValue({ state: null });
    mockUseGardens.mockReturnValue({
      data: [{ id: "garden-1", name: "Alpha Garden" }],
      isLoading: false,
    });

    renderWithProviders(<GardenVaultView />);

    expect(screen.getByTestId("page-header")).toHaveAttribute(
      "data-description",
      "Manage direct endowment positions and impact-yield routing for Beta Garden."
    );
    expect(mockUseGardenVaults).toHaveBeenCalledWith("garden-2", { enabled: true });
    expect(screen.queryByText("app.treasury.gardenNotFound")).not.toBeInTheDocument();
  });
});
