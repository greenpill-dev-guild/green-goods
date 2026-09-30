/**
 * Today's G$ price, in dollars
 *
 * Stewards think in dollars and rewards are paid in G$, so the admin converts
 * between the two. The rate comes from GoodDollar's own reserve on Celo: the
 * Mento exchange provider's current price for the G$/cUSD exchange, the price
 * GoodDollar's SDK reads. It is the reserve's buy price, computed live from its
 * balances, about an eighth above what G$ trades for elsewhere; Afo chose it on
 * 2026-09-30 because it is on chain and hard to move. cUSD stands in for the
 * dollar.
 *
 * The price has no timestamp of its own, so freshness is how long ago we read
 * it. A missing, zero, paused or stale price is never guessed around: the
 * dollar entry stops and says why.
 *
 * @module modules/wallet/good-dollar-price
 */

import type { Hex, PublicClient } from "viem";
import type { Address } from "../../types/domain";
import { GOOD_DOLLAR_EXCHANGE_PROVIDER_ABI } from "../../utils/blockchain/abis/goodDollar";

/** GoodProtocol `releases/deployment.json`, `production-celo.MentoExchangeProvider`. */
const GOOD_DOLLAR_EXCHANGE_PROVIDER = "0x2fFBB49055d487DdBBb0C052Cd7c2a02A7971e41" as Address;

/** The G$/cUSD exchange, the provider's only one (`getExchangeIds`). */
const GOOD_DOLLAR_EXCHANGE_ID =
  "0xba77f5c7bb3317643c6d81d1ef3f9913561741d92095f88efa402faf2cbe9124" as Hex;

/** A read older than this is stale, and nothing converts on it. */
const GOOD_DOLLAR_PRICE_STALE_MS = 5 * 60_000;

/** cents × 10^34 / price: two decimals of cents, 18 of G$, 18 of the price. */
const CENTS_SCALE = 10n ** 34n;

export interface GoodDollarPrice {
  /** cUSD per 1 G$, with 18 decimals. */
  price: bigint;
  /** When this app read it, in milliseconds. */
  readAt: number;
}

export type GoodDollarPriceUnavailable = "paused" | "missing" | "stale";

export type GoodDollarPriceState =
  | ({ status: "ready" } & GoodDollarPrice)
  | { status: "loading" }
  | { status: "unavailable"; reason: GoodDollarPriceUnavailable };

/** Why a read gave no usable price. */
class GoodDollarPriceError extends Error {
  constructor(readonly reason: Exclude<GoodDollarPriceUnavailable, "stale">) {
    super(`The G$ price is unavailable: ${reason}`);
    this.name = "GoodDollarPriceError";
  }
}

type PriceReader = Pick<PublicClient, "readContract">;

/** Read the reserve's price now. Rejects rather than return a price nothing should convert on. */
export async function readGoodDollarPrice(
  options: { client?: PriceReader; now?: () => number } = {}
): Promise<GoodDollarPrice> {
  // Loaded on first read: the dollar parsing here is imported by every
  // composer's schema, which should not carry a Celo client along with it.
  const client =
    options.client ?? (await import("../../config/pimlico")).createPublicClientForChain(42220);
  const [paused, price] = await Promise.all([
    client.readContract({
      address: GOOD_DOLLAR_EXCHANGE_PROVIDER,
      abi: GOOD_DOLLAR_EXCHANGE_PROVIDER_ABI,
      functionName: "paused",
    }),
    client.readContract({
      address: GOOD_DOLLAR_EXCHANGE_PROVIDER,
      abi: GOOD_DOLLAR_EXCHANGE_PROVIDER_ABI,
      functionName: "currentPrice",
      args: [GOOD_DOLLAR_EXCHANGE_ID],
    }),
  ]);
  if (paused === true) throw new GoodDollarPriceError("paused");
  if (typeof price !== "bigint" || price <= 0n) throw new GoodDollarPriceError("missing");
  return { price, readAt: (options.now ?? Date.now)() };
}

/** Where a price read stands, for the one line that says whether dollars can be entered. */
export function goodDollarPriceState(
  read: { data?: GoodDollarPrice; error?: unknown; isLoading: boolean },
  now: number
): GoodDollarPriceState {
  // A paused reserve stops dollar entry at once, whatever an earlier read said.
  if (read.error instanceof GoodDollarPriceError && read.error.reason === "paused") {
    return { status: "unavailable", reason: "paused" };
  }
  if (read.data) {
    return now - read.data.readAt > GOOD_DOLLAR_PRICE_STALE_MS
      ? { status: "unavailable", reason: "stale" }
      : { status: "ready", ...read.data };
  }
  if (read.error instanceof GoodDollarPriceError) {
    return { status: "unavailable", reason: read.error.reason };
  }
  if (read.error) return { status: "unavailable", reason: "missing" };
  return read.isLoading ? { status: "loading" } : { status: "unavailable", reason: "missing" };
}

/** A dollar amount as a steward types it ("5", "5.00", "$5.5"), in cents; null when it isn't one. */
export function parseUsdCents(text: string): bigint | null {
  const match = /^\$?\s*(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return BigInt(whole as string) * 100n + BigInt(fraction.padEnd(2, "0"));
}

/**
 * US cents to G$ base units at a price. Rounded down, so a reward never costs
 * more than the dollars typed; computed once from the cents, never round-tripped.
 */
export function usdCentsToGoodDollarWei(cents: bigint, price: bigint): bigint {
  if (price <= 0n || cents <= 0n) return 0n;
  return (cents * CENTS_SCALE) / price;
}

/** G$ base units to US cents at a price, rounded down. */
export function goodDollarWeiToUsdCents(wei: bigint, price: bigint): bigint {
  if (price <= 0n || wei <= 0n) return 0n;
  return (wei * price) / CENTS_SCALE;
}
