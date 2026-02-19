/**
 * usePrimaryAddress Hook + getPrimaryAddress Function Tests
 * @vitest-environment jsdom
 *
 * Tests address resolution rules:
 * - passkey mode -> smartAccountAddress
 * - wallet mode -> walletAddress
 * - unauthenticated -> null
 */

import { describe, expect, it } from "vitest";

import { getPrimaryAddress } from "../../../hooks/auth/usePrimaryAddress";

const SMART_ACCOUNT = "0xSmartAccount1234567890123456789012345678" as `0x${string}`;
const WALLET_ADDRESS = "0xWalletAddress1234567890123456789012345678" as `0x${string}`;

// ============================================
// getPrimaryAddress (pure function)
// ============================================

describe("getPrimaryAddress", () => {
  describe("passkey mode", () => {
    it("returns smartAccountAddress when in passkey mode", () => {
      const result = getPrimaryAddress("passkey", null, SMART_ACCOUNT);
      expect(result).toBe(SMART_ACCOUNT);
    });

    it("returns null when passkey mode but no smartAccountAddress", () => {
      const result = getPrimaryAddress("passkey", WALLET_ADDRESS, null);
      expect(result).toBeNull();
    });

    it("prefers smartAccountAddress over walletAddress in passkey mode", () => {
      const result = getPrimaryAddress("passkey", WALLET_ADDRESS, SMART_ACCOUNT);
      expect(result).toBe(SMART_ACCOUNT);
    });
  });

  describe("wallet mode", () => {
    it("returns walletAddress when in wallet mode", () => {
      const result = getPrimaryAddress("wallet", WALLET_ADDRESS, null);
      expect(result).toBe(WALLET_ADDRESS);
    });

    it("returns null when wallet mode but no walletAddress", () => {
      const result = getPrimaryAddress("wallet", null, SMART_ACCOUNT);
      expect(result).toBeNull();
    });

    it("prefers walletAddress over smartAccountAddress in wallet mode", () => {
      const result = getPrimaryAddress("wallet", WALLET_ADDRESS, SMART_ACCOUNT);
      expect(result).toBe(WALLET_ADDRESS);
    });
  });

  describe("unauthenticated", () => {
    it("returns null when authMode is null", () => {
      const result = getPrimaryAddress(null, WALLET_ADDRESS, SMART_ACCOUNT);
      expect(result).toBeNull();
    });

    it("returns null when everything is null", () => {
      const result = getPrimaryAddress(null, null, null);
      expect(result).toBeNull();
    });

    it("returns null when everything is undefined", () => {
      const result = getPrimaryAddress(null, undefined, undefined);
      expect(result).toBeNull();
    });
  });
});
