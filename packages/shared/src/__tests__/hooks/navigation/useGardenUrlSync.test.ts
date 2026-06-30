/**
 * useGardenUrlSync Hook Tests
 * @vitest-environment jsdom
 *
 * Tests URL <-> store synchronization for the canvas garden navigation.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, Fragment, type ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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
const mockLocationSearch = { current: "" };
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

function LocationRecorder() {
  const location = useLocation();
  mockLocationSearch.current = location.search;
  return null;
}

function createRouterWrapper(initialEntries: string[]) {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries },
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          IntlProvider,
          { locale: "en", messages: {} },
          createElement(Fragment, null, createElement(LocationRecorder), children)
        )
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
    mockLocationSearch.current = "";
    mockScopeKey.current = "11155111:0x1111111111111111111111111111111111111111";
    mockIsLoaded.current = true;
  });

  it("reads garden id from canonical URL ?gardenId= param without Zustand selection", () => {
    const garden = createMockGarden({
      id: "garden-123",
      tokenAddress: "0x1230000000000000000000000000000000000123",
    });
    mockEligibleGardens.current = [garden];

    const wrapper = createRouterWrapper(["/hub?gardenId=garden-123"]);
    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.gardenId).toBe("garden-123");
    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
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

  it("setGarden writes canonical gardenId, preserves unrelated search params, and pushes history", async () => {
    const greenGarden = createMockGarden({
      id: "garden-green",
      name: "Green Goods Community Garden",
      tokenAddress: "0xaaa0000000000000000000000000000000000aaa",
    });
    const growGarden = createMockGarden({
      id: "garden-grow",
      name: "Grow Ecosystem",
      tokenAddress: "0xbbb0000000000000000000000000000000000bbb",
    });
    mockEligibleGardens.current = [greenGarden, growGarden];

    const wrapper = createRouterWrapper([`/hub/work?gardenId=${greenGarden.id}&sort=oldest`]);
    const { result } = renderHook(
      () => ({
        sync: useGardenUrlSync(),
        navigate: useNavigate(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.sync.setGarden(growGarden);
    });

    await waitFor(() => {
      expect(result.current.sync.gardenId).toBe(growGarden.id);
    });

    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
    expect(mockLocationSearch.current).toContain(`gardenId=${growGarden.id}`);
    expect(mockLocationSearch.current).toContain("sort=oldest");

    act(() => {
      result.current.navigate(-1);
    });

    await waitFor(() => {
      expect(result.current.sync.gardenId).toBe(greenGarden.id);
      expect(mockLocationSearch.current).toContain(`gardenId=${greenGarden.id}`);
    });
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

  it("does not duplicate the route garden into useAdminStore selectedGarden", () => {
    const garden = createMockGarden({
      id: "garden-sync",
      tokenAddress: "0x4560000000000000000000000000000000000456",
    });
    mockEligibleGardens.current = [garden];
    mockIsLoaded.current = true;

    const wrapper = createRouterWrapper(["/hub?gardenId=garden-sync"]);

    renderHook(() => useGardenUrlSync(), { wrapper });

    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
  });

  it("normalizes a legacy gardenAddress URL over the resolved default garden", async () => {
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

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    await waitFor(() => {
      expect(result.current.gardenId).toBe("garden-url");
      expect(mockLocationSearch.current).toContain("gardenId=garden-url");
    });
    expect(mockLocationSearch.current).not.toContain("gardenAddress=");
    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
  });

  it("normalizes the resolved default garden into the URL when the route has no garden id", async () => {
    const defaultGarden = createMockGarden({ id: "garden-default" });
    mockEligibleGardens.current = [defaultGarden];
    mockResolvedDefaultGarden.current = defaultGarden;

    const wrapper = createRouterWrapper(["/hub"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    await waitFor(() => {
      expect(result.current.gardenId).toBe("garden-default");
      expect(mockLocationSearch.current).toContain("gardenId=garden-default");
    });
    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
    expect(mockSetPersistedGardenId).toHaveBeenCalledWith(
      "11155111:0x1111111111111111111111111111111111111111",
      "garden-default"
    );
  });

  it("keeps an explicit invalid garden id unresolved instead of falling back to a different garden", () => {
    const defaultGarden = createMockGarden({
      id: "garden-default",
      tokenAddress: "0x9990000000000000000000000000000000000999",
    });
    mockEligibleGardens.current = [defaultGarden];
    mockResolvedDefaultGarden.current = defaultGarden;

    const wrapper = createRouterWrapper(["/hub?gardenId=garden-missing"]);

    const { result } = renderHook(() => useGardenUrlSync(), { wrapper });

    expect(result.current.gardenId).toBeNull();
    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
  });
});
