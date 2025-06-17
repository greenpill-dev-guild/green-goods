import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useIntersectionObserver,
  useLazyLoad,
  useInfiniteScroll,
} from "@/hooks/useIntersectionObserver";

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

mockIntersectionObserver.mockImplementation((callback, options) => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
  callback,
  options,
}));

vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);

describe("useIntersectionObserver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useIntersectionObserver());

    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasIntersected).toBe(false);
    expect(result.current.entry).toBeUndefined();
    expect(result.current.ref).toBeDefined();
  });

  it("should create IntersectionObserver with correct options", () => {
    const options = {
      threshold: 0.5,
      rootMargin: "10px",
      root: document.body,
    };

    const { result } = renderHook(() => useIntersectionObserver(options));

    // Mock element
    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining(options)
    );
  });

  it("should observe element when ref is set", () => {
    const { result } = renderHook(() => useIntersectionObserver());

    const mockElement = document.createElement("div");

    act(() => {
      result.current.ref.current = mockElement;
    });

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it("should handle intersection changes", () => {
    const { result } = renderHook(() => useIntersectionObserver());

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    // Get the callback function passed to IntersectionObserver
    const callback = mockIntersectionObserver.mock.calls[0][0];

    // Simulate intersection
    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
      intersectionRatio: 0.5,
      boundingClientRect: {},
      intersectionRect: {},
      rootBounds: {},
      time: 0,
    };

    act(() => {
      callback([mockEntry]);
    });

    expect(result.current.isIntersecting).toBe(true);
    expect(result.current.isVisible).toBe(true);
    expect(result.current.hasIntersected).toBe(true);
    expect(result.current.entry).toEqual(mockEntry);
  });

  it("should handle triggerOnce option", () => {
    const { result } = renderHook(() => useIntersectionObserver({ triggerOnce: true }));

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    const callback = mockIntersectionObserver.mock.calls[0][0];

    // First intersection
    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
    };

    act(() => {
      callback([mockEntry]);
    });

    expect(result.current.hasIntersected).toBe(true);

    // Should not observe again after triggering once
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should disconnect observer on unmount", () => {
    const { unmount } = renderHook(() => useIntersectionObserver());

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should handle enabled option", () => {
    const { result, rerender } = renderHook(({ enabled }) => useIntersectionObserver({ enabled }), {
      initialProps: { enabled: false },
    });

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    expect(mockObserve).not.toHaveBeenCalled();

    // Enable the observer
    rerender({ enabled: true });

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });
});

describe("useLazyLoad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with correct lazy load state", () => {
    const { result } = renderHook(() => useLazyLoad());

    expect(result.current.shouldLoad).toBe(false);
    expect(result.current.isVisible).toBe(false);
    expect(result.current.ref).toBeDefined();
  });

  it("should trigger loading when intersecting", () => {
    const { result } = renderHook(() => useLazyLoad());

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    const callback = mockIntersectionObserver.mock.calls[0][0];

    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
    };

    act(() => {
      callback([mockEntry]);
    });

    expect(result.current.shouldLoad).toBe(true);
    expect(result.current.isVisible).toBe(true);
  });

  it("should use triggerOnce by default", () => {
    renderHook(() => useLazyLoad());

    // Check that triggerOnce is true in the options
    const options = mockIntersectionObserver.mock.calls[0][1];
    expect(options).toEqual(
      expect.objectContaining({
        triggerOnce: true,
        rootMargin: "50px",
      })
    );
  });
});

describe("useInfiniteScroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call loadMore when intersecting", () => {
    const mockLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll(mockLoadMore, { hasMore: true, isLoading: false })
    );

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    const callback = mockIntersectionObserver.mock.calls[0][0];

    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
    };

    act(() => {
      callback([mockEntry]);
    });

    expect(mockLoadMore).toHaveBeenCalled();
  });

  it("should not call loadMore when hasMore is false", () => {
    const mockLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll(mockLoadMore, { hasMore: false, isLoading: false })
    );

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    const callback = mockIntersectionObserver.mock.calls[0][0];

    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
    };

    act(() => {
      callback([mockEntry]);
    });

    expect(mockLoadMore).not.toHaveBeenCalled();
  });

  it("should not call loadMore when isLoading is true", () => {
    const mockLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll(mockLoadMore, { hasMore: true, isLoading: true })
    );

    const mockElement = document.createElement("div");
    result.current.ref.current = mockElement;

    const callback = mockIntersectionObserver.mock.calls[0][0];

    const mockEntry = {
      isIntersecting: true,
      target: mockElement,
    };

    act(() => {
      callback([mockEntry]);
    });

    expect(mockLoadMore).not.toHaveBeenCalled();
  });

  it("should use correct default rootMargin", () => {
    const mockLoadMore = vi.fn();
    renderHook(() => useInfiniteScroll(mockLoadMore));

    const options = mockIntersectionObserver.mock.calls[0][1];
    expect(options.rootMargin).toBe("100px");
  });
});
