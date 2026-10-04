import { createMockGarden, createMockWork } from "../../test-utils/mock-factories";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResolvedWorkDetail } from "../../../hooks/admin-ui/garden/useResolvedWorkDetail";

const {
  mockSelectGarden,
  mockUseActions,
  mockUseAdminGardenContext,
  mockUseGardenPermissions,
  mockUseGardens,
  mockUseWorks,
} = vi.hoisted(() => ({
  mockSelectGarden: vi.fn(),
  mockUseActions: vi.fn(),
  mockUseAdminGardenContext: vi.fn(),
  mockUseGardenPermissions: vi.fn(),
  mockUseGardens: vi.fn(),
  mockUseWorks: vi.fn(),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => mockUseActions(),
  useGardens: () => mockUseGardens(),
}));

vi.mock("../../../hooks/garden/useAdminGardenContext", () => ({
  useAdminGardenContext: () => mockUseAdminGardenContext(),
}));

vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => mockUseGardenPermissions(),
}));

vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: () => mockUseWorks(),
}));

const work = createMockWork({ id: "work-1", gardenAddress: "garden-1" });
const garden = createMockGarden({ id: "garden-1", works: [work] });

describe("useResolvedWorkDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminGardenContext.mockReturnValue({
      activeGarden: garden,
      activeGardenId: garden.id,
      isError: false,
      selectGarden: mockSelectGarden,
    });
    mockUseGardenPermissions.mockReturnValue({
      canReviewGarden: () => true,
      isStewardOfGarden: () => true,
      isOwnerOfGarden: () => false,
    });
    mockUseActions.mockReturnValue({ data: [], isError: false });
    mockUseGardens.mockReturnValue({
      data: [garden],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [work],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
  });

  it("retains the last authoritative work and garden while the current collection changes", () => {
    const { result, rerender } = renderHook(() => useResolvedWorkDetail(work.id));

    expect(result.current.work).toBe(work);
    expect(result.current.garden).toBe(garden);

    mockUseGardens.mockReturnValue({
      data: [{ ...garden, works: [] }],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [createMockWork({ id: "unrelated-work", gardenAddress: garden.id })],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    rerender();

    expect(result.current.resolutionStatus).toBe("temporarily-absent");
    expect(result.current.work).toBe(work);
    expect(result.current.garden).toBe(garden);
  });

  it("settles when each render hands back an equal copy of the garden and the work", () => {
    // The garden work list did this from 16 September 2026 until it was fixed:
    // the same content in new objects on every render. Keeping each copy in
    // state re-rendered without end.
    mockUseGardens.mockImplementation(() => ({
      data: [{ ...garden }],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }));
    mockUseWorks.mockImplementation(() => ({
      works: [{ ...work }],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }));
    let renders = 0;

    const { result } = renderHook(() => {
      renders += 1;
      // Without this a loop spins inside act and hangs the run instead of failing it.
      if (renders > 50) throw new Error("useResolvedWorkDetail kept re-rendering");
      return useResolvedWorkDetail(work.id);
    });

    expect(result.current.resolutionStatus).toBe("resolved");
    expect(result.current.work).toEqual(work);
    expect(renders).toBeLessThan(10);
  });

  it("keeps the latest version of the record, not the first one it saw", () => {
    const { result, rerender } = renderHook(() => useResolvedWorkDetail(work.id));
    const settled = { isLoading: false, isFetching: false, isError: false, error: null };

    // A decision lands while the detail is open.
    const approved = { ...work, status: "approved" as const };
    mockUseWorks.mockReturnValue({ works: [approved], ...settled });
    rerender();
    expect(result.current.work).toBe(approved);

    // Then the record leaves both collections: the detail still shows the decision.
    mockUseGardens.mockReturnValue({ data: [{ ...garden, works: [] }], ...settled });
    mockUseWorks.mockReturnValue({ works: [], ...settled });
    rerender();

    expect(result.current.resolutionStatus).toBe("temporarily-absent");
    expect(result.current.work).toBe(approved);
  });

  it("keeps query failure distinct from authoritative not found", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Gardens unavailable"),
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Works unavailable"),
    });

    const { result } = renderHook(() => useResolvedWorkDetail("unknown-work"));

    expect(result.current.resolutionStatus).toBe("error");
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.error).toEqual(expect.any(Error));
  });

  it("reports not found only after authoritative sources settle", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
    });
    const { result, rerender } = renderHook(() => useResolvedWorkDetail("unknown-work"));

    expect(result.current.resolutionStatus).toBe("loading");

    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    rerender();

    expect(result.current.resolutionStatus).toBe("not-found");
    expect(result.current.isNotFound).toBe(true);
  });
});
