/**
 * useGardenUrlSync Hook Tests
 * @vitest-environment jsdom
 *
 * Tests URL <-> store synchronization for the cockpit garden navigation.
 */

import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockGarden, createTestQueryClient } from "../../test-utils";
import { QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "react-intl";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSetSelectedGarden = vi.fn();
const mockSelectedGardenId = { current: null as string | null };
const mockGardensData = { current: [] as any[] };
const mockHasFetchedGardens = { current: true };

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: any) => any) =>
    selector({
      selectedGarden: mockSelectedGardenId.current ? { id: mockSelectedGardenId.current } : null,
      setSelectedGarden: mockSetSelectedGarden,
    }),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({
    data: mockGardensData.current,
    isFetched: mockHasFetchedGardens.current,
  }),
}));

import { useGardenUrlSync } from "../../../hooks/navigation/useGardenUrlSync";

// ── Helpers ────────────────────────────────────────────────────────────────

function createRouterWrapper(initialEntries: string[]) {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries },
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(IntlProvider, { locale: "en", messages: {} }, children)
      )
    );
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useGardenUrlSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedGardenId.current = null;
    mockGardensData.current = [];
    mockHasFetchedGardens.current = true;
  });

  it("reads garden ID from URL ?garden= param", () => {
    const garden = createMockGarden({ id: "garden-123" });
    mockGardensData.current = [garden];
    // Simulate that the store already reflects the URL garden (steady state)
    mockSelectedGardenId.current = "garden-123";

    const wrapper = createRouterWrapper(["/work?garden=garden-123"]);
    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.gardenId).toBe("garden-123");
  });

  it("reads tab from URL ?tab= param", () => {
    const wrapper = createRouterWrapper(["/work?tab=community"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.tab).toBe("community");
  });

  it("setTab updates URL search param", () => {
    const wrapper = createRouterWrapper(["/work"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    act(() => {
      result.current.setTab("actions");
    });

    // After setting tab, the hook should reflect the new tab value
    expect(result.current.tab).toBe("actions");
  });

  it("openItem adds ?item= param to URL", () => {
    const wrapper = createRouterWrapper(["/work"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    act(() => {
      result.current.openItem("item-456");
    });

    expect(result.current.item).toBe("item-456");
  });

  it("closeItem removes ?item= param", () => {
    const wrapper = createRouterWrapper(["/work?item=item-789"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.item).toBe("item-789");

    act(() => {
      result.current.closeItem();
    });

    expect(result.current.item).toBeNull();
  });

  it("syncs garden selection to useAdminStore", () => {
    const garden = createMockGarden({ id: "garden-sync" });
    mockGardensData.current = [garden];
    mockHasFetchedGardens.current = true;

    const wrapper = createRouterWrapper(["/work?garden=garden-sync"]);

    renderHook(() => useGardenUrlSync(), { wrapper });

    // The hook should call setSelectedGarden with the matching garden
    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "garden-sync" })
    );
  });
});
