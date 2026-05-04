/**
 * useConvictionWeightAllocator integration tests
 * @vitest-environment jsdom
 *
 * Round-trip coverage for the optimistic-state container that drives the
 * WeightAllocator: mirroring server state, debouncing saves, computing signed
 * deltas, and force-flushing on close.
 *
 * Cleanup item A3 from .plans/active/admin-design-revamp/handoffs/claude-cleanup.md.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberPower, VoterAllocation } from "../../../types/conviction";
import type { Address } from "../../../types/domain";

const TEST_POOL = "0x1111111111111111111111111111111111111111" as Address;
const TEST_VOTER = "0x2222222222222222222222222222222222222222" as Address;

const mockUseMemberVotingPower = vi.fn();
const mockMutate = vi.fn();
const mockUseAllocateHypercertSupport = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}));

vi.mock("../../../hooks/conviction/useMemberVotingPower", () => ({
  useMemberVotingPower: (...args: unknown[]) => mockUseMemberVotingPower(...args),
}));

vi.mock("../../../hooks/conviction/useAllocateHypercertSupport", () => ({
  useAllocateHypercertSupport: (...args: unknown[]) => mockUseAllocateHypercertSupport(...args),
}));

import { useConvictionWeightAllocator } from "../../../hooks/conviction/useConvictionWeightAllocator";

function memberPower(pointsBudget: bigint, allocations: VoterAllocation[] = []): MemberPower {
  return {
    totalStake: pointsBudget,
    pointsBudget,
    isEligible: true,
    allocations,
  };
}

function setMemberPower(power: MemberPower, isLoading = false): void {
  mockUseMemberVotingPower.mockReturnValue({ power, isLoading });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockMutate.mockReset();
  mockUseMemberVotingPower.mockReset();
  mockUseAllocateHypercertSupport.mockClear();
  mockUseAllocateHypercertSupport.mockImplementation(() => ({
    mutate: mockMutate,
    isPending: false,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useConvictionWeightAllocator initial state", () => {
  it("mirrors useMemberVotingPower allocations into the local percent map", () => {
    setMemberPower(
      memberPower(1000n, [
        { hypercertId: 1n, amount: 250n },
        { hypercertId: 2n, amount: 500n },
      ])
    );

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    expect(result.current.allocations).toEqual({ "1": 25, "2": 50 });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  it("exposes isLoading from the underlying useMemberVotingPower query", () => {
    setMemberPower(memberPower(0n), true);

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    expect(result.current.isLoading).toBe(true);
  });
});

describe("useConvictionWeightAllocator debounced saves", () => {
  it("does not fire allocateMutation.mutate before the debounce window elapses", () => {
    setMemberPower(memberPower(1000n, [{ hypercertId: 1n, amount: 250n }]));

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    act(() => {
      result.current.setAllocations({ "1": 50 });
    });

    expect(result.current.allocations).toEqual({ "1": 50 });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      vi.advanceTimersByTime(399);
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("fires allocateMutation.mutate once the debounce window elapses", () => {
    setMemberPower(memberPower(1000n, [{ hypercertId: 1n, amount: 250n }]));

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    act(() => {
      result.current.setAllocations({ "1": 50 });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({
      poolAddress: TEST_POOL,
      signals: [{ hypercertId: 1n, deltaSupport: 250n }],
    });
  });

  it("computes signed deltas from the diff of old → new percent maps", () => {
    setMemberPower(
      memberPower(1000n, [
        { hypercertId: 1n, amount: 500n }, // 50%
        { hypercertId: 2n, amount: 250n }, // 25%
      ])
    );

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    // Drop hypercert 1 (50% → 0), bump hypercert 2 (25% → 75%), add hypercert 3 (0% → 10%).
    act(() => {
      result.current.setAllocations({ "2": 75, "3": 10 });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const call = mockMutate.mock.calls[0]?.[0] as {
      poolAddress: Address;
      signals: Array<{ hypercertId: bigint; deltaSupport: bigint }>;
    };
    expect(call.poolAddress).toBe(TEST_POOL);
    const sorted = call.signals.slice().sort((a, b) => Number(a.hypercertId - b.hypercertId));
    expect(sorted).toEqual([
      { hypercertId: 1n, deltaSupport: -500n },
      { hypercertId: 2n, deltaSupport: 500n },
      { hypercertId: 3n, deltaSupport: 100n },
    ]);
  });

  it("respects a custom debounce window via options", () => {
    setMemberPower(memberPower(1000n));

    const { result } = renderHook(() =>
      useConvictionWeightAllocator(TEST_POOL, TEST_VOTER, { debounceMs: 1000 })
    );

    act(() => {
      result.current.setAllocations({ "1": 25 });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockMutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("does not fire mutate when the points budget is zero", () => {
    setMemberPower(memberPower(0n));

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    act(() => {
      result.current.setAllocations({ "1": 50 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not fire mutate when poolAddress is missing", () => {
    setMemberPower(memberPower(1000n));

    const { result } = renderHook(() => useConvictionWeightAllocator(undefined, TEST_VOTER));

    act(() => {
      result.current.setAllocations({ "1": 50 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe("useConvictionWeightAllocator flush()", () => {
  it("cancels the pending debounce and fires mutate synchronously", () => {
    setMemberPower(memberPower(1000n));

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    act(() => {
      result.current.setAllocations({ "1": 25 });
    });
    expect(mockMutate).not.toHaveBeenCalled();

    act(() => {
      result.current.flush();
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);

    // Advancing past the debounce window must not trigger a second save.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when there are no pending changes", () => {
    setMemberPower(memberPower(1000n, [{ hypercertId: 1n, amount: 500n }]));

    const { result } = renderHook(() => useConvictionWeightAllocator(TEST_POOL, TEST_VOTER));

    act(() => {
      result.current.flush();
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe("useConvictionWeightAllocator server sync", () => {
  it("clears isDirty when the server state catches up to the local state", () => {
    setMemberPower(memberPower(1000n, [{ hypercertId: 1n, amount: 250n }]));

    const { result, rerender } = renderHook(() =>
      useConvictionWeightAllocator(TEST_POOL, TEST_VOTER)
    );

    act(() => {
      result.current.setAllocations({ "1": 50 });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);

    // Simulate the post-mutation refetch landing — server now returns the
    // saved allocations, the useEffect should re-mirror them and clear isDirty.
    setMemberPower(memberPower(1000n, [{ hypercertId: 1n, amount: 500n }]));
    rerender();

    expect(result.current.allocations).toEqual({ "1": 50 });
    expect(result.current.isDirty).toBe(false);
  });
});
