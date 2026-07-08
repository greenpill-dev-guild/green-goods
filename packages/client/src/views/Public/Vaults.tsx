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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
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

const copyFieldMessageIds = {
  headline: "headline",
  summary: "summary",
  fundingPurpose: "fundingPurpose",
  recipientLogic: "recipientLogic",
  riskNote: "riskNote",
} as const;

const VAULT_ENDOW_BUTTON_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 border border-primary-action bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

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
          defaultMessage: "Backed so far",
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
      defaultMessage: "Not available yet",
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
      defaultMessage: "Not available yet",
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
            defaultMessage: "Generated for the campaign",
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
            defaultMessage: "Current yield rate",
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
        <div className="mt-4 max-w-3xl space-y-4 text-sm leading-[1.65] text-text-sub-600 md:text-base">
          <p>
            {formatMessage({
              id: "public.vaults.strategy.body",
              defaultMessage:
                "Each endowment helps back a campaign today, while the yield it generates can keep supporting the work over time. You are not earning personal yield; the campaign is the beneficiary.",
            })}
          </p>
          <p>
            <FormattedMessage
              id="public.vaults.strategy.evidence"
              defaultMessage="These campaigns use Octant's yield donating strategy model, designed so generated yield can flow toward public goods instead of personal return. Curious readers can explore the broader model in the <docsLink>Octant docs</docsLink>."
              values={{
                docsLink: (chunks) => (
                  <a
                    href="https://docs.v2.octant.build/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              }}
            />
          </p>
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
            defaultMessage: "Public goods campaigns, powered by <accent>Octant vaults</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.vaults.hero.lede",
          defaultMessage:
            "Back a campaign once, and its support can keep growing as generated yield is routed toward the public good.",
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
                  defaultMessage: "Active Campaigns",
                })}
              </EditorialKicker>
              <EditorialHeading id="public-vaults-browse-title">
                {formatMessage({
                  id: "public.vaults.browse.title",
                  defaultMessage: "Explore public goods campaigns ready for support.",
                })}
              </EditorialHeading>
              <EditorialLede className="mt-5">
                {formatMessage({
                  id: "public.vaults.browse.lede",
                  defaultMessage:
                    "Each campaign turns support today into ongoing public goods funding.",
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
              defaultMessage: "Beyond these campaigns",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-vaults-boundary-title" size="sub">
            {formatMessage({
              id: "public.vaults.boundary.title",
              defaultMessage: "Want to see more places, projects, and impact?",
            })}
          </EditorialHeading>
          <p className="mt-4 max-w-3xl text-sm leading-[1.65] text-text-sub-600 md:text-base">
            {formatMessage({
              id: "public.vaults.boundary.body",
              defaultMessage:
                "This page is for Octant-backed campaigns. For the wider Green Goods network, explore Gardens.",
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
