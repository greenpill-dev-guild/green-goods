import {
  type Address,
  type GardenVault,
  ImageWithFallback,
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetSymbol,
} from "@green-goods/shared";
import { RiArrowRightLine, RiPlantLine, RiSafe2Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  GardenHarvestableYield,
  GardenPendingYield,
  GardenSplitBadges,
} from "./GardenYieldIndicators";

export interface GroupedGarden {
  gardenAddress: string;
  garden?: { id: string; name?: string; location?: string; bannerImage?: string };
  vaults: GardenVault[];
  netDeposited: bigint;
  harvestCount: number;
}

interface EndowmentsVaultListProps {
  isLoading: boolean;
  grouped: GroupedGarden[];
  filteredGrouped: GroupedGarden[];
  isFilterActive: boolean;
  onResetFilters: () => void;
}

function VaultListSkeleton() {
  const { formatMessage } = useIntl();

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-live="polite">
      <span className="sr-only">{formatMessage({ id: "app.treasury.loadingVaults" })}</span>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} padding="compact" className="sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
            <div className="space-y-2">
              <div
                className="h-5 w-32 rounded skeleton-shimmer"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
              <div
                className="h-3 w-20 rounded skeleton-shimmer"
                style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div
              className="h-9 rounded-md skeleton-shimmer"
              style={{ animationDelay: `${i * 0.1 + 0.1}s` }}
            />
            <div
              className="h-9 rounded-md skeleton-shimmer"
              style={{ animationDelay: `${i * 0.1 + 0.15}s` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div
              className="h-3 w-24 rounded skeleton-shimmer"
              style={{ animationDelay: `${i * 0.1 + 0.2}s` }}
            />
            <div
              className="h-8 w-28 rounded-md skeleton-shimmer"
              style={{ animationDelay: `${i * 0.1 + 0.2}s` }}
            />
          </div>
        </Card>
      ))}
    </section>
  );
}

function GardenVaultInlineCard({ item }: { item: GroupedGarden }) {
  const { formatMessage } = useIntl();

  return (
    <Card padding="compact" colorAccent="info" className="sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
          {item.garden?.bannerImage ? (
            <ImageWithFallback
              src={item.garden.bannerImage}
              alt={item.garden.name || "Garden"}
              className="h-10 w-10 object-cover rounded-lg"
              fallbackClassName="h-10 w-10 rounded-lg"
              fallbackIcon={RiPlantLine}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-soft text-text-sub">
              <span className="text-sm font-semibold">
                {(item.garden?.name ?? "G").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h2
            className="line-clamp-2 break-words font-heading text-base font-semibold text-text-strong sm:text-lg"
            title={item.garden?.name}
          >
            {item.garden?.name}
          </h2>
          <p
            className="line-clamp-2 break-words text-xs text-text-sub"
            title={item.garden?.location}
          >
            {item.garden?.location}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {[...item.vaults]
          .sort((a, b) => {
            const symA = getVaultAssetSymbol(a.asset, a.chainId).toUpperCase();
            const symB = getVaultAssetSymbol(b.asset, b.chainId).toUpperCase();
            // ETH/WETH first, then alphabetical
            if (symA === "WETH" || symA === "ETH") return -1;
            if (symB === "WETH" || symB === "ETH") return 1;
            return symA.localeCompare(symB);
          })
          .map((vault) => (
            <div
              key={vault.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-words font-medium text-text-sub">
                {getVaultAssetSymbol(vault.asset, vault.chainId)}
              </span>
              <span className="ml-auto tabular-nums text-text-strong">
                {formatTokenAmount(
                  getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
                  18,
                  2
                )}
              </span>
            </div>
          ))}
      </div>

      <GardenHarvestableYield vaults={item.vaults} />

      <GardenPendingYield
        gardenAddress={item.gardenAddress as Address}
        assetAddresses={item.vaults.map((v) => v.asset)}
      />

      <div className="mt-3">
        <GardenSplitBadges gardenAddress={item.gardenAddress as Address} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-soft">
          {formatMessage({ id: "app.treasury.harvestCount" })}: {item.harvestCount}
        </p>
        {item.garden && (
          <Button variant="secondary" size="sm" asChild>
            <Link
              to={`/gardens/${item.garden.id}/vault`}
              state={{
                returnTo: "/endowments",
                returnLabelId: "app.admin.nav.treasury",
              }}
            >
              {formatMessage({ id: "app.treasury.manageVault" })}
              <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

export function EndowmentsVaultList({
  isLoading,
  grouped,
  filteredGrouped,
  isFilterActive,
  onResetFilters,
}: EndowmentsVaultListProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return <VaultListSkeleton />;
  }

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<RiSafe2Line className="h-6 w-6" />}
        title={formatMessage({ id: "app.treasury.noVault" })}
        description={formatMessage({
          id: "app.treasury.noVaultDescription",
          defaultMessage: "No gardens have configured vault strategies yet.",
        })}
      />
    );
  }

  if (filteredGrouped.length === 0 && isFilterActive) {
    return (
      <EmptyState
        icon={<RiSafe2Line className="h-6 w-6" />}
        title={formatMessage({ id: "app.treasury.noResults" })}
        action={{
          label: formatMessage({ id: "app.treasury.resetFilters" }),
          onClick: onResetFilters,
        }}
      />
    );
  }

  if (filteredGrouped.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-base font-semibold text-text-strong">
        {formatMessage({
          id: "app.endowments.section.vaults",
          defaultMessage: "Garden Vaults",
        })}
      </h2>
      <section className="stagger-children grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredGrouped.map((item) => (
          <GardenVaultInlineCard key={item.gardenAddress} item={item} />
        ))}
      </section>
    </div>
  );
}
