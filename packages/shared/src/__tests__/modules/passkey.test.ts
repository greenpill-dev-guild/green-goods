/**
 * Passkey Module Tests
 *
 * Tests for WebAuthn credential management and smart account session handling.
 * These are security-critical tests for the passkey authentication flow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock viem/account-abstraction
vi.mock("viem/account-abstraction", () => ({
  createWebAuthnCredential: vi.fn(),
  toWebAuthnAccount: vi.fn(() => ({ address: "0xWebAuthnAccount" })),
  entryPoint07Address: "0x0000000000000000000000000000000000000007",
}));

// Mock permissionless
vi.mock("permissionless", () => ({
  createSmartAccountClient: vi.fn(() => ({
    account: { address: "0xSmartAccount123" },
    sendTransaction: vi.fn(),
  })),
}));

// Mock permissionless/accounts
vi.mock("permissionless/accounts", () => ({
  toKernelSmartAccount: vi.fn(() => Promise.resolve({ address: "0xSmartAccount123" })),
}));

// Mock config modules
vi.mock("../../config/chains", () => ({
  getChain: vi.fn(() => ({ id: 84532, name: "Base Sepolia" })),
}));

vi.mock("../../config/pimlico", () => ({
  createPimlicoClientForChain: vi.fn(() => ({
    getUserOperationGasPrice: vi.fn(() =>
      Promise.resolve({ fast: { maxFeePerGas: 1n, maxPriorityFeePerGas: 1n } })
    ),
  })),
  createPublicClientForChain: vi.fn(() => ({})),
  getPimlicoBundlerUrl: vi.fn(() => "https://bundler.test"),
}));

import { createWebAuthnCredential } from "viem/account-abstraction";
import {
  authenticatePasskey,
  clearStoredCredential,
  PASSKEY_STORAGE_KEY,
  registerPasskeySession,
  restorePasskeySession,
} from "../../modules/auth/passkey";

describe("modules/auth/passkey", () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  // Mock navigator.credentials
  const mockCredentials = {
    create: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    Object.defineProperty(navigator, "credentials", {
      value: mockCredentials,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, "location", {
      value: { hostname: "localhost" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerPasskeySession", () => {
    it("creates credential and persists to localStorage", async () => {
      const mockCredential = {
        id: "test-credential-id",
        publicKey: "0xTestPublicKey",
        raw: { id: "test-credential-id", type: "public-key" },
      };

      vi.mocked(createWebAuthnCredential).mockResolvedValue(mockCredential);

      const session = await registerPasskeySession(84532);

      expect(createWebAuthnCredential).toHaveBeenCalledWith({
        name: "Green Goods Wallet",
        createFn: expect.any(Function),
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        PASSKEY_STORAGE_KEY,
        expect.any(String)
      );
      expect(session).toHaveProperty("credential");
      expect(session).toHaveProperty("address");
      expect(session).toHaveProperty("client");
    });
  });

  describe("restorePasskeySession", () => {
    it("returns null when no stored credential exists", async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const session = await restorePasskeySession(84532);

      expect(session).toBeNull();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(PASSKEY_STORAGE_KEY);
    });

    it("restores valid credential from localStorage", async () => {
      const storedCredential = {
        id: "stored-credential-id",
        publicKey: "0xStoredPublicKey",
        raw: { id: "stored-credential-id", type: "public-key" },
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));

      const session = await restorePasskeySession(84532);

      expect(session).not.toBeNull();
      expect(session?.credential).toBeDefined();
      expect(session?.address).toBeDefined();
      expect(session?.client).toBeDefined();
    });

    it("clears storage and throws on invalid stored data", async () => {
      localStorageMock.getItem.mockReturnValue("invalid-json-{{{");

      await expect(restorePasskeySession(84532)).rejects.toThrow();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(PASSKEY_STORAGE_KEY);
    });
  });

  describe("clearStoredCredential", () => {
    it("removes credential from localStorage", () => {
      clearStoredCredential();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(PASSKEY_STORAGE_KEY);
    });
  });

  describe("authenticatePasskey", () => {
    it("throws when no stored credential exists", async () => {
      localStorageMock.getItem.mockReturnValue(null);

      await expect(authenticatePasskey(84532)).rejects.toThrow(
        "No passkey found. Please create a new account."
      );
    });

    it("handles NotAllowedError (user cancellation)", async () => {
      const storedCredential = {
        id: "test-id",
        publicKey: "0xTestKey",
        raw: {},
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));

      const notAllowedError = new Error("User cancelled");
      notAllowedError.name = "NotAllowedError";
      mockCredentials.get.mockRejectedValue(notAllowedError);

      await expect(authenticatePasskey(84532)).rejects.toThrow(
        "Passkey authentication was cancelled"
      );
    });

    it("handles SecurityError during authentication", async () => {
      const storedCredential = {
        id: "test-id",
        publicKey: "0xTestKey",
        raw: {},
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));

      const securityError = new Error("Security issue");
      securityError.name = "SecurityError";
      mockCredentials.get.mockRejectedValue(securityError);

      await expect(authenticatePasskey(84532)).rejects.toThrow(
        "Passkey authentication failed. Please try again."
      );
    });

    it("authenticates successfully with valid credential", async () => {
      const storedCredential = {
        id: "dGVzdC1jcmVkZW50aWFsLWlk", // Base64URL encoded
        publicKey: "0xTestKey",
        raw: {},
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));

      mockCredentials.get.mockResolvedValue({
        id: "dGVzdC1jcmVkZW50aWFsLWlk",
        type: "public-key",
      });

      const session = await authenticatePasskey(84532);

      expect(session).toHaveProperty("credential");
      expect(session).toHaveProperty("address");
      expect(session).toHaveProperty("client");
      expect(mockCredentials.get).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          rpId: "localhost",
          userVerification: "required",
        }),
      });
    });
  });

  describe("base64UrlDecode (internal utility)", () => {
    // Test indirectly through authenticatePasskey
    it("correctly handles Base64URL-encoded credential IDs", async () => {
      // Base64URL uses - and _ instead of + and /
      const base64UrlId = "dGVzdC1jcmVkZW50aWFsLWlk"; // "test-credential-id" in Base64URL

      const storedCredential = {
        id: base64UrlId,
        publicKey: "0xTestKey",
        raw: {},
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedCredential));

      mockCredentials.get.mockResolvedValue({
        id: base64UrlId,
        type: "public-key",
      });

      // Should not throw - Base64URL decoding works
      const session = await authenticatePasskey(84532);
      expect(session).toBeDefined();
    });
  });
});
