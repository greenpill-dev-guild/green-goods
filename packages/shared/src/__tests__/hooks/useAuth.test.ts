/**
 * @vitest-environment jsdom
 */

/**
 * useAuth Hook Tests
 *
 * Tests the universal auth hook that works with both Client and Admin auth providers.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the provider hooks
const mockUseOptionalAuthContext = vi.fn();
const mockUseOptionalWalletAuth = vi.fn();

vi.mock("../../providers/Auth", () => ({
  useOptionalAuthContext: () => mockUseOptionalAuthContext(),
  useAuthContext: vi.fn(),
}));

vi.mock("../../providers/WalletAuth", () => ({
  useOptionalWalletAuth: () => mockUseOptionalWalletAuth(),
  useWalletAuth: vi.fn(),
}));

import { useAuth } from "../../hooks/auth/useAuth";

describe("hooks/auth/useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOptionalAuthContext.mockReturnValue(null);
    mockUseOptionalWalletAuth.mockReturnValue(null);
  });

  describe("no provider available", () => {
    it("returns default unauthenticated state when no provider is available", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.authMode).toBeNull();
      expect(result.current.isReady).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isAuthenticating).toBe(false);
      expect(result.current.eoaAddress).toBeUndefined();
      expect(result.current.smartAccountAddress).toBeUndefined();
      expect(result.current.smartAccountClient).toBeUndefined();
      expect(result.current.externalWalletConnected).toBe(false);
      expect(result.current.externalWalletAddress).toBeNull();
    });
  });

  describe("with Auth provider (passkey mode)", () => {
    it("returns passkey auth state when in passkey mode", () => {
      mockUseOptionalAuthContext.mockReturnValue({
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

    it("returns wallet auth state when auth provider is in wallet mode", () => {
      mockUseOptionalAuthContext.mockReturnValue({
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

    it("returns authenticating state during passkey creation", () => {
      mockUseOptionalAuthContext.mockReturnValue({
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
      mockUseOptionalAuthContext.mockReturnValue({
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

  describe("with WalletAuth provider (admin)", () => {
    it("returns wallet auth state from admin provider", () => {
      mockUseOptionalWalletAuth.mockReturnValue({
        authMode: "wallet",
        eoaAddress: "0xAdminWallet789",
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        connect: vi.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.authMode).toBe("wallet");
      expect(result.current.eoaAddress).toBe("0xAdminWallet789");
      expect(result.current.isAuthenticated).toBe(true);
      // Smart account properties should be undefined for wallet-only auth
      expect(result.current.smartAccountAddress).toBeUndefined();
      expect(result.current.smartAccountClient).toBeUndefined();
      // External wallet should reflect the wallet auth state
      expect(result.current.externalWalletConnected).toBe(true);
      expect(result.current.externalWalletAddress).toBe("0xAdminWallet789");
    });

    it("returns not ready state when wallet is connecting", () => {
      mockUseOptionalWalletAuth.mockReturnValue({
        authMode: null,
        eoaAddress: undefined,
        isReady: false,
        isAuthenticated: false,
        isAuthenticating: true,
        connect: vi.fn(),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isReady).toBe(false);
      expect(result.current.isAuthenticating).toBe(true);
    });
  });

  describe("provider priority", () => {
    it("prioritizes AuthProvider over WalletAuth when both available", () => {
      // Both providers return values
      mockUseOptionalAuthContext.mockReturnValue({
        authMode: "passkey",
        eoaAddress: undefined,
        smartAccountAddress: "0xPasskeyAccount",
        smartAccountClient: { account: {} },
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        walletAddress: null,
        externalWalletConnected: false,
        externalWalletAddress: null,
      });

      mockUseOptionalWalletAuth.mockReturnValue({
        authMode: "wallet",
        eoaAddress: "0xWalletAccount",
        isReady: true,
        isAuthenticated: true,
        isAuthenticating: false,
        connect: vi.fn(),
      });

      const { result } = renderHook(() => useAuth());

      // Should use AuthProvider values
      expect(result.current.authMode).toBe("passkey");
      expect(result.current.smartAccountAddress).toBe("0xPasskeyAccount");
    });
  });
});
