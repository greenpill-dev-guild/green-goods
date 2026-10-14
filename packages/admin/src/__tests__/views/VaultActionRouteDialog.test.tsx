import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "../test-utils";
import { VaultActionRouteDialog } from "@/views/Community/components/VaultActionRouteDialog";

const GARDEN = "0x2222222222222222222222222222222222222222";
const mocks = vi.hoisted(() => ({ vaults: vi.fn(), navigate: vi.fn(), refetch: vi.fn() }));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [], isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({ selectedGarden: undefined }),
}));
vi.mock("@green-goods/shared/hooks/vault/useGardenVaults", () => ({
  useGardenVaults: (...args: unknown[]) => mocks.vaults(...args),
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/components/Vault", () => ({
  DepositModal: ({ gardenAddress }: { gardenAddress: string }) => (
    <div>Deposit for {gardenAddress}</div>
  ),
  WithdrawModal: ({ gardenAddress }: { gardenAddress: string }) => (
    <div>Withdraw for {gardenAddress}</div>
  ),
}));

describe("VaultActionRouteDialog address rejection and recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.vaults.mockReturnValue({
      vaults: [],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });
  });
  it.each([
    "community-garden",
    "0xwrong",
    undefined,
  ])("rejects garden %s without leaving a disabled query loading", (gardenAddress) => {
    renderWithProviders(<VaultActionRouteDialog action="deposit" gardenAddress={gardenAddress} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Garden not found");
    expect(screen.queryByText("Loading vault data...")).not.toBeInTheDocument();
    expect(mocks.vaults).toHaveBeenCalledWith(undefined, { enabled: false });
  });
  it("does not retry a cached unscoped error for an invalid address", () => {
    mocks.vaults.mockReturnValue({
      vaults: [],
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    renderWithProviders(<VaultActionRouteDialog action="withdraw" gardenAddress="bad-garden" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Garden not found");
    expect(screen.queryByRole("button", { name: "Try Again" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.navigate).toHaveBeenCalled();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
  it("shows loading for a valid scoped read", () => {
    mocks.vaults.mockReturnValue({
      vaults: [],
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    renderWithProviders(<VaultActionRouteDialog action="deposit" gardenAddress={GARDEN} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading vault data...");
    expect(mocks.vaults).toHaveBeenCalledWith(GARDEN, { enabled: true });
  });
  it("lets a valid address retry a failed vault read", () => {
    mocks.vaults.mockReturnValue({
      vaults: [],
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    renderWithProviders(<VaultActionRouteDialog action="withdraw" gardenAddress={GARDEN} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load vault data");
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it.each([
    "deposit",
    "withdraw",
  ] as const)("passes the validated garden into the %s form", (action) => {
    renderWithProviders(<VaultActionRouteDialog action={action} gardenAddress={GARDEN} />);
    expect(
      screen.getByText(`${action === "deposit" ? "Deposit" : "Withdraw"} for ${GARDEN}`)
    ).toBeInTheDocument();
  });
});
