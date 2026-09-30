import { parseUnits, type Hash } from "viem";
import { createPublicClientForChain } from "../../config/pimlico";
import { getCampaignCookieJarPayoutAsset } from "../../utils/cookie-jar-campaign";

const PRICE_DECIMALS = 12;
const PRICE_SCALE = 10n ** BigInt(PRICE_DECIMALS);
const MAX_PRICE_DISTANCE_SECONDS = 3600;
const PRICE_READ_CONCURRENCY = 4;

interface FundingReceipt {
  amount: bigint;
  token: string;
  transactionHash: Hash;
}

interface ValuationReads {
  receivedAt: (hash: Hash) => Promise<number>;
  priceAt: (timestamp: number, coin: string) => Promise<unknown>;
}

function defaultReads(): ValuationReads {
  const client = createPublicClientForChain(42220);
  return {
    receivedAt: async (hash) => {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Funding transfer did not succeed");
      const block = await client.getBlock({ blockHash: receipt.blockHash });
      return Number(block.timestamp);
    },
    priceAt: async (timestamp, coin) => {
      // DefiLlama's historical endpoint returns the nearest recorded USD price.
      // https://api-docs.defillama.com/llms-free.txt
      const response = await fetch(
        `https://coins.llama.fi/prices/historical/${timestamp}/${coin}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) throw new Error(`Historical funding price failed: ${response.status}`);
      return response.json();
    },
  };
}

/** Value confirmed G$ receipts near their execution time, never at today's price. */
export async function valueFundingReceiptsUsdCents(
  receipts: readonly FundingReceipt[],
  reads?: ValuationReads
): Promise<bigint> {
  if (receipts.length === 0) return 0n;
  const asset = getCampaignCookieJarPayoutAsset(42220, "gooddollar");
  if (!asset?.address) throw new Error("GoodDollar metadata is unavailable");
  const coin = `celo:${asset.address}`;
  const source = reads ?? defaultReads();
  const timestamps = new Map<Hash, Promise<number>>();
  const prices = new Map<number, Promise<bigint>>();
  let numerator = 0n;
  for (let offset = 0; offset < receipts.length; offset += PRICE_READ_CONCURRENCY) {
    const values = await Promise.all(
      receipts.slice(offset, offset + PRICE_READ_CONCURRENCY).map(async (receipt) => {
        if (receipt.amount < 0n || receipt.token.toLowerCase() !== asset.address?.toLowerCase()) {
          throw new Error("Funding receipt has an unsupported amount or token");
        }
        if (!/^0x[0-9a-f]{64}$/i.test(receipt.transactionHash)) {
          throw new Error("Funding receipt has no execution transaction");
        }
        let time = timestamps.get(receipt.transactionHash);
        if (!time) {
          time = source.receivedAt(receipt.transactionHash);
          timestamps.set(receipt.transactionHash, time);
        }
        const receivedAt = await time;
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
