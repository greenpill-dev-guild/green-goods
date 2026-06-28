import { describe, expect, it } from "vitest";

import { usdCentsToWei, weiToUsdCents } from "../../../utils/blockchain/price-feeds";

// $3,000.00 / ETH expressed as a raw Chainlink answer (price * 10^8).
const PRICE_3000 = 3000n * 10n ** 8n;
const ONE_WETH = 10n ** 18n;

describe("weiToUsdCents", () => {
  it("converts a whole WETH amount to its USD-cents value", () => {
    // 1 WETH at $3,000 => 300,000 cents.
    expect(weiToUsdCents(ONE_WETH, PRICE_3000, 18)).toBe(300_000n);
  });

  it("scales linearly for fractional WETH", () => {
    // 0.5 WETH at $3,000 => 150,000 cents.
    expect(weiToUsdCents(ONE_WETH / 2n, PRICE_3000, 18)).toBe(150_000n);
  });

  it("returns 0n for non-positive wei or a missing price feed", () => {
    expect(weiToUsdCents(0n, PRICE_3000, 18)).toBe(0n);
    expect(weiToUsdCents(-1n, PRICE_3000, 18)).toBe(0n);
    expect(weiToUsdCents(ONE_WETH, 0n, 18)).toBe(0n);
    expect(weiToUsdCents(ONE_WETH, -1n, 18)).toBe(0n);
  });

  it("round-trips usdCentsToWei within one cent of truncation", () => {
    const cents = 2_000n; // $20.00
    const wei = usdCentsToWei(cents, PRICE_3000, 18);
    const recovered = weiToUsdCents(wei, PRICE_3000, 18);
    // Integer wei truncation can only lose value, never add it.
    expect(recovered).toBeLessThanOrEqual(cents);
    expect(cents - recovered).toBeLessThanOrEqual(1n);
  });
});
