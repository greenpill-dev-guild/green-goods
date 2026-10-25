import type { ServiceIssuerAsset } from "@green-goods/shared/commitment-pooling";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { parseUnits } from "viem";

/** Never round a member's entered quantity into a different authorization. */
export function parseIssuerAmount(value: string, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
  if (!/^\d+(\.\d+)?$/.test(value) || (value.split(".")[1]?.length ?? 0) > decimals) return null;
  const amount = parseUnits(value, decimals);
  return amount > 0n && amount < (1n << 256n) - 1n ? amount : null;
}

export function issuerAmount(value: bigint, asset: ServiceIssuerAsset, locale: string) {
  return `${formatTokenAmount(value, asset.decimals, asset.decimals, locale)} ${asset.symbol}`;
}
