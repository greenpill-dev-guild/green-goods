/**
 * useCarousel Hook Tests
 *
 * Tests for the carousel context consumer hook.
 * useCarousel is a thin context consumer that throws when used outside its provider.
 */

import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { CarouselContextProps } from "../../../hooks/app/useCarousel";
import { CarouselContext, useCarousel } from "../../../hooks/app/useCarousel";

describe("hooks/app/useCarousel", () => {
  it("throws when used outside CarouselContext provider", () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useCarousel());
    }).toThrow("useCarousel must be used within a <Carousel />");

    spy.mockRestore();
  });

  it("returns context value when used inside provider", () => {
    const mockContext: CarouselContextProps = {
      carouselRef: (() => {}) as any,
      api: undefined,
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      canScrollPrev: false,
      canScrollNext: true,
      orientation: "horizontal",
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CarouselContext.Provider, { value: mockContext }, children);

    const { result } = renderHook(() => useCarousel(), { wrapper });

    expect(result.current).toBe(mockContext);
    expect(result.current.canScrollPrev).toBe(false);
    expect(result.current.canScrollNext).toBe(true);
    expect(result.current.orientation).toBe("horizontal");
  });

  it("exposes scroll functions from context", () => {
    const scrollPrev = vi.fn();
    const scrollNext = vi.fn();

    const mockContext: CarouselContextProps = {
      carouselRef: (() => {}) as any,
      api: undefined,
      scrollPrev,
      scrollNext,
      canScrollPrev: true,
      canScrollNext: true,
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CarouselContext.Provider, { value: mockContext }, children);

    const { result } = renderHook(() => useCarousel(), { wrapper });

    result.current.scrollNext();
    result.current.scrollPrev();

    expect(scrollNext).toHaveBeenCalledTimes(1);
    expect(scrollPrev).toHaveBeenCalledTimes(1);
  });

  it("includes optional openPreview when provided", () => {
    const openPreview = vi.fn();

    const mockContext: CarouselContextProps = {
      carouselRef: (() => {}) as any,
      api: undefined,
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      canScrollPrev: false,
      canScrollNext: false,
      openPreview,
      enablePreview: true,
      previewImages: ["img1.jpg", "img2.jpg"],
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CarouselContext.Provider, { value: mockContext }, children);

    const { result } = renderHook(() => useCarousel(), { wrapper });

    expect(result.current.openPreview).toBeDefined();
    result.current.openPreview?.(1);
    expect(openPreview).toHaveBeenCalledWith(1);
    expect(result.current.previewImages).toEqual(["img1.jpg", "img2.jpg"]);
  });
});
