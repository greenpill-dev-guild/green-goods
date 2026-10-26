/**
 * What waits for the reader in one garden's queues (PWA Home step 19): each queue is read, and
 * listed, only for an account that can perform the act it opens, under that act's existing
 * predicate. The ordering and grouping are the selector's (modules/garden/steward-duties.test.ts).
 *
 * @vitest-environment happy-dom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOpenStewardDuty, useStewardDuties } from "../../../hooks/garden/useStewardDuties";
import { useUIStore } from "../../../stores/useUIStore";
import type { Garden, Work } from "../../../types/domain";
import { createMockGarden, createMockWork } from "../../test-utils/mock-factories";

const ME = "0xa11ce00000000000000000000000000000000001";
const GARDEN = "0x6A7DE00000000000000000000000000000000AAA";
const OTHER_GARDEN = "0x0757e00000000000000000000000000000000bbb";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reviewGardens: [] as string[][],
  toReview: [] as Work[],
  reviewReady: true,
  reviewLoading: false,
  reviewError: false,
  reviewRefetch: vi.fn(async () => true),
  hatGarden: [] as Array<string | null | undefined>,
  wearsStewardHat: false,
  roleLoading: false,
  roleError: false,
  roleRefetch: vi.fn(async () => ({})),
  pools: [] as Array<{ poolId: bigint; garden: string }>,
  poolsLoading: false,
  poolsError: false,
  poolsRefetch: vi.fn(async () => ({})),
  claimsEnabled: [] as boolean[],
  claimRows: [] as unknown[],
  claimsLoading: false,
  claimsError: false,
  claimsRefetch: vi.fn(async () => ({})),
  confirmViewer: [] as Array<string | undefined>,
  confirmEnabled: [] as Array<boolean | undefined>,
  confirmScopes: [] as Array<
    ((gardens: readonly (string | null | undefined)[]) => boolean) | undefined
  >,
  confirmGroups: [] as Array<{ garden: string; rows: Array<{ commitment: unknown }> }>,
  confirmLoading: false,
  confirmError: false,
  confirmRefetch: vi.fn(async () => []),
}));

// The roster predicates run for real on the garden's record; the reads are the edges.
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => ME }));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => ({ user: { id: ME } }) }));
vi.mock("../../../hooks/app/useNavigateToTop", () => ({ useNavigateToTop: () => mocks.navigate }));
vi.mock("../../../hooks/work/useNeedsReview", () => ({
  useNeedsReview: (gardenIds: string[]) => {
    mocks.reviewGardens.push(gardenIds);
    return {
      works: gardenIds.length > 0 ? mocks.toReview : [],
      ready: gardenIds.length === 0 || mocks.reviewReady,
      isLoading: gardenIds.length > 0 && mocks.reviewLoading,
      isError: gardenIds.length > 0 && mocks.reviewError,
      refetch: mocks.reviewRefetch,
    };
  },
}));
vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (garden: string | null | undefined) => {
    mocks.hatGarden.push(garden);
    // A failed read answers false, since the answer is unknown.
    return {
      hasRole: Boolean(garden) && mocks.wearsStewardHat && !mocks.roleError,
      isLoading: Boolean(garden) && mocks.roleLoading,
      error: mocks.roleError ? new Error("role read failed") : null,
      refetch: mocks.roleRefetch,
    };
  },
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  // A failed read hands back no pools, as React Query does with no saved data.
  useCommitmentPools: () => ({
    pools: mocks.poolsError ? [] : mocks.pools,
    isLoading: mocks.poolsLoading,
    isError: mocks.poolsError,
    refetch: mocks.poolsRefetch,
  }),
}));
vi.mock("../../../hooks/commitment-pooling/usePoolClaimRequests", () => ({
  usePoolClaimRequests: (_input: unknown, options: { enabled?: boolean }) => {
    const enabled = options.enabled !== false;
    mocks.claimsEnabled.push(enabled);
    // A disabled query still hands back what it read before, as React Query does.
    return {
      rows: mocks.claimRows,
      isLoading: enabled && mocks.claimsLoading,
      isError: enabled && mocks.claimsError,
      refetch: mocks.claimsRefetch,
    };
  },
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentsToConfirm", () => ({
  useCommitmentsToConfirm: ({
    viewer,
    inScope,
    enabled,
  }: {
    viewer?: string;
    inScope?: (gardens: readonly (string | null | undefined)[]) => boolean;
    enabled?: boolean;
  }) => {
    mocks.confirmViewer.push(viewer);
    mocks.confirmEnabled.push(enabled);
    mocks.confirmScopes.push(inScope);
    return {
      groups: viewer ? mocks.confirmGroups : [],
      isLoading: Boolean(viewer) && mocks.confirmLoading,
      isError: Boolean(viewer) && mocks.confirmError,
      refetch: mocks.confirmRefetch,
    };
  },
}));

function garden(roles: { stewards?: string[]; owners?: string[]; gardeners?: string[] }): Garden {
  return createMockGarden({
    id: GARDEN,
    stewards: roles.stewards ?? [],
    owners: roles.owners ?? [],
    gardeners: roles.gardeners ?? [],
    evaluators: [],
  });
}

const render = (record: Garden) => renderHook(() => useStewardDuties(record)).result.current;

function pendingClaim(commitmentId: bigint) {
  return {
    claim: { commitmentId, requestedAt: 100, state: "PENDING" },
    commitment: { commitmentId },
  };
}

function everythingWaits() {
  mocks.toReview = [createMockWork({ id: "0x01" })];
  mocks.claimRows = [pendingClaim(4n)];
  mocks.confirmGroups = [
    { garden: OTHER_GARDEN, rows: [{ commitment: { commitmentId: 7n } }] },
    { garden: GARDEN.toLowerCase(), rows: [{ commitment: { commitmentId: 9n } }] },
  ];
}

describe("useStewardDuties", () => {
  beforeEach(() => {
    mocks.reviewGardens = [];
    mocks.toReview = [];
    mocks.reviewReady = true;
    mocks.reviewLoading = false;
    mocks.reviewError = false;
    mocks.hatGarden = [];
    mocks.wearsStewardHat = false;
    mocks.roleLoading = false;
    mocks.roleError = false;
    mocks.pools = [{ poolId: 3n, garden: GARDEN.toLowerCase() }];
    mocks.poolsLoading = false;
    mocks.poolsError = false;
    mocks.claimsEnabled = [];
    mocks.claimRows = [];
    mocks.claimsLoading = false;
    mocks.claimsError = false;
    mocks.confirmViewer = [];
    mocks.confirmEnabled = [];
    mocks.confirmScopes = [];
    mocks.confirmGroups = [];
    mocks.confirmLoading = false;
    mocks.confirmError = false;
    vi.clearAllMocks();
  });

  it("reads and lists nothing for a gardener or an evaluator, whatever waits", () => {
    everythingWaits();
    const record = { ...garden({ gardeners: [ME] }), evaluators: [ME] };

    const duties = render(record);

    expect(duties.duties).toEqual([]);
    expect(mocks.reviewGardens.at(-1)).toEqual([]);
    expect(mocks.claimsEnabled.at(-1)).toBe(false);
    expect(mocks.confirmViewer.at(-1)).toBeUndefined();
    // Not even the confirmation queue's pool reads start for them.
    expect(mocks.confirmEnabled.at(-1)).toBe(false);
  });

  it("lists every queue for a steward the chain says may decide take-ups, and only this garden's promises", () => {
    everythingWaits();
    mocks.wearsStewardHat = true;

    const duties = render(garden({ stewards: [ME] }));

    expect(mocks.reviewGardens.at(-1)).toEqual([GARDEN]);
    expect(mocks.hatGarden.at(-1)).toBe(GARDEN.toLowerCase());
    expect(duties.duties.map((duty) => [duty.kind, duty.count])).toEqual([
      ["review", 1],
      ["takeUp", 1],
      ["confirm", 1],
    ]);
    const confirm = duties.duties.find((duty) => duty.kind === "confirm");
    expect(confirm?.kind === "confirm" && confirm.commitments[0]?.commitmentId).toBe(9n);
  });

  it("shows an owner who is not a steward the queues an owner acts on, and no take-up requests", () => {
    everythingWaits();

    const duties = render(garden({ owners: [ME] }));

    expect(duties.duties.map((duty) => duty.kind)).toEqual(["review", "confirm"]);
    expect(mocks.claimsEnabled.at(-1)).toBe(false);
  });

  it("leaves take-up requests out for a steward the chain does not say may decide them", () => {
    everythingWaits();

    const duties = render(garden({ stewards: [ME] }));

    expect(duties.duties.map((duty) => duty.kind)).toEqual(["review", "confirm"]);
    expect(mocks.claimsEnabled.at(-1)).toBe(false);
  });

  it("keeps work to review uncounted while the garden's list is incomplete, rather than dropping it", () => {
    everythingWaits();
    mocks.reviewReady = false;

    const duties = render(garden({ owners: [ME] }));

    expect(duties.duties.map((duty) => duty.kind)).toEqual(["review", "confirm"]);
    expect(duties.duties[0]).toMatchObject({ kind: "review", uncounted: true });
  });

  it("publishes promises to confirm only once the queue's eligibility reads have all answered", () => {
    everythingWaits();
    mocks.confirmLoading = true;
    expect(render(garden({ owners: [ME] })).duties.map((duty) => duty.kind)).toEqual(["review"]);

    mocks.confirmLoading = false;
    mocks.confirmError = true;
    expect(render(garden({ owners: [ME] })).duties.map((duty) => duty.kind)).toEqual(["review"]);
    expect(mocks.confirmEnabled.at(-1)).toBe(true);
  });

  it("asks To confirm about this garden alone, so another garden's read neither holds nor fails it", () => {
    render(garden({ stewards: [ME] }));

    const inScope = mocks.confirmScopes.at(-1);
    expect(inScope?.([GARDEN.toLowerCase()])).toBe(true);
    expect(inScope?.([OTHER_GARDEN])).toBe(false);
  });

  it("is loading or failed only for a queue the account can act on", () => {
    mocks.claimsLoading = true;
    mocks.claimsError = true;
    expect(render(garden({ stewards: [ME] }))).toMatchObject({ isLoading: false, isError: false });

    mocks.wearsStewardHat = true;
    expect(render(garden({ stewards: [ME] }))).toMatchObject({ isLoading: true, isError: true });

    mocks.claimsLoading = false;
    mocks.claimsError = false;
    mocks.reviewLoading = true;
    expect(render(garden({ stewards: [ME] })).isLoading).toBe(true);
    mocks.reviewLoading = false;
    mocks.confirmError = true;
    expect(render(garden({ stewards: [ME] })).isError).toBe(true);

    // The take-up path's own reads, the pool and the chain's steward answer, may hide requests.
    mocks.confirmError = false;
    mocks.wearsStewardHat = false;
    mocks.poolsError = true;
    expect(render(garden({ stewards: [ME] })).isError).toBe(true);
    expect(render(garden({ gardeners: [ME] })).isError).toBe(false);
    mocks.poolsError = false;
    mocks.roleError = true;
    expect(render(garden({ stewards: [ME] })).isError).toBe(true);
    mocks.roleError = false;
    mocks.poolsLoading = true;
    expect(render(garden({ stewards: [ME] })).isLoading).toBe(true);
  });

  it("reads every queue again on refetch", () => {
    mocks.wearsStewardHat = true;

    render(garden({ stewards: [ME] })).refetch();

    expect(mocks.reviewRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.claimsRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.confirmRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.poolsRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.roleRefetch).toHaveBeenCalledTimes(1);
  });
});

describe("useOpenStewardDuty", () => {
  it("opens each duty's own queue: the Work sheet over Home, the promise's page, Promises on To confirm", () => {
    const openCommitmentsSheet = vi.fn();
    const openGardenSheet = vi.fn();
    const real = {
      openCommitmentsSheet: useUIStore.getState().openCommitmentsSheet,
      openGardenSheet: useUIStore.getState().openGardenSheet,
    };
    useUIStore.setState({ openCommitmentsSheet, openGardenSheet });
    try {
      const open = renderHook(() => useOpenStewardDuty(GARDEN)).result.current;

      // Work to review opens the garden's Work as a sheet over Home (DL-128), whose list puts
      // pending work first; Home keeps its place under it.
      open({ kind: "review", count: 1, works: [createMockWork({ id: "0x01" })] });
      expect(openGardenSheet).toHaveBeenCalledWith("work");
      expect(mocks.navigate).not.toHaveBeenCalled();

      open({ kind: "takeUp", count: 2, commitment: { commitmentId: 4n } as never, newestAt: 10 });
      expect(mocks.navigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/4`);

      open({ kind: "confirm", count: 1, commitments: [] });
      expect(openCommitmentsSheet).toHaveBeenCalledWith({ tab: "to-confirm" });
      expect(mocks.navigate).toHaveBeenCalledTimes(1);
    } finally {
      useUIStore.setState(real);
    }
  });
});
