/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockSetSelectedGarden = vi.fn();
const mockSetPersistedGardenId = vi.fn();
const mockSelectedGardenId = { current: null as string | null };
const mockSelectedGarden = { current: null as any };

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: any) => any) =>
    selector({
      selectedGarden:
        mockSelectedGarden.current ??
        (mockSelectedGardenId.current ? { id: mockSelectedGardenId.current } : null),
      setSelectedGarden: mockSetSelectedGarden,
      setPersistedGardenId: mockSetPersistedGardenId,
    }),
}));

vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => ({
    eligibleGardens: [],
    resolvedDefaultGarden: null,
    persistedGardenId: null,
    scopeKey: "11155111:0x1111111111111111111111111111111111111111",
    canCreateGarden: false,
    isLoaded: true,
  }),
}));

import { useGardenUrlSync } from "../../../hooks/navigation/useGardenUrlSync";

describe("useGardenUrlSync search options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedGardenId.current = null;
    mockSelectedGarden.current = null;
  });

  it("preserves scroll when opening and closing route-backed item sheets", () => {
    const { result } = renderHook(() => useGardenUrlSync());

    act(() => {
      result.current.openItem("item-456");
    });

    expect(mockSetSearchParams).toHaveBeenLastCalledWith(expect.any(Function), {
      replace: false,
      preventScrollReset: true,
    });

    act(() => {
      result.current.closeItem();
    });

    expect(mockSetSearchParams).toHaveBeenLastCalledWith(expect.any(Function), {
      replace: false,
      preventScrollReset: true,
    });
  });

  it("pushes garden selections while keeping tab updates replace-only", () => {
    const { result } = renderHook(() => useGardenUrlSync());

    act(() => {
      result.current.setTab("activity");
    });

    expect(mockSetSearchParams).toHaveBeenLastCalledWith(expect.any(Function), { replace: true });

    act(() => {
      result.current.setGarden({ id: "0x2222222222222222222222222222222222222222" } as any);
    });

    expect(mockSetSearchParams).toHaveBeenLastCalledWith(expect.any(Function), {
      replace: false,
      preventScrollReset: true,
    });
  });
});
