/**
 * usePendingReviewCount Hook Tests
 *
 * Pins the truth-gated readiness predicate that backs the arrival "review"/"stewardClear"
 * claims: ready only when the count (including count = 0) is backed by settled data, and
 * the count is the same Needs review list the Work Dashboard shows for steward gardens.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingReviewCount } from "../../hooks/work/usePendingReviewCount";
import type { Address } from "../../types/domain";

const VIEWER = "0xAbC0000000000000000000000000000000000001" as Address;
const GARDEN = "0x1111111111111111111111111111111111111111";
const OTHER_GARDEN = "0x2222222222222222222222222222222222222222";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    gardens: { data: [] as Array<Record<string, unknown>>, isSuccess: true },
    needsReview: {
      works: [] as Array<{ id: string }>,
      ready: true,
    },
    needsReviewGardens: [] as string[][],
  },
}));

vi.mock("../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mocks.gardens,
}));
vi.mock("../../hooks/work/useNeedsReview", () => ({
  useNeedsReview: (gardenIds: string[]) => {
    mocks.needsReviewGardens.push(gardenIds);
    return mocks.needsReview;
  },
}));

describe("usePendingReviewCount", () => {
  beforeEach(() => {
    mocks.gardens = { data: [], isSuccess: true };
    mocks.needsReview = { works: [], ready: true };
    mocks.needsReviewGardens = [];
  });

  it("is vacuously ready with count 0 for a non-steward", () => {
    mocks.gardens = { data: [{ id: GARDEN, stewards: [] }], isSuccess: true };
    mocks.needsReview = { works: [], ready: false };
    const { result } = renderHook(() => usePendingReviewCount(VIEWER));
    expect(result.current).toEqual({ count: 0, ready: true, isSteward: false });
  });

  it("is NOT ready while the review list is not backed by settled data", () => {
    mocks.gardens = { data: [{ id: GARDEN, stewards: [VIEWER] }], isSuccess: true };
    mocks.needsReview = { works: [{ id: "w1" }], ready: false };
    const { result } = renderHook(() => usePendingReviewCount(VIEWER));
    expect(result.current).toEqual({ count: 0, ready: false, isSteward: true });
  });

  it("counts the Needs review list once it is ready, including zero", () => {
    mocks.gardens = { data: [{ id: GARDEN, stewards: [VIEWER] }], isSuccess: true };
    mocks.needsReview = { works: [{ id: "w1" }, { id: "w2" }], ready: true };
    const { result, rerender } = renderHook(() => usePendingReviewCount(VIEWER));
    expect(result.current).toEqual({ count: 2, ready: true, isSteward: true });

    mocks.needsReview = { works: [], ready: true };
    rerender();
    expect(result.current).toEqual({ count: 0, ready: true, isSteward: true });
  });

  it("reads steward gardens only", () => {
    mocks.gardens = {
      data: [
        { id: GARDEN, stewards: [VIEWER] },
        { id: OTHER_GARDEN, stewards: [] },
      ],
      isSuccess: true,
    };
    renderHook(() => usePendingReviewCount(VIEWER));
    expect(mocks.needsReviewGardens.at(-1)).toEqual([GARDEN]);
  });
});
