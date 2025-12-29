/**
 * @vitest-environment jsdom
 */

/**
 * useAnalyticsIdentity Hook Test Suite
 *
 * Tests the analytics identity sync hook that identifies users with PostHog
 * when authentication state changes.
 */

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock PostHog module
const mockIdentifyWithProperties = vi.fn();
const mockReset = vi.fn();
const mockTrack = vi.fn();

vi.mock("../../modules/app/posthog", () => ({
  identifyWithProperties: (...args: unknown[]) => mockIdentifyWithProperties(...args),
  reset: () => mockReset(),
  track: (...args: unknown[]) => mockTrack(...args),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock("../../hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useUser hook
const mockUseUser = vi.fn();
vi.mock("../../hooks/auth/useUser", () => ({
  useUser: () => mockUseUser(),
}));

// Mock config
vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

import { useAnalyticsIdentity } from "../../hooks/analytics/useAnalyticsIdentity";

describe("useAnalyticsIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to unauthenticated state
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authMode: null,
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: null,
    });
  });

  it("should not identify when not authenticated", () => {
    renderHook(() => useAnalyticsIdentity({ app: "client" }));

    expect(mockIdentifyWithProperties).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("should not do anything when auth is not ready", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authMode: null,
      isReady: false,
    });

    renderHook(() => useAnalyticsIdentity({ app: "client" }));

    expect(mockIdentifyWithProperties).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("should identify user on login", () => {
    // Start unauthenticated
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authMode: null,
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: null,
    });

    const { rerender } = renderHook(() =>
      useAnalyticsIdentity({
        app: "client",
        isPwa: true,
        locale: "en",
      })
    );

    // Login
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authMode: "passkey",
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: "0x1234567890abcdef1234567890abcdef12345678",
    });

    act(() => {
      rerender();
    });

    expect(mockIdentifyWithProperties).toHaveBeenCalledWith(
      "0x1234567890abcdef1234567890abcdef12345678",
      {
        auth_mode: "passkey",
        app: "client",
        chain_id: 84532,
        is_pwa: true,
        locale: "en",
      }
    );

    expect(mockTrack).toHaveBeenCalledWith("auth_login_success", {
      auth_mode: "passkey",
      app: "client",
    });
  });

  it("should reset on logout", () => {
    // Start authenticated
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authMode: "wallet",
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: "0x1234567890abcdef1234567890abcdef12345678",
    });

    const { rerender } = renderHook(() =>
      useAnalyticsIdentity({
        app: "admin",
        isPwa: false,
      })
    );

    // Clear mocks after initial identify
    vi.clearAllMocks();

    // Logout
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      authMode: null,
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: null,
    });

    act(() => {
      rerender();
    });

    expect(mockTrack).toHaveBeenCalledWith("auth_logout", {
      auth_mode: "wallet",
      app: "admin",
    });
    expect(mockReset).toHaveBeenCalled();
  });

  it("should re-identify when address changes while authenticated", () => {
    // Start authenticated with one address
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authMode: "passkey",
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA11",
    });

    const { rerender } = renderHook(() =>
      useAnalyticsIdentity({
        app: "client",
      })
    );

    // Clear mocks after initial identify
    vi.clearAllMocks();

    // Address changes (e.g., switched to different smart account)
    mockUseUser.mockReturnValue({
      primaryAddress: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB22",
    });

    act(() => {
      rerender();
    });

    // Should identify with new address
    expect(mockIdentifyWithProperties).toHaveBeenCalledWith(
      "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB22",
      expect.objectContaining({
        app: "client",
      })
    );

    // Should NOT track login (it's an address change, not a login)
    expect(mockTrack).not.toHaveBeenCalledWith("auth_login_success", expect.anything());
  });

  it("should pass correct app identifier for admin", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      authMode: "wallet",
      isReady: true,
    });
    mockUseUser.mockReturnValue({
      primaryAddress: "0x1234567890abcdef1234567890abcdef12345678",
    });

    renderHook(() =>
      useAnalyticsIdentity({
        app: "admin",
        isPwa: false,
        locale: "es",
      })
    );

    expect(mockIdentifyWithProperties).toHaveBeenCalledWith(
      "0x1234567890abcdef1234567890abcdef12345678",
      expect.objectContaining({
        app: "admin",
        is_pwa: false,
        locale: "es",
      })
    );
  });
});
