import {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetSymbol,
  useGardenVaults,
  useGardens,
} from "@green-goods/shared";
import {
  RiArrowRightLine,
  RiLeafLine,
  RiMoneyDollarCircleLine,
  RiPlantLine,
  RiSafe2Line,
} from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";

export default function TreasuryOverview() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { vaults, isLoading: vaultsLoading } = useGardenVaults(undefined, { enabled: true });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof vaults>();

    for (const vault of vaults) {
      const key = vault.garden.toLowerCase();
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, vault]);
    }

    return Array.from(map.entries())
      .map(([gardenAddress, gardenVaults]) => {
        const garden = gardens.find((item) => item.id.toLowerCase() === gardenAddress);
        return {
          gardenAddress,
          garden,
          vaults: gardenVaults,
          netDeposited: gardenVaults.reduce(
            (sum, vault) => sum + getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
            0n
          ),
          harvestCount: gardenVaults.reduce((sum, vault) => sum + vault.totalHarvestCount, 0),
        };
      })
      .filter((item) => item.garden)
      .sort((a, b) => (a.garden?.name ?? "").localeCompare(b.garden?.name ?? ""));
  }, [gardens, vaults]);

  const totalTVL = useMemo(
    () => grouped.reduce((sum, item) => sum + item.netDeposited, 0n),
    [grouped]
  );
  const totalHarvests = useMemo(
    () => grouped.reduce((sum, item) => sum + item.harvestCount, 0),
    [grouped]
  );

  const isLoading = gardensLoading || vaultsLoading;

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.treasury.title" })}
        description={formatMessage({ id: "app.treasury.overviewDescription" })}
        sticky
      />

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 sm:px-6">
        <section className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<RiMoneyDollarCircleLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalValueLocked" })}
            value={formatTokenAmount(totalTVL)}
            colorScheme="info"
          />
          <StatCard
            icon={<RiLeafLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalHarvests" })}
            value={totalHarvests}
            colorScheme="success"
          />
          <StatCard
            icon={<RiPlantLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.gardensWithVaults" })}
            value={grouped.length}
            colorScheme="warning"
          />
        </section>

        {isLoading && (
          <section
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">{formatMessage({ id: "app.treasury.loadingVaults" })}</span>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} padding="compact" className="sm:p-5">
                <div className="mb-4 space-y-2">
                  <div
                    className="h-5 w-32 rounded skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                  <div
                    className="h-3 w-20 rounded skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
                  />
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
        )}

        {!isLoading && grouped.length === 0 && (
          <EmptyState
            icon={<RiSafe2Line className="h-6 w-6" />}
            title={formatMessage({ id: "app.treasury.noVault" })}
            description={formatMessage({
              id: "app.treasury.noVaultDescription",
              defaultMessage: "No gardens have configured vault strategies yet.",
            })}
          />
        )}

        {!isLoading && grouped.length > 0 && (
          <section className="stagger-children grid grid-cols-1 gap-4 lg:grid-cols-2">
            {grouped.map((item) => (
              <Card
                key={item.gardenAddress}
                padding="compact"
                colorAccent="info"
                className="sm:p-5"
              >
                <div className="mb-4">
                  <h2 className="font-heading text-base font-semibold text-text-strong sm:text-lg">
                    {item.garden?.name}
                  </h2>
                  <p className="text-xs text-text-sub">{item.garden?.location}</p>
                </div>

                <div className="space-y-2">
                  {item.vaults.map((vault) => (
                    <div
                      key={vault.id}
                      className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-text-sub">
                        {getVaultAssetSymbol(vault.asset, vault.chainId)}
                      </span>
                      <span className="text-text-strong">
                        {formatTokenAmount(
                          getNetDeposited(vault.totalDeposited, vault.totalWithdrawn)
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-text-soft">
                    {formatMessage({ id: "app.treasury.harvestCount" })}: {item.harvestCount}
                  </p>
                  {item.garden && (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/gardens/${item.garden.id}/vault`}>
                        {formatMessage({ id: "app.treasury.manageVault" })}
                        <RiArrowRightLine className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
