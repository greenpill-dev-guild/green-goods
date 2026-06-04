import {
  getOctantVaultCampaignCopy,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  OCTANT_VAULT_MANIFEST_FIELD_LABELS,
  type OctantVaultCampaignManifest,
  type OctantVaultManifestField,
} from "@green-goods/shared";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { VaultCheckoutDialog } from "@/components/Public/VaultCheckoutDialog";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

const fieldMessageIds: Record<OctantVaultManifestField, string> = {
  chainId: "public.vaults.field.chainId",
  vaultAddress: "public.vaults.field.vaultAddress",
  assetAddress: "public.vaults.field.assetAddress",
  assetSymbol: "public.vaults.field.assetSymbol",
  assetDecimals: "public.vaults.field.assetDecimals",
  recipientRoutingSummary: "public.vaults.field.recipientRoutingSummary",
  protocolGuildDestinationContext: "public.vaults.field.protocolGuildDestinationContext",
  explorerLink: "public.vaults.field.explorerLink",
  campaignCopy: "public.vaults.field.campaignCopy",
};

const copyFieldMessageIds = {
  headline: "headline",
  summary: "summary",
  fundingPurpose: "fundingPurpose",
  recipientLogic: "recipientLogic",
  riskNote: "riskNote",
} as const;

const VAULT_ENDOW_BUTTON_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 border border-primary-action bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

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

function formatFieldLabel(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  field: OctantVaultManifestField
): string {
  return formatMessage({
    id: fieldMessageIds[field],
    defaultMessage: OCTANT_VAULT_MANIFEST_FIELD_LABELS[field],
  });
}

function CampaignStatus({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const state = getOctantVaultCampaignTransactionState(campaign);
  const label =
    state.manifestStatus === "complete"
      ? formatMessage({
          id: "public.vaults.status.ready",
          defaultMessage: "Manifest complete",
        })
      : formatMessage({
          id: "public.vaults.status.blocked",
          defaultMessage: "Blocked pending manifest",
        });

  return (
    <span
      className={
        state.manifestStatus === "complete"
          ? "inline-flex w-fit rounded-full bg-primary-action/12 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-primary-base"
          : "inline-flex w-fit rounded-full bg-bg-weak-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-sub-600 ring-1 ring-stroke-soft-200"
      }
    >
      {label}
    </span>
  );
}

function ManifestMissingList({
  missingFields,
  id,
}: {
  missingFields: readonly OctantVaultManifestField[];
  id: string;
}) {
  const { formatMessage } = useIntl();

  // Only rendered for blocked campaigns (ready ones render the Endow CTA instead),
  // so `missingFields` is always non-empty here.
  return (
    <div id={id}>
      <p className="text-sm leading-[1.55] text-text-sub-600">
        {formatMessage({
          id: "public.vaults.manifest.blocked",
          defaultMessage: "Endow stays disabled until these manifest fields are supplied:",
        })}
      </p>
      <ul
        className="mt-3 flex flex-wrap gap-2"
        aria-label={formatMessage({
          id: "public.vaults.manifest.missingFields",
          defaultMessage: "Missing manifest fields",
        })}
      >
        {missingFields.map((field) => (
          <li
            key={field}
            className="rounded-full bg-bg-white-0 px-3 py-1 text-xs text-text-sub-600 ring-1 ring-stroke-soft-200"
          >
            {formatFieldLabel(formatMessage, field)}
          </li>
        ))}
      </ul>
    </div>
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
  const transactionState = getOctantVaultCampaignTransactionState(campaign);
  const ready = transactionState.walletEndowEnabled;
  const missingId = `vault-campaign-${campaign.slug}-missing-fields`;

  return (
    <article
      data-testid={`vault-campaign-card-${campaign.slug}`}
      className="flex min-h-full flex-col gap-6 border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6"
      aria-labelledby={`vault-campaign-${campaign.slug}-title`}
    >
      <header className="flex flex-col gap-4">
        <CampaignStatus campaign={campaign} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {campaign.communityName}
          </p>
          <h3
            id={`vault-campaign-${campaign.slug}-title`}
            className="mt-2 font-serif text-2xl font-normal leading-[1.08] text-text-strong-950"
          >
            {campaign.displayName}
          </h3>
        </div>
        <p className="text-base leading-[1.6] text-text-sub-600">{copy.summary}</p>
      </header>

      <EditorialDivider />

      <section aria-labelledby={`vault-campaign-${campaign.slug}-story-title`}>
        <h4
          id={`vault-campaign-${campaign.slug}-story-title`}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({ id: "public.vaults.card.story", defaultMessage: "Campaign story" })}
        </h4>
        <p className="mt-2 font-serif text-xl leading-[1.25] text-text-strong-950">
          {copy.headline}
        </p>
        <dl className="mt-5 space-y-4 text-sm leading-[1.6] text-text-sub-600">
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.fundingPurpose",
                defaultMessage: "Funding purpose",
              })}
            </dt>
            <dd className="mt-1">{copy.fundingPurpose}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.recipientLogic",
                defaultMessage: "Recipient logic",
              })}
            </dt>
            <dd className="mt-1">{copy.recipientLogic}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.guardrail",
                defaultMessage: "Guardrail",
              })}
            </dt>
            <dd className="mt-1">{copy.riskNote}</dd>
          </div>
        </dl>
      </section>

      <section
        className="mt-auto"
        aria-labelledby={`vault-campaign-${campaign.slug}-actions-title`}
      >
        <h4
          id={`vault-campaign-${campaign.slug}-actions-title`}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.card.readiness",
            defaultMessage: "Readiness",
          })}
        </h4>
        <div className="mt-4">
          {ready ? (
            <button
              type="button"
              onClick={() => onEndow?.(campaign)}
              aria-label={formatMessage(
                { id: "public.vaults.endow.ctaLabel", defaultMessage: "Endow to {campaign}" },
                { campaign: campaign.displayName }
              )}
              className={VAULT_ENDOW_BUTTON_CLASS}
            >
              {formatMessage({ id: "public.vaults.endow.cta", defaultMessage: "Endow" })}
            </button>
          ) : (
            <ManifestMissingList id={missingId} missingFields={transactionState.missingFields} />
          )}
        </div>
      </section>
    </article>
  );
}

export function VaultsPageContent({
  campaigns: campaignItems,
}: {
  campaigns?: OctantVaultCampaignManifest[];
} = {}) {
  const { formatMessage } = useIntl();
  const campaigns = useMemo(() => campaignItems ?? getOctantVaultCampaigns(), [campaignItems]);
  const [selectedCampaign, setSelectedCampaign] = useState<OctantVaultCampaignManifest | null>(
    null
  );
  const handleEndow = useCallback((campaign: OctantVaultCampaignManifest) => {
    setSelectedCampaign(campaign);
  }, []);
  const handleClose = useCallback(() => {
    setSelectedCampaign(null);
  }, []);

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("vaults")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({
          id: "public.vaults.hero.kicker",
          defaultMessage: "Octant V2 Ethereum vaults",
        })}
        titleId="public-vaults-title"
        title={formatMessage(
          {
            id: "public.vaults.hero.title",
            defaultMessage: "Octant vault campaigns for <accent>public goods</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.vaults.hero.lede",
          defaultMessage:
            "Browse Greenpill NYC and EVMavericks campaign slots before any wallet step. Endow stays disabled until each Octant V2 Ethereum vault manifest is complete.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-vaults-browse-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.vaults.browse.kicker",
                defaultMessage: "§ 01 — Campaign manifest",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-vaults-browse-title">
              {formatMessage({
                id: "public.vaults.browse.title",
                defaultMessage: "Two pilot slots, one dedicated vault route.",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-5 max-w-2xl">
              {formatMessage({
                id: "public.vaults.browse.lede",
                defaultMessage: "No wallet connection needed to browse.",
              })}
            </EditorialLede>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.slug} campaign={campaign} onEndow={handleEndow} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-vaults-boundary-title"
      >
        <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.boundary.kicker",
              defaultMessage: "§ 02 — Route boundary",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-vaults-boundary-title" size="sub">
            {formatMessage({
              id: "public.vaults.boundary.title",
              defaultMessage: "This is separate from Garden funding.",
            })}
          </EditorialHeading>
          <p className="mt-4 max-w-3xl text-sm leading-[1.65] text-text-sub-600 md:text-base">
            {formatMessage({
              id: "public.vaults.boundary.body",
              defaultMessage:
                "/vaults is the Octant V2 Ethereum vault crowdfunding surface. /fund remains the existing Garden endowment page and is only reuse context for later shared capability.",
            })}
          </p>
        </div>
      </section>

      <PublicFooter variant="soil" />

      {selectedCampaign ? (
        <VaultCheckoutDialog
          key={selectedCampaign.slug}
          campaign={selectedCampaign}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}

export default function VaultsPage() {
  return <VaultsPageContent />;
}
