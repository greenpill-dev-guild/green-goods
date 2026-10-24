import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { CampaignCookieJarCampaign } from "@green-goods/shared/types/cookie-jar";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiCookieLine } from "@remixicon/react";
import { useIntl } from "react-intl";

/**
 * A campaign cookie jar in the Cookies list, on the shared item row: its own picture, its
 * title, a pill only when its details could not be read, what one claim pays, and its balance
 * on the right. The row opens the jar's Manage dialog, its own page, where its address,
 * description, source gardens and steward sync live. A campaign jar is not a garden's jar.
 */
export function CampaignJarListRow({
  campaign,
  onSelect,
}: {
  campaign: CampaignCookieJarCampaign;
  onSelect: (campaign: CampaignCookieJarCampaign) => void;
}) {
  const { formatMessage } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(campaign.address);
  const metadata = jar?.metadata ?? campaign.metadata;
  const title = metadata?.title ?? campaign.title ?? campaign.label;
  const image = metadata?.image ? resolveIPFSUrl(metadata.image) : null;
  // What one claim pays: the fixed amount, or the most a variable jar lets a claim take.
  const perClaim =
    jar?.withdrawalType === "fixed"
      ? jar.fixedAmount
      : jar?.withdrawalType === "variable"
        ? jar.maxWithdrawal
        : null;
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
    <ItemRow
      lead={{ kind: "photo", src: image, fallbackIcon: RiCookieLine }}
      title={title}
      status={
        hasDetailReadFailure
          ? {
              label: formatMessage({
                id: "cockpit.community.cookies.needsReview",
                defaultMessage: "Needs review",
              }),
              tone: "error",
            }
          : undefined
      }
      details={
        jar && perClaim !== null
          ? [
              formatMessage(
                { id: "app.cookieJar.perClaim" },
                { amount: formatTokenAmount(perClaim, jar.decimals, 4), asset: jar.symbol }
              ),
            ]
          : undefined
      }
      amount={{
        value: balanceLabel,
        caption: formatMessage({
          id: "cockpit.community.cookies.rowBalance",
          defaultMessage: "Jar balance",
        }),
      }}
      onOpen={() => onSelect(campaign)}
      openLabel={formatMessage(
        {
          id: "cockpit.community.cookies.manageJarAria",
          defaultMessage: "Manage {title}",
        },
        { title }
      )}
    />
  );
}
