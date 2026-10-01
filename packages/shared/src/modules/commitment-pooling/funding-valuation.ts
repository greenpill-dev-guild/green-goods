import { parseUnits } from "viem";
import { getCampaignCookieJarPayoutAsset } from "../../utils/cookie-jar-campaign";

const PRICE_DECIMALS = 12;
const PRICE_SCALE = 10n ** BigInt(PRICE_DECIMALS);
const MAX_PRICE_DISTANCE_SECONDS = 3600;
const PRICE_READ_CONCURRENCY = 4;

interface FundingReceipt {
  amount: bigint;
  token: string;
  receivedAt: number;
}

interface ValuationReads {
  priceAt: (timestamp: number, coin: string) => Promise<unknown>;
}

function defaultReads(signal?: AbortSignal): ValuationReads {
  const deadline = AbortSignal.timeout(30000);
  return {
    priceAt: async (timestamp, coin) => {
      // DefiLlama's historical endpoint returns the nearest recorded USD price.
      // https://api-docs.defillama.com/llms-free.txt
      const response = await fetch(
        `https://coins.llama.fi/prices/historical/${timestamp}/${coin}`,
        {
          signal: AbortSignal.any([
            deadline,
            AbortSignal.timeout(10000),
            ...(signal ? [signal] : []),
          ]),
        }
      );
      if (!response.ok) throw new Error(`Historical funding price failed: ${response.status}`);
      return response.json();
    },
  };
}

/** Value confirmed G$ receipts near their execution time, never at today's price. */
export async function valueFundingReceiptsUsdCents(
  receipts: readonly FundingReceipt[],
  reads?: ValuationReads,
  signal?: AbortSignal
): Promise<bigint> {
  if (receipts.length === 0) return 0n;
  const asset = getCampaignCookieJarPayoutAsset(42220, "gooddollar");
  if (!asset?.address) throw new Error("GoodDollar metadata is unavailable");
  const coin = `celo:${asset.address}`;
  const source = reads ?? defaultReads(signal);
  const prices = new Map<number, Promise<bigint>>();
  let numerator = 0n;
  for (let offset = 0; offset < receipts.length; offset += PRICE_READ_CONCURRENCY) {
    signal?.throwIfAborted();
    const values = await Promise.all(
      receipts.slice(offset, offset + PRICE_READ_CONCURRENCY).map(async (receipt) => {
        if (receipt.amount < 0n || receipt.token.toLowerCase() !== asset.address?.toLowerCase()) {
          throw new Error("Funding receipt has an unsupported amount or token");
        }
        const receivedAt = receipt.receivedAt;
        if (!Number.isSafeInteger(receivedAt) || receivedAt <= 0) {
          throw new Error("Funding receipt time is unavailable");
        }
        let price = prices.get(receivedAt);
        if (!price) {
          price = source.priceAt(receivedAt, coin).then((result) => {
            const record = (result as { coins?: Record<string, unknown> } | null)?.coins?.[coin];
            if (!record || typeof record !== "object")
              throw new Error("Historical G$ price is missing");
            const quote = record as Record<string, unknown>;
            if (
              typeof quote.price !== "number" ||
              !Number.isFinite(quote.price) ||
              quote.price <= 0 ||
              typeof quote.timestamp !== "number" ||
              !Number.isSafeInteger(quote.timestamp) ||
              Math.abs(quote.timestamp - receivedAt) > MAX_PRICE_DISTANCE_SECONDS ||
              typeof quote.confidence !== "number" ||
              !Number.isFinite(quote.confidence) ||
              quote.confidence < 0.9 ||
              quote.confidence > 1 ||
              quote.decimals !== asset.decimals ||
              quote.symbol !== asset.symbol
            )
              throw new Error("Historical G$ price is not reliable enough to publish");
            const scaled = parseUnits(quote.price.toFixed(PRICE_DECIMALS), PRICE_DECIMALS);
            if (scaled <= 0n) throw new Error("Historical G$ price is below reporting precision");
            return scaled;
          });
          prices.set(receivedAt, price);
        }
        return receipt.amount * (await price) * 100n;
      })
    );
    for (const value of values) numerator += value;
  }
  // Round once after summing, so small receipts do not disappear individually.
  const denominator = 10n ** BigInt(asset.decimals) * PRICE_SCALE;
  return (numerator + denominator / 2n) / denominator;
}
