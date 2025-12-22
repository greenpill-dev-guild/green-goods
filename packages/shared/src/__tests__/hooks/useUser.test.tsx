/**
 * @vitest-environment jsdom
 */

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
const mockUseAuth = vi.fn();
vi.mock("../../hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      authMode: null,
      smartAccountAddress: null,
      smartAccountClient: null,
      walletAddress: null,
      credential: null,
      isReady: false,
      isAuthenticated: false,
      externalWalletConnected: false,
      externalWalletAddress: null,
    });
  });

  it("should return null user when not authenticated", () => {
    const { result } = renderHook(() => useUser());

    expect(result.current.user).toBeNull();
    expect(result.current.ready).toBe(false);
    expect(result.current.eoa).toBeNull();
    expect(result.current.smartAccountAddress).toBeNull();
    expect(result.current.ensName).toBeNull();
    expect(result.current.primaryAddress).toBeNull();
  });

  it("should have correct return shape", () => {
    const { result } = renderHook(() => useUser());

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("ready");
    expect(result.current).toHaveProperty("eoa");
    expect(result.current).toHaveProperty("smartAccountAddress");
    expect(result.current).toHaveProperty("smartAccountClient");
    expect(result.current).toHaveProperty("ensName");
    expect(result.current).toHaveProperty("authMode");
    expect(result.current).toHaveProperty("primaryAddress");
    expect(result.current).toHaveProperty("externalWalletConnected");
    expect(result.current).toHaveProperty("externalWalletAddress");
  });

  describe("passkey mode", () => {
    it("should return smart account address as primary when in passkey mode", () => {
      mockUseAuth.mockReturnValue({
        authMode: "passkey",
        smartAccountAddress: "0xSmartAccount123",
        smartAccountClient: { account: { address: "0xSmartAccount123" } },
        walletAddress: null,
        isReady: true,
        isAuthenticated: true,
        externalWalletConnected: false,
        externalWalletAddress: null,
      });

      const { result } = renderHook(() => useUser());

      expect(result.current.authMode).toBe("passkey");
      expect(result.current.primaryAddress).toBe("0xSmartAccount123");
      expect(result.current.smartAccountAddress).toBe("0xSmartAccount123");
      expect(result.current.eoa).toBeNull();
      expect(result.current.user?.id).toBe("0xSmartAccount123");
    });

    it("should track external wallet even in passkey mode", () => {
      mockUseAuth.mockReturnValue({
        authMode: "passkey",
        smartAccountAddress: "0xSmartAccount123",
        smartAccountClient: { account: { address: "0xSmartAccount123" } },
        walletAddress: null,
        isReady: true,
        isAuthenticated: true,
        externalWalletConnected: true,
        externalWalletAddress: "0xExternalWallet999",
      });

      const { result } = renderHook(() => useUser());

      expect(result.current.authMode).toBe("passkey");
      expect(result.current.primaryAddress).toBe("0xSmartAccount123");
      expect(result.current.externalWalletConnected).toBe(true);
      expect(result.current.externalWalletAddress).toBe("0xExternalWallet999");
    });
  });

  describe("wallet mode", () => {
    it("should return wallet address as primary when in wallet mode", () => {
      mockUseAuth.mockReturnValue({
        authMode: "wallet",
        smartAccountAddress: null,
        smartAccountClient: null,
        walletAddress: "0xWallet456",
        isReady: true,
        isAuthenticated: true,
        externalWalletConnected: true,
        externalWalletAddress: "0xWallet456",
      });

      const { result } = renderHook(() => useUser());

      expect(result.current.authMode).toBe("wallet");
      expect(result.current.primaryAddress).toBe("0xWallet456");
      expect(result.current.eoa?.address).toBe("0xWallet456");
      expect(result.current.smartAccountAddress).toBeNull();
      expect(result.current.user?.id).toBe("0xWallet456");
    });
  });
});
