import {
  type Address,
  type GardenVault,
  ImageWithFallback,
  formatApy,
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetSymbol,
  useStrategyRate,
  useVaultPreview,
  ZERO_ADDRESS,
} from "@green-goods/shared";
import { RiArrowRightLine, RiPlantLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface VaultAssetRowProps {
  vault: GardenVault;
}

/** Single vault row: asset symbol, APY badge, net deposited, unharvested yield */
function VaultAssetRow({ vault }: VaultAssetRowProps) {
  const { formatMessage } = useIntl();
  const {
    apy,
    isLoading: apyLoading,
    isError: apyError,
    unsupported,
  } = useStrategyRate(vault.asset as Address, {
    chainId: vault.chainId,
  });
  const netDeposited = getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
  const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId);

  const { preview, isLoading: previewLoading } = useVaultPreview({
    vaultAddress: vault.vaultAddress,
    chainId: vault.chainId,
    userAddress: ZERO_ADDRESS as Address,
    enabled: netDeposited > 0n,
  });
  const totalAssets = preview?.totalAssets ?? netDeposited;
  const unharvested = totalAssets > netDeposited ? totalAssets - netDeposited : 0n;

  return (
    <div className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-strong">{assetSymbol}</span>
          {!apyLoading && !unsupported && apy !== undefined && (
            <span
              className="rounded-full bg-success-lighter px-1.5 py-0.5 text-[10px] font-semibold text-success-dark"
              title={formatMessage({ id: "app.funders.strategyApy" }, { asset: assetSymbol })}
            >
              {formatApy(apy)}
            </span>
          )}
          {(unsupported || apyError || (!apyLoading && apy === undefined)) && (
            <span
              className="rounded-full bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium text-text-soft"
              title={formatMessage({
                id: unsupported ? "app.endowments.apyUnsupported" : "app.status.notAvailable",
              })}
            >
              APY {formatMessage({ id: "app.treasury.none" })}
            </span>
          )}
        </div>
        <span
          className="tabular-nums text-text-strong"
          title={`${formatTokenAmount(netDeposited)} ${assetSymbol}`}
        >
          {formatTokenAmount(netDeposited)}
        </span>
      </div>

      {!previewLoading && unharvested > 0n && (
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-success-dark">
            {formatMessage({ id: "app.endowments.unharvestedYield" })}
          </span>
          <span className="font-medium tabular-nums text-success-dark">
            +{formatTokenAmount(unharvested)} {assetSymbol}
          </span>
        </div>
      )}
    </div>
  );
}

interface GardenVaultCardProps {
  item: {
    gardenAddress: string;
    garden?: { id: string; name?: string; location?: string; bannerImage?: string };
    vaults: GardenVault[];
    netDeposited: bigint;
    harvestCount: number;
  };
}

export function GardenVaultCard({ item }: GardenVaultCardProps) {
  const { formatMessage } = useIntl();
  const { garden } = item;
  const name = garden?.name || "Garden";
  const location = garden?.location || "";

  const sortedVaults = useMemo(
    () =>
      [...item.vaults].sort((a, b) => {
        const symA = getVaultAssetSymbol(a.asset, a.chainId).toUpperCase();
        const symB = getVaultAssetSymbol(b.asset, b.chainId).toUpperCase();
        if (symA === "WETH" || symA === "ETH") return -1;
        if (symB === "WETH" || symB === "ETH") return 1;
        return symA.localeCompare(symB);
      }),
    [item.vaults]
  );

  return (
    <Card padding="compact" colorAccent="info" className="sm:p-5">
      {/* Header: garden image + name */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
          {garden?.bannerImage ? (
            <ImageWithFallback
              src={garden.bannerImage}
              alt={name}
              className="h-10 w-10 object-cover rounded-lg"
              fallbackClassName="h-10 w-10 rounded-lg"
              fallbackIcon={RiPlantLine}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-soft text-text-sub">
              <span className="text-sm font-semibold">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3
            className="truncate font-heading text-base font-semibold text-text-strong sm:text-lg"
            title={name}
          >
            {name}
          </h3>
          <p className="truncate text-xs text-text-sub" title={location}>
            {location}
          </p>
        </div>
      </div>

      {/* Per-asset vault rows */}
      <div className="space-y-2">
        {sortedVaults.map((vault) => (
          <VaultAssetRow key={vault.id} vault={vault} />
        ))}
      </div>

      {/* Footer: harvest count + manage CTA */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-text-soft">
          {formatMessage({ id: "app.treasury.harvestCount" })}: {item.harvestCount}
        </p>
        {garden && (
          <Button variant="secondary" size="sm" asChild>
            <Link
              to={`/gardens/${garden.id}/vault`}
              state={{
                returnTo: "/endowments",
                returnLabelId: "app.admin.nav.treasury",
              }}
            >
              {formatMessage({ id: "app.treasury.manageVault" })}
              <RiArrowRightLine className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
