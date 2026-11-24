import type { ServiceAsset } from "@green-goods/shared/commitment-pooling";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";

export function serviceAssetHasUnits(
  asset: ServiceAsset | null | undefined
): asset is ServiceAsset & { decimals: number; symbol: string } {
  return (
    typeof asset?.decimals === "number" &&
    Number.isInteger(asset.decimals) &&
    asset.decimals >= 0 &&
    asset.decimals <= 255 &&
    typeof asset.symbol === "string" &&
    asset.symbol.length > 0
  );
}

/** Unknown metadata is displayed exactly; it never implies a token denomination or price. */
export function formatServiceAccessAmount(
  value: bigint,
  asset: ServiceAsset | null | undefined,
  locale: string,
  baseUnitsLabel: string
): string {
  return serviceAssetHasUnits(asset)
    ? `${formatTokenAmount(value, asset.decimals, asset.decimals, locale)} ${asset.symbol}`
    : `${value.toString()} ${baseUnitsLabel}`;
}
