import { Button } from "@green-goods/shared/components/Button";
import { getOctantVaultCampaignCopy } from "@green-goods/shared/modules/vault-crowdfunding/copy";
import type { OctantVaultCampaignManifest } from "@green-goods/shared/modules/vault-crowdfunding/manifest";
import { getOctantVaultCampaignTransactionState } from "@green-goods/shared/modules/vault-crowdfunding/route-manage";
import { useIntl } from "react-intl";
import { CampaignVaultStats, CampaignYieldRow } from "./VaultsCampaignStats";

/*
 * One campaign record on /vaults: identity, purpose, learn-more links, live
 * vault numbers, and the Endow action once the campaign is open.
 */

const copyFieldMessageIds = {
  headline: "headline",
  summary: "summary",
  fundingPurpose: "fundingPurpose",
  recipientLogic: "recipientLogic",
  riskNote: "riskNote",
} as const;

const campaignLearnMoreLinks: Record<
  string,
  { href: string; labelId: string; defaultLabel: string }[]
> = {
  "greenpill-nyc": [
    {
      href: "https://greenpill.network/",
      labelId: "public.vaults.campaign.greenpill-nyc.link.greenpillNetwork",
      defaultLabel: "Greenpill Network",
    },
    {
      href: "https://decentralpark.nyc/",
      labelId: "public.vaults.campaign.greenpill-nyc.link.decentralPark",
      defaultLabel: "Decentral Park",
    },
  ],
  evmavericks: [
    {
      href: "https://dao.evmavericks.xyz/",
      labelId: "public.vaults.campaign.evmavericks.link.manenetDao",
      defaultLabel: "ManeNet DAO",
    },
    {
      href: "https://www.protocolguild.org/",
      labelId: "public.vaults.campaign.evmavericks.link.protocolGuild",
      defaultLabel: "Protocol Guild",
    },
  ],
};

function campaignCopyId(
  campaign: OctantVaultCampaignManifest,
  field: keyof typeof copyFieldMessageIds
) {
  return `public.vaults.campaign.${campaign.slug}.${copyFieldMessageIds[field]}`;
}

function formatCampaignCopy(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  campaign: OctantVaultCampaignManifest
) {
  const copy = getOctantVaultCampaignCopy(campaign);

  return {
    headline: formatMessage({
      id: campaignCopyId(campaign, "headline"),
      defaultMessage: copy.headline,
    }),
    summary: formatMessage({
      id: campaignCopyId(campaign, "summary"),
      defaultMessage: copy.summary,
    }),
    fundingPurpose: formatMessage({
      id: campaignCopyId(campaign, "fundingPurpose"),
      defaultMessage: copy.fundingPurpose,
    }),
    recipientLogic: formatMessage({
      id: campaignCopyId(campaign, "recipientLogic"),
      defaultMessage: copy.recipientLogic,
    }),
    riskNote: formatMessage({
      id: campaignCopyId(campaign, "riskNote"),
      defaultMessage: copy.riskNote,
    }),
  };
}

function formatCampaignIdentity(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  campaign: OctantVaultCampaignManifest
) {
  if (campaign.slug === "greenpill-nyc") {
    return formatMessage({
      id: "public.vaults.campaign.greenpill-nyc.identity",
      defaultMessage: "Greenpill Network",
    });
  }

  return campaign.communityName;
}

function CampaignStatus({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const state = getOctantVaultCampaignTransactionState(campaign);
  if (state.walletEndowEnabled) return null;

  const label = formatMessage({
    id: "public.vaults.status.blocked",
    defaultMessage: "Preview",
  });

  return (
    <span className="inline-flex w-fit rounded-full bg-bg-weak-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-sub-600 ring-1 ring-stroke-soft-200">
      {label}
    </span>
  );
}

function CampaignPreviewNote() {
  const { formatMessage } = useIntl();

  return (
    <p className="text-sm leading-[1.55] text-text-sub-600">
      {formatMessage({
        id: "public.vaults.manifest.blocked",
        defaultMessage:
          "This campaign is not open for endowments yet. It will open once setup is complete.",
      })}
    </p>
  );
}

export function CampaignCard({
  campaign,
  onEndow,
}: {
  campaign: OctantVaultCampaignManifest;
  onEndow?: (campaign: OctantVaultCampaignManifest) => void;
}) {
  const { formatMessage } = useIntl();
  const copy = formatCampaignCopy(formatMessage, campaign);
  const identity = formatCampaignIdentity(formatMessage, campaign);
  const links = campaignLearnMoreLinks[campaign.slug] ?? [];
  const transactionState = getOctantVaultCampaignTransactionState(campaign);
  const ready = transactionState.walletEndowEnabled;

  return (
    <article
      data-testid={`vault-campaign-card-${campaign.slug}`}
      className="grid min-h-full grid-rows-[auto_auto_auto_auto_1fr_auto] gap-6 border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6"
      aria-labelledby={`vault-campaign-${campaign.slug}-title`}
    >
      <CampaignStatus campaign={campaign} />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          {identity}
        </p>
        <h3
          id={`vault-campaign-${campaign.slug}-title`}
          className="mt-2 font-serif text-2xl font-normal leading-[1.08] text-text-strong-950"
        >
          {campaign.displayName}
        </h3>
      </div>
      <p
        className="text-base leading-[1.6] text-text-sub-600"
        data-testid={`vault-campaign-purpose-${campaign.slug}`}
      >
        {copy.fundingPurpose}
      </p>

      {links.length ? (
        <nav
          className="flex flex-wrap gap-x-4 gap-y-2"
          aria-label={formatMessage(
            {
              id: "public.vaults.campaign.linksLabel",
              defaultMessage: "Learn more about {campaign}",
            },
            { campaign: campaign.displayName }
          )}
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
            >
              {formatMessage({ id: link.labelId, defaultMessage: link.defaultLabel })}
            </a>
          ))}
        </nav>
      ) : null}

      <div data-testid={`vault-campaign-amount-row-${campaign.slug}`}>
        <CampaignVaultStats campaign={campaign} />
        <CampaignYieldRow campaign={campaign} />
      </div>

      <section
        className="self-end"
        aria-labelledby={`vault-campaign-${campaign.slug}-actions-title`}
      >
        <h4
          id={`vault-campaign-${campaign.slug}-actions-title`}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.card.readiness",
            defaultMessage: "Availability",
          })}
        </h4>
        <div className="mt-4">
          {ready ? (
            <Button
              type="button"
              onClick={() => onEndow?.(campaign)}
              aria-label={formatMessage(
                {
                  id: "public.vaults.endow.ctaLabel",
                  defaultMessage: "Endow to {campaign}",
                },
                { campaign: campaign.displayName }
              )}
              className="w-full"
            >
              {formatMessage({
                id: "public.vaults.endow.cta",
                defaultMessage: "Endow",
              })}
            </Button>
          ) : (
            <CampaignPreviewNote />
          )}
        </div>
      </section>
    </article>
  );
}
