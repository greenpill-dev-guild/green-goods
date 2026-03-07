import {
  type Address,
  getNetDeposited,
  getVaultAssetSymbol,
  getVaultAssetDecimals,
  useDebouncedValue,
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
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { useReadContracts } from "wagmi";
import { Button } from "@/components/ui/Button";
import {
  buildAssetTotals,
  formatAssetTotal,
  getAssetTotalKey,
} from "@/components/Vault/assetTotals";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SortSelect } from "@/components/ui/SortSelect";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";

type TreasurySortOrder = "name" | "tvl";

const TOKEN_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export default function TreasuryOverview() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { vaults, isLoading: vaultsLoading } = useGardenVaults(undefined, { enabled: true });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortOrder, setSortOrder] = useState<TreasurySortOrder>("name");

  const assetAddresses = useMemo(() => {
    const uniqueAssets = new Map<string, Address>();

    for (const vault of vaults) {
      uniqueAssets.set(getAssetTotalKey(vault.chainId, vault.asset), vault.asset);
    }

    return Array.from(uniqueAssets.entries()).map(([key, address]) => ({ key, address }));
  }, [vaults]);

  const { data: assetDecimalsResults } = useReadContracts({
    contracts: assetAddresses.map(({ address }) => ({
      address,
      abi: TOKEN_DECIMALS_ABI,
      functionName: "decimals" as const,
    })),
    query: {
      enabled: assetAddresses.length > 0,
    },
  });

  const assetDecimalsByKey = useMemo(() => {
    const decimals = new Map<string, number>();

    assetAddresses.forEach(({ key, address }, index) => {
      const result = assetDecimalsResults?.[index];
      const resolved =
        result?.status === "success" && typeof result.result === "number"
          ? result.result
          : getVaultAssetDecimals(address, undefined);

      decimals.set(key, resolved);
    });

    return decimals;
  }, [assetAddresses, assetDecimalsResults]);

  const totalAssetTotals = useMemo(
    () =>
      buildAssetTotals(
        vaults.map((vault) => ({
          chainId: vault.chainId,
          assetAddress: vault.asset,
          amount: getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
          decimals:
            assetDecimalsByKey.get(getAssetTotalKey(vault.chainId, vault.asset)) ??
            getVaultAssetDecimals(vault.asset, vault.chainId),
          symbol: getVaultAssetSymbol(vault.asset, vault.chainId),
        }))
      ),
    [assetDecimalsByKey, vaults]
  );
  const canSortByTvl = totalAssetTotals.length === 1;

  useEffect(() => {
    if (!canSortByTvl && sortOrder === "tvl") {
      setSortOrder("name");
    }
  }, [canSortByTvl, sortOrder]);

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
          assetTotals: buildAssetTotals(
            gardenVaults.map((vault) => ({
              chainId: vault.chainId,
              assetAddress: vault.asset,
              amount: getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
              decimals:
                assetDecimalsByKey.get(getAssetTotalKey(vault.chainId, vault.asset)) ??
                getVaultAssetDecimals(vault.asset, vault.chainId),
              symbol: getVaultAssetSymbol(vault.asset, vault.chainId),
            }))
          ),
          sortableTvlAmount:
            gardenVaults.length > 0 && canSortByTvl
              ? gardenVaults.reduce(
                  (sum, vault) => sum + getNetDeposited(vault.totalDeposited, vault.totalWithdrawn),
                  0n
                )
              : 0n,
          harvestCount: gardenVaults.reduce((sum, vault) => sum + vault.totalHarvestCount, 0),
        };
      })
      .filter((item) => item.garden);
  }, [canSortByTvl, gardens, assetDecimalsByKey, vaults]);

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
    if (sortOrder === "tvl" && canSortByTvl) {
      return [...working].sort((a, b) => {
        if (b.sortableTvlAmount > a.sortableTvlAmount) return 1;
        if (b.sortableTvlAmount < a.sortableTvlAmount) return -1;
        return 0;
      });
    }
    return [...working].sort((a, b) => (a.garden?.name ?? "").localeCompare(b.garden?.name ?? ""));
  }, [canSortByTvl, grouped, debouncedSearch, sortOrder]);

  const isFilterActive = !!debouncedSearch || sortOrder !== "name";

  const resetFilters = () => {
    setSearch("");
    setSortOrder("name");
  };
  const totalHarvests = useMemo(
    () => grouped.reduce((sum, item) => sum + item.harvestCount, 0),
    [grouped]
  );

  const isLoading = gardensLoading || vaultsLoading;

  const sortOptions: { value: TreasurySortOrder; label: string }[] = canSortByTvl
    ? [
        { value: "name", label: formatMessage({ id: "app.treasury.sort.name" }) },
        { value: "tvl", label: formatMessage({ id: "app.treasury.sort.tvl" }) },
      ]
    : [{ value: "name", label: formatMessage({ id: "app.treasury.sort.name" }) }];

  const totalTvlLabel =
    totalAssetTotals.length > 0
      ? totalAssetTotals.map((total) => formatAssetTotal(total)).join(" / ")
      : "0";

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
            value={totalTvlLabel}
            titleText={totalTvlLabel}
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
                <div className="mb-4">
                  <h2 className="font-heading text-base font-semibold text-text-strong sm:text-lg">
                    {item.garden?.name}
                  </h2>
                  <p className="text-xs text-text-sub">{item.garden?.location}</p>
                </div>

                <div className="space-y-2">
                  {item.assetTotals.map((total) => (
                    <div
                      key={total.key}
                      className="flex items-center justify-between rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-text-sub">{total.symbol}</span>
                      <span className="text-text-strong">{formatAssetTotal(total)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-text-soft">
                    {formatMessage({ id: "app.treasury.harvestCount" })}: {item.harvestCount}
                  </p>
                  {item.garden && (
                    <Button variant="secondary" size="sm" asChild>
                      <Link
                        to={`/gardens/${item.garden.id}/vault`}
                        state={{ returnTo: "/endowments", returnLabelId: "app.admin.nav.treasury" }}
                      >
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
