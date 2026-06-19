/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetSearchParams = vi.fn();
const mockSearchParams = { current: new URLSearchParams() };
const mockSetSelectedGarden = vi.fn();
const mockSetPersistedGardenId = vi.fn();
const mockSelectedGardenId = { current: null as string | null };
const mockSelectedGarden = { current: null as any };
const mockEligibleGardens = { current: [] as any[] };
const mockResolvedDefaultGarden = { current: null as any };
const mockIsLoaded = { current: true };

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParams.current, mockSetSearchParams],
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
    eligibleGardens: mockEligibleGardens.current,
    resolvedDefaultGarden: mockResolvedDefaultGarden.current,
    persistedGardenId: null,
    scopeKey: "11155111:0x1111111111111111111111111111111111111111",
    canCreateGarden: false,
    isLoaded: mockIsLoaded.current,
  }),
}));

import { useGardenUrlSync } from "../../../hooks/navigation/useGardenUrlSync";

describe("useGardenUrlSync search options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetSelectedGarden.mockImplementation((garden) => {
      mockSelectedGarden.current = garden;
      mockSelectedGardenId.current = garden?.id ?? null;
    });
    mockSearchParams.current = new URLSearchParams();
    mockSelectedGardenId.current = null;
    mockSelectedGarden.current = null;
    mockEligibleGardens.current = [];
    mockResolvedDefaultGarden.current = null;
    mockIsLoaded.current = true;
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

  it("keeps garden and tab updates as replace-only URL updates", () => {
    const { result } = renderHook(() => useGardenUrlSync());

    act(() => {
      result.current.setTab("activity");
    });

    expect(mockSetSearchParams).toHaveBeenLastCalledWith(expect.any(Function), { replace: true });

    act(() => {
      result.current.setGarden(null);
    });

    expect(mockSetSearchParams).toHaveBeenLastCalledWith(expect.any(Function), { replace: true });
  });

  it("does not let a second hook instance restore the previous URL garden while a switch is pending", () => {
    const gardenA = {
      id: "garden-a",
      name: "Alpha",
      tokenAddress: "0xaaa0000000000000000000000000000000000aaa",
    };
    const gardenB = {
      id: "garden-b",
      name: "Beta",
      tokenAddress: "0xbbb0000000000000000000000000000000000bbb",
    };
    mockEligibleGardens.current = [gardenA, gardenB];
    mockSelectedGarden.current = gardenA;
    mockSelectedGardenId.current = gardenA.id;
    mockSearchParams.current = new URLSearchParams(`gardenAddress=${gardenA.tokenAddress}`);

    const { result, rerender } = renderHook(() => ({
      shell: useGardenUrlSync(),
      route: useGardenUrlSync(),
    }));

    act(() => {
      result.current.shell.setGarden(gardenB);
    });

    rerender();

    expect(mockSelectedGarden.current).toEqual(gardenB);
    expect(mockSetSelectedGarden).not.toHaveBeenLastCalledWith(gardenA);
  });
});
