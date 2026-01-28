import {
  DEFAULT_CHAIN_ID,
  ImageWithFallback,
  type AllowlistEntry,
  type HypercertMetadata,
  type MintingState,
  copyToClipboard,
} from "@green-goods/shared";
import { cn } from "@green-goods/shared/utils";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { DistributionChart } from "../DistributionChart";

interface HypercertPreviewProps {
  metadata: HypercertMetadata | null;
  gardenName: string;
  attestationCount: number;
  totalUnits: bigint;
  allowlist?: AllowlistEntry[];
  mintingState?: MintingState;
  chainId?: number;
  /** Called when user clicks "Edit" to navigate back to metadata step */
  onEditMetadata?: () => void;
  /** Called when user clicks "Edit" to navigate back to distribution step */
  onEditDistribution?: () => void;
}

/** Reusable section header with optional edit button */
function SectionHeader({ labelId, onEdit }: { labelId: string; onEdit?: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-wide text-text-soft">
        {formatMessage({ id: labelId })}
      </p>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-primary-base hover:underline"
        >
          {formatMessage({ id: "app.hypercerts.preview.edit" })}
        </button>
      )}
    </div>
  );
}

/** Displays truncated Ethereum address with copy button */
function TruncatedAddress({ address }: { address: string }) {
  const { formatMessage } = useIntl();
  const [copied, setCopied] = useState(false);

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span title={address} className="font-mono text-xs">
        {truncated}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-0.5 text-text-sub transition hover:bg-bg-weak hover:text-text-strong focus:outline-none focus:ring-1 focus:ring-primary-light"
        aria-label={formatMessage({ id: "app.common.copyAddress" })}
      >
        {copied ? (
          <RiCheckLine className="h-3 w-3 text-success-base" />
        ) : (
          <RiFileCopyLine className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}

export function HypercertPreview({
  metadata,
  gardenName,
  attestationCount,
  totalUnits,
  allowlist = [],
  mintingState,
  chainId: _chainId = DEFAULT_CHAIN_ID,
  onEditMetadata,
  onEditDistribution,
}: HypercertPreviewProps) {
  const { formatMessage } = useIntl();

  // Minting progress is now shown in a dialog overlay (MintingDialog)
  // rather than replacing this preview component
  const isMinting =
    mintingState &&
    mintingState.status !== "idle" &&
    mintingState.status !== "confirmed" &&
    mintingState.status !== "failed";

  if (!metadata) {
    return (
      <div className="rounded-lg border border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
        {formatMessage({ id: "app.hypercerts.preview.empty" })}
      </div>
    );
  }

  const workTimeframe = metadata.hypercert.work_timeframe.display_value ?? "";
  const impactTimeframe = metadata.hypercert.impact_timeframe.display_value ?? "";

  return (
    <div className={cn("space-y-6", isMinting && "pointer-events-none opacity-60")}>
      {/* Hypercert Card Preview and Details */}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-stroke-soft bg-bg-white shadow-sm">
          <div className="relative aspect-square bg-bg-weak">
            <ImageWithFallback
              src={metadata.image}
              alt={
                metadata.name ||
                formatMessage({
                  id: "app.hypercerts.preview.imageAlt",
                  defaultMessage: "Hypercert image",
                })
              }
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full"
            />
          </div>
          <div className="space-y-2 p-4">
            <h3 className="text-base font-semibold text-text-strong">{metadata.name}</h3>
            <p className="text-sm text-text-sub">{metadata.description}</p>
            <div className="text-xs text-text-sub">
              {formatMessage(
                { id: "app.hypercerts.preview.attestationCount" },
                { count: attestationCount }
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-soft">
              {formatMessage({ id: "app.hypercerts.preview.garden" })}
            </p>
            <p className="text-sm font-medium text-text-strong">{gardenName}</p>
          </div>
          <div>
            <SectionHeader labelId="app.hypercerts.preview.workScope" onEdit={onEditMetadata} />
            <p className="text-sm text-text-strong">
              {metadata.hypercert.work_scope.value.join(", ")}
            </p>
          </div>
          <div>
            <SectionHeader labelId="app.hypercerts.preview.impactScope" onEdit={onEditMetadata} />
            <p className="text-sm text-text-strong">
              {metadata.hypercert.impact_scope.value.join(", ")}
            </p>
          </div>
          <div className="grid gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-soft">
                {formatMessage({ id: "app.hypercerts.preview.workTimeframe" })}
              </p>
              <p className="text-sm text-text-strong">{workTimeframe}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-soft">
                {formatMessage({ id: "app.hypercerts.preview.impactTimeframe" })}
              </p>
              <p className={cn("text-sm text-text-strong", !impactTimeframe && "text-text-sub")}>
                {impactTimeframe || formatMessage({ id: "app.hypercerts.preview.indefinite" })}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-text-soft">
              {formatMessage({ id: "app.hypercerts.preview.totalUnits" })}
            </p>
            <p className="text-sm text-text-strong">{totalUnits.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Distribution Section */}
      {allowlist.length > 0 && (
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
          <SectionHeader
            labelId="app.hypercerts.preview.distribution"
            onEdit={onEditDistribution}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
            {/* Pie Chart */}
            <div className="flex justify-center">
              <DistributionChart allowlist={allowlist} totalUnits={totalUnits} size={160} />
            </div>

            {/* Allowlist Table */}
            <div className="overflow-x-auto">
              <div className="grid min-w-[300px] gap-2 border-b border-stroke-soft bg-bg-weak px-3 py-2 text-xs font-medium text-text-sub grid-cols-[minmax(100px,2fr)_minmax(70px,1fr)_minmax(50px,1fr)]">
                <span>{formatMessage({ id: "app.hypercerts.distribution.table.recipient" })}</span>
                <span>{formatMessage({ id: "app.hypercerts.distribution.table.units" })}</span>
                <span>{formatMessage({ id: "app.hypercerts.distribution.table.percent" })}</span>
              </div>
              <div className="max-h-48 divide-y divide-stroke-soft overflow-y-auto">
                {allowlist.map((entry, index) => {
                  const percent =
                    totalUnits > 0n ? Number((entry.units * 10000n) / totalUnits) / 100 : 0;
                  return (
                    <div
                      key={`${entry.address}-${index}`}
                      className="grid min-w-[300px] items-center gap-2 px-3 py-2 text-sm grid-cols-[minmax(100px,2fr)_minmax(70px,1fr)_minmax(50px,1fr)]"
                    >
                      <div>
                        <TruncatedAddress address={entry.address} />
                        {entry.label && <p className="text-xs text-text-sub">{entry.label}</p>}
                      </div>
                      <span className="text-xs">{entry.units.toLocaleString()}</span>
                      <span className="text-xs text-text-sub">{percent.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
