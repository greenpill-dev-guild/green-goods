import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders, screen } from "@/__tests__/test-utils";

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useGardenYieldWiringState: vi.fn(),
  };
});

import { GardenCommunityCard } from "../../../components/Garden/GardenCommunityCard";
import { PoolType, useGardenYieldWiringState } from "@green-goods/shared";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const HYPERCERT_POOL = "0x2222222222222222222222222222222222222222";
const ACTION_POOL = "0x3333333333333333333333333333333333333333";
const RESOLVER_POOL_OTHER = "0x4444444444444444444444444444444444444444";
const REPAIR_HREF = `/community/governance?gardenAddress=${GARDEN_ID}`;

const baseProps = {
  community: { weightScheme: 0 },
  communityLoading: false,
  pools: [
    { poolType: PoolType.Hypercert, poolAddress: HYPERCERT_POOL as `0x${string}` },
    { poolType: PoolType.Action, poolAddress: ACTION_POOL as `0x${string}` },
  ],
  gardenId: GARDEN_ID,
  canManage: true,
  isCreatingPools: false,
  onCreatePools: vi.fn().mockResolvedValue(undefined),
  onScheduleRefetch: vi.fn(),
};

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

function renderCard(propsOverride: Partial<typeof baseProps> = {}) {
  return renderWithProviders(
    <MemoryRouter>
      <GardenCommunityCard {...baseProps} {...propsOverride} />
    </MemoryRouter>
  );
}

describe("GardenCommunityCard yield wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connected: shows healthy wiring status with no Connect to yield action", () => {
    mockWiring({
      wiringStatus: "connected",
      wiringState: {
        readStatus: "available",
        status: "connected",
        gardenAddress: GARDEN_ID as `0x${string}`,
        expectedHypercertPoolAddress: HYPERCERT_POOL as `0x${string}`,
        resolverHypercertPoolAddress: HYPERCERT_POOL as `0x${string}`,
        canRepairFromCommunity: false,
        issues: [],
      },
      repairHref: undefined,
    });

    renderCard();

    expect(screen.getByText("Yield connected")).toBeInTheDocument();
    expect(screen.queryByText("Connect to yield")).not.toBeInTheDocument();
  });

  it("missing-resolver-wiring with known expected pool: shows Connect to yield link to /community/governance", () => {
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

    renderCard();

    const link = screen.getByRole("link", { name: /Connect to yield/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toContain("/community/governance");
    expect(link.getAttribute("href")).toContain(`gardenAddress=${GARDEN_ID}`);
  });

  it("mismatch with known expected pool: shows Connect to yield link", () => {
    mockWiring({
      wiringStatus: "mismatch",
      wiringState: {
        readStatus: "available",
        status: "mismatch",
        gardenAddress: GARDEN_ID as `0x${string}`,
        expectedHypercertPoolAddress: HYPERCERT_POOL as `0x${string}`,
        resolverHypercertPoolAddress: RESOLVER_POOL_OTHER as `0x${string}`,
        canRepairFromCommunity: true,
        repairHref: REPAIR_HREF,
        issues: ["resolver-hypercert-pool-mismatch"],
      },
      repairHref: REPAIR_HREF,
    });

    renderCard();

    const link = screen.getByRole("link", { name: /Connect to yield/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toContain(`gardenAddress=${GARDEN_ID}`);
  });

  it("missing-pool: shows review hint and no Connect to yield link", () => {
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

    renderCard();

    expect(screen.getByText(/Hypercert pool identity needs review/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Connect to yield/i })).not.toBeInTheDocument();
  });

  it("unavailable readStatus: shows muted hint and no Connect to yield link", () => {
    mockWiring({
      wiringStatus: undefined,
      wiringState: {
        readStatus: "unavailable",
        status: undefined,
        gardenAddress: GARDEN_ID as `0x${string}`,
        canRepairFromCommunity: false,
        issues: ["contract-read-unavailable"],
        readErrorMessage: "rpc fail",
      },
      repairHref: undefined,
    });

    renderCard();

    expect(screen.getByText(/Yield wiring status unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Connect to yield/i })).not.toBeInTheDocument();
  });

  it("no-pools branch: still shows Create Signal Pools and no wiring section", () => {
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

    renderCard({ pools: [] });

    expect(screen.getByText("Create Signal Pools")).toBeInTheDocument();
    expect(screen.queryByText("Yield connected")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Connect to yield/i })).not.toBeInTheDocument();
  });
});
