import {
  formatApy,
  formatTokenAmount,
  formatUsdCents,
  getOctantVaultAssetDisplayPolicy,
  getOctantVaultCampaignCopy,
  getOctantVaultCampaigns,
  getOctantVaultCampaignTransactionState,
  useOctantVaultProjectSupportMetric,
  useOctantVaultStats,
  useOctantVaultStrategyApy,
  type OctantVaultCampaignManifest,
} from "@green-goods/shared";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
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
  "https://docs.v2.octant.build/docs/yield_donating_strategy";
const OCTANT_YIELD_DONATING_STRATEGY_CONTRACT_URL =
  "https://docs.v2.octant.build/docs/smart_contracts/YieldDonatingTokenizedStrategy/";
const OCTANT_YIELD_DONATING_STRATEGY_ARCHITECTURE_URL =
  "https://docs.v2.octant.build/docs/yield_donating_strategy/architecture-yds";

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

function ProjectSupportMetricCard({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const assetSymbol = campaign.vault?.asset?.symbol ?? "WETH";
  const assetDecimals = campaign.vault?.asset?.decimals ?? 18;
  const metric = useOctantVaultProjectSupportMetric({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
  });
  const amountLabel = `${formatTokenAmount(metric.assetValue, assetDecimals, 4, undefined, true)} ${assetSymbol}`;

  let valueNode: ReactNode;
  let bodyNode: ReactNode;

  if (metric.isLoading) {
    valueNode = "…";
    bodyNode = formatMessage({
      id: "public.vaults.strategy.metric.loading",
      defaultMessage: "Reading the configured project-support router.",
    });
  } else if (metric.status === "unavailable") {
    valueNode = formatMessage({
      id: "public.vaults.strategy.metric.unavailable",
      defaultMessage: "Unavailable",
    });
    bodyNode = formatMessage({
      id: "public.vaults.strategy.metric.unavailableBody",
      defaultMessage:
        "No numeric support value is shown until the router source and conversion path can be proven.",
    });
  } else if (metric.status === "zero") {
    valueNode = amountLabel;
    bodyNode = formatMessage({
      id: "public.vaults.strategy.metric.zeroBody",
      defaultMessage:
        "Deposits are in the vault, but no yield has been harvested and donated to the project yet.",
    });
  } else {
    valueNode = amountLabel;
    bodyNode = formatMessage({
      id: "public.vaults.strategy.metric.positiveBody",
      defaultMessage:
        "Estimated from donation shares held by the configured project-support router.",
    });
  }

  return (
    <article
      className="border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-testid={`vault-project-support-metric-${campaign.slug}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
        {campaign.displayName}
      </p>
      <p className="mt-2 font-serif text-2xl leading-none text-text-strong-950">{valueNode}</p>
      <p className="mt-3 text-xs leading-[1.55] text-text-sub-600">{bodyNode}</p>
      <StrategyApyLine campaign={campaign} />
    </article>
  );
}

/**
 * Live gross APY of the campaign vault's underlying yield source (the rate that
 * funds project donations). Rendered beneath the aggregate donated-value metric.
 * Degrades to an honest "rate unavailable" state — never a fabricated number.
 */
function StrategyApyLine({ campaign }: { campaign: OctantVaultCampaignManifest }) {
  const { formatMessage } = useIntl();
  const apy = useOctantVaultStrategyApy({
    vaultAddress: campaign.vault?.vaultAddress,
    chainId: campaign.vault?.chainId,
    yieldSource: campaign.vault?.yieldSource,
  });

  let valueNode: ReactNode;
  let bodyNode: ReactNode;

  if (apy.isLoading) {
    valueNode = "…";
    bodyNode = formatMessage({
      id: "public.vaults.strategy.apy.loading",
      defaultMessage: "Reading the strategy's underlying yield source.",
    });
  } else if (apy.status === "unavailable") {
    valueNode = formatMessage({
      id: "public.vaults.strategy.apy.unavailable",
      defaultMessage: "Rate unavailable",
    });
    bodyNode = formatMessage({
      id: "public.vaults.strategy.apy.unavailableBody",
      defaultMessage:
        "The strategy's source rate is shown once it can be read. It funds project donations and is not a depositor return.",
    });
  } else if (apy.status === "zero") {
    valueNode = formatApy(apy.apy ?? 0);
    bodyNode = formatMessage({
      id: "public.vaults.strategy.apy.zeroBody",
      defaultMessage: "The underlying yield source currently reports no yield.",
    });
  } else {
    valueNode = formatApy(apy.apy ?? 0);
    bodyNode = formatMessage({
      id: "public.vaults.strategy.apy.positiveBody",
      defaultMessage:
        "Gross annual rate of the strategy's underlying source. This funds project donations; your share price stays flat.",
    });
  }

  return (
    <div
      className="mt-3 border-t border-stroke-soft-200 pt-3"
      data-testid={`vault-strategy-apy-${campaign.slug}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({
          id: "public.vaults.strategy.apy.label",
          defaultMessage: "Underlying source rate",
        })}
      </p>
      <p className="mt-1 font-serif text-xl leading-none text-text-strong-950">{valueNode}</p>
      <p className="mt-2 text-xs leading-[1.55] text-text-sub-600">{bodyNode}</p>
    </div>
  );
}

function YieldSupportExplainer({ campaigns }: { campaigns: OctantVaultCampaignManifest[] }) {
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
            defaultMessage: "§ 02 — Strategy model",
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
                  "When you support a campaign you receive vault shares for your full WETH contribution, and that position stays yours. Reported strategy profit becomes donation shares that support the project rather than a profit balance for each user.",
              })}
            </p>
            <p>
              {formatMessage({
                id: "public.vaults.strategy.ownership",
                defaultMessage:
                  "You can redeem your shares back to WETH whenever you choose, and the share price is designed to stay flat — so you keep the option to withdraw your contribution in full. The yield the strategy earns on top is what funds the project, which is how you support the work while still being able to exit your position.",
              })}
            </p>
            <p>
              {formatMessage({
                id: "public.vaults.strategy.evidence",
                defaultMessage:
                  "The recorded pilot evidence points to YieldDonatingTokenizedStrategy contracts created through YearnV3StrategyFactory metadata. Green Goods treats that as evidence of the strategy factory and creator for these pilot vaults, not as a new deployment or yield rate claim.",
              })}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
            >
              {formatMessage({
                id: "public.vaults.strategy.source.yds",
                defaultMessage: "Octant Yield Donating Strategy docs",
              })}
            </a>
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_CONTRACT_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
            >
              {formatMessage({
                id: "public.vaults.strategy.source.contract",
                defaultMessage: "YieldDonatingTokenizedStrategy contract docs",
              })}
            </a>
            <a
              href={OCTANT_YIELD_DONATING_STRATEGY_ARCHITECTURE_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
            >
              {formatMessage({
                id: "public.vaults.strategy.source.architecture",
                defaultMessage: "YDS architecture",
              })}
            </a>
          </div>
        </div>
        <div className="mt-6" aria-labelledby="public-vaults-strategy-metric-title">
          <p
            id="public-vaults-strategy-metric-title"
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.strategy.metric.title",
              defaultMessage: "Donated yield generated for the project",
            })}
          </p>
          <p className="mt-1 text-xs leading-[1.55] text-text-soft-400">
            {formatMessage({
              id: "public.vaults.strategy.metric.subtitle",
              defaultMessage:
                "Cumulative across all supporters in this campaign — not your personal balance.",
            })}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {campaigns.map((campaign) => (
              <ProjectSupportMetricCard key={campaign.slug} campaign={campaign} />
            ))}
          </div>
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
        <p className="text-base leading-[1.6] text-text-sub-600">{copy.fundingPurpose}</p>
      </header>

      <CampaignVaultStats campaign={campaign} />

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
        <dl className="mt-5 text-sm leading-[1.6] text-text-sub-600">
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
  const [searchParams, setSearchParams] = useSearchParams();
  const managing = searchParams.get(MANAGE_POSITIONS_PARAM) === MANAGE_POSITIONS_VALUE;
  const [selectedCampaign, setSelectedCampaign] = useState<OctantVaultCampaignManifest | null>(
    null
  );
  const handleEndow = useCallback((campaign: OctantVaultCampaignManifest) => {
    setSelectedCampaign(campaign);
  }, []);
  const handleClose = useCallback(() => {
    setSelectedCampaign(null);
  }, []);
  // Open the route-local management surface. Only `?manage=positions` enters the URL
  // — never an address, email, or any owner identifier.
  const openManage = useCallback(() => {
    setSelectedCampaign(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(MANAGE_POSITIONS_PARAM, MANAGE_POSITIONS_VALUE);
        return next;
      },
      { replace: false }
    );
  }, [setSearchParams]);
  const closeManage = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(MANAGE_POSITIONS_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

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
            "Fund public goods work that keeps giving — your contribution settles into a dedicated Octant vault, and the position stays yours.",
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
                defaultMessage:
                  "Your support funds real public goods work and keeps working over time.",
              })}
            </EditorialLede>
            <div className="mt-6">
              <button
                type="button"
                onClick={openManage}
                data-testid="vault-manage-positions-entry"
                className="inline-flex items-center text-sm font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
              >
                {formatMessage({
                  id: "public.vaults.manage.entry",
                  defaultMessage: "Manage positions",
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

      <YieldSupportExplainer campaigns={campaigns} />

      <section
        className="bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-vaults-boundary-title"
      >
        <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.boundary.kicker",
              defaultMessage: "§ 03 — Route boundary",
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

      {/* Management and checkout each mount their own wallet runtime, so render at
          most one at a time to avoid nesting two AppKit providers. */}
      {managing ? (
        <VaultManagePositionsPanel open onClose={closeManage} onEndow={closeManage} />
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
