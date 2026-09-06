/** @vitest-environment jsdom */

import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const POOL = "0x2222222222222222222222222222222222222222";
const GARDEN = "0x1111111111111111111111111111111111111111";
const mocks = vi.hoisted(() => ({
  isOnline: true,
  isError: false,
  mutate: vi.fn(),
  refetchWeights: vi.fn(),
  refetchPower: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useUser: () => ({ primaryAddress: GARDEN }),
  };
});

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOnlineStatus: () => mocks.isOnline,
  };
});

vi.mock("@green-goods/shared/hooks/conviction/useConvictionStrategies", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useConvictionStrategies: () => ({ strategies: [POOL] }),
  };
});

vi.mock("@green-goods/shared/hooks/conviction/useHypercertConviction", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useHypercertConviction: () => ({
      weights: [{ hypercertId: 12n, weight: 40n }],
      isLoading: false,
      isError: mocks.isError,
      refetch: mocks.refetchWeights,
    }),
  };
});

vi.mock("@green-goods/shared/hooks/conviction/useMemberVotingPower", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useMemberVotingPower: () => ({
      power: { isEligible: true, pointsBudget: 100n, totalStake: 40n, allocations: [] },
      isLoading: false,
      isError: mocks.isError,
      refetch: mocks.refetchPower,
    }),
  };
});

vi.mock("@green-goods/shared/hooks/conviction/useGardenCommunity", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useGardenCommunity: () => ({ community: null }),
  };
});

vi.mock("@green-goods/shared/hooks/yield/useYieldAllocations", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useYieldAllocations: () => ({ allocations: [] }),
  };
});

vi.mock(
  "@green-goods/shared/hooks/conviction/useAllocateHypercertSupport",
  async (importOriginal) => {
    return {
      ...(await importOriginal()),
      useAllocateHypercertSupport: () => ({ mutate: mocks.mutate, isPending: false }),
    };
  }
);

const { ConvictionDrawer } = await import("@/components/Dialogs/ConvictionDrawer");

describe("ConvictionDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOnline = true;
    mocks.isError = false;
  });

  it("opens with an eligible allocation control and submits valid support", () => {
    renderWithProviders(
      <ConvictionDrawer isOpen onClose={vi.fn()} gardenAddress={GARDEN} gardenName="Rocinha" />
    );
    const input = screen.getByRole("spinbutton", { name: /points to allocate/i });
    const submit = screen.getByRole("button", { name: "Support" });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.click(submit);
    expect(mocks.mutate).toHaveBeenCalledWith(
      { poolAddress: POOL, signals: [{ hypercertId: 12n, deltaSupport: 30n }] },
      expect.any(Object)
    );
  });

  it("disables allocation while offline", () => {
    mocks.isOnline = false;
    renderWithProviders(
      <ConvictionDrawer isOpen onClose={vi.fn()} gardenAddress={GARDEN} gardenName="Rocinha" />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /points to allocate/i })).toBeDisabled();
  });

  it("retries both failed reads", () => {
    mocks.isError = true;
    renderWithProviders(
      <ConvictionDrawer isOpen onClose={vi.fn()} gardenAddress={GARDEN} gardenName="Rocinha" />
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mocks.refetchWeights).toHaveBeenCalledOnce();
    expect(mocks.refetchPower).toHaveBeenCalledOnce();
  });

  it("stays closed when the drawer is not open", () => {
    renderWithProviders(
      <ConvictionDrawer
        isOpen={false}
        onClose={vi.fn()}
        gardenAddress={GARDEN}
        gardenName="Rocinha"
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
