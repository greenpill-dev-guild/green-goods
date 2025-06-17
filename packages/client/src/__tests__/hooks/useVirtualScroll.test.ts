import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useVirtualScroll } from "@/hooks/useVirtualScroll";

// Mock requestAnimationFrame
const mockRequestAnimationFrame = vi.fn();
vi.stubGlobal("requestAnimationFrame", mockRequestAnimationFrame);

// Mock performance.now
const mockPerformanceNow = vi.fn();
vi.stubGlobal("performance", { now: mockPerformanceNow });

// Mock timers
vi.useFakeTimers();

describe("useVirtualScroll", () => {
  const mockItems = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
  const defaultOptions = {
    itemHeight: 50,
    containerHeight: 400,
    overscan: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
    mockRequestAnimationFrame.mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    expect(result.current.visibleItems).toHaveLength(11); // 8 visible + 3 overscan on each side
    expect(result.current.isScrolling).toBe(false);
    expect(result.current.containerProps).toBeDefined();
    expect(result.current.wrapperProps).toBeDefined();
  });

  it("should calculate correct visible items for given scroll position", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    // Simulate scroll to middle
    const scrollEvent = {
      currentTarget: { scrollTop: 2500 },
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.containerProps.onScroll(scrollEvent);
    });

    // At scroll position 2500 with item height 50:
    // - Visible start: floor(2500 / 50) = 50
    // - Visible end: floor((2500 + 400) / 50) = 58
    // - With overscan: start = 47, end = 61
    // - Total visible items: 15
    expect(result.current.visibleItems).toHaveLength(15);
    expect(result.current.visibleItems[0].index).toBe(47);
    expect(result.current.visibleItems[result.current.visibleItems.length - 1].index).toBe(61);
  });

  it("should set scrolling state correctly", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    const scrollEvent = {
      currentTarget: { scrollTop: 100 },
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.containerProps.onScroll(scrollEvent);
    });

    expect(result.current.isScrolling).toBe(true);

    // Fast-forward past scrolling delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.isScrolling).toBe(false);
  });

  it("should calculate correct item positions", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    const visibleItems = result.current.visibleItems;

    // Check that positions are calculated correctly
    visibleItems.forEach((item, index) => {
      expect(item.offsetTop).toBe(item.index * defaultOptions.itemHeight);
    });
  });

  it("should handle scrollToIndex correctly", () => {
    const mockContainer = {
      scrollTop: 0,
    };

    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    // Mock the container ref
    result.current.containerProps.ref.current = mockContainer as any;

    act(() => {
      result.current.scrollToIndex(100);
    });

    expect(mockContainer.scrollTop).toBe(100 * defaultOptions.itemHeight);
  });

  it("should handle scrollToTop correctly", () => {
    const mockContainer = {
      scrollTop: 1000,
    };

    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    // Mock the container ref
    result.current.containerProps.ref.current = mockContainer as any;

    act(() => {
      result.current.scrollToTop();
    });

    expect(mockContainer.scrollTop).toBe(0);
  });

  it("should handle edge cases at the beginning of list", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    // Scroll to very top
    const scrollEvent = {
      currentTarget: { scrollTop: 0 },
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.containerProps.onScroll(scrollEvent);
    });

    // Should start from index 0 even with overscan
    expect(result.current.visibleItems[0].index).toBe(0);
  });

  it("should handle edge cases at the end of list", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    // Scroll to very bottom
    const scrollEvent = {
      currentTarget: { scrollTop: 50000 }, // Way past the end
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.containerProps.onScroll(scrollEvent);
    });

    // Should not exceed the last item index
    const lastVisibleItem = result.current.visibleItems[result.current.visibleItems.length - 1];
    expect(lastVisibleItem.index).toBe(mockItems.length - 1);
  });

  it("should have correct container props for performance", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    const containerProps = result.current.containerProps;

    expect(containerProps.style.height).toBe(defaultOptions.containerHeight);
    expect(containerProps.style.overflow).toBe("auto");
    expect(containerProps.style.transform).toBe("translateZ(0)");
    expect(containerProps.style.willChange).toBe("scroll-position");
    expect(containerProps.style.WebkitOverflowScrolling).toBe("touch");
    expect(containerProps.style.overscrollBehavior).toBe("none");
  });

  it("should have correct wrapper props", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    const wrapperProps = result.current.wrapperProps;
    const expectedTotalHeight = mockItems.length * defaultOptions.itemHeight;

    expect(wrapperProps.style.height).toBe(expectedTotalHeight);
    expect(wrapperProps.style.position).toBe("relative");
  });

  it("should respect custom overscan value", () => {
    const customOverscan = 5;
    const { result } = renderHook(() =>
      useVirtualScroll(mockItems, {
        ...defaultOptions,
        overscan: customOverscan,
      })
    );

    // At scroll position 0:
    // - Visible items: 0-7 (8 items fit in 400px container with 50px height)
    // - With overscan 5: 0-12 (13 items total)
    expect(result.current.visibleItems).toHaveLength(13);
  });

  it("should handle empty items array", () => {
    const { result } = renderHook(() => useVirtualScroll([], defaultOptions));

    expect(result.current.visibleItems).toHaveLength(0);
    expect(result.current.wrapperProps.style.height).toBe(0);
  });

  it("should handle scroll events with custom scrolling delay", () => {
    const customDelay = 300;
    const { result } = renderHook(() =>
      useVirtualScroll(mockItems, {
        ...defaultOptions,
        scrollingDelay: customDelay,
      })
    );

    const scrollEvent = {
      currentTarget: { scrollTop: 100 },
    } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.containerProps.onScroll(scrollEvent);
    });

    expect(result.current.isScrolling).toBe(true);

    // Fast-forward past default delay but not custom delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.isScrolling).toBe(true);

    // Fast-forward past custom delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.isScrolling).toBe(false);
  });

  it("should handle multiple rapid scroll events", () => {
    const { result } = renderHook(() => useVirtualScroll(mockItems, defaultOptions));

    // Rapid scroll events
    for (let i = 0; i < 5; i++) {
      const scrollEvent = {
        currentTarget: { scrollTop: i * 100 },
      } as React.UIEvent<HTMLDivElement>;

      act(() => {
        result.current.containerProps.onScroll(scrollEvent);
      });
    }

    expect(result.current.isScrolling).toBe(true);

    // Should only set one timeout for scrolling end
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.isScrolling).toBe(false);
  });
});
