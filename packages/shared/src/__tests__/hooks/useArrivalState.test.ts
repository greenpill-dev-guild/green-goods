/**
 * useArrivalState Hook Tests
 *
 * Covers the truth-gated priority ladder (resolveArrivalKind) exhaustively, plus the hook's
 * derivation of per-source readiness/signals — including the failure modes that must NOT surface
 * a wrong orientation (a gardens error must never read as "signed in, no membership").
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ArrivalInputs,
  resolveArrivalKind,
  useArrivalState,
} from "../../hooks/app/useArrivalState";

// Mutable mock state, read lazily by the module factories so each test can tweak a source.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    primaryAddress: "0xAbC0000000000000000000000000000000000001" as string | null,
    gardens: { data: [] as Array<Record<string, unknown>>, isSuccess: true },
    drafts: { draftCount: 0, isLoading: false },
    queue: { data: { pending: 0, failed: 0 } as Record<string, number>, isSuccess: true },
    pendingJoinsVersion: 0,
    isGardenMember: false,
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

type SourceOverrides = {
  queue?: Partial<ArrivalInputs["queue"]>;
  drafts?: Partial<ArrivalInputs["drafts"]>;
  gardens?: Partial<ArrivalInputs["gardens"]>;
};

// Baseline: every source ready, every signal absent (→ "signedIn"). Override per case.
function makeInputs(overrides: SourceOverrides = {}): ArrivalInputs {
  return {
    queue: { ready: true, hasPendingOrFailed: false, ...overrides.queue },
    drafts: { ready: true, hasDraft: false, ...overrides.drafts },
    gardens: { ready: true, hasMembership: false, ...overrides.gardens },
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
          gardens: { ready: false, hasMembership: true },
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

  it("orders queue > draft > member", () => {
    const all = {
      queue: { hasPendingOrFailed: true },
      drafts: { hasDraft: true },
      gardens: { hasMembership: true },
    };
    expect(resolveArrivalKind(makeInputs(all))).toBe("queue");
    expect(resolveArrivalKind(makeInputs({ ...all, queue: { hasPendingOrFailed: false } }))).toBe(
      "draft"
    );
    expect(resolveArrivalKind(makeInputs({ gardens: { hasMembership: true } }))).toBe("member");
  });

  it("never reads a gardens error as signedIn or member for an actual member", () => {
    const kind = resolveArrivalKind(makeInputs({ gardens: { ready: false, hasMembership: true } }));
    expect(kind).not.toBe("signedIn");
    expect(kind).not.toBe("member");
    expect(kind).toBe("none");
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
  });

  it("returns none when there is no resolved address yet", () => {
    mocks.primaryAddress = null;
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("none");
    expect(result.current.myGardenIds).toEqual([]);
  });

  it("derives membership from gardens + isGardenMember", () => {
    mocks.gardens = { data: [{ id: "g1", gardeners: [], operators: [] }], isSuccess: true };
    mocks.isGardenMember = true;
    const { result } = renderHook(() => useArrivalState());
    expect(result.current.kind).toBe("member");
    expect(result.current.myGardenIds).toEqual(["g1"]);
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
