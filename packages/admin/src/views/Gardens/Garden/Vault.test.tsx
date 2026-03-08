/**
 * GardenVaultView Tests
 * @vitest-environment jsdom
 */

import { renderWithProviders as render, screen } from "../../../__tests__/test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const TEST_MODULE = "0x9999999999999999999999999999999999999999" as const;

const testGarden = {
  id: TEST_GARDEN,
  name: "Garden Alpha",
};

const testVaults = [
  {
    id: "vault-usdc",
    chainId: 11155111,
    garden: TEST_GARDEN,
    asset: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    vaultAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    totalDeposited: 1000000n,
    totalWithdrawn: 0n,
    totalHarvestCount: 2,
    donationAddress: null,
    depositorCount: 3,
    paused: false,
    createdAt: 1,
  },
  {
    id: "vault-weth",
    chainId: 11155111,
    garden: TEST_GARDEN,
    asset: "0xcccccccccccccccccccccccccccccccccccccccc",
    vaultAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
    totalDeposited: 2000000000000000000n,
    totalWithdrawn: 0n,
    totalHarvestCount: 1,
    donationAddress: null,
    depositorCount: 1,
    paused: false,
    createdAt: 2,
  },
];

const mockUseReadContract = vi.fn();
const mockUseReadContracts = vi.fn();

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useReadContracts: (...args: unknown[]) => mockUseReadContracts(...args),
}));

vi.mock("@/components/Vault", () => ({
  DepositModal: () => null,
  PositionCard: () => <div data-testid="position-card" />,
  VaultEventHistory: () => <div data-testid="vault-history" />,
  WithdrawModal: () => null,
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    OCTANT_MODULE_ABI: [],
    getNetworkContracts: () => ({ octantModule: TEST_MODULE }),
    getVaultAssetSymbol: (asset: string) =>
      asset.toLowerCase() === testVaults[0].asset ? "USDC" : "WETH",
    useCurrentChain: () => 11155111,
    useGardenPermissions: () => ({
      canManageGarden: () => true,
      isOwnerOfGarden: () => true,
    }),
    useGardenVaults: () => ({
      vaults: testVaults,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    }),
    useGardens: () => ({
      data: [testGarden],
      isLoading: false,
    }),
    useUser: () => ({ primaryAddress: undefined }),
  };
});

import GardenVaultView from "./Vault";

function renderView(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/gardens/${TEST_GARDEN}/vault`, state }]}>
      <Routes>
        <Route path="/gardens/:id/vault" element={<GardenVaultView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("GardenVaultView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContract.mockReturnValue({ data: undefined });
    mockUseReadContracts.mockReturnValue({
      data: [
        { status: "success", result: 6 },
        { status: "success", result: 18 },
      ],
    });
  });

  it("uses the endowments route as the back destination when opened from there", () => {
    renderView({ returnTo: "/endowments", returnLabelId: "app.admin.nav.treasury" });

    expect(screen.getByRole("link", { name: "Endowments" })).toHaveAttribute("href", "/endowments");
  });

  it("renders mixed-asset totals as separate denominated values", () => {
    renderView();

    expect(screen.getByText("1 USDC")).toBeInTheDocument();
    expect(screen.getByText("2 WETH")).toBeInTheDocument();
  });
});
