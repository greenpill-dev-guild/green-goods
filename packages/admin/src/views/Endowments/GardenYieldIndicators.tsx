import {
  type Address,
  type GardenVault,
  formatTokenAmount,
  getVaultAssetSymbol,
  useCurrentChain,
  useHarvestableYield,
  usePendingYield,
  useSplitConfig,
} from "@green-goods/shared";
import { useIntl } from "react-intl";

/**
 * Displays real-time harvestable yield for a garden's vaults.
 *
 * Reads `strategy.totalAssets()` (live aToken balance from Aave) and compares
 * to `vault.totalDebt()` (stale, from last harvest). The delta is yield that
 * will become garden shares when `harvest()` is called.
 */
export function GardenHarvestableYield({ vaults }: { vaults: GardenVault[] }) {
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
export function GardenPendingYield({
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
export function GardenSplitBadges({ gardenAddress }: { gardenAddress: Address }) {
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
