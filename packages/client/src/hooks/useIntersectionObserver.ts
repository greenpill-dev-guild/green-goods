import { useCallback, useEffect, useRef, useState } from "react";

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
  triggerOnce?: boolean;
  enabled?: boolean;
}

interface IntersectionResult {
  isIntersecting: boolean;
  isVisible: boolean;
  hasIntersected: boolean;
  entry?: IntersectionObserverEntry;
  ref: React.RefObject<Element>;
}

export function useIntersectionObserver<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {}
): IntersectionResult {
  const {
    threshold = 0,
    rootMargin = "0px",
    root = null,
    triggerOnce = false,
    enabled = true,
  } = options;

  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef<T>(null);

  const updateEntry = useCallback(
    ([entry]: IntersectionObserverEntry[]) => {
      setEntry(entry);

      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    },
    [hasIntersected]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    // Stop observing if we've triggered once and only want to trigger once
    if (triggerOnce && hasIntersected) return;

    const observer = new IntersectionObserver(updateEntry, {
      threshold,
      rootMargin,
      root,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [updateEntry, threshold, rootMargin, root, triggerOnce, hasIntersected, enabled]);

  return {
    isIntersecting: entry?.isIntersecting ?? false,
    isVisible: entry?.isIntersecting ?? false,
    hasIntersected,
    entry,
    ref: elementRef,
  };
}

// Hook for multiple elements
export function useIntersectionObserverMultiple<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {}
): {
  observe: (element: T) => void;
  unobserve: (element: T) => void;
  entries: Map<T, IntersectionObserverEntry>;
} {
  const { threshold = 0, rootMargin = "0px", root = null, enabled = true } = options;

  const [entries, setEntries] = useState<Map<T, IntersectionObserverEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver>();

  const updateEntries = useCallback((observerEntries: IntersectionObserverEntry[]) => {
    setEntries((prev) => {
      const newEntries = new Map(prev);
      observerEntries.forEach((entry) => {
        newEntries.set(entry.target as T, entry);
      });
      return newEntries;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    observerRef.current = new IntersectionObserver(updateEntries, {
      threshold,
      rootMargin,
      root,
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [updateEntries, threshold, rootMargin, root, enabled]);

  const observe = useCallback((element: T) => {
    observerRef.current?.observe(element);
  }, []);

  const unobserve = useCallback((element: T) => {
    observerRef.current?.unobserve(element);
    setEntries((prev) => {
      const newEntries = new Map(prev);
      newEntries.delete(element);
      return newEntries;
    });
  }, []);

  return {
    observe,
    unobserve,
    entries,
  };
}

// Hook for lazy loading content
export function useLazyLoad<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {}
) {
  const { isIntersecting, hasIntersected, ref } = useIntersectionObserver<T>({
    triggerOnce: true,
    rootMargin: "50px",
    ...options,
  });

  return {
    shouldLoad: hasIntersected,
    isVisible: isIntersecting,
    ref,
  };
}

// Hook for infinite scrolling
export function useInfiniteScroll<T extends Element = Element>(
  loadMore: () => void | Promise<void>,
  options: UseIntersectionObserverOptions & {
    hasMore?: boolean;
    isLoading?: boolean;
  } = {}
) {
  const {
    hasMore = true,
    isLoading = false,
    rootMargin = "100px",
    ...intersectionOptions
  } = options;

  const { isIntersecting, ref } = useIntersectionObserver<T>({
    rootMargin,
    ...intersectionOptions,
  });

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading) {
      loadMoreRef.current();
    }
  }, [isIntersecting, hasMore, isLoading]);

  return {
    ref,
    isIntersecting,
  };
}

// Hook for scroll-triggered animations
export function useScrollAnimation<T extends Element = Element>(
  options: UseIntersectionObserverOptions & {
    animationClass?: string;
    resetOnExit?: boolean;
  } = {}
) {
  const {
    animationClass = "animate-fade-in",
    resetOnExit = false,
    threshold = 0.1,
    ...intersectionOptions
  } = options;

  const { isIntersecting, hasIntersected, ref } = useIntersectionObserver<T>({
    threshold,
    ...intersectionOptions,
  });

  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (isIntersecting) {
      setShouldAnimate(true);
    } else if (resetOnExit) {
      setShouldAnimate(false);
    }
  }, [isIntersecting, resetOnExit]);

  const getAnimationProps = useCallback(() => {
    return shouldAnimate ? { className: animationClass } : {};
  }, [shouldAnimate, animationClass]);

  return {
    ref,
    isVisible: isIntersecting,
    hasBeenVisible: hasIntersected,
    shouldAnimate,
    getAnimationProps,
  };
}

// Hook for viewport detection with precise positioning
export function useViewportPosition<T extends Element = Element>() {
  const [position, setPosition] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

  const elementRef = useRef<T>(null);

  const updatePosition = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    setPosition({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    });
  }, []);

  // Use intersection observer to detect when element enters/exits viewport
  const { isIntersecting } = useIntersectionObserver({
    root: null,
    threshold: 0,
    enabled: true,
  });

  useEffect(() => {
    if (isIntersecting) {
      updatePosition();

      // Update position on scroll and resize
      const handleUpdate = () => updatePosition();
      window.addEventListener("scroll", handleUpdate, { passive: true });
      window.addEventListener("resize", handleUpdate);

      return () => {
        window.removeEventListener("scroll", handleUpdate);
        window.removeEventListener("resize", handleUpdate);
      };
    }
  }, [isIntersecting, updatePosition]);

  return {
    ref: elementRef,
    position,
    isInViewport: isIntersecting,
    updatePosition,
  };
}
