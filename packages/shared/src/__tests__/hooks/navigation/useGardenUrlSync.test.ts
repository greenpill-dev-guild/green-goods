/**
 * useGardenUrlSync Hook Tests
 * @vitest-environment jsdom
 *
 * Tests URL <-> store synchronization for the canvas garden navigation.
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
const mockSetPersistedGardenId = vi.fn();
const mockSelectedGardenId = { current: null as string | null };
const mockSelectedGarden = { current: null as any };
const mockResolvedDefaultGarden = { current: null as any };
const mockEligibleGardens = { current: [] as any[] };
const mockScopeKey = {
  current: "11155111:0x1111111111111111111111111111111111111111" as string | null,
};
const mockIsLoaded = { current: true };

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
    persistedGardenId: mockResolvedDefaultGarden.current?.id ?? null,
    scopeKey: mockScopeKey.current,
    canCreateGarden: false,
    isLoaded: mockIsLoaded.current,
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
    mockSetSelectedGarden.mockImplementation((garden) => {
      mockSelectedGarden.current = garden;
      mockSelectedGardenId.current = garden?.id ?? null;
    });
    mockSelectedGardenId.current = null;
    mockSelectedGarden.current = null;
    mockResolvedDefaultGarden.current = null;
    mockEligibleGardens.current = [];
    mockScopeKey.current = "11155111:0x1111111111111111111111111111111111111111";
    mockIsLoaded.current = true;
  });

  it("reads garden address from URL ?gardenAddress= param", () => {
    const garden = createMockGarden({
      id: "garden-123",
      tokenAddress: "0x1230000000000000000000000000000000000123",
    });
    mockEligibleGardens.current = [garden];
    // Simulate that the store already reflects the URL garden (steady state)
    mockSelectedGardenId.current = "garden-123";

    const wrapper = createRouterWrapper([
      "/hub?gardenAddress=0x1230000000000000000000000000000000000123",
    ]);
    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.gardenId).toBe("garden-123");
  });

  it("reads tab from URL ?tab= param", () => {
    const wrapper = createRouterWrapper(["/hub?tab=community"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.tab).toBe("community");
  });

  it("setTab updates URL search param", () => {
    const wrapper = createRouterWrapper(["/hub"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    act(() => {
      result.current.setTab("actions");
    });

    // After setting tab, the hook should reflect the new tab value
    expect(result.current.tab).toBe("actions");
  });

  it("openItem adds ?item= param to URL for non-Hub canvas filters", () => {
    const wrapper = createRouterWrapper(["/garden/overview"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    act(() => {
      result.current.openItem("item-456");
    });

    expect(result.current.item).toBe("item-456");
  });

  it("closeItem removes ?item= param for non-Hub canvas filters", () => {
    const wrapper = createRouterWrapper(["/garden/overview?item=item-789"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.item).toBe("item-789");

    act(() => {
      result.current.closeItem();
    });

    expect(result.current.item).toBeNull();
  });

  it("syncs garden selection to useAdminStore", () => {
    const garden = createMockGarden({
      id: "garden-sync",
      tokenAddress: "0x4560000000000000000000000000000000000456",
    });
    mockEligibleGardens.current = [garden];
    mockIsLoaded.current = true;

    const wrapper = createRouterWrapper([
      "/hub?gardenAddress=0x4560000000000000000000000000000000000456",
    ]);

    renderHook(() => useGardenUrlSync(), { wrapper });

    // The hook should call setSelectedGarden with the matching garden
    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "garden-sync" })
    );
  });

  it("prefers a valid URL garden over the resolved default garden", () => {
    const urlGarden = createMockGarden({
      id: "garden-url",
      tokenAddress: "0x7890000000000000000000000000000000000789",
    });
    const defaultGarden = createMockGarden({ id: "garden-default" });
    mockEligibleGardens.current = [urlGarden, defaultGarden];
    mockResolvedDefaultGarden.current = defaultGarden;

    const wrapper = createRouterWrapper([
      "/hub?gardenAddress=0x7890000000000000000000000000000000000789",
    ]);

    renderHook(() => useGardenUrlSync(), { wrapper });

    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "garden-url" })
    );
  });

  it("falls back to the resolved default garden when the URL has no garden param", () => {
    const defaultGarden = createMockGarden({ id: "garden-default" });
    mockEligibleGardens.current = [defaultGarden];
    mockResolvedDefaultGarden.current = defaultGarden;

    const wrapper = createRouterWrapper(["/hub"]);

    const { rerender } = renderHook(() => useGardenUrlSync(), { wrapper });

    rerender();

    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "garden-default" })
    );
    expect(mockSetPersistedGardenId).toHaveBeenCalledWith(
      "11155111:0x1111111111111111111111111111111111111111",
      "garden-default"
    );
  });

  it("ignores an invalid gardenAddress and keeps the resolved default garden", () => {
    const defaultGarden = createMockGarden({
      id: "garden-default",
      tokenAddress: "0x9990000000000000000000000000000000000999",
    });
    mockEligibleGardens.current = [defaultGarden];
    mockResolvedDefaultGarden.current = defaultGarden;

    const wrapper = createRouterWrapper([
      "/hub?gardenAddress=0x0000000000000000000000000000000000000001",
    ]);

    renderHook(() => useGardenUrlSync(), { wrapper });

    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "garden-default" })
    );
  });
});
