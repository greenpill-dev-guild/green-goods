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
  EMBEDDED_ADDRESS_KEY,
  clearAllAuth,
  clearEmbeddedAddress,
  getAuthMode,
  getEmbeddedAddress,
  setAuthMode,
  setEmbeddedAddress,
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

  describe("clearAllAuth", () => {
    it("clears embedded address along with other auth data", () => {
      const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";
      mockLocalStorage.setItem(EMBEDDED_ADDRESS_KEY, TEST_ADDRESS);
      mockLocalStorage.setItem(AUTH_MODE_STORAGE_KEY, "embedded");

      clearAllAuth();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(EMBEDDED_ADDRESS_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AUTH_MODE_STORAGE_KEY);
    });
  });
});
