import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number; // Number of items to render outside visible area
  scrollingDelay?: number; // Delay before considering scroll finished
}

interface VirtualScrollResult {
  containerProps: {
    ref: React.RefObject<HTMLDivElement>;
    style: React.CSSProperties;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  };
  wrapperProps: {
    style: React.CSSProperties;
  };
  visibleItems: Array<{
    index: number;
    offsetTop: number;
  }>;
  isScrolling: boolean;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
}

export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
): VirtualScrollResult {
  const { itemHeight, containerHeight, overscan = 3, scrollingDelay = 150 } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate total height
  const totalHeight = items.length * itemHeight;

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight)
    );

    // Add overscan
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(items.length - 1, visibleEnd + overscan);

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Calculate visible items with their positions
  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      items.push({
        index: i,
        offsetTop: i * itemHeight,
      });
    }
    return items;
  }, [visibleRange, itemHeight]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      setIsScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to detect when scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, scrollingDelay);
    },
    [scrollingDelay]
  );

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number) => {
      if (!containerRef.current) return;

      const targetScrollTop = Math.max(0, index * itemHeight);
      containerRef.current.scrollTop = targetScrollTop;
      setScrollTop(targetScrollTop);
    },
    [itemHeight]
  );

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Props for the container element
  const containerProps = {
    ref: containerRef,
    style: {
      height: containerHeight,
      overflow: "auto" as const,
      // Enable hardware acceleration
      transform: "translateZ(0)",
      willChange: "scroll-position" as const,
      // iOS momentum scrolling
      WebkitOverflowScrolling: "touch" as const,
      // Prevent overscroll
      overscrollBehavior: "none" as const,
    },
    onScroll: handleScroll,
  };

  // Props for the wrapper element (holds the total height)
  const wrapperProps = {
    style: {
      height: totalHeight,
      position: "relative" as const,
    },
  };

  return {
    containerProps,
    wrapperProps,
    visibleItems,
    isScrolling,
    scrollToIndex,
    scrollToTop,
  };
}

// Hook for dynamic item heights (more complex but handles variable heights)
export function useDynamicVirtualScroll<T>(
  items: T[],
  estimateItemHeight: (item: T, index: number) => number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementsRef = useRef<Map<number, number>>(new Map());
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Measure an item
  const measureItem = useCallback((index: number, height: number) => {
    measurementsRef.current.set(index, height);
  }, []);

  // Calculate positions and heights
  const itemData = useMemo(() => {
    let totalHeight = 0;
    const positions = new Map<number, { top: number; height: number }>();

    for (let i = 0; i < items.length; i++) {
      const height = measurementsRef.current.get(i) || estimateItemHeight(items[i], i);
      positions.set(i, { top: totalHeight, height });
      totalHeight += height;
    }

    return { positions, totalHeight };
  }, [items, estimateItemHeight]);

  // Find visible range for dynamic heights
  const visibleRange = useMemo(() => {
    const { positions } = itemData;

    let start = 0;
    let end = items.length - 1;

    // Binary search for start
    let low = 0;
    let high = items.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const pos = positions.get(mid);
      if (!pos) break;

      if (pos.top + pos.height < scrollTop) {
        start = mid + 1;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Find end
    for (let i = start; i < items.length; i++) {
      const pos = positions.get(i);
      if (!pos) break;

      if (pos.top > scrollTop + containerHeight) {
        end = i - 1;
        break;
      }
    }

    // Add overscan
    start = Math.max(0, start - overscan);
    end = Math.min(items.length - 1, end + overscan);

    return { start, end };
  }, [scrollTop, containerHeight, itemData, items.length, overscan]);

  // Calculate visible items
  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      const position = itemData.positions.get(i);
      if (position) {
        items.push({
          index: i,
          offsetTop: position.top,
          height: position.height,
        });
      }
    }
    return items;
  }, [visibleRange, itemData.positions]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (!containerRef.current) return;

      const position = itemData.positions.get(index);
      if (position) {
        containerRef.current.scrollTop = position.top;
        setScrollTop(position.top);
      }
    },
    [itemData.positions]
  );

  const scrollToTop = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    containerProps: {
      ref: containerRef,
      style: {
        height: containerHeight,
        overflow: "auto" as const,
        transform: "translateZ(0)",
        willChange: "scroll-position" as const,
        WebkitOverflowScrolling: "touch" as const,
        overscrollBehavior: "none" as const,
      },
      onScroll: handleScroll,
    },
    wrapperProps: {
      style: {
        height: itemData.totalHeight,
        position: "relative" as const,
      },
    },
    visibleItems,
    isScrolling,
    scrollToIndex,
    scrollToTop,
    measureItem,
  };
}
