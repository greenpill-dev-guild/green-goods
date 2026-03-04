import {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetSymbol,
  ImageWithFallback,
  useDebouncedValue,
  useGardens,
  useGardenVaults,
} from "@green-goods/shared";
import {
  RiArrowRightLine,
  RiLeafLine,
  RiMoneyDollarCircleLine,
  RiPlantLine,
  RiSafe2Line,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SortSelect } from "@/components/ui/SortSelect";

type EndowmentsSortOrder = "name" | "tvl";

export default function EndowmentsOverview() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { vaults, isLoading: vaultsLoading } = useGardenVaults(undefined, { enabled: true });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortOrder, setSortOrder] = useState<EndowmentsSortOrder>("name");

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
      .filter((item) => item.garden);
  }, [gardens, vaults]);

  const filteredGrouped = useMemo(() => {
    let working = grouped;

    // Filter by search text
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      working = working.filter(
        (item) =>
          (item.garden?.name || "").toLowerCase().includes(term) ||
          (item.garden?.location || "").toLowerCase().includes(term)
      );
    }

    // Sort
    if (sortOrder === "tvl") {
      return [...working].sort((a, b) => {
        if (b.netDeposited > a.netDeposited) return 1;
        if (b.netDeposited < a.netDeposited) return -1;
        return 0;
      });
    }
    return [...working].sort((a, b) => (a.garden?.name ?? "").localeCompare(b.garden?.name ?? ""));
  }, [grouped, debouncedSearch, sortOrder]);

  const isFilterActive = !!debouncedSearch || sortOrder !== "name";

  const resetFilters = () => {
    setSearch("");
    setSortOrder("name");
  };

  const tvlByAsset = useMemo(() => {
    let totalEth = 0n;
    let totalDai = 0n;

    for (const vault of vaults) {
      const netDeposited = getNetDeposited(vault.totalDeposited, vault.totalWithdrawn);
      const assetSymbol = getVaultAssetSymbol(vault.asset, vault.chainId).toUpperCase();

      if (assetSymbol === "ETH" || assetSymbol === "WETH") {
        totalEth += netDeposited;
      }

      if (assetSymbol === "DAI") {
        totalDai += netDeposited;
      }
    }

    return { totalEth, totalDai };
  }, [vaults]);
  const totalHarvests = useMemo(
    () => grouped.reduce((sum, item) => sum + item.harvestCount, 0),
    [grouped]
  );

  const isLoading = gardensLoading || vaultsLoading;

  const sortOptions: { value: EndowmentsSortOrder; label: string }[] = [
    { value: "name", label: formatMessage({ id: "app.treasury.sort.name" }) },
    { value: "tvl", label: formatMessage({ id: "app.treasury.sort.tvl" }) },
  ];

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.treasury.title" })}
        description={formatMessage({ id: "app.treasury.overviewDescription" })}
        sticky
        toolbar={
          !isLoading && grouped.length > 0 ? (
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={formatMessage({ id: "app.treasury.searchPlaceholder" })}
            >
              <SortSelect
                value={sortOrder}
                onChange={setSortOrder}
                options={sortOptions}
                aria-label={formatMessage({ id: "app.home.filters.sortTitle" })}
              />
            </ListToolbar>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">
        <section className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<RiMoneyDollarCircleLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalValueLocked" })}
            value={`${formatTokenAmount(tvlByAsset.totalEth)} ETH / ${formatTokenAmount(
              tvlByAsset.totalDai
            )} DAI`}
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

        {!isLoading && grouped.length > 0 && filteredGrouped.length === 0 && isFilterActive && (
          <EmptyState
            icon={<RiSafe2Line className="h-6 w-6" />}
            title={formatMessage({ id: "app.treasury.noResults" })}
            action={{
              label: formatMessage({ id: "app.treasury.resetFilters" }),
              onClick: resetFilters,
            }}
          />
        )}

        {!isLoading && filteredGrouped.length > 0 && (
          <section className="stagger-children grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredGrouped.map((item) => (
              <Card
                key={item.gardenAddress}
                padding="compact"
                colorAccent="info"
                className="sm:p-5"
              >
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
                      className="truncate font-heading text-base font-semibold text-text-strong sm:text-lg"
                      title={item.garden?.name}
                    >
                      {item.garden?.name}
                    </h2>
                    <p className="truncate text-xs text-text-sub" title={item.garden?.location}>
                      {item.garden?.location}
                    </p>
                  </div>
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
