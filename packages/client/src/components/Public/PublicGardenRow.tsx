import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { PublicGardenSummary } from "@green-goods/shared/hooks/public/usePublicGardens";
import type {
  PublicGardenVaultSummary,
  PublicVaultSummaryAsset,
} from "@green-goods/shared/hooks/public/usePublicVaultSummary";
import type { PublicFundingIntentKind } from "@green-goods/shared/public-contracts/core";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display/Image/ImageWithFallback";
import { EditorialGhostButton, EditorialMetaRow, EditorialPrimaryButton } from "./atoms";
import { GardenCoverFallback } from "./GardenCoverFallback";
import { PublicGardenMeta } from "./PublicGardenMeta";
import { getPublicGardenDescription } from "@/content/publicGardenNarrative";

export interface PublicGardenRowProps {
  garden: PublicGardenSummary;
  vaultSummary?: PublicGardenVaultSummary;
  /** The Vault catalog read failed, so the row cannot tell an endowment from none. */
  vaultsUnavailable?: boolean;
  onSupport: (garden: PublicGardenSummary, intent: PublicFundingIntentKind) => void;
}

/**
 * PublicGardenRow — compact horizontal Garden card used in the Fund-page grid.
 *
 * Anatomy: small thumbnail (left) → garden name, details, description and, when
 * the Garden has Vaults, its endowment line (center) → Donate + Endow CTAs
 * (right). Thumbnail, name and actions share one top edge. Tapping the
 * thumbnail/title block routes to the public Garden detail page; tapping a CTA
 * opens the funding card with the matching intent pre-set. The two paths are
 * explained once in the § 01 "Ways to support" section above the list, so the
 * buttons carry no per-card helper captions.
 *
 * Density tuned for funder-mode scanning (smaller padding than discovery
 * cards on /gardens) so two cards fit per desktop row at sm:grid-cols-2.
 *
 * A row narrower than 28rem (a phone, or one of two columns on a tablet) puts
 * the CTAs side by side under the text instead. Beside the text they take
 * their labels' width out of the name's column, and a longer translation
 * ("Provisionar") left the name 62px at 360px. `EditorialListRowSkeleton`
 * mirrors this row; change the two together.
 */
export function PublicGardenRow({
  garden,
  vaultSummary,
  vaultsUnavailable = false,
  onSupport,
}: PublicGardenRowProps) {
  const { formatMessage } = useIntl();
  const description = getPublicGardenDescription(garden, formatMessage);

  return (
    <div
      data-component="PublicGardenRow"
      role="group"
      aria-label={formatMessage(
        {
          id: "public.fund.gardenCardLabel",
          defaultMessage: "{garden} funding options",
        },
        { garden: garden.name || garden.slug }
      )}
      className="@container h-full min-w-0"
    >
      <div className="flex h-full min-w-0 flex-wrap content-between items-start gap-4 py-4 sm:gap-5 @[28rem]:flex-nowrap">
        <Link
          to={`/gardens/${garden.slug}`}
          viewTransition
          className="group flex min-w-0 flex-1 basis-0 items-start gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-5"
          aria-label={garden.name}
        >
          <div
            data-component="PublicGardenRowMedia"
            className="relative h-20 w-28 shrink-0 overflow-hidden bg-editorial-warm sm:h-24 sm:w-36"
          >
            <ImageWithFallback
              src={garden.bannerImage}
              alt=""
              className="h-full w-full object-cover"
              backgroundFallback={
                <GardenCoverFallback
                  name={garden.name}
                  slug={garden.slug}
                  initialClassName="text-3xl tracking-[-0.025em] sm:text-4xl lg:text-4xl"
                />
              }
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h3
              className="min-w-0 font-serif text-lg font-normal leading-[1.15] tracking-[-0.012em] text-text-strong-950 group-hover:text-primary-action"
              title={garden.name}
            >
              <span className="line-clamp-2 [overflow-wrap:anywhere]">
                {garden.name || garden.slug}
              </span>
            </h3>
            <PublicGardenMeta garden={garden} />
            {description ? (
              // The height cap matches the clamp: without it the grid sizes the
              // row from the unclamped text and the slack lands above the actions.
              <p
                className="line-clamp-3 max-h-[3lh] text-xs leading-relaxed text-text-sub-600"
                title={description}
              >
                {description}
              </p>
            ) : null}
            <GardenVaultMetrics summary={vaultSummary} unavailable={vaultsUnavailable} />
          </div>
        </Link>

        <div className="flex basis-full flex-row items-stretch gap-3 @[28rem]:shrink-0 @[28rem]:basis-auto @[28rem]:flex-col">
          <EditorialPrimaryButton
            size="sm"
            className="flex-1 @[28rem]:flex-none"
            onClick={() => onSupport(garden, "donate")}
          >
            {formatMessage({ id: "public.fund.dialog.donate.title", defaultMessage: "Donate" })}
          </EditorialPrimaryButton>
          <EditorialGhostButton
            variant="warm"
            size="sm"
            className="flex-1 @[28rem]:flex-none"
            onClick={() => onSupport(garden, "endow")}
          >
            {formatMessage({ id: "public.fund.dialog.endow.title", defaultMessage: "Endow" })}
          </EditorialGhostButton>
        </div>
      </div>
    </div>
  );
}

/**
 * The Garden's endowment in its Vaults, shown in the row itself rather than behind a
 * toggle. Only assets that hold something are listed, and yield only once some has
 * accrued; Vaults that hold nothing yet say so in words instead of a row of zeros.
 */
function GardenVaultMetrics({
  summary,
  unavailable,
}: {
  summary?: PublicGardenVaultSummary;
  unavailable: boolean;
}) {
  const { formatMessage } = useIntl();
  const assets = summary?.hasVaults ? summary.assets : [];
  // A Garden without Vaults leaves the line out; a failed read says so instead of vanishing.
  if (assets.length === 0 && !unavailable) return null;

  const items = assets
    .filter((asset) => asset.currentValue > 0n)
    .map((asset) => ({ label: formatGardenVaultAmount(asset) }));
  const accruedLabels = assets
    .filter((asset) => (asset.accruedYield ?? 0n) > 0n)
    .map((asset) => formatGardenVaultAmount(asset, asset.accruedYield ?? 0n));
  if (accruedLabels.length > 0) {
    items.push({
      label: formatMessage(
        {
          id: "public.fund.gardenAccruedYield",
          defaultMessage: "Yield accrued {assets}",
        },
        { assets: accruedLabels.join(" / ") }
      ),
    });
  }
  if (items.length === 0) {
    items.push({
      label:
        assets.length > 0
          ? formatMessage({ id: "public.fund.gardenEndowmentNone", defaultMessage: "None yet" })
          : formatMessage({
              id: "public.fund.gardenEndowmentUnavailable",
              defaultMessage: "Not available right now",
            }),
    });
  }

  return (
    <div className="flex min-w-0 items-baseline gap-3 pt-0.5">
      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({ id: "public.fund.gardenEndowmentLabel", defaultMessage: "Endowment" })}
      </span>
      <EditorialMetaRow items={items} className="min-w-0 text-text-sub-600" />
    </div>
  );
}

function formatGardenVaultAmount(
  asset: PublicVaultSummaryAsset,
  value = asset.currentValue
): string {
  return `${formatTokenAmount(value, asset.decimals, 4, undefined, true)} ${asset.symbol}`;
}
