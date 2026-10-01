import { describe, expect, it, vi } from "vitest";

import {
  goodDollarPriceState,
  goodDollarWeiToUsdCents,
  parseUsdCents,
  readGoodDollarPrice,
  usdCentsToGoodDollarWei,
} from "../../../modules/wallet/good-dollar-price";

/** The reserve's price read on Celo at block 78864167 (2026-09-30): $0.00012865 per G$. */
const PRICE = 128_647_930_734_508n;
const G = 10n ** 18n;
/** The G$/cUSD exchange on GoodDollar's Mento exchange provider. */
const EXCHANGE_ID = "0xba77f5c7bb3317643c6d81d1ef3f9913561741d92095f88efa402faf2cbe9124";
const FIVE_MINUTES = 5 * 60_000;

function reader(answers: { paused?: unknown; price?: unknown }) {
  return {
    readContract: vi.fn(
      async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "paused") return answers.paused ?? false;
        expect(args).toEqual([EXCHANGE_ID]);
        return answers.price ?? PRICE;
      }
    ),
  } as never;
}

/** The error a paused reserve's read rejects with, as the hook receives it. */
const pausedReadError = () =>
  readGoodDollarPrice({ client: reader({ paused: true }) }).catch((error: unknown) => error);

describe("today's G$ price", () => {
  it("turns typed dollars into G$ at the reserve's price, rounding down", () => {
    const fiveDollars = usdCentsToGoodDollarWei(500n, PRICE);
    // $5.00 / $0.000128647930734508 = 38,865.81… G$
    expect(fiveDollars / G).toBe(38_865n);
    expect(fiveDollars).toBeLessThan((500n * 10n ** 34n) / PRICE + 1n);
    // Converting back loses a cent, which is why a G$ amount is fixed once from the cents.
    expect(goodDollarWeiToUsdCents(fiveDollars, PRICE)).toBe(499n);
    expect(usdCentsToGoodDollarWei(0n, PRICE)).toBe(0n);
    expect(usdCentsToGoodDollarWei(500n, 0n)).toBe(0n);
  });

  it.each([
    ["5", 500n],
    ["5.00", 500n],
    ["$5.5", 550n],
    ["0.99", 99n],
    ["5.001", null],
    ["1,000", null],
    ["-5", null],
    ["", null],
    ["five", null],
  ] as const)("reads %j as %s cents", (typed, cents) => {
    expect(parseUsdCents(typed)).toBe(cents);
  });

  it("reads the reserve's price with the time it was read", async () => {
    await expect(readGoodDollarPrice({ client: reader({}), now: () => 1_000 })).resolves.toEqual({
      price: PRICE,
      readAt: 1_000,
    });
  });

  it.each([
    { label: "a paused reserve", answers: { paused: true }, reason: "paused" },
    { label: "a zero price", answers: { price: 0n }, reason: "missing" },
    { label: "an answer that isn't a number", answers: { price: "12" }, reason: "missing" },
  ])("refuses $label rather than return a price to convert on", async ({ answers, reason }) => {
    await expect(readGoodDollarPrice({ client: reader(answers) })).rejects.toMatchObject({
      reason,
    });
  });

  const read = { price: PRICE, readAt: 10_000 };
  it.each([
    {
      label: "a fresh read",
      input: async () => ({ data: read, isLoading: false }),
      now: 10_000 + 60_000,
      expected: { status: "ready", ...read },
    },
    {
      label: "a read older than five minutes",
      input: async () => ({ data: read, isLoading: false }),
      now: 10_000 + FIVE_MINUTES + 1,
      expected: { status: "unavailable", reason: "stale" },
    },
    {
      label: "a reserve that paused after the last read",
      input: async () => ({ data: read, error: await pausedReadError(), isLoading: false }),
      now: 10_001,
      expected: { status: "unavailable", reason: "paused" },
    },
    {
      label: "a failed first read",
      input: async () => ({ error: new Error("rpc down"), isLoading: false }),
      now: 0,
      expected: { status: "unavailable", reason: "missing" },
    },
    {
      label: "the first read",
      input: async () => ({ isLoading: true }),
      now: 0,
      expected: { status: "loading" },
    },
  ])("says whether dollars can be entered: $label", async ({ input, now, expected }) => {
    expect(goodDollarPriceState(await input(), now)).toEqual(expected);
  });
});
