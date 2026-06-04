/**
 * Chainlink ETH/USD price-feed addresses + bigint USD↔wei conversion helpers.
 *
 * Used by the public Fund card to convert dollar entry into native-token
 * (WETH) wei amounts. All math is bigint to avoid floating-point on user
 * money. Floats only show up at the final UI formatting boundary.
 *
 * Aggregator addresses verified against https://data.chain.link.
 */

import type { Address } from "../../types/domain";

/** Standard Chainlink price-feed decimals (most USD feeds report 8). */
export const PRICE_FEED_DECIMALS = 8;

/** USD math precision — cents. Two decimal places, integer arithmetic. */
const USD_CENTS_SCALE = 100n;

const ETH_USD_FEED: Record<number, Address | undefined> = {
  // Ethereum mainnet — Octant V2 vault route
  1: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419" as Address,
  // Arbitrum mainnet — production target
  42161: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" as Address,
  // Sepolia — testnet
  11155111: "0x694AA1769357215DE4FAC081bf1f309aDC325306" as Address,
  // Celo — no canonical Chainlink ETH/USD feed; consumers degrade gracefully
  42220: undefined,
};

/**
 * Resolve the ETH/USD aggregator address for a chain. Returns undefined when
 * the chain has no canonical feed — UI must fall back to native-units display.
 */
export function getEthUsdFeedAddress(chainId: number): Address | undefined {
  return ETH_USD_FEED[chainId];
}

/**
 * Stale threshold (seconds). Chainlink ETH/USD heartbeat on Arbitrum is 24h
 * but the UX threshold for "fresh enough to convert without warning" is
 * tighter — 1 hour matches typical DeFi UX.
 */
export const PRICE_FEED_STALE_THRESHOLD_S = 60 * 60;

/**
 * Convert USD cents to native-token wei using a Chainlink price answer.
 *
 * @param usdCents - USD amount in cents (e.g. $20.00 = 2000n)
 * @param priceAnswer - Raw Chainlink answer (price * 10^PRICE_FEED_DECIMALS)
 * @param tokenDecimals - Decimals of the target token (WETH = 18)
 */
export function usdCentsToWei(
  usdCents: bigint,
  priceAnswer: bigint,
  tokenDecimals: number
): bigint {
  if (priceAnswer <= 0n || usdCents <= 0n) return 0n;
  // wei = (usdCents * 10^tokenDecimals * 10^PRICE_FEED_DECIMALS) / (priceAnswer * 100)
  // priceAnswer encodes price * 10^8, USD_CENTS_SCALE removes the cents factor.
  const numerator = usdCents * 10n ** BigInt(tokenDecimals) * 10n ** BigInt(PRICE_FEED_DECIMALS);
  const denominator = priceAnswer * USD_CENTS_SCALE;
  return numerator / denominator;
}

/**
 * Format a Chainlink USD price answer for display ("$3,712.45").
 *
 * @param priceAnswer - Raw Chainlink answer (price * 10^PRICE_FEED_DECIMALS)
 * @param locale - BCP-47 tag for number formatting
 */
export function formatUsdPrice(priceAnswer: bigint, locale?: string): string {
  if (priceAnswer <= 0n) return "$0.00";
  const resolvedLocale =
    locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  // Convert bigint cents to a number for Intl formatting. The price is bounded
  // (USD assets fit comfortably in Number's safe integer range as cents) so
  // the precision loss is negligible at display time.
  const cents = priceAnswer / 10n ** BigInt(PRICE_FEED_DECIMALS - 2);
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Parse a user-entered USD string ("20", "20.5", "20.55") into bigint cents.
 * Returns null for invalid input. Caps fractional digits at 2.
 */
export function parseUsdToCents(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = fraction.padEnd(2, "0");
  return BigInt(whole) * 100n + BigInt(paddedFraction);
}

/**
 * Format bigint cents back to a `$X.XX` display string.
 */
export function formatUsdCents(cents: bigint, locale?: string): string {
  const resolvedLocale =
    locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(dollars);
}
