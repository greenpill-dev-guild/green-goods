import {
  type Address,
  type FunderLeaderboardEntry,
  formatAddress,
  formatTokenAmount,
  useEnsName,
} from "@green-goods/shared";
import { RiLeafLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface FunderRowProps {
  funder: FunderLeaderboardEntry;
  /** The top funder's yield — used to calculate proportional bar width. */
  maxYield: bigint;
}

export function FunderRow({ funder, maxYield }: FunderRowProps) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(funder.address as Address);
  const displayName = ensName || formatAddress(funder.address, { variant: "card" });

  const hasYield = funder.totalYieldGenerated > 0n;
  const barWidth =
    hasYield && maxYield > 0n ? Number((funder.totalYieldGenerated * 100n) / maxYield) : 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5">
      {/* Avatar placeholder */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-lighter text-xs font-semibold text-primary-dark">
        {(ensName ?? funder.address).charAt(0).toUpperCase()}
      </div>

      {/* Name + yield bar */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-text-strong">{displayName}</p>
          <span className="shrink-0 text-sm font-semibold text-success-dark">
            {hasYield ? `+${formatTokenAmount(funder.totalYieldGenerated)}` : formatTokenAmount(0n)}
          </span>
        </div>

        {/* Proportional yield bar */}
        {barWidth > 0 && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-soft">
            <div
              className="h-full rounded-full bg-success-base transition-all duration-300"
              style={{ width: `${Math.max(barWidth, 2)}%` }}
            />
          </div>
        )}

        {/* Garden count */}
        <div className="mt-1 flex items-center gap-1 text-xs text-text-sub">
          <RiLeafLine className="h-3 w-3" />
          <span>
            {formatMessage({ id: "app.funders.gardensSupported" }, { count: funder.gardenCount })}
          </span>
        </div>
      </div>
    </div>
  );
}
