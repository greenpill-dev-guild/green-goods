import {
  type FunderAssetTotal,
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "@green-goods/shared";

export function getVisibleFunderAssetTotals(assetTotals: FunderAssetTotal[]): FunderAssetTotal[] {
  return assetTotals.filter((assetTotal) => assetTotal.totalYieldGenerated > 0n);
}

export function formatFunderAssetTotals(assetTotals: FunderAssetTotal[]): string {
  const visibleAssetTotals = getVisibleFunderAssetTotals(assetTotals);

  if (visibleAssetTotals.length === 0) return "0";

  return visibleAssetTotals
    .map((assetTotal) => {
      const symbol = getVaultAssetSymbol(assetTotal.asset, assetTotal.chainId);
      const decimals = getVaultAssetDecimals(assetTotal.asset, assetTotal.chainId);
      return `${formatTokenAmount(assetTotal.totalYieldGenerated, decimals)} ${symbol}`;
    })
    .join(", ");
}
