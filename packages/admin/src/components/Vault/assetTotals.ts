import { formatTokenAmount } from "@green-goods/shared";

export interface AssetTotalInput {
  chainId: number;
  assetAddress: string;
  amount: bigint;
  decimals: number;
  symbol: string;
}

export interface AssetTotal {
  key: string;
  amount: bigint;
  decimals: number;
  symbol: string;
}

export function getAssetTotalKey(chainId: number, assetAddress: string): string {
  return `${chainId}:${assetAddress.toLowerCase()}`;
}

export function buildAssetTotals(items: AssetTotalInput[]): AssetTotal[] {
  const totals = new Map<string, AssetTotal>();

  for (const item of items) {
    if (item.amount <= 0n) continue;

    const key = getAssetTotalKey(item.chainId, item.assetAddress);
    const existing = totals.get(key);

    if (existing) {
      existing.amount += item.amount;
      continue;
    }

    totals.set(key, {
      key,
      amount: item.amount,
      decimals: item.decimals,
      symbol: item.symbol,
    });
  }

  return Array.from(totals.values()).sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export function formatAssetTotal(total: AssetTotal): string {
  return `${formatTokenAmount(total.amount, total.decimals, Math.min(total.decimals, 6))} ${total.symbol}`;
}
