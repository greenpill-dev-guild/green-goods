/**
 * useGardenTabs Hook Tests
 * @vitest-environment jsdom
 *
 * Tests tab switching, scroll position tracking,
 * and ref management for garden view tabs.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGardenTabs, GardenTab } from "../../../hooks/garden/useGardenTabs";

describe("useGardenTabs", () => {
  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts with Work tab active", () => {
      const { result } = renderHook(() => useGardenTabs());
      expect(result.current.activeTab).toBe(GardenTab.Work);
    });

    it("initializes scroll positions to 0 for all tabs", () => {
      const { result } = renderHook(() => useGardenTabs());

      expect(result.current.scrollPositions[GardenTab.Work]).toBe(0);
      expect(result.current.scrollPositions[GardenTab.Insights]).toBe(0);
      expect(result.current.scrollPositions[GardenTab.Gardeners]).toBe(0);
    });

    it("provides refs for all three tabs", () => {
      const { result } = renderHook(() => useGardenTabs());

      expect(result.current.tabRefs[GardenTab.Work]).toBeDefined();
      expect(result.current.tabRefs[GardenTab.Insights]).toBeDefined();
      expect(result.current.tabRefs[GardenTab.Gardeners]).toBeDefined();
    });
  });

  // ------------------------------------------
  // Tab switching
  // ------------------------------------------

  describe("tab switching", () => {
    it("switches to Insights tab", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.setActiveTab(GardenTab.Insights);
      });

      expect(result.current.activeTab).toBe(GardenTab.Insights);
    });

    it("switches to Gardeners tab", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.setActiveTab(GardenTab.Gardeners);
      });

      expect(result.current.activeTab).toBe(GardenTab.Gardeners);
    });

    it("can switch back to Work tab", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.setActiveTab(GardenTab.Insights);
      });

      act(() => {
        result.current.setActiveTab(GardenTab.Work);
      });

      expect(result.current.activeTab).toBe(GardenTab.Work);
    });
  });

  // ------------------------------------------
  // Scroll position tracking
  // ------------------------------------------

  describe("scroll position tracking", () => {
    it("updates scroll position on handleScroll", () => {
      const { result } = renderHook(() => useGardenTabs());

      const scrollHandler = result.current.handleScroll(GardenTab.Work);

      act(() => {
        scrollHandler({
          currentTarget: { scrollTop: 150 },
        } as unknown as React.UIEvent<HTMLUListElement>);
      });

      expect(result.current.scrollPositions[GardenTab.Work]).toBe(150);
    });

    it("tracks scroll positions per tab independently", () => {
      const { result } = renderHook(() => useGardenTabs());

      act(() => {
        result.current.handleScroll(GardenTab.Work)({
          currentTarget: { scrollTop: 100 },
        } as unknown as React.UIEvent<HTMLUListElement>);
      });

      act(() => {
        result.current.handleScroll(GardenTab.Insights)({
          currentTarget: { scrollTop: 200 },
        } as unknown as React.UIEvent<HTMLUListElement>);
      });

      expect(result.current.scrollPositions[GardenTab.Work]).toBe(100);
      expect(result.current.scrollPositions[GardenTab.Insights]).toBe(200);
      expect(result.current.scrollPositions[GardenTab.Gardeners]).toBe(0);
    });
  });

  // ------------------------------------------
  // API surface
  // ------------------------------------------

  describe("API surface", () => {
    it("returns all expected properties", () => {
      const { result } = renderHook(() => useGardenTabs());

      expect(result.current).toHaveProperty("activeTab");
      expect(result.current).toHaveProperty("setActiveTab");
      expect(result.current).toHaveProperty("scrollPositions");
      expect(result.current).toHaveProperty("tabRefs");
      expect(result.current).toHaveProperty("handleScroll");
      expect(result.current).toHaveProperty("restoreScrollPosition");
    });

    it("handleScroll returns a function", () => {
      const { result } = renderHook(() => useGardenTabs());
      expect(typeof result.current.handleScroll(GardenTab.Work)).toBe("function");
    });

    it("restoreScrollPosition is a function", () => {
      const { result } = renderHook(() => useGardenTabs());
      expect(typeof result.current.restoreScrollPosition).toBe("function");
    });
  });

  // ------------------------------------------
  // GardenTab enum
  // ------------------------------------------

  describe("GardenTab enum", () => {
    it("has expected values", () => {
      expect(GardenTab.Work).toBe("work");
      expect(GardenTab.Insights).toBe("insights");
      expect(GardenTab.Gardeners).toBe("gardeners");
    });
  });
});
