import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const mockUseGardens = vi.fn();
const mockUseGardenVaults = vi.fn();
const mockUseGardenPermissions = vi.fn();
const mockUseLocation = vi.fn();

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
      selectedGarden: { id: "garden-1", name: "Alpha Garden" },
    }),
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: { id: "garden-1", name: "Alpha Garden" },
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
  useParams: () => ({ id: "garden-1" }),
  useLocation: () => mockUseLocation(),
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ backLink }: { backLink?: { to: string } }) =>
    React.createElement("div", {
      "data-testid": "page-header",
      "data-back-link": backLink?.to ?? "",
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
      "/community/treasury?gardenId=garden-1"
    );
  });
});
