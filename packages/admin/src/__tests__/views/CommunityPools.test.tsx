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
  pools: Array<{ state: string; openSeasonCycleId: bigint | null }>;
  isLoading: boolean;
};

const mocks = vi.hoisted(() => ({
  protocolPool: null as ProtocolPoolView | null,
  toConfirm: null as CommitmentsToConfirm | null,
  ownPools: null as OwnPoolsView | null,
  navigate: vi.fn(),
  poolTabGardens: [] as string[],
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

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

// The pool console and the confirm queue are tested on their own; here they
// only need to prove which garden they were handed.
vi.mock("@/views/Garden/Pool", () => ({
  GardenPoolTab: ({
    garden,
    presentation,
  }: {
    garden: { id: string };
    presentation?: { protocolContext?: boolean };
  }) => {
    mocks.poolTabGardens.push(garden.id);
    return (
      <div data-testid="pool-tab">
        {garden.id}:{presentation?.protocolContext ? "protocol" : "garden"}
      </div>
    );
  },
}));
vi.mock("@/views/Hub/components/HubConfirmQueue", () => ({
  HubConfirmQueue: ({ toConfirm }: { toConfirm: CommitmentsToConfirm }) => {
    mocks.confirmQueueProps.push(toConfirm);
    return <div data-testid="protocol-confirm-queue" />;
  },
}));

const { CommunityPools } = await import("@/views/Community/components/CommunityPools");

function renderPools(canManage = true) {
  return renderWithProviders(
    <CommunityPools
      chainId={42161}
      garden={{ id: GARDEN, name: "Rocinha" }}
      canManage={canManage}
    />
  );
}

describe("CommunityPools (W12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.poolTabGardens = [];
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

  it("offers exactly two tabs, Protocol pool and This garden", () => {
    renderPools();
    const rail = screen.getByRole("tablist", { name: /pools/i });
    expect(
      within(rail)
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual([expect.stringMatching(/protocol pool/i), expect.stringMatching(/this garden/i)]);
  });

  it("renders the protocol pool console for the root garden in protocol context, with the protocol confirmations for a protocol steward", () => {
    renderPools();
    expect(screen.getByTestId("protocol-pool")).toBeInTheDocument();
    expect(screen.getByTestId("pool-tab")).toHaveTextContent(`${ROOT}:protocol`);
    expect(screen.getByTestId("protocol-confirm-queue")).toBeInTheDocument();
    // Never another garden's pool.
    expect(mocks.poolTabGardens).toEqual([ROOT]);
    expect(mocks.poolTabGardens).not.toContain(OTHER_GARDEN);
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
    renderPools();
    const handed = mocks.confirmQueueProps.at(-1);
    expect(handed?.groups).toEqual([]);
    expect(handed?.fallback).toEqual([protocolRow]);
    expect(handed?.disputed).toEqual([]);
    expect(handed?.count).toBe(1);
    // The tab badge counts the same rows the section will show.
    expect(within(screen.getByRole("tablist", { name: /pools/i })).getByText("1")).toBeVisible();
  });

  it("keeps the protocol confirmations queue from a steward who does not steward the protocol garden", () => {
    mocks.toConfirm = { ...mocks.toConfirm!, isProtocolSteward: false };
    renderPools();
    expect(screen.queryByTestId("protocol-confirm-queue")).not.toBeInTheDocument();
    expect(screen.getByTestId("pool-tab")).toBeInTheDocument();
  });

  it("says when no protocol pool is registered instead of rendering a console", () => {
    mocks.protocolPool = {
      ...mocks.protocolPool!,
      poolId: null,
      rootGarden: ROOT,
      isRegistered: false,
    };
    renderPools();
    expect(screen.getByTestId("protocol-pool-unregistered")).toBeInTheDocument();
    expect(screen.queryByTestId("pool-tab")).not.toBeInTheDocument();
  });

  it("shows loading and read-error casts for the protocol read", () => {
    mocks.protocolPool = { ...mocks.protocolPool!, isLoading: true };
    const first = renderPools();
    expect(screen.getByRole("status")).toBeInTheDocument();
    first.unmount();

    const refetch = vi.fn();
    mocks.protocolPool = { ...mocks.protocolPool!, isLoading: false, isError: true, refetch };
    renderPools();
    expect(screen.getByText(/couldn.t read the protocol pool/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("is one tap into this garden's pool console, with its status and no duplicated grammar", () => {
    renderPools();
    fireEvent.click(screen.getByRole("tab", { name: /this garden/i }));
    const card = screen.getByTestId("current-garden-pool");
    expect(within(card).getByText("Rocinha")).toBeInTheDocument();
    expect(within(card).getByText(/taking commitments/i)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /open the pool console/i }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/garden\/pool\?gardenId=/)
    );
    expect(screen.queryByTestId("pool-tab")).not.toBeInTheDocument();
  });
});
