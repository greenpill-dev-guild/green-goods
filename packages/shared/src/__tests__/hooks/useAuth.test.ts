/**
 * @vitest-environment jsdom
 */

/**
 * useAuth Hook Tests
 *
 * Tests the universal auth hook that works with AuthProvider.
 * Supports both passkey and wallet authentication modes.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the auth context
const mockUseAuthContext = vi.fn();

vi.mock("../../providers/Auth", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

import { useAuth } from "../../hooks/auth/useAuth";

describe("hooks/auth/useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthContext.mockReturnValue({
      authMode: null,
      eoaAddress: undefined,
      smartAccountAddress: null,
      smartAccountClient: null,
      isReady: true,
      isAuthenticated: false,
      isAuthenticating: false,
      walletAddress: null,
      externalWalletConnected: false,
      externalWalletAddress: null,
    });
  });

  describe("unauthenticated state", () => {
    it("returns unauthenticated state when not logged in", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.authMode).toBeNull();
      expect(result.current.isReady).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isAuthenticating).toBe(false);
      expect(result.current.eoaAddress).toBeUndefined();
      expect(result.current.smartAccountAddress).toBeNull();
      expect(result.current.smartAccountClient).toBeNull();
      expect(result.current.externalWalletConnected).toBe(false);
      expect(result.current.externalWalletAddress).toBeNull();
    });
  });

  describe("passkey mode", () => {
    it("returns passkey auth state when authenticated with passkey", () => {
      mockUseAuthContext.mockReturnValue({
        authMode: "passkey",
        eoaAddress: undefined,
        smartAccountAddress: "0xSmartAccount123",
        smartAccountClient: { account: { address: "0xSmartAccount123" } },
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        walletAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.authMode).toBe("passkey");
      expect(result.current.isReady).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.smartAccountAddress).toBe("0xSmartAccount123");
      expect(result.current.smartAccountClient).toBeDefined();
      expect(result.current.walletAddress).toBeNull();
      expect(result.current.externalWalletConnected).toBe(false);
    });

    it("returns authenticating state during passkey creation", () => {
      mockUseAuthContext.mockReturnValue({
        authMode: null,
        eoaAddress: undefined,
        smartAccountAddress: null,
        smartAccountClient: null,
        isReady: true,
        isAuthenticated: false,
        isAuthenticating: true,
        walletAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticating).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("tracks external wallet even when in passkey mode", () => {
      mockUseAuthContext.mockReturnValue({
        authMode: "passkey",
        eoaAddress: undefined,
        smartAccountAddress: "0xSmartAccount123",
        smartAccountClient: { account: { address: "0xSmartAccount123" } },
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        walletAddress: null,
        externalWalletConnected: true,
        externalWalletAddress: "0xExternalWallet999",
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.authMode).toBe("passkey");
      expect(result.current.smartAccountAddress).toBe("0xSmartAccount123");
      // External wallet is tracked even though passkey is the primary auth
      expect(result.current.externalWalletConnected).toBe(true);
      expect(result.current.externalWalletAddress).toBe("0xExternalWallet999");
      // walletAddress is null because passkey is the primary auth
      expect(result.current.walletAddress).toBeNull();
    });
  });

  describe("wallet mode", () => {
    it("returns wallet auth state when authenticated with wallet", () => {
      mockUseAuthContext.mockReturnValue({
        authMode: "wallet",
        eoaAddress: "0xWallet456",
        smartAccountAddress: null,
        smartAccountClient: null,
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        walletAddress: "0xWallet456",
        externalWalletConnected: true,
        externalWalletAddress: "0xWallet456",
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.authMode).toBe("wallet");
      expect(result.current.eoaAddress).toBe("0xWallet456");
      expect(result.current.walletAddress).toBe("0xWallet456");
      expect(result.current.smartAccountClient).toBeNull();
      expect(result.current.externalWalletConnected).toBe(true);
      expect(result.current.externalWalletAddress).toBe("0xWallet456");
    });

    it("returns connecting state during wallet connection", () => {
      mockUseAuthContext.mockReturnValue({
        authMode: null,
        eoaAddress: undefined,
        smartAccountAddress: null,
        smartAccountClient: null,
        isReady: false,
        isAuthenticated: false,
        isAuthenticating: true,
        walletAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isReady).toBe(false);
      expect(result.current.isAuthenticating).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("actions", () => {
    it("exposes signOut action", () => {
      const mockSignOut = vi.fn();
      mockUseAuthContext.mockReturnValue({
        authMode: "wallet",
        eoaAddress: "0xWallet456",
        smartAccountAddress: null,
        smartAccountClient: null,
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        walletAddress: "0xWallet456",
        externalWalletConnected: true,
        externalWalletAddress: "0xWallet456",
        signOut: mockSignOut,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.signOut).toBeDefined();
      result.current.signOut?.();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("exposes loginWithWallet action", () => {
      const mockLoginWithWallet = vi.fn();
      mockUseAuthContext.mockReturnValue({
        authMode: null,
        eoaAddress: undefined,
        smartAccountAddress: null,
        smartAccountClient: null,
        isReady: true,
        isAuthenticated: false,
        isAuthenticating: false,
        walletAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
        loginWithWallet: mockLoginWithWallet,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loginWithWallet).toBeDefined();
      result.current.loginWithWallet?.();
      expect(mockLoginWithWallet).toHaveBeenCalledTimes(1);
    });
  });
});
