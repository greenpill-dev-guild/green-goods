import {
  formatTokenAmount,
  formatUsdCents,
  getOctantVaultAssetDisplayPolicy,
  getOctantVaultCampaignCopy,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  useOctantVaultStats,
  type OctantVaultCampaignManifest,
} from "@green-goods/shared";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Navigate, useLocation } from "react-router-dom";
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

function CampaignStatus({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const state = getOctantVaultCampaignTransactionState(campaign);
  const label = state.walletEndowEnabled
    ? formatMessage({
        id: "public.vaults.status.ready",
        defaultMessage: "Ready for checkout",
      })
    : formatMessage({
        id: "public.vaults.status.blocked",
        defaultMessage: "Preview",
      });

  return (
    <span
      className={
        state.walletEndowEnabled
          ? "inline-flex w-fit rounded-full bg-primary-action/12 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-primary-base"
          : "inline-flex w-fit rounded-full bg-bg-weak-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-sub-600 ring-1 ring-stroke-soft-200"
      }
    >
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
          "This preview does not accept Endow payments yet. The campaign will open after its vault route is complete and verified.",
      })}
    </p>
  );
}

/**
 * On-chain crowdfunding signal for a campaign card: how much the dedicated Octant
 * vault currently holds. Reads through a read-only public client (no wallet
 * runtime) and degrades gracefully — it renders nothing on error or when no vault
 * route exists. Supporter/donor counts are a follow-up (not indexed for these
 * mainnet vaults yet).
 */
function CampaignVaultStats({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const donorSymbol = getOctantVaultAssetDisplayPolicy(campaign.vault?.asset?.symbol).donorSymbol;
  const stats = useOctantVaultStats({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    decimals,
  });

  if (!campaign.vault?.vaultAddress || stats.isError) return null;

  const tokenAmount = formatTokenAmount(stats.totalAssets, decimals, 4, undefined, true);
  const usd = stats.usdCents !== null ? formatUsdCents(stats.usdCents) : null;

  return (
    <dl
      className="border-y border-stroke-soft-200 py-4"
      data-testid={`vault-campaign-stats-${campaign.slug}`}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({ id: "public.vaults.card.inVault", defaultMessage: "In vault" })}
      </dt>
      {stats.isLoading ? (
        <dd className="mt-1 font-serif text-2xl leading-none text-text-soft-400">…</dd>
      ) : stats.totalAssets > 0n ? (
        <dd className="mt-1 flex items-baseline gap-2">
          <span className="font-serif text-3xl leading-none text-text-strong-950">
            {usd ?? `${tokenAmount} ${donorSymbol}`}
          </span>
          {usd ? (
            <span className="text-sm text-text-soft-400">
              {tokenAmount} {donorSymbol}
            </span>
          ) : null}
        </dd>
      ) : (
        <dd className="mt-1 font-serif text-xl leading-none text-text-soft-400">
          {formatMessage({
            id: "public.vaults.card.justLaunched",
            defaultMessage: "Just launched — be the first to endow",
          })}
        </dd>
      )}
    </dl>
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

      <CampaignVaultStats campaign={campaign} />

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
            defaultMessage: "Availability",
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
            <CampaignPreviewNote />
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
            "Browse Greenpill NYC and EVMavericks before any wallet step. Wallet Endow and Card Endow open for both supplied Octant V2 Ethereum vault routes.",
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
                defaultMessage: "§ 01 — Campaign details",
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

function DeprecatedCardEndowQueryParamScrub() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  if (!searchParams.has("cardEndowQa")) return null;

  searchParams.delete("cardEndowQa");
  const nextSearch = searchParams.toString();

  return (
    <Navigate
      replace
      to={{
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash,
      }}
    />
  );
}

export default function VaultsPage() {
  return (
    <>
      <DeprecatedCardEndowQueryParamScrub />
      <VaultsPageContent />
    </>
  );
}
