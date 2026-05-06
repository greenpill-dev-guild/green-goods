import {
  type Address,
  type CampaignCookieJarCampaign,
  formatTokenAmount,
  type PublicGardenSummary,
  useCampaignCookieJar,
} from "@green-goods/shared";
import { useIntl } from "react-intl";

function formatSourceGardens(
  sourceGardens: readonly Address[],
  gardensByAddress: Map<Address, PublicGardenSummary> | undefined
): string {
  if (sourceGardens.length === 0) return "";
  const names = sourceGardens
    .map((addr) => gardensByAddress?.get(addr.toLowerCase() as Address)?.name)
    .filter((name): name is string => Boolean(name && name.trim().length > 0));
  if (names.length === 0)
    return `${sourceGardens.length} Garden${sourceGardens.length === 1 ? "" : "s"}`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

function formatDate(seconds: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(seconds * 1000);
}

export interface PublicCookieJarRowProps {
  campaign: CampaignCookieJarCampaign;
  gardensByAddress?: Map<Address, PublicGardenSummary>;
  onOpen: (campaign: CampaignCookieJarCampaign) => void;
}

/**
 * Compact past-drop list row. Used in `§ 03 — Closed drops` where density
 * matters more than visual prominence — the visitor is just confirming what
 * happened rather than triaging an active jar.
 *
 * Mirrors the `PublicGardenRow` rhythm: hairline-bordered row, name + meta
 * left, distributed amount right. Click anywhere on the row opens the same
 * `CampaignCookieJarDialog` as the active-state cards.
 */
export function PublicCookieJarRow({
  campaign,
  gardensByAddress,
  onOpen,
}: PublicCookieJarRowProps) {
  const intl = useIntl();
  const { jar } = useCampaignCookieJar(campaign.address);

  const title = jar?.metadata?.title ?? campaign.title ?? campaign.label;
  const sourceGardens = jar?.metadata?.sourceGardens ?? campaign.metadata?.sourceGardens ?? [];
  const sourceLabel = formatSourceGardens(sourceGardens, gardensByAddress);

  const distributedLabel = jar
    ? `${formatTokenAmount(jar.totalWithdrawn, jar.decimals, 4)} ${jar.symbol}`
    : "—";
  const balanceRemaining = jar?.balance ?? 0n;
  const closedReason = jar?.isPaused
    ? intl.formatMessage({ id: "public.cookies.status.pastPaused", defaultMessage: "Paused" })
    : balanceRemaining === 0n
      ? intl.formatMessage({ id: "public.cookies.status.pastEmpty", defaultMessage: "Sealed" })
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(campaign)}
      className="group flex w-full cursor-pointer items-stretch gap-4 border-t border-stroke-soft-200 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 sm:gap-6"
      aria-label={title}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <h4
          className="font-serif text-base font-normal leading-[1.2] tracking-[-0.01em] text-text-strong-950 transition-colors group-hover:text-primary-action sm:text-lg"
          title={title}
        >
          <span className="line-clamp-1">{title}</span>
        </h4>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-soft-400">
          {sourceLabel ? <span>{sourceLabel}</span> : null}
          {sourceLabel && campaign.createdAt ? <span aria-hidden="true">·</span> : null}
          {campaign.createdAt ? <span>{formatDate(campaign.createdAt, intl.locale)}</span> : null}
          {closedReason ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="italic">{closedReason}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1 text-right">
        <p className="font-serif text-base font-normal leading-none tracking-[-0.012em] text-text-strong-950 sm:text-lg">
          {distributedLabel}
        </p>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
          {intl.formatMessage({
            id: "public.cookies.row.distributed",
            defaultMessage: "Distributed",
          })}
        </p>
      </div>
    </button>
  );
}
