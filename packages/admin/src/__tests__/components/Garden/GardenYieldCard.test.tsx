import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  return {
    ...actual,
    formatDate: (timestamp: number) => `date-${timestamp}`,
    formatTokenAmount: (value: bigint) => value.toString(),
    getVaultAssetSymbol: (asset: string) =>
      asset.toLowerCase() === "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" ? "WETH" : "DAI",
    summarizeYieldAllocations: (allocations: Array<any>) => ({
      assets: allocations.map((allocation) => ({
        assetAddress: allocation.assetAddress,
        totalYield: allocation.totalAmount,
        totalCookieJar: allocation.cookieJarAmount,
        totalFractions: allocation.fractionsAmount,
        totalJuicebox: allocation.juiceboxAmount,
        allocationCount: 1,
      })),
      allocationCount: allocations.length,
    }),
    useCurrentChain: () => 42161,
    useGardenYieldWiringState: vi.fn(),
  };
});

import { GardenYieldCard } from "../../../components/Garden/GardenYieldCard";
import { useGardenYieldWiringState } from "@green-goods/shared";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const HYPERCERT_POOL = "0x2222222222222222222222222222222222222222";
const REPAIR_HREF = `/community/governance?gardenAddress=${GARDEN_ID}`;

function mockWiring(override: Partial<ReturnType<typeof useGardenYieldWiringState>> = {}): void {
  vi.mocked(useGardenYieldWiringState).mockReturnValue({
    isLoading: false,
    isError: false,
    isSuccess: true,
    isPending: false,
    data: undefined,
    error: null,
    wiringState: undefined,
    wiringStatus: undefined,
    repairHref: undefined,
    ...override,
  } as ReturnType<typeof useGardenYieldWiringState>);
}

describe("GardenYieldCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWiring();
  });

  it("derives cumulative totals from allocation history", () => {
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
    expect(screen.getByText("date-1700000000")).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });
});

describe("GardenYieldCard wiring deep link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("non-connected with known expected pool: deep links to /community and shows no Connect to yield button", () => {
    mockWiring({
      wiringStatus: "missing-resolver-wiring",
      wiringState: {
        readStatus: "available",
        status: "missing-resolver-wiring",
        gardenAddress: GARDEN_ID as `0x${string}`,
        expectedHypercertPoolAddress: HYPERCERT_POOL as `0x${string}`,
        canRepairFromCommunity: true,
        repairHref: REPAIR_HREF,
        issues: ["resolver-hypercert-pool-missing"],
      },
      repairHref: REPAIR_HREF,
    });

    renderWithProviders(
      <MemoryRouter>
        <GardenYieldCard
          allocations={[]}
          allocationsLoading={false}
          gardenAddress={GARDEN_ID as `0x${string}`}
        />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /Reconnect from Community/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toContain("/community/governance");
    expect(link.getAttribute("href")).toContain(`gardenAddress=${GARDEN_ID}`);
    expect(screen.queryByRole("button", { name: /Connect to yield/i })).not.toBeInTheDocument();
  });

  it("missing-pool: shows muted hint without link", () => {
    mockWiring({
      wiringStatus: "missing-pool",
      wiringState: {
        readStatus: "available",
        status: "missing-pool",
        gardenAddress: GARDEN_ID as `0x${string}`,
        canRepairFromCommunity: true,
        repairHref: REPAIR_HREF,
        issues: ["typed-hypercert-pool-missing"],
      },
      repairHref: REPAIR_HREF,
    });

    renderWithProviders(
      <MemoryRouter>
        <GardenYieldCard
          allocations={[]}
          allocationsLoading={false}
          gardenAddress={GARDEN_ID as `0x${string}`}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Fractions routing needs review/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Reconnect from Community/i })
    ).not.toBeInTheDocument();
  });

  it("unavailable readStatus: shows muted hint without link", () => {
    mockWiring({
      wiringStatus: undefined,
      wiringState: {
        readStatus: "unavailable",
        status: undefined,
        gardenAddress: GARDEN_ID as `0x${string}`,
        canRepairFromCommunity: false,
        issues: ["contract-read-unavailable"],
      },
      repairHref: undefined,
    });

    renderWithProviders(
      <MemoryRouter>
        <GardenYieldCard
          allocations={[]}
          allocationsLoading={false}
          gardenAddress={GARDEN_ID as `0x${string}`}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Wiring status unavailable/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Reconnect from Community/i })
    ).not.toBeInTheDocument();
  });
});
