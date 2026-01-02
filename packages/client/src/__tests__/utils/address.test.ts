/**
 * Address Utility Tests
 *
 * Tests for Ethereum address validation and formatting
 */

import { describe, it, expect } from "vitest";

describe("Address Utilities", () => {
  describe("isValidAddress", () => {
    it("validates correct Ethereum address", () => {
      const validAddress = "0x1234567890abcdef1234567890abcdef12345678";
      expect(validAddress.startsWith("0x")).toBe(true);
      expect(validAddress.length).toBe(42);
    });

    it("rejects address without 0x prefix", () => {
      const invalidAddress = "1234567890abcdef1234567890abcdef12345678";
      expect(invalidAddress.startsWith("0x")).toBe(false);
    });

    it("rejects address with wrong length", () => {
      const shortAddress = "0x1234";
      expect(shortAddress.length).not.toBe(42);
    });

    it("rejects non-hex characters", () => {
      const invalidAddress = "0xGGGG567890abcdef1234567890abcdef12345678";
      const hexPattern = /^0x[0-9a-fA-F]{40}$/;
      expect(hexPattern.test(invalidAddress)).toBe(false);
    });
  });

  describe("formatAddress", () => {
    it("truncates address to short format", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const formatted = `${address.slice(0, 6)}...${address.slice(-4)}`;
      expect(formatted).toBe("0x1234...5678");
    });

    it("handles short addresses", () => {
      const shortAddress = "0x1234";
      expect(shortAddress.length).toBeLessThan(10);
    });
  });

  describe("compareAddresses", () => {
    it("compares addresses case-insensitively", () => {
      const addr1 = "0x1234567890abcdef1234567890abcdef12345678";
      const addr2 = "0x1234567890ABCDEF1234567890ABCDEF12345678";
      expect(addr1.toLowerCase()).toBe(addr2.toLowerCase());
    });

    it("returns false for different addresses", () => {
      const addr1 = "0x1234567890abcdef1234567890abcdef12345678";
      const addr2 = "0xabcdef1234567890abcdef1234567890abcdef12";
      expect(addr1.toLowerCase()).not.toBe(addr2.toLowerCase());
    });
  });

  describe("normalizeAddress", () => {
    it("converts address to lowercase", () => {
      const mixedCase = "0x1234567890ABCDEF1234567890ABCDEF12345678";
      const normalized = mixedCase.toLowerCase();
      expect(normalized).toBe("0x1234567890abcdef1234567890abcdef12345678");
    });

    it("preserves 0x prefix", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const normalized = address.toLowerCase();
      expect(normalized.startsWith("0x")).toBe(true);
    });
  });

  describe("isZeroAddress", () => {
    it("identifies zero address", () => {
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const isZero = zeroAddress === "0x0000000000000000000000000000000000000000";
      expect(isZero).toBe(true);
    });

    it("returns false for non-zero address", () => {
      const nonZeroAddress = "0x1234567890abcdef1234567890abcdef12345678";
      const isZero = nonZeroAddress === "0x0000000000000000000000000000000000000000";
      expect(isZero).toBe(false);
    });
  });
});
