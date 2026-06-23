import {
  formatApy,
  formatTokenAmount,
  formatUsdCents,
  getOctantVaultAssetDisplayPolicy,
  getOctantVaultCampaignCopy,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  useOctantVaultHarvestableYield,
  useOctantVaultStats,
  useOctantVaultStrategyApy,
  type OctantVaultCampaignManifest,
} from "@green-goods/shared";
import { RiExternalLinkLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { VaultCheckoutDialog } from "@/components/Public/VaultCheckoutDialog";
import { VaultManagePositionsPanel } from "@/components/Public/VaultManagePositionsPanel";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

const MANAGE_POSITIONS_PARAM = "manage";
const MANAGE_POSITIONS_VALUE = "positions";
const OCTANT_YIELD_DONATING_STRATEGY_URL =
  "https://docs.v2.octant.build/docs/developers/yield_donating_strategy/";
const OCTANT_YIELD_DONATING_STRATEGY_INTRODUCTION_URL =
  "https://docs.v2.octant.build/docs/developers/yield_donating_strategy/introduction-to-yds";
const OCTANT_YIELD_DONATING_STRATEGY_ARCHITECTURE_URL =
  "https://docs.v2.octant.build/docs/developers/yield_donating_strategy/architecture-yds";
const OCTANT_YIELD_DONATING_STRATEGY_LIFECYCLE_URL =
  "https://docs.v2.octant.build/docs/developers/yield_donating_strategy/mental-model-lifecycle-yds";

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
          "This preview does not accept Endow payments yet. The campaign will open after its vault setup is complete and verified.",
      })}
    </p>
  );
}

/**
 * On-chain crowdfunding signal for a campaign card: how much the dedicated Octant
 * vault currently holds. Reads through a public client without requiring a wallet
 * runtime) and degrades gracefully; it renders nothing on error or when no vault
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
        {formatMessage({
          id: "public.vaults.card.inVault",
          defaultMessage: "In vault",
        })}
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
            defaultMessage: "Just launched. Be the first to endow.",
          })}
        </dd>
      )}
    </dl>
  );
}

function CampaignYieldRow({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const assetSymbol = campaign.vault?.asset?.symbol ?? "WETH";
  const assetDecimals = campaign.vault?.asset?.decimals ?? 18;
  const metric = useOctantVaultHarvestableYield({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    asset: campaign.vault?.asset,
    yieldSource: campaign.vault?.yieldSource,
    yieldStrategy: campaign.vault?.yieldStrategy,
  });
  const apy = useOctantVaultStrategyApy({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    yieldSource: campaign.vault?.yieldSource,
  });

  let generatedYieldValue: string;
  if (metric.isLoading) {
    generatedYieldValue = formatMessage({
      id: "public.vaults.card.metricReading",
      defaultMessage: "Reading",
    });
  } else if (metric.status === "unavailable") {
    generatedYieldValue = formatMessage({
      id: "public.vaults.card.generatedYieldUnavailable",
      defaultMessage: "Unavailable",
    });
  } else if (metric.status === "zero") {
    generatedYieldValue = formatMessage({
      id: "public.vaults.card.noYieldYet",
      defaultMessage: "No yield yet",
    });
  } else {
    generatedYieldValue = `${formatTokenAmount(
      metric.harvestableAssets,
      assetDecimals,
      4,
      undefined,
      true
    )} ${assetSymbol}`;
  }

  let fundingRateValue: string;
  if (apy.isLoading) {
    fundingRateValue = formatMessage({
      id: "public.vaults.card.metricReading",
      defaultMessage: "Reading",
    });
  } else if (apy.status === "unavailable") {
    fundingRateValue = formatMessage({
      id: "public.vaults.card.fundingRateUnavailable",
      defaultMessage: "Rate unavailable",
    });
  } else {
    fundingRateValue = formatApy(apy.apy ?? 0);
  }

  return (
    <dl
      className="grid grid-cols-2 gap-3 border-b border-stroke-soft-200 py-4"
      data-testid={`vault-campaign-yield-row-${campaign.slug}`}
    >
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.vaults.card.generatedYield",
            defaultMessage: "Generated yield",
          })}
        </dt>
        <dd className="mt-1 font-serif text-lg leading-none text-text-strong-950">
          {generatedYieldValue}
        </dd>
      </div>
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.vaults.card.fundingRate",
            defaultMessage: "Funding rate",
          })}
        </dt>
        <dd className="mt-1 font-serif text-lg leading-none text-text-strong-950">
          {fundingRateValue}
        </dd>
      </div>
    </dl>
  );
}

function YieldSupportExplainer() {
  const { formatMessage } = useIntl();

  return (
    <section
      className="bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
      aria-labelledby="public-vaults-strategy-title"
    >
      <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
        <EditorialKicker className="mb-3">
          {formatMessage({
            id: "public.vaults.strategy.kicker",
            defaultMessage: "§ 02: Strategy model",
          })}
        </EditorialKicker>
        <EditorialHeading id="public-vaults-strategy-title" size="sub">
          {formatMessage({
            id: "public.vaults.strategy.title",
            defaultMessage: "How yield support works",
          })}
        </EditorialHeading>
        <div className="mt-4 grid gap-4 text-sm leading-[1.65] text-text-sub-600 md:grid-cols-[minmax(0,1fr)_auto] md:text-base">
          <div className="max-w-3xl space-y-4">
            <p>
              {formatMessage({
                id: "public.vaults.strategy.body",
                defaultMessage:
                  "When you support a campaign, your contribution becomes vault shares you can redeem later. Generated yield supports the project instead of becoming a personal profit balance.",
              })}
            </p>
            <p>
              {formatMessage({
                id: "public.vaults.strategy.ownership",
                defaultMessage:
                  "You can redeem your vault shares back to WETH whenever you choose. The generated yield is what funds the campaign, so you can support the work while still keeping an exit path.",
              })}
            </p>
            <p>
              {formatMessage({
                id: "public.vaults.strategy.evidence",
                defaultMessage:
                  "These pilot vaults use Octant's yield donating strategy model. Green Goods links the source docs so you can inspect how generated yield is routed without framing the rate as personal return.",
              })}
            </p>
          </div>
          <aside
            className="border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm md:min-w-72 md:max-w-xs"
            aria-labelledby="public-vaults-strategy-source-title"
          >
            <p
              id="public-vaults-strategy-source-title"
              className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
            >
              {formatMessage({
                id: "public.vaults.strategy.source.title",
                defaultMessage: "Technical docs",
              })}
            </p>
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_URL}
              target="_blank"
              rel="noreferrer"
              className="group mt-2 flex min-h-11 w-full items-center justify-between gap-3 border-b border-stroke-soft-200 py-3 text-left text-sm font-medium leading-snug text-text-strong-950 transition-colors hover:border-primary-action/60 hover:text-primary-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
            >
              <span>
                {formatMessage({
                  id: "public.vaults.strategy.source.yds",
                  defaultMessage: "Octant Yield Donating Strategy docs",
                })}
              </span>
              <RiExternalLinkLine
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-text-soft-400 transition-colors group-hover:text-primary-action"
              />
            </a>
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_INTRODUCTION_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-11 w-full items-center justify-between gap-3 border-b border-stroke-soft-200 py-3 text-left text-sm font-medium leading-snug text-text-strong-950 transition-colors hover:border-primary-action/60 hover:text-primary-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
            >
              <span>
                {formatMessage({
                  id: "public.vaults.strategy.source.introduction",
                  defaultMessage: "Yield Donating Strategy introduction",
                })}
              </span>
              <RiExternalLinkLine
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-text-soft-400 transition-colors group-hover:text-primary-action"
              />
            </a>
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_ARCHITECTURE_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-11 w-full items-center justify-between gap-3 border-b border-stroke-soft-200 py-3 text-left text-sm font-medium leading-snug text-text-strong-950 transition-colors hover:border-primary-action/60 hover:text-primary-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
            >
              <span>
                {formatMessage({
                  id: "public.vaults.strategy.source.architecture",
                  defaultMessage: "Yield Donating Strategy architecture",
                })}
              </span>
              <RiExternalLinkLine
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-text-soft-400 transition-colors group-hover:text-primary-action"
              />
            </a>
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_LIFECYCLE_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium leading-snug text-text-strong-950 transition-colors hover:text-primary-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
            >
              <span>
                {formatMessage({
                  id: "public.vaults.strategy.source.lifecycle",
                  defaultMessage: "Yield Donating Strategy lifecycle mental model",
                })}
              </span>
              <RiExternalLinkLine
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-text-soft-400 transition-colors group-hover:text-primary-action"
              />
            </a>
          </aside>
        </div>
      </div>
    </section>
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
      className="grid min-h-full grid-rows-[auto_auto_auto_auto_1fr_auto] gap-6 border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)] sm:p-6 lg:row-span-8 lg:grid-rows-subgrid"
      aria-labelledby={`vault-campaign-${campaign.slug}-title`}
    >
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
      <p
        className="text-base leading-[1.6] text-text-sub-600"
        data-testid={`vault-campaign-purpose-${campaign.slug}`}
      >
        {copy.fundingPurpose}
      </p>

      <div data-testid={`vault-campaign-amount-row-${campaign.slug}`}>
        <CampaignVaultStats campaign={campaign} />
        <CampaignYieldRow campaign={campaign} />
      </div>

      <section
        className="grid gap-y-2 lg:row-span-3 lg:grid-rows-subgrid lg:gap-y-3"
        data-testid={`vault-campaign-story-row-${campaign.slug}`}
        aria-labelledby={`vault-campaign-${campaign.slug}-story-title`}
      >
        <h4
          id={`vault-campaign-${campaign.slug}-story-title`}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({
            id: "public.vaults.card.story",
            defaultMessage: "Campaign story",
          })}
        </h4>
        <p
          className="font-serif text-xl leading-[1.25] text-text-strong-950"
          data-testid={`vault-campaign-story-headline-${campaign.slug}`}
        >
          {copy.headline}
        </p>
        <dl className="text-sm leading-[1.6] text-text-sub-600">
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.card.recipientLogic",
                defaultMessage: "Where your support goes",
              })}
            </dt>
            <dd className="mt-1">{copy.recipientLogic}</dd>
          </div>
        </dl>
      </section>

      <section
        className="self-end"
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
                {
                  id: "public.vaults.endow.ctaLabel",
                  defaultMessage: "Endow to {campaign}",
                },
                { campaign: campaign.displayName }
              )}
              className={VAULT_ENDOW_BUTTON_CLASS}
            >
              {formatMessage({
                id: "public.vaults.endow.cta",
                defaultMessage: "Endow",
              })}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const managing = searchParams.get(MANAGE_POSITIONS_PARAM) === MANAGE_POSITIONS_VALUE;
  const [isManagePanelOpen, setManagePanelOpen] = useState(managing);
  const isManagePanelClosePendingRef = useRef(false);
  const [selectedCampaign, setSelectedCampaign] = useState<OctantVaultCampaignManifest | null>(
    null
  );
  const shouldRenderManagePanel =
    isManagePanelOpen || isManagePanelClosePendingRef.current || managing;

  useEffect(() => {
    if (managing) {
      isManagePanelClosePendingRef.current = false;
      setManagePanelOpen(true);
      return;
    }

    setManagePanelOpen(false);
  }, [managing]);

  const handleEndow = useCallback((campaign: OctantVaultCampaignManifest) => {
    setSelectedCampaign(campaign);
  }, []);
  const handleClose = useCallback(() => {
    setSelectedCampaign(null);
  }, []);
  // Open the route-local management surface. Only `?manage=positions` enters the URL
  // Never an address, email, or any owner identifier.
  const openManage = useCallback(() => {
    setSelectedCampaign(null);
    isManagePanelClosePendingRef.current = false;
    setManagePanelOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(MANAGE_POSITIONS_PARAM, MANAGE_POSITIONS_VALUE);
        return next;
      },
      { replace: false }
    );
  }, [setSearchParams]);
  const handleManagePanelOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        isManagePanelClosePendingRef.current = false;
        setManagePanelOpen(true);
        return;
      }

      setManagePanelOpen(false);
      if (searchParams.get(MANAGE_POSITIONS_PARAM) === MANAGE_POSITIONS_VALUE) {
        isManagePanelClosePendingRef.current = true;
      }
    },
    [searchParams]
  );
  const handleManagePanelExitComplete = useCallback(() => {
    if (!isManagePanelClosePendingRef.current) return;

    isManagePanelClosePendingRef.current = false;
    if (searchParams.get(MANAGE_POSITIONS_PARAM) === MANAGE_POSITIONS_VALUE) {
      const next = new URLSearchParams(searchParams);
      next.delete(MANAGE_POSITIONS_PARAM);
      setSearchParams(next, { replace: true, preventScrollReset: true });
    }
  }, [searchParams, setSearchParams]);

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
            "Support public goods through an Octant vault. Your contribution becomes vault shares you can redeem later, while generated yield supports the campaign.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-vaults-browse-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-6 border-b border-stroke-soft-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div className="max-w-2xl">
              <EditorialKicker className="mb-3">
                {formatMessage({
                  id: "public.vaults.browse.kicker",
                  defaultMessage: "§ 01: Campaign details",
                })}
              </EditorialKicker>
              <EditorialHeading id="public-vaults-browse-title">
                {formatMessage({
                  id: "public.vaults.browse.title",
                  defaultMessage: "Two pilot campaigns, each with its own Octant vault.",
                })}
              </EditorialHeading>
              <EditorialLede className="mt-5">
                {formatMessage({
                  id: "public.vaults.browse.lede",
                  defaultMessage:
                    "Your support funds real public goods work and keeps growing over time.",
                })}
              </EditorialLede>
            </div>
            <div className="flex justify-end sm:shrink-0">
              <button
                type="button"
                onClick={openManage}
                data-testid="vault-manage-positions-entry"
                className="inline-flex items-center text-sm font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
              >
                {formatMessage({
                  id: "public.vaults.manage.entry",
                  defaultMessage: "Manage Endowments",
                })}
              </button>
            </div>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.slug} campaign={campaign} onEndow={handleEndow} />
            ))}
          </div>
        </div>
      </section>

      <YieldSupportExplainer />

      <section
        className="bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-vaults-boundary-title"
      >
        <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.boundary.kicker",
              defaultMessage: "§ 03: Separate funding lanes",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-vaults-boundary-title" size="sub">
            {formatMessage({
              id: "public.vaults.boundary.title",
              defaultMessage: "Vaults are the Octant lane.",
            })}
          </EditorialHeading>
          <p className="mt-4 max-w-3xl text-sm leading-[1.65] text-text-sub-600 md:text-base">
            {formatMessage({
              id: "public.vaults.boundary.body",
              defaultMessage:
                "This Octant vault lane funds specific campaigns. Gardens carry the broader Green Goods public record of places, work, and impact.",
            })}
          </p>
          <Link
            to="/gardens"
            className="mt-5 inline-flex text-sm font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
          >
            {formatMessage({
              id: "public.vaults.boundary.cta",
              defaultMessage: "Explore Gardens",
            })}
          </Link>
        </div>
      </section>

      <PublicFooter variant="soil" />

      {/* Management and checkout each mount their own wallet runtime, so render at
          most one at a time to avoid nesting two AppKit providers. */}
      {shouldRenderManagePanel ? (
        <VaultManagePositionsPanel
          open={isManagePanelOpen}
          onExitComplete={handleManagePanelExitComplete}
          onOpenChange={handleManagePanelOpenChange}
          onEndow={() => handleManagePanelOpenChange(false)}
        />
      ) : selectedCampaign ? (
        <VaultCheckoutDialog
          key={selectedCampaign.slug}
          campaign={selectedCampaign}
          onClose={handleClose}
          onManagePositions={openManage}
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
