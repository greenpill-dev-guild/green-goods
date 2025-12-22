/**
 * PasskeyAuthProvider Test Suite
 *
 * DEPRECATED: This test file tests the old PasskeyAuthProvider which has been
 * consolidated into the unified Auth.tsx provider with XState.
 *
 * See these test files for the new auth system tests:
 * - workflows/authMachine.test.ts (state machine tests)
 * - workflows/authServices.test.ts (service integration tests)
 * - hooks/useAuth.test.ts (useAuth hook tests)
 */

import { describe, it, vi } from "vitest";

// Skip all tests - old provider has been consolidated
describe.skip("PasskeyAuthProvider (DEPRECATED)", () => {
  it("placeholder", () => {});
});

// Original test code below (kept for reference)
/*
import { render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasskeyAuthProvider, usePasskeyAuth } from "../../providers/PasskeyAuth";

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

// Mock config
vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

// Mock auth modules
vi.mock("../../modules/auth/passkey", () => ({
  authenticatePasskey: vi.fn(),
  clearStoredCredential: vi.fn(),
  registerPasskeySession: vi.fn(),
  restorePasskeySession: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../modules/auth/session", () => ({
  clearStoredPasskey: vi.fn(),
  hasStoredPasskey: vi.fn().mockReturnValue(false),
  PASSKEY_STORAGE_KEY: "greengoods_passkey_credential",
}));

describe("PasskeyAuthProvider", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should provide auth context", () => {
    const { result } = renderHook(() => usePasskeyAuth(), {
      wrapper: ({ children }) => <PasskeyAuthProvider>{children}</PasskeyAuthProvider>,
    });

    expect(result.current).toBeDefined();
    expect(result.current.credential).toBeNull();
    expect(result.current.smartAccountAddress).toBeNull();
    expect(result.current.isReady).toBe(true); // Ready after initialization
  });

  it("should throw error when usePasskeyAuth is used outside provider", () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePasskeyAuth());
    }).toThrow("usePasskeyAuth must be used within PasskeyAuthProvider");

    consoleError.mockRestore();
  });

  it("should have createPasskey function", () => {
    const { result } = renderHook(() => usePasskeyAuth(), {
      wrapper: ({ children }) => <PasskeyAuthProvider>{children}</PasskeyAuthProvider>,
    });

    expect(result.current.createPasskey).toBeDefined();
    expect(typeof result.current.createPasskey).toBe("function");
  });

  it("should have clearPasskey function", () => {
    const { result } = renderHook(() => usePasskeyAuth(), {
      wrapper: ({ children }) => <PasskeyAuthProvider>{children}</PasskeyAuthProvider>,
    });

    expect(result.current.clearPasskey).toBeDefined();
    expect(typeof result.current.clearPasskey).toBe("function");
  });

  it("should have signOut function", () => {
    const { result } = renderHook(() => usePasskeyAuth(), {
      wrapper: ({ children }) => <PasskeyAuthProvider>{children}</PasskeyAuthProvider>,
    });

    expect(result.current.signOut).toBeDefined();
    expect(typeof result.current.signOut).toBe("function");
  });

  it("should render children", () => {
    render(
      <PasskeyAuthProvider>
        <div>Test Child</div>
      </PasskeyAuthProvider>
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  it("should start with isAuthenticated as false", () => {
    const { result } = renderHook(() => usePasskeyAuth(), {
      wrapper: ({ children }) => <PasskeyAuthProvider>{children}</PasskeyAuthProvider>,
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should have resumePasskey function", () => {
    const { result } = renderHook(() => usePasskeyAuth(), {
      wrapper: ({ children }) => <PasskeyAuthProvider>{children}</PasskeyAuthProvider>,
    });

    expect(result.current.resumePasskey).toBeDefined();
    expect(typeof result.current.resumePasskey).toBe("function");
  });
});
*/
