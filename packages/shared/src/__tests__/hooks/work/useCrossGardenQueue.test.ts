/**
 * useCrossGardenQueue Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the cross-garden work queue that merges, deduplicates,
 * and sorts work items from multiple gardens by status tier.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockGarden, createMockWork } from "../../test-utils";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUseGardens = vi.fn();

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mockUseGardens(),
}));

import { useCrossGardenQueue } from "../../../hooks/work/useCrossGardenQueue";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useCrossGardenQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });
  });

  it("returns empty items when no gardens have work", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });

    const { result } = renderHook(() => useCrossGardenQueue());

    expect(result.current.items).toEqual([]);
    expect(result.current.gardenCount).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("merges work items from multiple gardens", () => {
    const workA = createMockWork({ id: "work-a", status: "pending" });
    const workB = createMockWork({ id: "work-b", status: "approved" });
    const gardenA = createMockGarden({ id: "garden-a", works: [workA] });
    const gardenB = createMockGarden({ id: "garden-b", works: [workB] });

    mockUseGardens.mockReturnValue({
      data: [gardenA, gardenB],
      isLoading: false,
    });

    const { result } = renderHook(() => useCrossGardenQueue());

    expect(result.current.items).toHaveLength(2);
    const ids = result.current.items.map((w) => w.id);
    expect(ids).toContain("work-a");
    expect(ids).toContain("work-b");
  });

  it("deduplicates work items with same ID", () => {
    const sharedWork = createMockWork({
      id: "work-shared",
      status: "pending",
      createdAt: 1000,
    });
    const gardenA = createMockGarden({
      id: "garden-a",
      works: [sharedWork],
    });
    const gardenB = createMockGarden({
      id: "garden-b",
      works: [{ ...sharedWork }],
    });

    mockUseGardens.mockReturnValue({
      data: [gardenA, gardenB],
      isLoading: false,
    });

    const { result } = renderHook(() => useCrossGardenQueue());

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("work-shared");
  });

  it("sorts by status tier: pending_review > pending_assessment > pending_mint", () => {
    const workMint = createMockWork({
      id: "work-mint",
      status: "pending_mint" as any,
      createdAt: 1000,
    });
    const workReview = createMockWork({
      id: "work-review",
      status: "pending_review" as any,
      createdAt: 1000,
    });
    const workAssessment = createMockWork({
      id: "work-assessment",
      status: "pending_assessment" as any,
      createdAt: 1000,
    });

    const garden = createMockGarden({
      id: "garden-1",
      works: [workMint, workAssessment, workReview],
    });

    mockUseGardens.mockReturnValue({
      data: [garden],
      isLoading: false,
    });

    const { result } = renderHook(() => useCrossGardenQueue());

    const ids = result.current.items.map((w) => w.id);
    expect(ids).toEqual(["work-review", "work-assessment", "work-mint"]);
  });

  it("within same tier, sorts by createdAt ascending (FIFO)", () => {
    const workOlder = createMockWork({
      id: "work-older",
      status: "pending_review" as any,
      createdAt: 1000,
    });
    const workNewer = createMockWork({
      id: "work-newer",
      status: "pending_review" as any,
      createdAt: 2000,
    });

    const garden = createMockGarden({
      id: "garden-1",
      works: [workNewer, workOlder],
    });

    mockUseGardens.mockReturnValue({
      data: [garden],
      isLoading: false,
    });

    const { result } = renderHook(() => useCrossGardenQueue());

    const ids = result.current.items.map((w) => w.id);
    expect(ids).toEqual(["work-older", "work-newer"]);
  });

  it("returns accurate gardenCount", () => {
    const gardenA = createMockGarden({ id: "garden-a", works: [] });
    const gardenB = createMockGarden({ id: "garden-b", works: [] });
    const gardenC = createMockGarden({ id: "garden-c", works: [] });

    mockUseGardens.mockReturnValue({
      data: [gardenA, gardenB, gardenC],
      isLoading: false,
    });

    const { result } = renderHook(() => useCrossGardenQueue());

    expect(result.current.gardenCount).toBe(3);
  });

  it("isLoading true while gardens query is loading", () => {
    mockUseGardens.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useCrossGardenQueue());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
  });
});
