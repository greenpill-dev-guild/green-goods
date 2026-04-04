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
  const { apy, unsupported, isLoading, isError } = useStrategyRate(assetAddress, { chainId });
  const symbol = getVaultAssetSymbol(assetAddress, chainId);

  let value: string;
  let colorScheme: "success" | "warning" | "info" = "success";
  if (isLoading) {
    value = "--";
  } else if (unsupported) {
    value = formatMessage({ id: "app.endowments.apyUnsupported", defaultMessage: "No strategy" });
    colorScheme = "warning";
  } else if (isError || apy === undefined) {
    value = formatMessage({ id: "app.status.notAvailable", defaultMessage: "Unavailable" });
    colorScheme = "warning";
  } else {
    value = formatApy(apy);
  }

  return (
    <StatCard
      icon={<RiLeafLine className="h-5 w-5" />}
      label={formatMessage({ id: "app.funders.strategyApy" }, { asset: symbol })}
      value={value}
      colorScheme={colorScheme}
    />
  );
}
