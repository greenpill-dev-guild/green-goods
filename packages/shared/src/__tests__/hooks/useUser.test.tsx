/**
 * useUser Hook Test Suite
 *
 * Tests the user data hook that wraps authentication state
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "../../hooks/auth/useUser";
import { AuthProvider } from "../../providers/auth";

// Mock the useAuth hook
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    smartAccountAddress: null,
    smartAccountClient: null,
    credential: null,
    isReady: false,
  })),
}));

describe("useUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null user when not authenticated", () => {
    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.ready).toBe(false);
    expect(result.current.eoa).toBeNull();
    expect(result.current.smartAccountAddress).toBeNull();
  });

  it("should have correct return shape", () => {
    const { result } = renderHook(() => useUser(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("ready");
    expect(result.current).toHaveProperty("eoa");
    expect(result.current).toHaveProperty("smartAccountAddress");
    expect(result.current).toHaveProperty("smartAccountClient");
  });
});
