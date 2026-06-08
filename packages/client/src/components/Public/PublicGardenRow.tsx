import {
  formatRelativeTime,
  formatTokenAmount,
  type PublicGardenSummary,
  type PublicGardenVaultSummary,
  type PublicVaultSummaryAsset,
} from "@green-goods/shared";
import type { PublicFundingIntentKind } from "@green-goods/shared/public-contracts";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";
import { EditorialGhostButton, EditorialKicker, EditorialPrimaryButton } from "./atoms";
import { GardenCoverFallback } from "./GardenCoverFallback";

export interface PublicGardenRowProps {
  garden: PublicGardenSummary;
  vaultSummary?: PublicGardenVaultSummary;
  onSupport: (garden: PublicGardenSummary, intent: PublicFundingIntentKind) => void;
}

/**
 * Aggregate garden's people count. `contributorCount` from the indexer is
 * unique addresses across Work attestations (gardeners who submitted work).
 * Operators are also gardeners (per product semantics) but may not have
 * submitted any work. Without the unique-address sets in scope, `max(...)`
 * is the safe approximation: when work exists, contributorCount typically
 * subsumes operators (operators submit work too); when work is sparse,
 * operators reflects who's involved.
 */
function aggregateGardenerCount(garden: PublicGardenSummary): number {
  return Math.max(garden.contributorCount, garden.operators.length);
}

/**
 * PublicGardenRow — compact horizontal Garden card used in the Fund-page grid.
 *
 * Anatomy: small thumbnail (left) → garden name + meta (center) → stacked
 * Donate/Endow CTAs (right). Tapping the thumbnail/title block routes to the
 * public Garden detail page; tapping a CTA opens the funding method selector
 * with that intent pre-set so the dialog skips its own intent step.
 *
 * Density tuned for funder-mode scanning (smaller padding than discovery
 * cards on /gardens) so two cards fit per desktop row at sm:grid-cols-2.
 */
export function PublicGardenRow({ garden, vaultSummary, onSupport }: PublicGardenRowProps) {
  const { formatMessage } = useIntl();
  const gardenerCount = aggregateGardenerCount(garden);
  const meta: string[] = [
    formatMessage(
      {
        id: "public.gardens.gardeners",
        defaultMessage: "{count} gardeners",
      },
      { count: gardenerCount }
    ),
    formatMessage(
      {
        id: "public.gardens.works",
        defaultMessage: "{count} entries",
      },
      { count: garden.actionCount }
    ),
  ];
  if (garden.lastActivityAt > 0) {
    meta.push(
      formatMessage(
        {
          id: "public.gardens.lastActive",
          defaultMessage: "Active {when}",
        },
        { when: formatRelativeTime(garden.lastActivityAt) }
      )
    );
  }

  return (
    <div
      role="group"
      aria-label={formatMessage(
        {
          id: "public.fund.gardenCardLabel",
          defaultMessage: "{garden} funding options",
        },
        { garden: garden.name || garden.slug }
      )}
      className="flex items-stretch gap-4 py-4 sm:gap-5"
    >
      <Link
        to={`/gardens/${garden.slug}`}
        viewTransition
        className="group flex min-w-0 flex-1 items-stretch gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-5"
        aria-label={garden.name}
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-editorial-warm">
          <ImageWithFallback
            src={garden.bannerImage}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
            backgroundFallback={<GardenCoverFallback name={garden.name} slug={garden.slug} />}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {garden.location ? (
            <EditorialKicker className="-mb-0.5">{garden.location}</EditorialKicker>
          ) : null}
          <h3
            className="font-serif text-lg font-normal leading-[1.15] tracking-[-0.012em] text-text-strong-950 group-hover:text-primary-action"
            title={garden.name}
          >
            <span className="line-clamp-2">{garden.name || garden.slug}</span>
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-soft-400">
            {meta.map((label, index) => (
              <span key={label} className="flex items-center gap-x-2">
                {index > 0 ? <span aria-hidden="true">·</span> : null}
                <span>{label}</span>
              </span>
            ))}
          </p>
          <GardenVaultMetrics summary={vaultSummary} />
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-stretch justify-center gap-3">
        <div className="flex flex-col items-stretch gap-1">
          <EditorialPrimaryButton
            onClick={() => onSupport(garden, "donate")}
            className="px-4 py-2 text-xs sm:text-sm"
            aria-describedby={`${garden.id}-donate-helper`}
          >
            {formatMessage({ id: "public.fund.dialog.donate.title", defaultMessage: "Donate" })}
          </EditorialPrimaryButton>
          <p
            id={`${garden.id}-donate-helper`}
            className="max-w-24 text-center text-[10px] leading-[1.25] text-text-soft-400"
          >
            {formatMessage({
              id: "public.fund.gardenDonateHelper",
              defaultMessage: "Shared fund support",
            })}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1">
          <EditorialGhostButton
            variant="warm"
            onClick={() => onSupport(garden, "endow")}
            className="px-4 py-2 text-xs sm:text-sm"
            aria-describedby={`${garden.id}-endow-helper`}
          >
            {formatMessage({ id: "public.fund.dialog.endow.title", defaultMessage: "Endow" })}
          </EditorialGhostButton>
          <p
            id={`${garden.id}-endow-helper`}
            className="max-w-24 text-center text-[10px] leading-[1.25] text-text-soft-400"
          >
            {formatMessage({
              id: "public.fund.gardenEndowHelper",
              defaultMessage: "Garden Vault endowment",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

function GardenVaultMetrics({ summary }: { summary?: PublicGardenVaultSummary }) {
  const { formatMessage } = useIntl();
  if (!summary?.hasVaults || summary.assets.length === 0) return null;

  const balanceLabels = summary.assets.map((asset) => formatGardenVaultAmount(asset));
  const accruedLabels = summary.assets
    .filter((asset) => asset.accruedYield !== undefined)
    .map((asset) => formatGardenVaultAmount(asset, asset.accruedYield ?? 0n));

  if (balanceLabels.length === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] leading-[1.45] text-text-sub-600">
      <span>{balanceLabels.join(" · ")}</span>
      {accruedLabels.length > 0 ? (
        <span>
          {" · "}
          {formatMessage(
            {
              id: "public.fund.gardenAccruedYield",
              defaultMessage: "Yield accrued {assets}",
            },
            { assets: accruedLabels.join(" / ") }
          )}
        </span>
      ) : null}
    </p>
  );
}

function formatGardenVaultAmount(
  asset: PublicVaultSummaryAsset,
  value = asset.currentValue
): string {
  return `${formatTokenAmount(value, asset.decimals, 4, undefined, true)} ${asset.symbol}`;
}
