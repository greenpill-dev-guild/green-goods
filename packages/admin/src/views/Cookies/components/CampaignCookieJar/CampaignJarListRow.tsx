import { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import type { Garden } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";
import { formatCampaignDate, formatSourceGardens } from "./helpers";

export function CampaignJarListRow({
  campaign,
  gardensByAddress,
  onSelect,
}: {
  campaign: CampaignCookieJarCampaign;
  gardensByAddress: Map<string, Garden>;
  onSelect: (campaign: CampaignCookieJarCampaign) => void;
}) {
  const { formatMessage, locale } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(campaign.address);
  const metadata = jar?.metadata ?? campaign.metadata;
  const title = metadata?.title ?? campaign.title ?? campaign.label;
  const description = metadata?.description;
  const sourceLabel = formatSourceGardens(metadata?.sourceGardens ?? [], gardensByAddress);
  const dateLabel = formatCampaignDate(campaign.createdAt, locale);
  const image = metadata?.image ? resolveIPFSUrl(metadata.image) : null;
  const balanceLabel = jar
    ? `${formatTokenAmount(jar.balance, jar.decimals, 4)} ${jar.symbol}`
    : isLoading
      ? formatMessage({
          id: "cockpit.community.cookies.rowReading",
          defaultMessage: "Reading...",
        })
      : formatMessage({
          id: "cockpit.community.cookies.rowUnavailable",
          defaultMessage: "Unavailable",
        });

  return (
    <button
      type="button"
      className="grid w-full gap-4 border-b border-[rgb(var(--m3-outline-variant))] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[rgb(var(--m3-on-surface)/0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] sm:grid-cols-[4rem_minmax(0,1fr)_auto]"
      onClick={() => onSelect(campaign)}
      aria-label={formatMessage(
        {
          id: "cockpit.community.cookies.manageJarAria",
          defaultMessage: "Manage {title}",
        },
        { title }
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-high))] text-[rgb(var(--m3-on-surface-variant))]">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <RiImageLine className="h-6 w-6" aria-hidden />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
            {title}
          </h3>
          {hasDetailReadFailure ? (
            <span className="rounded-full bg-[rgb(var(--m3-error-container))] px-2 py-0.5 text-label-sm text-[rgb(var(--m3-on-error-container))]">
              {formatMessage({
                id: "cockpit.community.cookies.needsReview",
                defaultMessage: "Needs review",
              })}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="line-clamp-2 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {description}
          </p>
        ) : null}
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
          <span>
            <EnsAddressText address={campaign.address} />
          </span>
          {sourceLabel ? <span>{sourceLabel}</span> : null}
          {dateLabel ? <span>{dateLabel}</span> : null}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-1 text-left sm:text-right">
        <p className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
          {balanceLabel}
        </p>
        <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
          {formatMessage({
            id: "cockpit.community.cookies.rowBalance",
            defaultMessage: "Jar balance",
          })}
        </p>
      </div>
    </button>
  );
}
