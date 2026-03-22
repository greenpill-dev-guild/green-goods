import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import { formatAddress } from "../app/text";
import { isZeroAddress, ZERO_ADDRESS } from "./address";

// Re-export for backward compatibility (canonical source is address.ts)
export { ZERO_ADDRESS };

/** Octant vault MAX_BPS (10000 = 100%). Used as maxLoss for permissive withdraw/redeem queries. */
export const VAULT_MAX_BPS = 10000n;
/** Canonical uint256 max value returned by contracts to signal "unlimited". */
export const MAX_UINT256 = (1n << 256n) - 1n;

/** Aave V3 pool addresses by chain — where vault strategies deploy funds */
export const AAVE_V3_POOL: Record<number, Address> = {
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" as Address, // Arbitrum
  11155111: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951" as Address, // Sepolia
};

const ASSET_SYMBOLS_BY_CHAIN: Record<number, Record<string, string>> = {
  42161: {
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": "DAI",
  },
  11155111: {
    "0x7b79995e5f793a07bc00c21412e50ecae098e7f9": "WETH",
    "0x68194a729c2450ad26072b3d33adacbcef39d574": "DAI",
  },
  42220: {
    "0x122013fd7df1c6f636a5bb8f03108e876548b455": "WETH",
    "0xe4fe50cdd716ef9e15b9ddd5e5e946b23fc4f9e4": "DAI",
  },
};

const ASSET_DECIMALS_BY_CHAIN: Record<number, Record<string, number>> = {
  42161: {
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": 18,
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": 18,
  },
  11155111: {
    "0x7b79995e5f793a07bc00c21412e50ecae098e7f9": 18,
    "0x68194a729c2450ad26072b3d33adacbcef39d574": 18,
  },
  42220: {
    "0x122013fd7df1c6f636a5bb8f03108e876548b455": 18,
    "0xe4fe50cdd716ef9e15b9ddd5e5e946b23fc4f9e4": 18,
  },
};

/** @deprecated Use `isZeroAddress` from `./address` instead. */
export const isZeroAddressValue = isZeroAddress;

/**
 * Checks if a bytes32 value is zero or falsy.
 * Handles both falsy values (null, undefined, "") and truthy
 * "0x000...0" strings of any length (20-byte addresses, 32-byte UIDs).
 */
export function isZeroBytes32(value: string | undefined | null): boolean {
  if (!value) return true;
  if (value.length < 3 || !value.startsWith("0x")) return false;
  return /^0+$/.test(value.slice(2));
}

export function getVaultAssetSymbol(
  assetAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): string {
  const normalized = assetAddress.toLowerCase();
  const symbol = ASSET_SYMBOLS_BY_CHAIN[chainId]?.[normalized];
  if (symbol) return symbol;
  return formatAddress(assetAddress, { variant: "card" });
}

export function getVaultAssetDecimals(
  assetAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): number {
  const normalized = assetAddress.toLowerCase();
  return ASSET_DECIMALS_BY_CHAIN[chainId]?.[normalized] ?? 18;
}

export function hasVaultAssetDecimals(
  assetAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): boolean {
  const normalized = assetAddress.toLowerCase();
  return typeof ASSET_DECIMALS_BY_CHAIN[chainId]?.[normalized] === "number";
}

/**
 * Validates a decimal string for token amount input.
 * Returns an i18n error key if the input is non-empty but invalid, or null if valid/empty.
 */
export function validateDecimalInput(input: string, decimals: number): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (!/^\d+(?:\.\d*)?$/.test(trimmed)) {
    return "app.treasury.invalidAmount";
  }

  const dotIndex = trimmed.indexOf(".");
  if (dotIndex !== -1 && trimmed.length - dotIndex - 1 > decimals) {
    return "app.treasury.tooManyDecimals";
  }

  return null;
}

export function getNetDeposited(totalDeposited: bigint, totalWithdrawn: bigint): bigint {
  if (totalDeposited <= totalWithdrawn) return 0n;
  return totalDeposited - totalWithdrawn;
}

export function isUnlimitedVaultLimit(value: bigint): boolean {
  return value === MAX_UINT256;
}

export function formatTokenAmount(
  value: bigint,
  decimals = 18,
  maxFractionDigits = 4,
  locale?: string,
  showDustIndicator = false
): string {
  if (value === 0n) return "0";

  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;

  // Dust indicator: when value is non-zero but too small to display
  if (showDustIndicator && whole === 0n) {
    const padded = fraction.toString().padStart(decimals, "0");
    const visible = padded.slice(0, maxFractionDigits).replace(/0+$/, "");
    if (!visible) {
      const dustStr = `< 0.${"0".repeat(maxFractionDigits - 1)}1`;
      return negative ? `< -0.${"0".repeat(maxFractionDigits - 1)}1` : dustStr;
    }
  }

  const resolvedLocale =
    locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const wholeText = whole.toLocaleString(resolvedLocale);

  if (fraction === 0n) {
    return negative ? `-${wholeText}` : wholeText;
  }

  const padded = fraction.toString().padStart(decimals, "0");
  const trimmed = padded.slice(0, maxFractionDigits).replace(/0+$/, "");
  if (!trimmed) {
    // When whole === 0 and value is non-zero, show full precision to avoid displaying "0"
    if (whole === 0n) {
      const fullTrimmed = padded.replace(/0+$/, "");
      if (fullTrimmed) {
        const decSep = (0.1).toLocaleString(resolvedLocale).charAt(1);
        const full = `${wholeText}${decSep}${fullTrimmed}`;
        return negative ? `-${full}` : full;
      }
    }
    return negative ? `-${wholeText}` : wholeText;
  }

  // Use locale-appropriate decimal separator
  const decimalSeparator = (0.1).toLocaleString(resolvedLocale).charAt(1);
  const formatted = `${wholeText}${decimalSeparator}${trimmed}`;
  return negative ? `-${formatted}` : formatted;
}
