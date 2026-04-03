import { type Address, formatApy, getVaultAssetSymbol, useStrategyRate } from "@green-goods/shared";
import { RiLeafLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { StatCard } from "@/components/StatCard";

export function AssetApyCard({
  assetAddress,
  chainId,
}: {
  assetAddress: Address;
  chainId: number;
}) {
  const { formatMessage } = useIntl();
  const { apy, isLoading } = useStrategyRate(assetAddress, { chainId });
  const symbol = getVaultAssetSymbol(assetAddress, chainId);

  return (
    <StatCard
      icon={<RiLeafLine className="h-5 w-5" />}
      label={formatMessage({ id: "app.funders.strategyApy" }, { asset: symbol })}
      value={isLoading ? "--" : apy !== undefined ? formatApy(apy) : "--"}
      colorScheme="success"
    />
  );
}
