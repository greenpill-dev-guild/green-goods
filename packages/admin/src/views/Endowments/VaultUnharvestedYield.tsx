import {
  type Address,
  type GardenVault,
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetSymbol,
  useVaultPreview,
  ZERO_ADDRESS,
} from "@green-goods/shared";
import { useIntl } from "react-intl";

/** Displays unharvested yield for a single vault inline */
export function VaultUnharvestedYield({ vault }: { vault: GardenVault }) {
  const { formatMessage } = useIntl();
  const netDeposited = getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
  const { preview, isLoading } = useVaultPreview({
    vaultAddress: vault.vaultAddress,
    userAddress: ZERO_ADDRESS as Address,
    enabled: netDeposited > 0n,
  });
  const totalAssets = preview?.totalAssets ?? netDeposited;
  const unharvested = totalAssets > netDeposited ? totalAssets - netDeposited : 0n;
  const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);

  if (isLoading || unharvested === 0n) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-success-light bg-success-lighter px-3 py-1.5 text-xs">
      <span className="text-success-dark">
        {formatMessage({ id: "app.endowments.unharvestedYield" })} ({assetSymbol})
      </span>
      <span className="font-medium tabular-nums text-success-dark">
        +{formatTokenAmount(unharvested)} {assetSymbol}
      </span>
    </div>
  );
}
