/**
 * useDebugMode Hook Tests
 *
 * Tests for the debug mode hook that controls verbose error display in toasts.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDebugMode } from "../../hooks/app/useDebugMode";
import { useUIStore } from "../../stores/useUIStore";

describe("hooks/useDebugMode", () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      debugMode: false,
    });
  });

  afterEach(() => {
    // Clean up localStorage
    localStorage.removeItem("green-goods:debug-mode");
  });

  it("returns debug mode state and controls", () => {
    const { result } = renderHook(() => useDebugMode());

    expect(result.current).toHaveProperty("debugMode");
    expect(result.current).toHaveProperty("setDebugMode");
    expect(result.current).toHaveProperty("toggleDebugMode");
  });

  it("has debug mode disabled by default", () => {
    const { result } = renderHook(() => useDebugMode());

    expect(result.current.debugMode).toBe(false);
  });

  it("enables debug mode via setDebugMode", () => {
    const { result } = renderHook(() => useDebugMode());

    act(() => {
      result.current.setDebugMode(true);
    });

    expect(result.current.debugMode).toBe(true);
  });

  it("disables debug mode via setDebugMode", () => {
    const { result } = renderHook(() => useDebugMode());

    act(() => {
      result.current.setDebugMode(true);
      result.current.setDebugMode(false);
    });

    expect(result.current.debugMode).toBe(false);
  });

  it("toggles debug mode", () => {
    const { result } = renderHook(() => useDebugMode());

    expect(result.current.debugMode).toBe(false);

    act(() => {
      result.current.toggleDebugMode();
    });

    expect(result.current.debugMode).toBe(true);

    act(() => {
      result.current.toggleDebugMode();
    });

    expect(result.current.debugMode).toBe(false);
  });

  it("syncs with UIStore state", () => {
    const { result } = renderHook(() => useDebugMode());

    // Change directly in store
    act(() => {
      useUIStore.setState({ debugMode: true });
    });

    expect(result.current.debugMode).toBe(true);
  });
});
