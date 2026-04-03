import {
  type Address,
  formatAddress,
  formatTokenAmount,
  getBlockExplorerAddressUrl,
  useCurrentChain,
  useVaultPreview,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Card } from "@/components/ui/Card";

export type TrackedAsset = "WETH" | "DAI";

export interface MyTrackedPosition {
  id: string;
  assetSymbol: TrackedAsset;
  gardenAddress: Address;
  gardenName: string;
  gardenLocation: string;
  vaultAddress: Address;
  shares: bigint;
  netDeposited: bigint;
}

export function MyTrackedPositionCard({
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
        : `+${formatTokenAmount(positionDelta)} ${position.assetSymbol}`;

  return (
    <Card padding="compact" className="sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-semibold text-text-strong">
            {position.gardenName}
          </p>
          <p className="truncate text-xs text-text-sub">{position.gardenLocation}</p>
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
            {formatTokenAmount(position.netDeposited)} {position.assetSymbol}
          </p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.endowments.myPositions.currentValue" })}
          </p>
          <p className="mt-1 font-medium text-text-strong">
            {isLoading ? "--" : `${formatTokenAmount(currentValue ?? 0n)} ${position.assetSymbol}`}
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
