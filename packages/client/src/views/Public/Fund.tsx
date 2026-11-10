import { ENDOWMENT_DEPOSITS_ENABLED } from "@green-goods/shared/config/app";
import { formatApy } from "@green-goods/shared/utils/blockchain/aave";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import {
  type PublicGardenSummary,
  usePublicGardens,
} from "@green-goods/shared/hooks/public/usePublicGardens";
import {
  type PublicGardenVaultSummary,
  type PublicVaultSummary,
  type PublicVaultSummaryAsset,
  usePublicVaultCatalogSummary,
} from "@green-goods/shared/hooks/public/usePublicVaultCatalogSummary";
import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { selectPublicSurfaceState } from "@green-goods/shared/public";
import type { PublicFundingIntentKind } from "@green-goods/shared/public-contracts/core";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import {
  EditorialGhostButton,
  EditorialHeading,
  EditorialKicker,
  EditorialListRowSkeleton,
  EditorialLinkArrow,
  EditorialVaultAssetCardSkeleton,
  editorialTitleTags,
} from "@/components/Public/atoms";
import { FundSupportPaths } from "@/components/Public/FundSupportPaths";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicFundingReceipt } from "@/components/Public/PublicFundingReceipt";
import { PublicGardenRow } from "@/components/Public/PublicGardenRow";
import { PublicSurfaceState } from "@/components/Public/PublicSurfaceState";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";
import { resolveGardenQuery } from "@/views/Public/gardenQueryResolution";
const PublicFundingCard = lazy(() =>
  import("@/components/Public/PublicFundingCard").then((module) => ({
    default: module.PublicFundingCard,
  }))
);
const PublicEndowmentPanel = lazy(() =>
  import("@/components/Public/PublicEndowmentPanel").then((module) => ({
    default: module.PublicEndowmentPanel,
  }))
);
const WalletRuntimeProviders = lazy(() => import("@/routes/WalletRuntimeProviders"));
// The endowment engine always supports these two assets, so the metrics
// section keeps their cards visible even when the live figures cannot be
// fetched — a blank section reads as "broken" rather than "no data yet".
const VAULT_PLACEHOLDER_SYMBOLS = ["DAI", "ETH"] as const;

function VaultAggregationSection({ summary }: { summary: PublicVaultSummary }) {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();

  const assets = summary.assets;
  const showSkeleton = assets.length === 0 && summary.isLoading;

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
      aria-labelledby="public-fund-vaults-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <header className="border-b border-stroke-soft-200 pb-6">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.fund.vaults.kicker",
              defaultMessage: "§ 01: Endowment engine",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-fund-vaults-title">
            {formatMessage({
              id: "public.fund.vaults.title",
              defaultMessage: "Endowment capital already supporting Gardens.",
            })}
          </EditorialHeading>
          <p className="mt-5 max-w-2xl text-base leading-[1.6] text-text-sub-600 md:text-lg">
            {formatMessage({
              id: "public.fund.vaults.lede",
              defaultMessage:
                "Endow places a long-term deposit in a garden's vault. Donate sends support straight to a garden's shared fund.",
            })}
          </p>
        </header>

        {assets.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {assets.map((asset) => (
              <VaultAssetCard
                key={`${asset.chainId}:${asset.asset}`}
                asset={asset}
                isYieldLoading={summary.isYieldLoading}
              />
            ))}
          </div>
        ) : showSkeleton ? (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2" aria-hidden="true">
            {[0, 1].map((index) => (
              <EditorialVaultAssetCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {VAULT_PLACEHOLDER_SYMBOLS.map((symbol) => (
              <VaultAssetUnavailableCard key={symbol} symbol={symbol} errored={summary.isError} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function VaultAssetUnavailableCard({ symbol, errored }: { symbol: string; errored: boolean }) {
  const { formatMessage } = useIntl();
  return (
    <article className="border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)]">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage(
          {
            id: "public.fund.vaults.assetTitle",
            defaultMessage: "{asset} endowment balance",
          },
          { asset: symbol }
        )}
      </p>
      <div className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.fund.vaults.currentBalance",
            defaultMessage: "Current balance",
          })}
        </p>
        <p
          className="mt-2 font-serif text-3xl font-normal leading-none tracking-[-0.018em] text-text-soft-400 md:text-4xl"
          aria-hidden="true"
        >
          —
        </p>
      </div>
      <p
        className="mt-6 border-t border-stroke-soft-200 pt-4 text-sm leading-[1.55] text-text-sub-600"
        role={errored ? "alert" : undefined}
      >
        {errored
          ? formatMessage({
              id: "public.fund.vaults.metricsError",
              defaultMessage: "We couldn't load these endowment metrics. Refresh to try again.",
            })
          : formatMessage({
              id: "public.fund.vaults.metricsEmpty",
              defaultMessage: "No endowment activity on this network yet.",
            })}
      </p>
    </article>
  );
}

function VaultAssetCard({
  asset,
  isYieldLoading,
}: {
  asset: PublicVaultSummaryAsset;
  isYieldLoading: boolean;
}) {
  const { formatMessage } = useIntl();
  const aprValue = asset.isAprLoading
    ? formatMessage({ id: "public.fund.vaults.loading", defaultMessage: "Loading..." })
    : typeof asset.apr === "number"
      ? formatApy(asset.apr)
      : formatMessage({
          id: "public.fund.vaults.aprUnavailable",
          defaultMessage: "APR unavailable",
        });
  const readyToHarvestValue = isYieldLoading
    ? formatMessage({ id: "public.fund.vaults.loading", defaultMessage: "Loading..." })
    : asset.accruingYield !== undefined
      ? formatVaultAssetAmount(asset.accruingYield, asset)
      : formatMessage({
          id: "public.fund.vaults.liveYieldUnavailable",
          defaultMessage: "Live yield unavailable",
        });
  const routedValue =
    asset.allocatedYield !== undefined
      ? formatVaultAssetAmount(asset.allocatedYield, asset)
      : formatMessage({
          id: "public.fund.vaults.routedUnavailable",
          defaultMessage: "Routed data unavailable",
        });

  return (
    <article className="border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)]">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage(
          {
            id: "public.fund.vaults.assetTitle",
            defaultMessage: "{asset} endowment balance",
          },
          { asset: asset.symbol }
        )}
      </p>
      <div className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.fund.vaults.currentBalance",
            defaultMessage: "Current balance",
          })}
        </p>
        <p className="mt-2 font-serif text-3xl font-normal leading-none tracking-[-0.018em] text-text-strong-950 md:text-4xl">
          {formatVaultAssetAmount(asset.currentValue, asset)}
        </p>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <VaultMetric
          label={formatMessage({ id: "public.fund.vaults.apr", defaultMessage: "APR" })}
          value={aprValue}
        />
        <VaultMetric
          label={formatMessage({
            id: "public.fund.vaults.readyToHarvest",
            defaultMessage: "Yield ready for gardens",
          })}
          value={readyToHarvestValue}
        />
        <VaultMetric
          label={formatMessage({
            id: "public.fund.vaults.routed",
            defaultMessage: "Routed to gardens",
          })}
          value={routedValue}
        />
        <VaultMetric
          label={formatMessage({
            id: "public.fund.vaults.vaultCountLabel",
            defaultMessage: "Vaults",
          })}
          value={formatMessage(
            {
              id: "public.fund.vaults.vaultCount",
              defaultMessage: "{count, plural, one {# vault} other {# vaults}}",
            },
            { count: asset.vaultCount }
          )}
        />
        <VaultMetric
          label={formatMessage({
            id: "public.fund.vaults.fundingPositionsLabel",
            defaultMessage: "Funding positions",
          })}
          value={formatMessage(
            {
              id: "public.fund.vaults.fundingPositions",
              defaultMessage:
                "{count, plural, one {# funding position} other {# funding positions}}",
            },
            { count: asset.depositorCount }
          )}
        />
      </dl>
    </article>
  );
}

function VaultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-stroke-soft-200 pt-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-[1.5] text-text-sub-600">{value}</dd>
    </div>
  );
}

function formatVaultAssetAmount(value: bigint, asset: PublicVaultSummaryAsset): string {
  return `${formatTokenAmount(value, asset.decimals, 4, undefined, true)} ${asset.symbol}`;
}

function getGardenVaultSummary(
  summary: PublicVaultSummary,
  garden: PublicGardenSummary
): PublicGardenVaultSummary | undefined {
  return (
    summary.gardensByAddress[garden.id.toLowerCase()] ??
    summary.gardensByAddress[garden.address.toLowerCase()]
  );
}

function FundPageContent() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading, isError, refetch } = usePublicGardens();
  const vaultSummary = usePublicVaultCatalogSummary();
  // A cold Vault read that failed: rows say so rather than look like Gardens without Vaults.
  const vaultsUnavailable = vaultSummary.isError && !vaultSummary.hasVaults;
  const [searchParams, setSearchParams] = useSearchParams();

  const intentId = searchParams.get("intent");
  const gardenQuery = searchParams.get("garden");
  const manageQuery = searchParams.get("manage");

  const resolved = useMemo(() => resolveGardenQuery(gardenQuery, gardens), [gardenQuery, gardens]);

  const orderedGardens = useMemo(() => {
    if (resolved.status !== "match" || !resolved.garden) return gardens;
    const match = resolved.garden;
    return [match, ...gardens.filter((g) => g.id !== match.id)];
  }, [gardens, resolved]);
  const gardensState = selectPublicSurfaceState({
    isLoading,
    isError,
    itemCount: orderedGardens.length,
  });

  const [selectorState, setSelectorState] = useState<{
    garden: PublicGardenSummary;
    intent: PublicFundingIntentKind;
  } | null>(null);
  const [isEndowmentPanelOpen, setEndowmentPanelOpen] = useState(false);
  const isEndowmentPanelClosePendingRef = useRef(false);
  const hasWalletRuntime = Boolean(selectorState);
  const { ref: gardensRef, revealed: gardensRevealed } = useInViewReveal<HTMLElement>();

  const matchHighlightRef = useRef<HTMLDivElement | null>(null);
  const matchedGardenId = resolved.status === "match" ? resolved.garden?.id : undefined;
  useEffect(() => {
    if (!matchedGardenId) {
      matchHighlightRef.current = null;
      return;
    }
    // Defer to the next frame so the ref attaches to the freshly-rendered row,
    // not a stale node from a previous `?garden=` value.
    const handle = requestAnimationFrame(() => {
      matchHighlightRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(handle);
  }, [matchedGardenId]);

  useEffect(() => {
    if (manageQuery === "endowments") {
      isEndowmentPanelClosePendingRef.current = false;
      setEndowmentPanelOpen(true);
      return;
    }

    setEndowmentPanelOpen(false);
  }, [manageQuery]);

  const closeSelector = useCallback(() => setSelectorState(null), []);

  const handleManageEndowmentsClick = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("manage", "endowments");
    isEndowmentPanelClosePendingRef.current = false;
    setEndowmentPanelOpen(true);
    setSearchParams(nextParams, { preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  const handleEndowmentPanelOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        isEndowmentPanelClosePendingRef.current = false;
        setEndowmentPanelOpen(true);
        return;
      }

      setEndowmentPanelOpen(open);
      if (searchParams.get("manage") === "endowments") {
        isEndowmentPanelClosePendingRef.current = true;
      }
    },
    [searchParams]
  );

  const handleEndowmentPanelExitComplete = useCallback(() => {
    if (!isEndowmentPanelClosePendingRef.current) return;

    isEndowmentPanelClosePendingRef.current = false;
    if (searchParams.get("manage") === "endowments") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("manage");
      setSearchParams(nextParams, { replace: true, preventScrollReset: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSupport = useCallback(
    (garden: PublicGardenSummary, intent: PublicFundingIntentKind) => {
      if (intent === "endow" && !ENDOWMENT_DEPOSITS_ENABLED) return;
      setSelectorState({ garden, intent });
    },
    []
  );

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("fund")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-fund-hero-title"
        title={formatMessage(
          {
            id: "public.fund.heroTitle",
            defaultMessage:
              "<line>A small gesture,</line> <line><accent>growing</accent> over</line> <line>many seasons</line>",
          },
          editorialTitleTags
        )}
        lede={formatMessage({
          ...(ENDOWMENT_DEPOSITS_ENABLED
            ? {
                id: "public.fund.heroLede",
                defaultMessage:
                  "Choose a garden whose work you want to support. Donate to its shared fund, or explore a longer-term endowment. You can read its approved submissions before contributing.",
              }
            : {
                id: "public.fund.heroDonationLede",
                defaultMessage:
                  "Choose a garden whose work you want to support. You can read its approved submissions and donate to its shared fund.",
              }),
        })}
      />

      {/* The first block after the hero clears its card: a receipt, a Garden-query notice, or § 01. */}
      <div className="bg-bg-weak-50 pt-32 sm:pt-36 md:pt-40">
        {intentId ? (
          <section className="px-6 pb-8 sm:px-10">
            <div className="mx-auto max-w-3xl">
              <PublicFundingReceipt intentId={intentId} />
            </div>
          </section>
        ) : null}

        {!intentId && (resolved.status === "stale" || resolved.status === "ambiguous") ? (
          <section className="px-6 pb-4 sm:px-10">
            <div className="mx-auto max-w-3xl">
              <p
                role="status"
                className="border-l-2 border-text-soft-400 bg-bg-white-0 px-4 py-3 text-sm text-text-sub-600"
              >
                {formatMessage(
                  {
                    id:
                      resolved.status === "ambiguous"
                        ? "public.fund.gardenQuery.ambiguous"
                        : "public.fund.gardenQuery.stale",
                    defaultMessage:
                      resolved.status === "ambiguous"
                        ? 'We couldn\'t tell which garden you meant by "{query}". Pick one below.'
                        : 'We couldn\'t find a garden matching "{query}". Browse the list below.',
                  },
                  { query: resolved.rawQuery ?? "" }
                )}
              </p>
            </div>
          </section>
        ) : null}

        {/* § 01: the endowment totals, so a visitor first sees what already supports Gardens */}
        <VaultAggregationSection summary={vaultSummary} />
      </div>

      {ENDOWMENT_DEPOSITS_ENABLED && <FundSupportPaths />}

      {/* Choose a garden to support. */}
      <section
        ref={gardensRef}
        data-revealed={gardensRevealed}
        className="editorial-section-reveal bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
        aria-labelledby="public-fund-gardens-title"
      >
        <div className="editorial-cascade mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <EditorialKicker className="mb-3">
                  {ENDOWMENT_DEPOSITS_ENABLED
                    ? formatMessage({
                        id: "public.fund.gardens.kicker",
                        defaultMessage: "§ 03: Choose a garden",
                      })
                    : formatMessage({
                        id: "public.fund.gardens.donateKicker",
                        defaultMessage: "§ 02: Choose a garden",
                      })}
                </EditorialKicker>
                <EditorialHeading id="public-fund-gardens-title">
                  {formatMessage({
                    id: "public.fund.gardens.title",
                    defaultMessage: "Find a Garden to support.",
                  })}
                </EditorialHeading>
              </div>
              <EditorialGhostButton
                variant="warm"
                onClick={handleManageEndowmentsClick}
                aria-expanded={isEndowmentPanelOpen}
                aria-haspopup="dialog"
                className="w-fit sm:mt-1"
              >
                {formatMessage({
                  id: "public.fund.manageEndowments.cta",
                  defaultMessage: "Manage Endowments",
                })}
              </EditorialGhostButton>
            </div>
            {!ENDOWMENT_DEPOSITS_ENABLED && (
              <div className="mt-5 max-w-2xl text-sm text-text-sub-600">
                <p className="font-semibold text-text-strong-950">
                  {formatMessage({
                    id: "public.fund.endowmentPause.title",
                    defaultMessage: "New endowment deposits are paused",
                  })}
                </p>
                <p className="mt-1">
                  {formatMessage({
                    id: "public.fund.endowmentPause.body",
                    defaultMessage:
                      "We’re updating our endowment vaults. You can still review your existing endowments and withdraw what’s available.",
                  })}
                </p>
              </div>
            )}
          </header>

          <PublicSurfaceState
            state={gardensState}
            loading={
              <div
                className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:auto-rows-fr sm:grid-cols-2"
                aria-hidden="true"
              >
                {[0, 1, 2, 3].map((i) => (
                  <EditorialListRowSkeleton key={i} />
                ))}
              </div>
            }
            onRetry={() => void refetch()}
            empty={
              <div className="mt-12 max-w-md">
                <p className="font-serif text-xl italic text-text-soft-400">
                  {formatMessage({
                    id: "public.fund.empty",
                    defaultMessage:
                      "Gardens will appear here after their first approved submission.",
                  })}
                </p>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                  <EditorialLinkArrow to="/gardens">
                    {formatMessage({
                      id: "public.fund.empty.browseGardens",
                      defaultMessage: "Browse All Gardens",
                    })}
                  </EditorialLinkArrow>
                  <EditorialLinkArrow to="/impact">
                    {formatMessage({
                      id: "public.fund.empty.viewImpact",
                      defaultMessage: "View Public Evidence",
                    })}
                  </EditorialLinkArrow>
                </div>
              </div>
            }
          >
            <div
              className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:auto-rows-fr sm:grid-cols-2"
              data-testid="public-fund-garden-grid"
            >
              {orderedGardens.map((garden) => {
                const isMatchedHighlight =
                  resolved.status === "match" && resolved.garden?.id === garden.id;
                return (
                  <div
                    key={garden.id}
                    ref={isMatchedHighlight ? matchHighlightRef : undefined}
                    className={
                      isMatchedHighlight
                        ? "h-full min-w-0 ring-2 ring-primary-action ring-offset-4 ring-offset-bg-weak-50"
                        : "h-full min-w-0"
                    }
                  >
                    <PublicGardenRow
                      garden={garden}
                      vaultSummary={getGardenVaultSummary(vaultSummary, garden)}
                      vaultsUnavailable={vaultsUnavailable}
                      onSupport={handleSupport}
                    />
                  </div>
                );
              })}
            </div>
          </PublicSurfaceState>
        </div>
      </section>

      <div className="bg-bg-weak-50 px-6 pb-16 sm:px-10">
        <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-10">
          <p className="max-w-2xl text-base leading-relaxed text-text-sub-600">
            {formatMessage({ id: "public.home.getInTouch.callBody" })}
          </p>
          <div className="mt-5">
            <EditorialLinkArrow to="/#contact">
              {formatMessage({ id: "public.gardenDetail.discussFunding" })}
            </EditorialLinkArrow>
          </div>
        </div>
      </div>

      <PublicFooter variant="soil" />

      {hasWalletRuntime ? (
        <Suspense
          fallback={
            <div
              role="status"
              aria-live="polite"
              className="fixed inset-0 z-modal flex items-end justify-center bg-static-black/40 sm:items-center"
            >
              <p className="m-4 max-w-[calc(100vw-2rem)] border border-stroke-soft-200 bg-bg-white-0 px-6 py-4 text-sm text-text-sub-600 shadow-[var(--shadow-editorial-panel)]">
                {formatMessage({
                  id: "public.fund.preparingWallet",
                  defaultMessage: "Preparing wallet…",
                })}
              </p>
            </div>
          }
        >
          {selectorState ? (
            <WalletRuntimeProviders>
              <PublicFundingCard
                open
                garden={selectorState.garden}
                intent={selectorState.intent}
                onClose={closeSelector}
              />
            </WalletRuntimeProviders>
          ) : null}
        </Suspense>
      ) : null}

      {isEndowmentPanelOpen ? (
        <Suspense fallback={null}>
          <WalletRuntimeProviders>
            <PublicEndowmentPanel
              open
              onExitComplete={handleEndowmentPanelExitComplete}
              onOpenChange={handleEndowmentPanelOpenChange}
            />
          </WalletRuntimeProviders>
        </Suspense>
      ) : null}
    </>
  );
}

export default function FundPage() {
  return <FundPageContent />;
}
