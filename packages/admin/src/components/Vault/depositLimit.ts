import { formatTokenAmount, isUnlimitedVaultLimit } from "@green-goods/shared";

interface DepositLimitLabelOptions {
  assetSymbol: string;
  decimals: number;
  locale?: string;
  unlimitedLabel: string;
}

export function getDepositLimitLabel(
  value: bigint,
  { assetSymbol, decimals, locale, unlimitedLabel }: DepositLimitLabelOptions
): string {
  if (isUnlimitedVaultLimit(value)) {
    return unlimitedLabel;
  }

  return `${formatTokenAmount(value, decimals, 4, locale)} ${assetSymbol}`;
}
