import { describe, it, expect } from "vitest";
import {
  ZERO_ADDRESS,
  isZeroAddressValue,
  getVaultAssetSymbol,
  getVaultAssetDecimals,
  validateDecimalInput,
  getNetDeposited,
  formatTokenAmount,
} from "../../utils/blockchain/vaults";

describe("Vault Utilities", () => {
  describe("ZERO_ADDRESS", () => {
    it("is a 42-character hex string", () => {
      expect(ZERO_ADDRESS).toBe("0x0000000000000000000000000000000000000000");
      expect(ZERO_ADDRESS).toHaveLength(42);
    });
  });

  describe("isZeroAddressValue", () => {
    it("returns true for zero address", () => {
      expect(isZeroAddressValue(ZERO_ADDRESS)).toBe(true);
    });

    it("returns true for null", () => {
      expect(isZeroAddressValue(null)).toBe(true);
    });

    it("returns true for undefined", () => {
      expect(isZeroAddressValue(undefined)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(isZeroAddressValue("")).toBe(true);
    });

    it("returns false for non-zero address", () => {
      expect(isZeroAddressValue("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isZeroAddressValue("0x0000000000000000000000000000000000000000")).toBe(true);
      expect(isZeroAddressValue("0X0000000000000000000000000000000000000000")).toBe(true);
    });
  });

  describe("getVaultAssetSymbol", () => {
    it("returns known symbol for Arbitrum WETH", () => {
      expect(getVaultAssetSymbol("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 42161)).toBe("WETH");
    });

    it("returns known symbol for Arbitrum DAI", () => {
      expect(getVaultAssetSymbol("0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", 42161)).toBe("DAI");
    });

    it("is case-insensitive for address lookup", () => {
      expect(getVaultAssetSymbol("0x82AF49447D8A07E3BD95BD0D56F35241523FBAB1", 42161)).toBe("WETH");
    });

    it("returns truncated address for unknown asset", () => {
      const result = getVaultAssetSymbol("0xdeadbeef00000000000000000000000000000001", 42161);
      // Should be a formatted address string, not "WETH" or "DAI"
      expect(result).not.toBe("WETH");
      expect(result).not.toBe("DAI");
      expect(typeof result).toBe("string");
    });

    it("returns truncated address for unknown chain", () => {
      const result = getVaultAssetSymbol("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 999999);
      expect(result).not.toBe("WETH");
      expect(typeof result).toBe("string");
    });
  });

  describe("getVaultAssetDecimals", () => {
    it("returns 18 for known WETH on Arbitrum", () => {
      expect(getVaultAssetDecimals("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 42161)).toBe(18);
    });

    it("defaults to 18 for unknown asset", () => {
      expect(getVaultAssetDecimals("0xdeadbeef00000000000000000000000000000001", 42161)).toBe(18);
    });

    it("defaults to 18 for unknown chain", () => {
      expect(getVaultAssetDecimals("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 999999)).toBe(18);
    });

    it("is case-insensitive", () => {
      expect(getVaultAssetDecimals("0x82AF49447D8A07E3BD95BD0D56F35241523FBAB1", 42161)).toBe(18);
    });
  });

  describe("validateDecimalInput", () => {
    it("returns null for empty string", () => {
      expect(validateDecimalInput("", 18)).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(validateDecimalInput("   ", 18)).toBeNull();
    });

    it("returns null for valid integer", () => {
      expect(validateDecimalInput("100", 18)).toBeNull();
    });

    it("returns null for valid decimal", () => {
      expect(validateDecimalInput("1.5", 18)).toBeNull();
    });

    it("returns null for valid decimal with trailing dot", () => {
      expect(validateDecimalInput("100.", 18)).toBeNull();
    });

    it("returns error for non-numeric characters", () => {
      expect(validateDecimalInput("abc", 18)).toBe("app.treasury.invalidAmount");
    });

    it("returns error for negative numbers", () => {
      expect(validateDecimalInput("-1.5", 18)).toBe("app.treasury.invalidAmount");
    });

    it("returns error for multiple dots", () => {
      expect(validateDecimalInput("1.2.3", 18)).toBe("app.treasury.invalidAmount");
    });

    it("returns error when decimals exceed allowed", () => {
      expect(validateDecimalInput("1.1234567", 6)).toBe("app.treasury.tooManyDecimals");
    });

    it("returns null when decimals are exactly at limit", () => {
      expect(validateDecimalInput("1.123456", 6)).toBeNull();
    });

    it("returns null when decimals are under limit", () => {
      expect(validateDecimalInput("1.12", 6)).toBeNull();
    });
  });

  describe("getNetDeposited", () => {
    it("returns difference when deposited > withdrawn", () => {
      expect(getNetDeposited(100n, 30n)).toBe(70n);
    });

    it("returns 0 when deposited equals withdrawn", () => {
      expect(getNetDeposited(100n, 100n)).toBe(0n);
    });

    it("returns 0 when withdrawn exceeds deposited", () => {
      expect(getNetDeposited(50n, 100n)).toBe(0n);
    });

    it("handles zero values", () => {
      expect(getNetDeposited(0n, 0n)).toBe(0n);
    });

    it("handles large values", () => {
      const deposited = 1000000000000000000000n; // 1000 ETH in wei
      const withdrawn = 500000000000000000000n; // 500 ETH in wei
      expect(getNetDeposited(deposited, withdrawn)).toBe(500000000000000000000n);
    });
  });

  describe("formatTokenAmount", () => {
    const EN = "en-US";

    it("returns '0' for zero value", () => {
      expect(formatTokenAmount(0n)).toBe("0");
    });

    it("formats whole numbers correctly", () => {
      const oneEth = 1000000000000000000n; // 1e18
      expect(formatTokenAmount(oneEth, 18, 4, EN)).toBe("1");
    });

    it("formats fractional amounts", () => {
      const amount = 1500000000000000000n; // 1.5 ETH
      expect(formatTokenAmount(amount, 18, 4, EN)).toBe("1.5");
    });

    it("respects maxFractionDigits", () => {
      const amount = 1123456789012345678n; // ~1.123456789...
      expect(formatTokenAmount(amount, 18, 4, EN)).toBe("1.1234");
      expect(formatTokenAmount(amount, 18, 2, EN)).toBe("1.12");
    });

    it("trims trailing zeros in fraction", () => {
      const amount = 1100000000000000000n; // 1.1 ETH
      expect(formatTokenAmount(amount, 18, 4, EN)).toBe("1.1");
    });

    it("handles amounts with fewer decimals (USDC-like)", () => {
      const amount = 1500000n; // 1.5 USDC (6 decimals)
      expect(formatTokenAmount(amount, 6, 4, EN)).toBe("1.5");
    });

    it("handles negative values", () => {
      const amount = -1500000000000000000n;
      expect(formatTokenAmount(amount, 18, 4, EN)).toBe("-1.5");
    });

    it("formats large amounts with locale separators", () => {
      const amount = 1000000000000000000000n; // 1000 ETH
      expect(formatTokenAmount(amount, 18, 4, EN)).toBe("1,000");
    });

    it("returns whole number when fraction rounds to zero", () => {
      const amount = 1000000000000000001n; // 1 ETH + 1 wei
      // With maxFractionDigits=4, the tiny fraction is too small to display
      expect(formatTokenAmount(amount, 18, 4, EN)).toBe("1");
    });

    it("uses locale-appropriate decimal separator", () => {
      const amount = 1500000000000000000n; // 1.5 ETH
      const result = formatTokenAmount(amount, 18, 4, "de-DE");
      // German uses comma as decimal separator
      expect(result).toBe("1,5");
    });

    it("shows dust indicator when value is too small to display", () => {
      expect(formatTokenAmount(1n, 18, 4, EN, true)).toBe("< 0.0001");
    });

    it("shows negative dust indicator for tiny negative values", () => {
      expect(formatTokenAmount(-1n, 18, 4, EN, true)).toBe("< -0.0001");
    });

    it("respects maxFractionDigits in dust indicator", () => {
      expect(formatTokenAmount(1n, 6, 6, EN, true)).toBe("< 0.000001");
    });
  });
});
