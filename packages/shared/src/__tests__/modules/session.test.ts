/**
 * Session Storage Tests
 *
 * Tests for auth session localStorage utilities,
 * including embedded wallet address caching.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// MOCK SETUP
// ============================================================================

const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
};

const mockLocalStorage = createMockLocalStorage();
Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

import {
  AUTH_MODE_STORAGE_KEY,
  clearActiveSessionAuth,
  clearAllAuth,
  clearEmbeddedAddress,
  clearSignedOutSentinel,
  clearStoredSmartAccountAddress,
  EMBEDDED_ADDRESS_KEY,
  getAuthMode,
  getEmbeddedAddress,
  getStoredSmartAccountAddress,
  hasSignedOutSentinel,
  RP_ID_STORAGE_KEY,
  SIGNED_OUT_STORAGE_KEY,
  SMART_ACCOUNT_ADDRESS_STORAGE_KEY,
  setAuthMode,
  setEmbeddedAddress,
  setSignedOutSentinel,
  setStoredSmartAccountAddress,
  USERNAME_STORAGE_KEY,
} from "../../modules/auth/session";

// ============================================================================
// TESTS
// ============================================================================

describe("modules/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setAuthMode", () => {
    it("accepts 'embedded' as a valid auth mode", () => {
      setAuthMode("embedded");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_MODE_STORAGE_KEY, "embedded");
    });

    it("accepts 'passkey' as a valid auth mode", () => {
      setAuthMode("passkey");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_MODE_STORAGE_KEY, "passkey");
    });

    it("accepts 'wallet' as a valid auth mode", () => {
      setAuthMode("wallet");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_MODE_STORAGE_KEY, "wallet");
    });
  });

  describe("signed-out sentinel", () => {
    it("sets, reads, and clears the sentinel", () => {
      expect(hasSignedOutSentinel()).toBe(false);
      setSignedOutSentinel();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SIGNED_OUT_STORAGE_KEY, "true");
      expect(hasSignedOutSentinel()).toBe(true);
      clearSignedOutSentinel();
      expect(hasSignedOutSentinel()).toBe(false);
    });

    it("is not cleared by sign-in intent alone", () => {
      // Auth mode is written at dispatch time, before the WebAuthn ceremony
      // resolves. A dismissed ceremony must leave the device signed out, so
      // only a successful passkey session creation clears the sentinel.
      setSignedOutSentinel();
      setAuthMode("passkey");
      expect(hasSignedOutSentinel()).toBe(true);
    });

    it("is removed by clearAllAuth", () => {
      setSignedOutSentinel();
      clearAllAuth();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(SIGNED_OUT_STORAGE_KEY);
      expect(hasSignedOutSentinel()).toBe(false);
    });
  });

  describe("getAuthMode", () => {
    it("returns 'embedded' when stored", () => {
      mockLocalStorage.setItem(AUTH_MODE_STORAGE_KEY, "embedded");
      const mode = getAuthMode();
      expect(mode).toBe("embedded");
    });

    it("returns null when nothing is stored", () => {
      const mode = getAuthMode();
      expect(mode).toBeNull();
    });
  });

  describe("embedded address storage", () => {
    const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";

    it("stores embedded address", () => {
      setEmbeddedAddress(TEST_ADDRESS);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(EMBEDDED_ADDRESS_KEY, TEST_ADDRESS);
    });

    it("retrieves stored embedded address", () => {
      mockLocalStorage.setItem(EMBEDDED_ADDRESS_KEY, TEST_ADDRESS);
      const address = getEmbeddedAddress();
      expect(address).toBe(TEST_ADDRESS);
    });

    it("returns null when no embedded address is stored", () => {
      const address = getEmbeddedAddress();
      expect(address).toBeNull();
    });

    it("clears embedded address", () => {
      mockLocalStorage.setItem(EMBEDDED_ADDRESS_KEY, TEST_ADDRESS);
      clearEmbeddedAddress();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(EMBEDDED_ADDRESS_KEY);
    });
  });

  describe("smart account address storage", () => {
    const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";

    it("stores expected passkey smart account address", () => {
      setStoredSmartAccountAddress(TEST_ADDRESS);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        SMART_ACCOUNT_ADDRESS_STORAGE_KEY,
        TEST_ADDRESS
      );
    });

    it("retrieves expected passkey smart account address", () => {
      mockLocalStorage.setItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY, TEST_ADDRESS);
      const address = getStoredSmartAccountAddress();
      expect(address).toBe(TEST_ADDRESS);
    });

    it("clears expected passkey smart account address", () => {
      mockLocalStorage.setItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY, TEST_ADDRESS);
      clearStoredSmartAccountAddress();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(SMART_ACCOUNT_ADDRESS_STORAGE_KEY);
    });
  });

  describe("clearAllAuth", () => {
    it("clears embedded address along with other auth data", () => {
      const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";
      mockLocalStorage.setItem(EMBEDDED_ADDRESS_KEY, TEST_ADDRESS);
      mockLocalStorage.setItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY, TEST_ADDRESS);
      mockLocalStorage.setItem(AUTH_MODE_STORAGE_KEY, "embedded");

      clearAllAuth();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(EMBEDDED_ADDRESS_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(SMART_ACCOUNT_ADDRESS_STORAGE_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AUTH_MODE_STORAGE_KEY);
    });
  });

  describe("clearActiveSessionAuth", () => {
    it("clears active session state but preserves passkey recovery metadata", () => {
      const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";
      const credential = JSON.stringify({ id: "credential-id", publicKey: "0x1234" });

      mockLocalStorage.setItem(AUTH_MODE_STORAGE_KEY, "passkey");
      mockLocalStorage.setItem(EMBEDDED_ADDRESS_KEY, TEST_ADDRESS);
      mockLocalStorage.setItem(USERNAME_STORAGE_KEY, "afo");
      mockLocalStorage.setItem("greengoods_credential", credential);
      mockLocalStorage.setItem(RP_ID_STORAGE_KEY, "greengoods.app");
      mockLocalStorage.setItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY, TEST_ADDRESS);

      clearActiveSessionAuth();

      expect(getAuthMode()).toBeNull();
      expect(getEmbeddedAddress()).toBeNull();
      expect(hasSignedOutSentinel()).toBe(true);
      expect(mockLocalStorage.getItem(USERNAME_STORAGE_KEY)).toBe("afo");
      expect(mockLocalStorage.getItem("greengoods_credential")).toBe(credential);
      expect(mockLocalStorage.getItem(RP_ID_STORAGE_KEY)).toBe("greengoods.app");
      expect(mockLocalStorage.getItem(SMART_ACCOUNT_ADDRESS_STORAGE_KEY)).toBe(TEST_ADDRESS);
    });
  });
});
