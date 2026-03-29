import {
  AAVE_V3_POOL,
  type Address,
  formatAddress,
  formatApy,
  formatTokenAmount,
  getBlockExplorerAddressUrl,
  getNetDeposited,
  getNetworkContracts,
  getVaultAssetSymbol,
  type GardenVault,
  ImageWithFallback,
  isZeroAddress,
  useCurrentChain,
  useGardens,
  useGardenVaults,
  useMyVaultDeposits,
  useHarvestableYield,
  usePendingYield,
  useProtocolYieldSummary,
  useSplitConfig,
  useStrategyRate,
  useUrlFilters,
  useUser,
  useVaultPreview,
  ZERO_ADDRESS,
} from "@green-goods/shared";
import {
  RiArrowRightLine,
  RiExternalLinkLine,
  RiLeafLine,
  RiMoneyDollarCircleLine,
  RiPlantLine,
  RiSafe2Line,
} from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { ImpactFunders } from "@/components/Vault";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { SortSelect } from "@/components/ui/SortSelect";

function AssetApyCard({ assetAddress, chainId }: { assetAddress: Address; chainId: number }) {
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

type EndowmentsSortOrder = "name" | "tvl";
type TrackedAsset = "WETH" | "DAI";

interface MyTrackedPosition {
  id: string;
  assetSymbol: TrackedAsset;
  gardenAddress: Address;
  gardenName: string;
  gardenLocation: string;
  vaultAddress: Address;
  shares: bigint;
  netDeposited: bigint;
}

function MyTrackedPositionCard({
  position,
  userAddress,
}: {
  position: MyTrackedPosition;
  userAddress: Address;
}) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { preview, isLoading } = useVaultPreview({
    vaultAddress: position.vaultAddress,
    shares: position.shares,
    userAddress,
    enabled: Boolean(userAddress),
  });

  const currentValue = preview?.previewAssets;
  const rawDelta = typeof currentValue === "bigint" ? currentValue - position.netDeposited : null;

  // Clamp negative deltas to zero — these vaults deploy to Aave V3 lending where
  // genuine losses are extremely unlikely. Negatives are ERC-4626 rounding artifacts
  // or profit unlock timing. Showing red/negative values creates false alarm.
  const positionDelta = rawDelta !== null && rawDelta < 0n ? 0n : rawDelta;

  const yieldToneClass =
    positionDelta === null
      ? "text-text-soft"
      : positionDelta > 0n
        ? "text-success-dark"
        : "text-text-strong";
  const yieldDisplay =
    positionDelta === null
      ? "--"
      : positionDelta === 0n
        ? `0 ${position.assetSymbol}`
        : `+${formatTokenAmount(positionDelta, 18, 2)} ${position.assetSymbol}`;

  return (
    <Card padding="compact" className="sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="line-clamp-2 break-words font-heading text-base font-semibold text-text-strong"
            title={position.gardenName}
          >
            {position.gardenName}
          </p>
          <p
            className="line-clamp-2 break-words text-xs text-text-sub"
            title={position.gardenLocation}
          >
            {position.gardenLocation}
          </p>
          <a
            href={getBlockExplorerAddressUrl(chainId, position.vaultAddress)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-primary-base hover:underline"
          >
            {formatMessage({ id: "app.endowments.myPositions.vault" })}:{" "}
            {formatAddress(position.vaultAddress, { variant: "card" })}
          </a>
        </div>
        <span className="inline-flex items-center rounded-full bg-primary-lighter px-2 py-1 text-xs font-semibold text-primary-dark">
          {position.assetSymbol}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.endowments.myPositions.netDeposited" })}
          </p>
          <p className="mt-1 font-medium text-text-strong">
            {formatTokenAmount(position.netDeposited, 18, 2)} {position.assetSymbol}
          </p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.endowments.myPositions.currentValue" })}
          </p>
          <p className="mt-1 font-medium text-text-strong">
            {isLoading
              ? "--"
              : `${formatTokenAmount(currentValue ?? 0n, 18, 2)} ${position.assetSymbol}`}
          </p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.endowments.myPositions.yieldGenerated" })}
          </p>
          <p className={`mt-1 font-medium ${yieldToneClass}`}>{yieldDisplay}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Displays real-time harvestable yield for a garden's vaults.
 *
 * Reads `strategy.totalAssets()` (live aToken balance from Aave) and compares
 * to `vault.totalDebt()` (stale, from last harvest). The delta is yield that
 * will become garden shares when `harvest()` is called.
 */
function GardenHarvestableYield({ vaults }: { vaults: GardenVault[] }) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { entries, total, isLoading } = useHarvestableYield(vaults);

  if (isLoading || total === 0n) return null;

  return (
    <div className="mt-1 space-y-1">
      {entries
        .filter((e) => e.harvestable > 0n)
        .map((e) => {
          const symbol = getVaultAssetSymbol(e.assetAddress, chainId);
          return (
            <div
              key={e.vaultAddress}
              className="flex items-center justify-between rounded-md border border-success-light bg-success-lighter px-3 py-1.5 text-xs"
            >
              <span className="text-success-dark">
                {formatMessage({
                  id: "app.endowments.harvestableYield",
                  defaultMessage: "Harvestable yield",
                })}{" "}
                ({symbol})
              </span>
              <span className="font-medium tabular-nums text-success-dark">
                +{formatTokenAmount(e.harvestable, 18, 2)} {symbol}
              </span>
            </div>
          );
        })}
    </div>
  );
}

/** Displays pending yield for a garden (yield below threshold, waiting to accumulate) */
function GardenPendingYield({
  gardenAddress,
  assetAddresses,
}: {
  gardenAddress: Address;
  assetAddresses: Address[];
}) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { entries, totalPending, isLoading } = usePendingYield(gardenAddress, assetAddresses, {
    enabled: assetAddresses.length > 0,
  });

  if (isLoading || totalPending === 0n) return null;

  return (
    <div className="rounded-md border border-warning-light bg-warning-lighter px-3 py-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-warning-dark">
          {formatMessage({
            id: "app.endowments.pendingYield",
            defaultMessage: "Pending yield (below threshold)",
          })}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {entries
          .filter((e) => e.amount > 0n)
          .map((e) => (
            <span key={e.assetAddress} className="font-medium tabular-nums text-warning-dark">
              {formatTokenAmount(e.amount, 18, 2)} {getVaultAssetSymbol(e.assetAddress, chainId)}
            </span>
          ))}
      </div>
    </div>
  );
}

/** Displays the three-way yield split configuration for a garden */
function GardenSplitBadges({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const { config, isLoading } = useSplitConfig(gardenAddress);

  if (isLoading) return null;

  const bpsToPercent = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;

  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className="rounded-full bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium text-text-sub"
        title={formatMessage({
          id: "app.endowments.split.cookieJar",
          defaultMessage: "Gardener compensation",
        })}
      >
        {formatMessage({ id: "app.yield.cookieJar", defaultMessage: "Cookie Jar" })}{" "}
        {bpsToPercent(config.cookieJarBps)}
      </span>
      <span
        className="rounded-full bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium text-text-sub"
        title={formatMessage({
          id: "app.endowments.split.fractions",
          defaultMessage: "Hypercert fraction purchases",
        })}
      >
        {formatMessage({ id: "app.yield.fractions", defaultMessage: "Fractions" })}{" "}
        {bpsToPercent(config.fractionsBps)}
      </span>
      <span
        className="rounded-full bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium text-text-sub"
        title={formatMessage({
          id: "app.endowments.split.juicebox",
          defaultMessage: "GOODS token treasury backing",
        })}
      >
        {formatMessage({ id: "app.yield.treasury", defaultMessage: "Treasury" })}{" "}
        {bpsToPercent(config.juiceboxBps)}
      </span>
    </div>
  );
}

const ENDOWMENT_FILTER_DEFAULTS: Record<string, string | undefined> = {
  search: undefined,
  sort: "name",
};

export default function EndowmentsOverview() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const { vaults, isLoading: vaultsLoading } = useGardenVaults(undefined, { enabled: true });
  const { primaryAddress } = useUser();
  const userAddress = (primaryAddress ?? undefined) as Address | undefined;
  const { deposits: myDeposits, isLoading: myDepositsLoading } = useMyVaultDeposits(userAddress, {
    enabled: Boolean(userAddress),
  });

  const { summary: yieldSummary, isLoading: yieldLoading } = useProtocolYieldSummary();
  const endowmentsChainId = useCurrentChain();
  const contracts = getNetworkContracts(endowmentsChainId);
  const aavePool = AAVE_V3_POOL[endowmentsChainId];

  const { filters: urlFilters, setFilter, resetFilters } = useUrlFilters(ENDOWMENT_FILTER_DEFAULTS);
  const search = urlFilters.search ?? "";
  const sortOrder = (urlFilters.sort ?? "name") as EndowmentsSortOrder;

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
    if (search) {
      const term = search.toLowerCase();
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
  }, [grouped, search, sortOrder]);

  const isFilterActive = !!search || sortOrder !== "name";

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
  const uniqueAssetAddresses = useMemo(() => {
    const seen = new Set<string>();
    const result: Address[] = [];
    for (const vault of vaults) {
      const key = vault.asset.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(vault.asset);
      }
    }
    return result;
  }, [vaults]);
  const isLoading = gardensLoading || vaultsLoading;
  const isMyPositionsLoading = isLoading || myDepositsLoading;
  const gardenByAddress = useMemo(
    () => new Map(gardens.map((garden) => [garden.id.toLowerCase(), garden] as const)),
    [gardens]
  );
  const vaultByPositionKey = useMemo(() => {
    const map = new Map<string, (typeof vaults)[number]>();
    for (const vault of vaults) {
      map.set(`${vault.garden}:${vault.asset}:${vault.vaultAddress}`.toLowerCase(), vault);
    }
    return map;
  }, [vaults]);

  const myTrackedPositions = useMemo(() => {
    const positions: MyTrackedPosition[] = [];

    for (const deposit of myDeposits) {
      const symbol = getVaultAssetSymbol(deposit.asset, deposit.chainId).toUpperCase();
      const trackedSymbol: TrackedAsset | null =
        symbol === "WETH" || symbol === "ETH" ? "WETH" : symbol === "DAI" ? "DAI" : null;

      if (!trackedSymbol) continue;

      const key = `${deposit.garden}:${deposit.asset}:${deposit.vaultAddress}`.toLowerCase();
      const matchedVault = vaultByPositionKey.get(key);
      const netDeposited = getNetDeposited(deposit.totalDeposited, deposit.totalWithdrawn);

      if (!matchedVault && netDeposited <= 0n && deposit.shares <= 0n) continue;

      const garden = gardenByAddress.get(deposit.garden.toLowerCase());
      positions.push({
        id: deposit.id,
        assetSymbol: trackedSymbol,
        gardenAddress: deposit.garden,
        gardenName: garden?.name || formatAddress(deposit.garden, { variant: "card" }),
        gardenLocation: garden?.location || formatMessage({ id: "app.treasury.none" }),
        vaultAddress: deposit.vaultAddress,
        shares: deposit.shares,
        netDeposited,
      });
    }

    // Sort ETH/WETH first (more natural for crypto UX), then DAI, then by TVL
    return positions.sort((a, b) => {
      if (a.assetSymbol !== b.assetSymbol) {
        if (a.assetSymbol === "WETH") return -1;
        if (b.assetSymbol === "WETH") return 1;
        return a.assetSymbol.localeCompare(b.assetSymbol);
      }
      if (b.netDeposited > a.netDeposited) return 1;
      if (b.netDeposited < a.netDeposited) return -1;
      return a.gardenName.localeCompare(b.gardenName);
    });
  }, [myDeposits, vaultByPositionKey, gardenByAddress, formatMessage]);

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
              onSearchChange={(value) => setFilter("search", value || undefined)}
              searchPlaceholder={formatMessage({ id: "app.treasury.searchPlaceholder" })}
            >
              <SortSelect
                value={sortOrder}
                onChange={(value) => setFilter("sort", value)}
                options={sortOptions}
                aria-label={formatMessage({ id: "app.home.filters.sortTitle" })}
              />
            </ListToolbar>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-6 px-4 sm:px-6">
        <div className="space-y-3">
          <h2 className="font-heading text-base font-semibold text-text-strong">
            {formatMessage({
              id: "app.endowments.section.overview",
              defaultMessage: "Protocol Overview",
            })}
          </h2>
          <section className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={<RiMoneyDollarCircleLine className="h-5 w-5" />}
              label={formatMessage({ id: "app.treasury.totalValueLocked" })}
              value={
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span>{formatTokenAmount(tvlByAsset.totalEth, 18, 2)} ETH</span>
                  <span className="text-text-soft">·</span>
                  <span>{formatTokenAmount(tvlByAsset.totalDai, 18, 2)} DAI</span>
                </span>
              }
              colorScheme="info"
            />
            {uniqueAssetAddresses.map((assetAddress) => (
              <AssetApyCard
                key={assetAddress}
                assetAddress={assetAddress}
                chainId={endowmentsChainId}
              />
            ))}
          </section>
        </div>

        {!yieldLoading && yieldSummary.allocationCount > 0 && (
          <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-heading text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.yield.protocolBreakdown" })}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-bg-weak p-3 text-center">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.yield.cumulativeCookieJar" })}
                </p>
                <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
                  {formatTokenAmount(yieldSummary.totalCookieJar, 18, 2)}
                </p>
              </div>
              <div className="rounded-lg bg-bg-weak p-3 text-center">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.yield.cumulativeFractions" })}
                </p>
                <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
                  {formatTokenAmount(yieldSummary.totalFractions, 18, 2)}
                </p>
              </div>
              <div className="rounded-lg bg-bg-weak p-3 text-center">
                <p className="label-xs text-text-soft">
                  {formatMessage({ id: "app.yield.cumulativeJuicebox" })}
                </p>
                <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
                  {formatTokenAmount(yieldSummary.totalJuicebox, 18, 2)}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-stroke-soft pt-3">
              <p className="label-xs text-text-soft">
                {formatMessage({ id: "app.explorer.verifyContracts" })}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {!isZeroAddress(contracts.octantModule) && (
                  <a
                    href={getBlockExplorerAddressUrl(endowmentsChainId, contracts.octantModule)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-base hover:underline"
                  >
                    {formatMessage({ id: "app.explorer.vaultRegistry" })}
                    <RiExternalLinkLine className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
                {!isZeroAddress(contracts.yieldSplitter) && (
                  <a
                    href={getBlockExplorerAddressUrl(endowmentsChainId, contracts.yieldSplitter)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-base hover:underline"
                  >
                    {formatMessage({ id: "app.explorer.yieldSplitter" })}
                    <RiExternalLinkLine className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
                {aavePool && (
                  <a
                    href={getBlockExplorerAddressUrl(endowmentsChainId, aavePool)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary-base hover:underline"
                  >
                    {formatMessage({ id: "app.explorer.aavePool" })}
                    <RiExternalLinkLine className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="space-y-3">
          <h2 className="font-heading text-base font-semibold text-text-strong">
            {formatMessage({
              id: "app.endowments.section.funders",
              defaultMessage: "Impact Funders",
            })}
          </h2>
          <ImpactFunders />
        </div>

        <section className="space-y-3 rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-text-strong">
                {formatMessage({ id: "app.endowments.myPositions.title" })}
              </h2>
              <p className="text-sm text-text-sub">
                {formatMessage({ id: "app.endowments.myPositions.description" })}
              </p>
              <p className="mt-2 text-xs text-text-soft">
                {formatMessage({
                  id: "app.endowments.myPositions.flatPpsHelper",
                  defaultMessage:
                    "Yield is generated through DeFi lending strategies. Values update in real time.",
                })}
              </p>
            </div>
          </div>

          {!userAddress && (
            <p className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub">
              {formatMessage({ id: "app.endowments.myPositions.connectWallet" })}
            </p>
          )}

          {userAddress && isMyPositionsLoading && (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-md border border-stroke-soft skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          )}

          {userAddress && !isMyPositionsLoading && myTrackedPositions.length === 0 && (
            <p className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-sm text-text-sub">
              {formatMessage({ id: "app.endowments.myPositions.empty" })}
            </p>
          )}

          {userAddress && !isMyPositionsLoading && myTrackedPositions.length > 0 && (
            <div className="space-y-3">
              {myTrackedPositions.map((position) => (
                <MyTrackedPositionCard
                  key={position.id}
                  position={position}
                  userAddress={userAddress}
                />
              ))}
            </div>
          )}
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
          <>
            <div className="space-y-3">
              <h2 className="font-heading text-base font-semibold text-text-strong">
                {formatMessage({
                  id: "app.endowments.section.vaults",
                  defaultMessage: "Garden Vaults",
                })}
              </h2>
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
                ))}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
