/**
 * useUser Hook Test Suite
 *
 * Tests the user data hook that wraps authentication state
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "../../hooks/auth/useUser";

vi.mock("../../hooks/blockchain/useEnsName", () => ({
  useEnsName: vi.fn(() => ({ data: null })),
}));

// Mock the useAuth hook
vi.mock("../../hooks/auth/useAuth", () => ({
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
    const { result } = renderHook(() => useUser());

    expect(result.current.user).toBeNull();
    expect(result.current.ready).toBe(false);
    expect(result.current.eoa).toBeNull();
    expect(result.current.smartAccountAddress).toBeNull();
    expect(result.current.ensName).toBeNull();
  });

  it("should have correct return shape", () => {
    const { result } = renderHook(() => useUser());

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("ready");
    expect(result.current).toHaveProperty("eoa");
    expect(result.current).toHaveProperty("smartAccountAddress");
    expect(result.current).toHaveProperty("smartAccountClient");
    expect(result.current).toHaveProperty("ensName");
  });
});
