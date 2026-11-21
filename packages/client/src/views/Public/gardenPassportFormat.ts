import { CELO_G_DOLLAR_TOKEN } from "@green-goods/shared/config/tokens";
import type { Address } from "@green-goods/shared/types/domain";
import type { IntlShape } from "react-intl";
import { formatUnits } from "viem";

/** A day on the record, in the reader's locale. */
export function passportDate(intl: IntlShape, seconds: number): string {
  return intl.formatDate(seconds * 1000, { year: "numeric", month: "short", day: "numeric" });
}

/** The same day for a `<time>` element. */
export function passportIsoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

/** A token amount in whole units, to two decimals at most. */
export function passportAmount(intl: IntlShape, amount: bigint, decimals: number): string {
  return intl.formatNumber(Number(formatUnits(amount, decimals)), { maximumFractionDigits: 2 });
}

/**
 * The name and decimals of a settlement token the page can state. Payments settle in G$ today;
 * an amount in any other token is reported without a figure, never under the wrong name.
 */
export function passportMoneyToken(token: Address): { symbol: string; decimals: number } | null {
  return token.toLowerCase() === CELO_G_DOLLAR_TOKEN.address.toLowerCase()
    ? { symbol: CELO_G_DOLLAR_TOKEN.symbol, decimals: CELO_G_DOLLAR_TOKEN.decimals }
    : null;
}
