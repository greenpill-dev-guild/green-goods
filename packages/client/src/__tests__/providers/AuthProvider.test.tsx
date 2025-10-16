/**
 * AuthProvider Test Suite
 *
 * Tests passkey-based authentication context provider
 */

import { render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../providers/auth";

// Mock viem account abstraction
vi.mock("viem/account-abstraction", () => ({
  createWebAuthnCredential: vi.fn(),
  toWebAuthnAccount: vi.fn(),
  entryPoint07Address: "0x0000000000000000000000000000000000000007",
}));

// Mock permissionless
vi.mock("permissionless", () => ({
  createSmartAccountClient: vi.fn(),
}));

// Mock permissionless/accounts
vi.mock("permissionless/accounts", () => ({
  toKernelSmartAccount: vi.fn(),
}));

// Mock pimlico config
vi.mock("@/services/pimlicoConfig", () => ({
  createPimlicoClientForChain: vi.fn(() => ({
    getUserOperationGasPrice: vi.fn(() => Promise.resolve({ fast: {} })),
    transport: {},
  })),
  createPublicClientForChain: vi.fn(() => ({})),
  getChainFromId: vi.fn(() => ({ id: 84532, name: "Base Sepolia" })),
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should provide auth context", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current).toBeDefined();
    expect(result.current.credential).toBeNull();
    expect(result.current.smartAccountAddress).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it("should throw error when useAuth is used outside provider", () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within AuthProvider");

    consoleError.mockRestore();
  });

  it("should have createPasskey function", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.createPasskey).toBeDefined();
    expect(typeof result.current.createPasskey).toBe("function");
  });

  it("should have clearPasskey function", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.clearPasskey).toBeDefined();
    expect(typeof result.current.clearPasskey).toBe("function");
  });

  it("should render children", () => {
    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });
});
