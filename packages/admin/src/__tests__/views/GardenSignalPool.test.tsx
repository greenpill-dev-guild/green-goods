/**
 * The signal pool view decides which item IDs a steward may register, hides registration while the
 * registered list cannot be read (the duplicate check would be blind), shows each item's share of
 * the pool's conviction, removes an item only after confirmation, and calls a pool missing only once
 * the garden's pool list has been read.
 */

import { PoolType } from "@green-goods/shared/types/gardens-community";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen } from "../test-utils";

const GARDEN = "0x2222222222222222222222222222222222222222";
const POOL = "0x6666666666666666666666666666666666666666";

const state = vi.hoisted(() => ({
  pools: {
    pools: [] as { poolType: number; poolAddress: string }[],
    poolsRead: true,
    poolsUnread: false,
    refetch: (() => {}) as () => unknown,
  },
  registered: { hypercertIds: [] as bigint[], isLoading: false, isError: false, refetch: () => {} },
  conviction: {
    weights: [] as { hypercertId: bigint; weight: bigint }[],
    isLoading: false,
    isError: false,
    refetch: () => {},
  },
  register: vi.fn(),
  deregister: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [{ id: GARDEN, name: "Alpha Garden" }], isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({ selectedGarden: { id: GARDEN } }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({ canManageGarden: () => true }),
}));
vi.mock("@green-goods/shared/hooks/conviction/useGardenPools", () => ({
  useGardenPools: () => state.pools,
}));
vi.mock("@green-goods/shared/hooks/conviction/useRegisteredHypercerts", () => ({
  useRegisteredHypercerts: () => state.registered,
}));
vi.mock("@green-goods/shared/hooks/conviction/useHypercertConviction", () => ({
  useHypercertConviction: () => state.conviction,
}));
vi.mock("@green-goods/shared/hooks/conviction/useRegisterHypercert", () => ({
  useRegisterHypercert: () => ({ mutate: state.register, isPending: false }),
}));
vi.mock("@green-goods/shared/hooks/conviction/useDeregisterHypercert", () => ({
  useDeregisterHypercert: () => ({ mutate: state.deregister, isPending: false }),
}));
vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => address,
}));

import GardenSignalPoolView from "@/views/Garden/SignalPool";

function renderPool() {
  return renderWithProviders(
    <MemoryRouter>
      <GardenSignalPoolView layout="inline" poolType="hypercert" />
    </MemoryRouter>
  );
}

function register(id: string) {
  fireEvent.change(screen.getByLabelText("Hypercert token ID"), { target: { value: id } });
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
}

beforeEach(() => {
  state.pools = {
    pools: [{ poolType: PoolType.HypercertSignal, poolAddress: POOL }],
    poolsRead: true,
    poolsUnread: false,
    refetch: () => {},
  };
  state.registered = { hypercertIds: [7n], isLoading: false, isError: false, refetch: () => {} };
  state.conviction = { weights: [], isLoading: false, isError: false, refetch: () => {} };
  state.register.mockReset();
  state.deregister.mockReset();
});

describe("GardenSignalPoolView", () => {
  it.each([
    { input: "twelve", error: "Must be a valid number" },
    { input: "-1", error: "Invalid hypercert ID" },
    { input: " 7 ", error: "This hypercert is already registered" },
  ])("refuses to register $input", ({ input, error }) => {
    renderPool();

    register(input);

    expect(screen.getByText(error)).toBeInTheDocument();
    expect(state.register).not.toHaveBeenCalled();
  });

  it("registers a new item ID in this garden's pool", () => {
    renderPool();

    register(" 9 ");

    expect(state.register).toHaveBeenCalledWith(
      { poolAddress: POOL, hypercertId: 9n },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it("hides registration while the registered items cannot be read", () => {
    state.registered = { ...state.registered, isError: true };
    renderPool();

    expect(screen.queryByLabelText("Hypercert token ID")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("offers a retry, not a missing pool, when the garden's pool list cannot be read", () => {
    const refetch = vi.fn();
    state.pools = { pools: [], poolsRead: false, poolsUnread: true, refetch };
    renderPool();

    expect(screen.queryByText("Signal pool not found for this garden.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("calls the pool missing once the garden's pool list is read without it", () => {
    state.pools = { ...state.pools, pools: [] };
    renderPool();

    expect(screen.getByText("Signal pool not found for this garden.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows each item's share of the pool's conviction", () => {
    state.registered = { ...state.registered, hypercertIds: [7n, 8n] };
    state.conviction = {
      ...state.conviction,
      weights: [
        { hypercertId: 7n, weight: 1n },
        { hypercertId: 8n, weight: 3n },
      ],
    };
    renderPool();

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("removes an item only after the steward confirms", () => {
    renderPool();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(state.deregister).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(state.deregister).toHaveBeenCalledWith(
      { poolAddress: POOL, hypercertId: 7n },
      expect.objectContaining({ onSettled: expect.any(Function) })
    );
  });
});
