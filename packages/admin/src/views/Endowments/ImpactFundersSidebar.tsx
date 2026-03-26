import { useFunderLeaderboard } from "@green-goods/shared";
import { RiArrowRightLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { FunderRow } from "@/components/Vault/FunderRow";
import { formatFunderAssetTotals } from "@/components/Vault/funderTotals";
import { ImpactFundersDialog } from "./ImpactFundersDialog";

const PREVIEW_COUNT = 3;

export function ImpactFundersSidebar() {
  const { formatMessage } = useIntl();
  const { funders, protocolAssetTotals, isLoading } = useFunderLeaderboard();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
        <div className="h-5 w-32 rounded skeleton-shimmer" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (funders.length === 0) return null;

  const previewFunders = funders.slice(0, PREVIEW_COUNT);
  const maxYield = funders[0]?.totalYieldGenerated ?? 0n;
  const hasMore = funders.length > PREVIEW_COUNT;
  const protocolYieldLabel = formatFunderAssetTotals(protocolAssetTotals);
  const showYieldBar = protocolAssetTotals.length === 1;

  return (
    <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-base font-semibold text-text-strong">
          {formatMessage({ id: "app.funders.impactFundersTitle" })}
        </h3>
        {protocolYieldLabel !== "0" && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2 py-0.5 text-[10px] font-semibold text-success-dark">
            {formatMessage({ id: "app.funders.yieldGenerated" }, { amount: protocolYieldLabel })}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-text-sub">
        {formatMessage({ id: "app.funders.impactFundersSubtitle" })}
      </p>

      <div className="mt-3 space-y-2">
        {previewFunders.map((funder) => (
          <FunderRow
            key={funder.address}
            funder={funder}
            maxYield={maxYield}
            showYieldBar={showYieldBar}
          />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-stroke-soft py-2 text-xs font-medium text-text-sub transition-colors hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.funders.viewAll" }, { count: funders.length })}
          <RiArrowRightLine className="h-3.5 w-3.5" />
        </button>
      )}

      <ImpactFundersDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        funders={funders}
        protocolAssetTotals={protocolAssetTotals}
      />
    </section>
  );
}
