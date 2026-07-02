/**
 * useArrivalState Hook Tests
 *
 * Covers the truth-gated priority ladder (resolveArrivalKind) exhaustively, plus the hook's
 * derivation of per-source readiness/signals — including the failure modes that must NOT surface
 * a wrong orientation (a gardens error must never read as "signed in, no membership"; an
 * operator with unready review data must get silence, never "all caught up").
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ArrivalInputs,
  resolveArrivalKind,
  useArrivalState,
} from "../../hooks/app/useArrivalState";

const ADDRESS = "0xabc0000000000000000000000000000000000001";

// Mutable mock state, read lazily by the module factories so each test can tweak a source.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    primaryAddress: "0xAbC0000000000000000000000000000000000001" as string | null,
    gardens: { data: [] as Array<Record<string, unknown>>, isSuccess: true },
    drafts: { draftCount: 0, isLoading: false },
    queue: { data: { pending: 0, failed: 0 } as Record<string, number>, isSuccess: true },
    pendingJoinsVersion: 0,
    isGardenMember: false,
    review: { count: 0, ready: true, isOperator: false },
  },
}));

vi.mock("../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.primaryAddress,
}));
vi.mock("../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mocks.gardens,
}));
vi.mock("../../hooks/garden/useJoinGarden", () => ({
  isGardenMember: () => mocks.isGardenMember,
  usePendingJoinsVersion: () => mocks.pendingJoinsVersion,
}));
vi.mock("../../hooks/work/useDrafts", () => ({
  useDrafts: () => mocks.drafts,
}));
vi.mock("../../hooks/work/useWorks", () => ({
  useQueueStatistics: () => mocks.queue,
}));
vi.mock("../../hooks/work/usePendingReviewCount", () => ({
  usePendingReviewCount: () => mocks.review,
}));

type SourceOverrides = {
  queue?: Partial<ArrivalInputs["queue"]>;
  drafts?: Partial<ArrivalInputs["drafts"]>;
  gardens?: Partial<ArrivalInputs["gardens"]>;
  review?: Partial<ArrivalInputs["review"]>;
};

// Baseline: every source ready, every signal absent (→ "signedIn"). Override per case.
function makeInputs(overrides: SourceOverrides = {}): ArrivalInputs {
  return {
    queue: { ready: true, hasPendingOrFailed: false, ...overrides.queue },
    drafts: { ready: true, hasDraft: false, ...overrides.drafts },
    gardens: { ready: true, isOperator: false, isGardener: false, ...overrides.gardens },
    review: { ready: true, needsReviewCount: 0, ...overrides.review },
  };
}

describe("resolveArrivalKind", () => {
  it("returns signedIn only when every source is ready and every signal absent", () => {
    expect(resolveArrivalKind(makeInputs())).toBe("signedIn");
  });

  it("returns none when an absence claim can't be fully trusted (a source not ready)", () => {
    expect(resolveArrivalKind(makeInputs({ drafts: { ready: false } }))).toBe("none");
    expect(resolveArrivalKind(makeInputs({ gardens: { ready: false } }))).toBe("none");
  });

  it("fires queue from IndexedDB even when gardens is unready (offline)", () => {
    expect(
      resolveArrivalKind(
        makeInputs({
          queue: { ready: true, hasPendingOrFailed: true },
          gardens: { ready: false, isGardener: true },
        })
      )
    ).toBe("queue");
  });

  it("stays silent (no premature lower-priority toast) until the queue source is ready", () => {
    // A user with both a failed-sync job and a draft must not see "draft" before the queue
    // resolves — the higher-priority queue would preempt it. Stay silent until queue is ready.
    expect(
      resolveArrivalKind(
        makeInputs({
          queue: { ready: false, hasPendingOrFailed: true },
          drafts: { ready: true, hasDraft: true },
        })
      )
    ).toBe("none");
  });

  it("orders queue > draft > review > gardener", () => {
    const all = {
      queue: { hasPendingOrFailed: true },
      drafts: { hasDraft: true },
      gardens: { isOperator: true, isGardener: true },
      review: { needsReviewCount: 3 },
    };
    expect(resolveArrivalKind(makeInputs(all))).toBe("queue");
    expect(resolveArrivalKind(makeInputs({ ...all, queue: { hasPendingOrFailed: false } }))).toBe(
      "draft"
    );
    expect(
      resolveArrivalKind(
        makeInputs({ gardens: { isOperator: true }, review: { needsReviewCount: 3 } })
      )
    ).toBe("review");
    expect(resolveArrivalKind(makeInputs({ gardens: { isGardener: true } }))).toBe("gardener");
  });

  it("resolves the operator with both a draft and review work to draft (local truth first)", () => {
    // Device-local unfinished work outranks the network-backed review queue: this session may
    // be the only chance to recover it, and review work stays reachable via the dashboard.
    expect(
      resolveArrivalKind(
        makeInputs({
          drafts: { hasDraft: true },
          gardens: { isOperator: true },
          review: { needsReviewCount: 5 },
        })
      )
    ).toBe("draft");
  });

  it("never reads a gardens error as signedIn or gardener for an actual member", () => {
    const kind = resolveArrivalKind(makeInputs({ gardens: { ready: false, isGardener: true } }));
    expect(kind).not.toBe("signedIn");
    expect(kind).not.toBe("gardener");
    expect(kind).toBe("none");
  });

  it("gates operators on review readiness — silence, never a premature claim", () => {
    // An operator whose review data is unready must not get "operatorClear" (a false
    // "all caught up") nor fall through to "gardener" (preemptable once review resolves).
    const kind = resolveArrivalKind(
      makeInputs({
        gardens: { isOperator: true, isGardener: true },
        review: { ready: false, needsReviewCount: 0 },
      })
    );
    expect(kind).toBe("none");
  });

  it("splits the operator branch on the review count: review vs operatorClear", () => {
    expect(
      resolveArrivalKind(
        makeInputs({ gardens: { isOperator: true }, review: { needsReviewCount: 1 } })
      )
    ).toBe("review");
    expect(
      resolveArrivalKind(
        makeInputs({ gardens: { isOperator: true }, review: { needsReviewCount: 0 } })
      )
    ).toBe("operatorClear");
  });

  it("never makes a gardener (non-operator) wait on review readiness", () => {
    expect(
      resolveArrivalKind(
        makeInputs({
          gardens: { isGardener: true },
          review: { ready: false, needsReviewCount: 0 },
        })
      )
    ).toBe("gardener");
  });

  it("resolves a user who both operates and gardens via the operator branch", () => {
    expect(
      resolveArrivalKind(
        makeInputs({
          gardens: { isOperator: true, isGardener: true },
          review: { needsReviewCount: 0 },
        })
      )
    ).toBe("operatorClear");
  });
});

describe("useArrivalState", () => {
  beforeEach(() => {
    mocks.primaryAddress = "0xAbC0000000000000000000000000000000000001";
    mocks.gardens = { data: [], isSuccess: true };
    mocks.drafts = { draftCount: 0, isLoading: false };
    mocks.queue = { data: { pending: 0, failed: 0 }, isSuccess: true };
    mocks.pendingJoinsVersion = 0;
    mocks.isGardenMember = false;
    mocks.review = { count: 0, ready: true, isOperator: false };
  });

  it("returns none when there is no resolved address yet", () => {
    mocks.primaryAddress = null;
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("none");
    expect(result.current.myGardenIds).toEqual([]);
  });

  it("derives gardener from gardens + isGardenMember (gardeners/pending-join scope)", () => {
    mocks.gardens = { data: [{ id: "g1", gardeners: [], operators: [] }], isSuccess: true };
    mocks.isGardenMember = true;
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("gardener");
    expect(result.current.myGardenIds).toEqual(["g1"]);
  });

  it("derives operator from the garden operators array (case-insensitive)", () => {
    mocks.gardens = {
      data: [{ id: "g1", gardeners: [], operators: [ADDRESS.toUpperCase().replace("0X", "0x")] }],
      isSuccess: true,
    };
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("operatorClear");
    expect(result.current.myGardenIds).toEqual(["g1"]);
  });

  it("surfaces review with its count when an operator has submissions waiting", () => {
    mocks.gardens = { data: [{ id: "g1", gardeners: [], operators: [ADDRESS] }], isSuccess: true };
    mocks.review = { count: 3, ready: true, isOperator: true };
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("review");
    expect(result.current.needsReviewCount).toBe(3);
  });

  it("stays silent for an operator whose review data is not ready", () => {
    mocks.gardens = { data: [{ id: "g1", gardeners: [], operators: [ADDRESS] }], isSuccess: true };
    mocks.review = { count: 0, ready: false, isOperator: true };
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("none");
  });

  it("reports needsReviewCount 0 when a higher-priority kind preempts review", () => {
    mocks.gardens = { data: [{ id: "g1", gardeners: [], operators: [ADDRESS] }], isSuccess: true };
    mocks.review = { count: 5, ready: true, isOperator: true };
    mocks.queue = { data: { pending: 1, failed: 0 }, isSuccess: true };
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("queue");
    expect(result.current.needsReviewCount).toBe(0);
  });

  it("stays silent (none) when gardens errored, even for a member", () => {
    mocks.gardens = { data: [{ id: "g1", gardeners: [], operators: [] }], isSuccess: false };
    mocks.isGardenMember = true;
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("none");
    // membership is still computed from cached data, but not asserted as an orientation
    expect(result.current.myGardenIds).toEqual(["g1"]);
  });

  it("fires queue while gardens are still loading", () => {
    mocks.queue = { data: { pending: 1, failed: 0 }, isSuccess: true };
    mocks.gardens = { data: [], isSuccess: false };
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("queue");
  });

  it("falls through to signedIn when all sources succeed and nothing is pending", () => {
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("signedIn");
  });
});
