/**
 * useTheme Hook Tests
 *
 * Tests the theme management hook that supports light/dark/system modes,
 * persists to localStorage, and syncs with system preference changes.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock theme utilities
const mockGetTheme = vi.fn();
const mockGetResolvedTheme = vi.fn();
const mockSetThemeAPI = vi.fn();

vi.mock("../../../utils/styles/theme", () => ({
  getTheme: () => mockGetTheme(),
  getResolvedTheme: (theme: string) => mockGetResolvedTheme(theme),
  setTheme: (theme: string) => mockSetThemeAPI(theme),
}));

// Mock AppKit theme sync
const mockUpdateAppKitTheme = vi.fn();
vi.mock("../../../config/appkit", () => ({
  updateAppKitTheme: (isDark: boolean) => mockUpdateAppKitTheme(isDark),
}));

import { useTheme } from "../../../hooks/app/useTheme";

describe("hooks/app/useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTheme.mockReturnValue("system");
    mockGetResolvedTheme.mockReturnValue("light");
  });

  describe("initial state", () => {
    it("initializes with stored theme", () => {
      mockGetTheme.mockReturnValue("dark");
      mockGetResolvedTheme.mockReturnValue("dark");

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe("dark");
      expect(result.current.isDark).toBe(true);
    });

    it("defaults to system theme", () => {
      mockGetTheme.mockReturnValue("system");
      mockGetResolvedTheme.mockReturnValue("light");

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe("system");
      expect(result.current.isDark).toBe(false);
    });
  });

  describe("setTheme", () => {
    it("updates theme state and persists", () => {
      const { result } = renderHook(() => useTheme());

      mockGetResolvedTheme.mockReturnValue("dark");

      act(() => {
        result.current.setTheme("dark");
      });

      expect(result.current.theme).toBe("dark");
      expect(result.current.isDark).toBe(true);
      expect(mockSetThemeAPI).toHaveBeenCalledWith("dark");
    });

    it("syncs AppKit theme on change", () => {
      const { result } = renderHook(() => useTheme());

      mockGetResolvedTheme.mockReturnValue("dark");

      act(() => {
        result.current.setTheme("dark");
      });

      expect(mockUpdateAppKitTheme).toHaveBeenCalledWith(true);
    });

    it("resolves system theme correctly", () => {
      const { result } = renderHook(() => useTheme());

      mockGetResolvedTheme.mockReturnValue("light");

      act(() => {
        result.current.setTheme("system");
      });

      expect(result.current.theme).toBe("system");
      expect(result.current.isDark).toBe(false);
      expect(mockUpdateAppKitTheme).toHaveBeenCalledWith(false);
    });
  });

  describe("toggleTheme", () => {
    it("cycles light -> dark -> system -> light", () => {
      mockGetTheme.mockReturnValue("light");
      mockGetResolvedTheme.mockReturnValue("light");

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe("light");

      // light -> dark
      mockGetResolvedTheme.mockReturnValue("dark");
      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe("dark");

      // dark -> system
      mockGetResolvedTheme.mockReturnValue("light");
      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe("system");

      // system -> light
      mockGetResolvedTheme.mockReturnValue("light");
      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe("light");
    });
  });

  describe("system theme changes", () => {
    it("listens for media query changes when in system mode", () => {
      mockGetTheme.mockReturnValue("system");
      mockGetResolvedTheme.mockReturnValue("light");

      const addEventListenerSpy = vi.fn();
      const removeEventListenerSpy = vi.fn();

      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: addEventListenerSpy,
        removeEventListener: removeEventListenerSpy,
      });

      const origMatchMedia = window.matchMedia;
      Object.defineProperty(window, "matchMedia", {
        value: mockMatchMedia,
        writable: true,
      });

      const { unmount } = renderHook(() => useTheme());

      // Should add listener for prefers-color-scheme
      expect(addEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));

      unmount();

      // Should clean up listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));

      Object.defineProperty(window, "matchMedia", {
        value: origMatchMedia,
        writable: true,
      });
    });

    it("does not listen for system changes when theme is explicit", () => {
      mockGetTheme.mockReturnValue("dark");
      mockGetResolvedTheme.mockReturnValue("dark");

      const addEventListenerSpy = vi.fn();
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: addEventListenerSpy,
        removeEventListener: vi.fn(),
      });

      const origMatchMedia = window.matchMedia;
      Object.defineProperty(window, "matchMedia", {
        value: mockMatchMedia,
        writable: true,
      });

      renderHook(() => useTheme());

      // Should NOT add listener since theme is explicit "dark"
      expect(addEventListenerSpy).not.toHaveBeenCalled();

      Object.defineProperty(window, "matchMedia", {
        value: origMatchMedia,
        writable: true,
      });
    });
  });

  describe("return value", () => {
    it("provides all expected properties", () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current).toHaveProperty("theme");
      expect(result.current).toHaveProperty("isDark");
      expect(result.current).toHaveProperty("setTheme");
      expect(result.current).toHaveProperty("toggleTheme");
      expect(typeof result.current.setTheme).toBe("function");
      expect(typeof result.current.toggleTheme).toBe("function");
    });
  });
});
