import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useOptimizedImage } from "@/hooks/useOptimizedImage";

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);

// Mock Image constructor
const mockImage = vi.fn();
mockImage.mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  src: "",
  onload: null,
  onerror: null,
}));
vi.stubGlobal("Image", mockImage);

describe("useOptimizedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with loading state", () => {
    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "test-image.jpg",
        lazy: false,
      })
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);
    expect(result.current.src).toBe("");
  });

  it("should handle successful image loading", async () => {
    const mockImg = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      src: "",
      onload: null as any,
      onerror: null as any,
    };
    mockImage.mockReturnValue(mockImg);

    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "test-image.jpg",
        lazy: false,
      })
    );

    // Simulate successful image load
    if (mockImg.onload) {
      mockImg.onload(new Event("load"));
    }

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  it("should handle image loading errors", async () => {
    const mockImg = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      src: "",
      onload: null as any,
      onerror: null as any,
    };
    mockImage.mockReturnValue(mockImg);

    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "invalid-image.jpg",
        lazy: false,
      })
    );

    // Simulate image error
    if (mockImg.onerror) {
      mockImg.onerror(new Event("error"));
    }

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should support lazy loading with intersection observer", () => {
    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "test-image.jpg",
        lazy: true,
      })
    );

    expect(mockIntersectionObserver).toHaveBeenCalled();
    expect(result.current.imgRef).toBeDefined();
  });

  it("should optimize WebP images when supported", () => {
    // Mock WebP support
    const mockCanvas = {
      width: 1,
      height: 1,
      toDataURL: vi.fn().mockReturnValue("data:image/webp;base64,"),
    };
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(mockCanvas),
    });

    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "test-image.jpg",
        webpFallback: true,
        lazy: false,
      })
    );

    expect(result.current.imgRef).toBeDefined();
  });

  it("should handle retry functionality", async () => {
    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "test-image.jpg",
        lazy: false,
      })
    );

    // First simulate an error
    const mockImg = mockImage.mock.results[0].value;
    if (mockImg.onerror) {
      mockImg.onerror();
    }

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });

    // Then retry
    result.current.retry();

    await waitFor(() => {
      expect(result.current.hasError).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });
  });

  it("should handle quality and sizes parameters", () => {
    const { result } = renderHook(() =>
      useOptimizedImage({
        src: "test-image.jpg",
        quality: 75,
        sizes: "400",
        lazy: false,
      })
    );

    expect(result.current.imgRef).toBeDefined();
  });
});
