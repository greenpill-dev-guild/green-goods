/**
 * @vitest-environment jsdom
 */

import { toConfirmFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { CommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const OTHER_GARDEN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const ROOT = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
const VIEWER = "0x1111111111111111111111111111111111111111" as const;

type UserModule = typeof import("@green-goods/shared/hooks/auth/useUser");
type PoolingModule = typeof import("@green-goods/shared/commitment-pooling");
type ProtocolPoolView = Pick<
  ReturnType<PoolingModule["useProtocolPool"]>,
  "poolId" | "rootGarden" | "isRegistered" | "isLoading" | "isError" | "refetch"
>;
type OwnPoolsView = {
  pools: Array<{ state: string; openSeasonCycleId: bigint | null; poolType?: string }>;
  isLoading: boolean;
};

const mocks = vi.hoisted(() => ({
  protocolPool: null as ProtocolPoolView | null,
  toConfirm: null as CommitmentsToConfirm | null,
  ownPools: null as OwnPoolsView | null,
  navigate: vi.fn(),
  confirmQueueProps: [] as CommitmentsToConfirm[],
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: (() => ({ primaryAddress: VIEWER })) as UserModule["useUser"],
}));

vi.mock(
  "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling")
      >();
    return {
      ...actual,
      useCommitmentPools: (() => mocks.ownPools!) as unknown as PoolingModule["useCommitmentPools"],
    };
  }
);

vi.mock(
  "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm")
      >();
    return {
      ...actual,
      useCommitmentsToConfirm: () => mocks.toConfirm!,
    };
  }
);

vi.mock("@green-goods/shared/hooks/commitment-pooling/useProtocolPool", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@green-goods/shared/hooks/commitment-pooling/useProtocolPool")
    >();
  return {
    ...actual,
    useProtocolPool: (() => mocks.protocolPool!) as unknown as PoolingModule["useProtocolPool"],
  };
});

// The operations card reads the settlement module through its own controller;
// this surface only needs to know it renders nothing for an ordinary steward.
vi.mock("@green-goods/shared/hooks/admin-ui/pool/useSettlementOperationsController", () => ({
  useSettlementOperationsController: () => ({
    chainId: 42161,
    viewer: VIEWER,
    availability: { status: "unknown-chain" },
    gardenerDeliveryEnabled: null,
    sourcePaused: null,
    owner: null,
    isSettlementOwner: false,
    isDeployer: false,
    canConfigureDelivery: false,
    showControl: false,
    isLoading: false,
    isError: false,
    isPending: false,
    lastAct: null,
    setGardenerDelivery: async () => "0x0",
    checkDeliveryStatus: async () => undefined,
    refetch: async () => undefined,
  }),
}));

vi.mock("@/views/Community/components/ProtocolFundingOperationsPanel", () => ({
  ProtocolFundingOperationsPanel: () => <div data-testid="protocol-funding-operations" />,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

// The confirm queue is tested on its own; here it only needs to prove what it was handed.
vi.mock("@/views/Hub/components/HubConfirmQueue", () => ({
  HubConfirmQueue: ({ toConfirm }: { toConfirm: CommitmentsToConfirm }) => {
    mocks.confirmQueueProps.push(toConfirm);
    return <div data-testid="protocol-confirm-queue" />;
  },
}));

const { CommunityPools } = await import("@/views/Community/components/CommunityPools");

function renderPools(garden: string = GARDEN, canManage = true) {
  return renderWithProviders(
    <CommunityPools
      chainId={42161}
      garden={{ id: garden as `0x${string}`, name: garden === ROOT ? "Green Goods" : "Rocinha" }}
      canManage={canManage}
    />
  );
}

describe("CommunityPools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmQueueProps = [];
    mocks.protocolPool = {
      poolId: 1n,
      rootGarden: ROOT,
      isRegistered: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    mocks.toConfirm = toConfirmFixture({
      groups: [],
      fallback: [],
      disputed: [],
      count: 0,
      isSteward: true,
      isProtocolSteward: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.ownPools = {
      pools: [{ state: "OPEN", openSeasonCycleId: 12n }],
      isLoading: false,
    };
  });

  it("gives an ordinary garden only its own pool: nothing of the protocol's, even for a protocol steward", () => {
    // The 2026-09-22 incident: this garden's Community tab set up the protocol pool.
    renderPools(GARDEN);
    expect(screen.getByTestId("current-garden-pool")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-pool")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protocol-confirm-queue")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(mocks.confirmQueueProps).toEqual([]);
  });

  it("shows the protocol's operations and confirmations inside the protocol garden", () => {
    renderPools(ROOT);
    expect(screen.getByTestId("protocol-pool")).toBeInTheDocument();
    expect(screen.getByTestId("protocol-funding-operations")).toBeInTheDocument();
    expect(screen.getByTestId("protocol-confirm-queue")).toBeInTheDocument();
    // The protocol pool's console is that garden's own Pool tab, not embedded here.
    expect(screen.getByTestId("current-garden-pool")).toBeInTheDocument();
  });

  it("knows the protocol garden by its pool's type when the chain read fails", () => {
    mocks.protocolPool = { ...mocks.protocolPool!, rootGarden: null, isError: true };
    mocks.ownPools = {
      pools: [{ state: "OPEN", openSeasonCycleId: 12n, poolType: "PROTOCOL" }],
      isLoading: false,
    };
    renderPools(ROOT);
    expect(screen.getByText(/couldn.t read the protocol pool/i)).toBeInTheDocument();
  });

  it("gives the protocol section only the cross-garden rows the team was asked into", () => {
    // A protocol steward who also stewards ordinary gardens carries those
    // gardens' own confirmations and disputes in the same object. Under a
    // heading promising no other garden's pool is browsed here, they are out.
    const fixture = toConfirmFixture();
    const protocolRow = {
      ...fixture.fallback[0]!,
      path: "PROTOCOL_FALLBACK" as const,
      garden: ROOT,
      gardenName: "Green Goods",
    };
    mocks.toConfirm = toConfirmFixture({
      groups: [
        {
          garden: OTHER_GARDEN,
          gardenName: "Awka",
          rows: [fixture.groups[0]!.rows[0]!, fixture.groups[0]!.rows[0]!],
        },
      ],
      fallback: [
        protocolRow,
        {
          ...fixture.fallback[0]!,
          path: "POOL_FALLBACK",
          garden: OTHER_GARDEN,
          gardenName: "Awka",
        },
      ],
      disputed: [
        {
          ...fixture.disputed![0]!,
          garden: OTHER_GARDEN,
          gardenName: "Awka",
        },
      ],
      count: 5,
      isProtocolSteward: true,
    });
    renderPools(ROOT);
    const handed = mocks.confirmQueueProps.at(-1);
    expect(handed?.groups).toEqual([]);
    expect(handed?.fallback).toEqual([protocolRow]);
    expect(handed?.disputed).toEqual([]);
    expect(handed?.count).toBe(1);
  });

  it("keeps the protocol confirmations queue from a steward who does not steward the protocol garden", () => {
    mocks.toConfirm = { ...mocks.toConfirm!, isProtocolSteward: false };
    renderPools(ROOT);
    expect(screen.queryByTestId("protocol-confirm-queue")).not.toBeInTheDocument();
    expect(screen.getByTestId("protocol-pool")).toBeInTheDocument();
  });

  it("says when no protocol pool is registered", () => {
    mocks.protocolPool = {
      ...mocks.protocolPool!,
      poolId: null,
      rootGarden: ROOT,
      isRegistered: false,
    };
    renderPools(ROOT);
    expect(screen.getByTestId("protocol-pool-unregistered")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-pool")).not.toBeInTheDocument();
  });

  it("shows loading and read-error casts for the protocol read", () => {
    mocks.protocolPool = { ...mocks.protocolPool!, isLoading: true };
    const first = renderPools(ROOT);
    expect(screen.getByRole("status", { name: /loading the protocol pool/i })).toBeInTheDocument();
    first.unmount();

    const refetch = vi.fn();
    mocks.protocolPool = { ...mocks.protocolPool!, isLoading: false, isError: true, refetch };
    renderPools(ROOT);
    expect(screen.getByText(/couldn.t read the protocol pool/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("is one tap into this garden's pool console, with its status", () => {
    renderPools(GARDEN);
    const card = screen.getByTestId("current-garden-pool");
    expect(within(card).getByText("Rocinha")).toBeInTheDocument();
    expect(within(card).getByText(/taking commitments/i)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /open the pool console/i }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/garden\/pool\?gardenId=/)
    );
  });
});
