import {
  formatTokenAmount,
  getNetDeposited,
  getVaultAssetSymbol,
  useGardenVaults,
  useGardens,
} from "@green-goods/shared";
import { RiArrowRightLine, RiSafe2Line } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

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
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.totalValueLocked" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">
              {formatTokenAmount(totalTVL)}
            </p>
          </div>
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.totalHarvests" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">{totalHarvests}</p>
          </div>
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.treasury.gardensWithVaults" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">{grouped.length}</p>
          </div>
        </section>

        {isLoading && (
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.treasury.loadingVaults" })}
          </p>
        )}

        {!isLoading && grouped.length === 0 && (
          <div className="rounded-lg border border-stroke-soft bg-bg-white py-16 text-center">
            <RiSafe2Line className="mx-auto h-12 w-12 text-text-disabled" />
            <h3 className="mt-2 text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.treasury.noVault" })}
            </h3>
            <p className="mt-1 text-sm text-text-soft">
              {formatMessage({ id: "app.treasury.noVaultDescription" })}
            </p>
          </div>
        )}

        {!isLoading && grouped.length > 0 && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {grouped.map((item) => (
              <article
                key={item.gardenAddress}
                className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-text-strong sm:text-lg">
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
                    <Link
                      to={`/gardens/${item.garden.id}/vault`}
                      className="inline-flex items-center gap-1 rounded-md border border-stroke-sub bg-bg-white px-3 py-1.5 text-sm font-medium text-text-sub hover:bg-bg-weak"
                    >
                      {formatMessage({ id: "app.treasury.manageVault" })}
                      <RiArrowRightLine className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
