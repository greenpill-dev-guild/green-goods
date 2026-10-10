import { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import type { Garden } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
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
      className="grid w-full gap-4 border-b border-stroke-soft px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[rgb(var(--text-strong-950)/0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))] sm:grid-cols-[4rem_minmax(0,1fr)_auto]"
      onClick={() => onSelect(campaign)}
      aria-label={formatMessage(
        {
          id: "cockpit.community.cookies.manageJarAria",
          defaultMessage: "Manage {title}",
        },
        { title }
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[var(--m3-shape-md)] bg-bg-sub text-text-sub">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <RiImageLine className="h-6 w-6" aria-hidden />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <AdminCardTitle className="truncate">{title}</AdminCardTitle>
          {hasDetailReadFailure ? (
            <span className="rounded-full bg-error-lighter px-2 py-0.5 text-label-sm text-error-dark">
              {formatMessage({
                id: "cockpit.community.cookies.needsReview",
                defaultMessage: "Needs review",
              })}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="line-clamp-2 text-body-sm text-text-sub">{description}</p>
        ) : null}
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-label-sm text-text-sub">
          <span>
            <EnsAddressText address={campaign.address} />
          </span>
          {sourceLabel ? <span>{sourceLabel}</span> : null}
          {dateLabel ? <span>{dateLabel}</span> : null}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-1 text-left sm:text-right">
        <p className="text-title-sm font-semibold text-text-strong">{balanceLabel}</p>
        <p className="text-label-sm text-text-sub">
          {formatMessage({
            id: "cockpit.community.cookies.rowBalance",
            defaultMessage: "Jar balance",
          })}
        </p>
      </div>
    </button>
  );
}
