import {
  formatApy,
  formatTokenAmount,
  type PublicGardenVaultSummary,
  type PublicGardenSummary,
  type PublicVaultSummary,
  type PublicVaultSummaryAsset,
  useInViewReveal,
  usePublicGardens,
  usePublicVaultSummary,
} from "@green-goods/shared";
import type { PublicFundingIntentKind } from "@green-goods/shared/public-contracts";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLinkArrow,
  EditorialNumeral,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEndowmentPanel } from "@/components/Public/PublicEndowmentPanel";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicFundingReceipt } from "@/components/Public/PublicFundingReceipt";
import { PublicGardenRow } from "@/components/Public/PublicGardenRow";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import { resolveGardenQuery } from "@/views/Public/garden-query-resolution";

const PublicFundingCard = lazy(() =>
  import("@/components/Public/PublicFundingCard").then((module) => ({
    default: module.PublicFundingCard,
  }))
);

interface SupportPathProps {
  numeral: string;
  titleId: string;
  defaultTitle: string;
  ledeId: string;
  defaultLede: string;
  routesId: string;
  defaultRoutes: string;
  bestForId: string;
  defaultBestFor: string;
  learnMoreId: string;
  defaultLearnMore: string;
  learnMoreHref: string;
}

function SupportPath({
  numeral,
  titleId,
  defaultTitle,
  ledeId,
  defaultLede,
  routesId,
  defaultRoutes,
  bestForId,
  defaultBestFor,
  learnMoreId,
  defaultLearnMore,
  learnMoreHref,
}: SupportPathProps) {
  const { formatMessage } = useIntl();
  return (
    <article className="flex flex-col gap-5">
      <EditorialNumeral>{numeral}</EditorialNumeral>
      <h3 className="font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
        {formatMessage({ id: titleId, defaultMessage: defaultTitle })}
      </h3>
      <p className="text-base leading-[1.6] text-text-sub-600 md:text-lg">
        {formatMessage({ id: ledeId, defaultMessage: defaultLede })}
      </p>
      <dl className="space-y-3 text-sm leading-[1.55] text-text-sub-600">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.fund.support.routes", defaultMessage: "Routes through" })}
          </dt>
          <dd className="mt-1">{formatMessage({ id: routesId, defaultMessage: defaultRoutes })}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.fund.support.bestFor", defaultMessage: "Best for" })}
          </dt>
          <dd className="mt-1">
            {formatMessage({ id: bestForId, defaultMessage: defaultBestFor })}
          </dd>
        </div>
      </dl>
      <div>
        <EditorialLinkArrow to={learnMoreHref} external>
          {formatMessage({ id: learnMoreId, defaultMessage: defaultLearnMore })}
        </EditorialLinkArrow>
      </div>
    </article>
  );
}

function VaultAggregationSection({ summary }: { summary: PublicVaultSummary }) {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();
  if (!summary.hasVaults && !summary.isLoading) return null;

  const assets = summary.assets;

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
      aria-labelledby="public-fund-vaults-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <header className="border-b border-stroke-soft-200 pb-6">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.fund.vaults.kicker",
              defaultMessage: "§ 01 — Endowment engine",
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
                "Endow adds long-term capital to these vaults; Donate sends support directly to a Garden's shared fund.",
            })}
          </p>
        </header>

        {assets.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {assets.map((asset) => (
              <VaultAssetCard key={`${asset.chainId}:${asset.asset}`} asset={asset} />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2" aria-hidden="true">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)]"
              >
                <div className="h-3 w-28 animate-pulse bg-stroke-soft-200/60" />
                <div className="mt-4 h-8 w-36 animate-pulse bg-stroke-soft-200/60" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="h-4 animate-pulse bg-stroke-soft-200/40" />
                  <div className="h-4 animate-pulse bg-stroke-soft-200/40" />
                  <div className="h-4 animate-pulse bg-stroke-soft-200/40" />
                  <div className="h-4 animate-pulse bg-stroke-soft-200/40" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function VaultAssetCard({ asset }: { asset: PublicVaultSummaryAsset }) {
  const { formatMessage } = useIntl();
  const aprValue =
    typeof asset.apr === "number"
      ? formatApy(asset.apr)
      : formatMessage({
          id: "public.fund.vaults.aprUnavailable",
          defaultMessage: "APR unavailable",
        });
  const readyToHarvestValue =
    asset.accruingYield !== undefined
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
            defaultMessage: "Ready to harvest",
          })}
          value={readyToHarvestValue}
        />
        <VaultMetric
          label={formatMessage({
            id: "public.fund.vaults.routed",
            defaultMessage: "Routed to Gardens",
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

/**
 * Fund — public garden funding gateway.
 *
 * Editorial recomposition:
 *   Hero → § 01 Vault overview → § 02 Donate vs Endow explanatory diptych
 *   with always-visible tax / risk disclosures → § 03 Compact garden grid
 *   with per-card Donate / Endow CTAs and the wallet-owned Manage Endowments
 *   panel entry → optional receipt / stale-link banner → Footer.
 *
 * Behavior contract:
 * - `?intent=<id>` triggers receipt mode (reads X-GG-Receipt-Token from session).
 * - `?garden=<id-or-slug>` resolves via `publicGardenHelpers.deriveSlug`. Stale,
 *   missing, zero-match, or ambiguous queries fall back to the regular Fund
 *   layout with a localized non-blocking message.
 * - Each Garden row exposes Donate + Endow CTAs that open PublicFundingCard
 *   (single editorial card with amount-first input, visual token picker, and
 *   inline wallet-connect through the smart submit button).
 * - `?manage=endowments` opens the wallet-owned public endowment panel.
 * - No public address lookup or admin controls.
 */
function FundPageContent() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();
  const vaultSummary = usePublicVaultSummary();
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

  const [selectorState, setSelectorState] = useState<{
    garden: PublicGardenSummary;
    intent: PublicFundingIntentKind;
  } | null>(null);
  const [isEndowmentPanelOpen, setEndowmentPanelOpen] = useState(false);
  const hasWalletRuntime = Boolean(selectorState);
  const { ref: pathsRef, revealed: pathsRevealed } = useInViewReveal<HTMLElement>();
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
    setEndowmentPanelOpen(manageQuery === "endowments");
  }, [manageQuery]);

  const closeSelector = useCallback(() => setSelectorState(null), []);

  const handleManageEndowmentsClick = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("manage", "endowments");
    setEndowmentPanelOpen(true);
    setSearchParams(nextParams, { preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  const handleEndowmentPanelOpenChange = useCallback(
    (open: boolean) => {
      setEndowmentPanelOpen(open);
      if (!open && searchParams.get("manage") === "endowments") {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("manage");
        setSearchParams(nextParams, { replace: true, preventScrollReset: true });
      }
    },
    [searchParams, setSearchParams]
  );

  const handleSupport = useCallback(
    (garden: PublicGardenSummary, intent: PublicFundingIntentKind) => {
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
            defaultMessage: "A small gesture, <accent>growing</accent> over many seasons.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.fund.heroLede",
          defaultMessage:
            "Donate to a Garden's immediate Work, or Endow a Vault so yield supports the Garden over many seasons. Every contribution lands with a Garden, not a platform.",
        })}
      />

      <VaultAggregationSection summary={vaultSummary} />

      {intentId ? (
        <section className="bg-bg-weak-50 px-6 pt-32 pb-8 sm:px-10 sm:pt-36 md:pt-40">
          <div className="mx-auto max-w-3xl">
            <PublicFundingReceipt intentId={intentId} />
          </div>
        </section>
      ) : null}

      {!intentId && (resolved.status === "stale" || resolved.status === "ambiguous") ? (
        <section className="bg-bg-weak-50 px-6 pt-32 pb-4 sm:px-10 sm:pt-36 md:pt-40">
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
                      ? 'We couldn\'t tell which Garden you meant by "{query}". Pick one below.'
                      : 'We couldn\'t find a Garden matching "{query}". Browse the list below.',
                },
                { query: resolved.rawQuery ?? "" }
              )}
            </p>
          </div>
        </section>
      ) : null}

      {/* § 01 — Donate vs Endow editorial diptych */}
      <section
        ref={pathsRef}
        data-revealed={pathsRevealed}
        className={
          vaultSummary.hasVaults ||
          vaultSummary.isLoading ||
          intentId ||
          resolved.status === "stale" ||
          resolved.status === "ambiguous"
            ? "editorial-section-reveal bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
            : "editorial-section-reveal bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        }
        aria-labelledby="public-fund-paths-title"
      >
        <div className="editorial-cascade mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.fund.paths.kicker",
                defaultMessage: "§ 02 — Ways to support",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-fund-paths-title">
              {formatMessage({
                id: "public.fund.paths.title",
                defaultMessage: "Donate now, or Endow for many seasons.",
              })}
            </EditorialHeading>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
            <SupportPath
              numeral="1."
              titleId="public.fund.paths.donateTitle"
              defaultTitle="Donate"
              ledeId="public.fund.paths.donateLede"
              defaultLede="Direct support reaching a Garden's shared fund today — funding the work right in front of them."
              routesId="public.fund.paths.donateRoutes"
              defaultRoutes="Goes to the Garden's shared fund."
              bestForId="public.fund.paths.donateBestFor"
              defaultBestFor="Immediate needs and near-term work."
              learnMoreId="public.fund.paths.donateLearnMore"
              defaultLearnMore="How direct support works"
              learnMoreHref="https://docs.greengoods.app/community/funder-guide"
            />
            <SupportPath
              numeral="2."
              titleId="public.fund.paths.endowTitle"
              defaultTitle="Endow"
              ledeId="public.fund.paths.endowLede"
              defaultLede="A Vault designed so the deposit can remain while yield supports the Garden over many seasons."
              routesId="public.fund.paths.endowRoutes"
              defaultRoutes="Stays in the Garden's Vault."
              bestForId="public.fund.paths.endowBestFor"
              defaultBestFor="Long-term support that compounds."
              learnMoreId="public.fund.paths.endowLearnMore"
              defaultLearnMore="Learn about Octant V2 vaults"
              learnMoreHref="https://octant.build"
            />
          </div>

          <aside
            className="mt-10 border-t border-stroke-soft-200 pt-6 text-xs leading-[1.6] text-text-soft-400"
            aria-label={formatMessage({
              id: "public.fund.paths.disclosures",
              defaultMessage: "Important disclosures",
            })}
          >
            <p>
              {formatMessage({
                id: "public.fund.dialog.taxDisclaimer",
                defaultMessage:
                  "Both paths support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured.",
              })}
            </p>
            <p className="mt-2">
              <span className="font-mono uppercase tracking-[0.16em] text-text-soft-400">
                {formatMessage({
                  id: "public.fund.paths.endowRiskLabel",
                  defaultMessage: "On Endow",
                })}
                {" — "}
              </span>
              {formatMessage({
                id: "public.fund.dialog.endow.risk",
                defaultMessage:
                  "Heads up: long-term deposits depend on the underlying token and provider, so values and access can vary.",
              })}
            </p>
          </aside>
        </div>
      </section>

      {/* § 03 — Choose a Garden to support */}
      <section
        ref={gardensRef}
        data-revealed={gardensRevealed}
        className="editorial-section-reveal bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-fund-gardens-title"
      >
        <div className="editorial-cascade mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <EditorialKicker className="mb-3">
                  {formatMessage({
                    id: "public.fund.gardens.kicker",
                    defaultMessage: "§ 03 — Choose where to apply your support",
                  })}
                </EditorialKicker>
                <EditorialHeading id="public-fund-gardens-title">
                  {formatMessage({
                    id: "public.fund.gardens.title",
                    defaultMessage: "Gardens accepting support this season.",
                  })}
                </EditorialHeading>
              </div>
              <button
                type="button"
                onClick={handleManageEndowmentsClick}
                aria-expanded={isEndowmentPanelOpen}
                aria-haspopup="dialog"
                className="inline-flex min-h-11 w-fit items-center border-b border-primary-action/35 text-left text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-4 focus-visible:ring-offset-bg-weak-50 sm:mt-1"
              >
                {formatMessage({
                  id: "public.fund.manageEndowments.cta",
                  defaultMessage: "Manage Endowments",
                })}
              </button>
            </div>
          </header>

          {isLoading ? (
            <div
              className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 2xl:grid-cols-3"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-stretch gap-4 py-4 sm:gap-5">
                  <div className="h-20 w-20 shrink-0 animate-pulse bg-editorial-warm" />
                  <div className="flex flex-1 flex-col justify-center gap-2">
                    <div className="h-3 w-24 animate-pulse bg-stroke-soft-200/60" />
                    <div className="h-5 w-3/4 animate-pulse bg-stroke-soft-200/60" />
                    <div className="h-3 w-1/2 animate-pulse bg-stroke-soft-200/40" />
                  </div>
                  <div className="flex shrink-0 flex-col justify-center gap-2">
                    <div className="h-9 w-20 animate-pulse rounded-full bg-stroke-soft-200/60" />
                    <div className="h-9 w-20 animate-pulse rounded-full bg-stroke-soft-200/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : orderedGardens.length === 0 ? (
            <div className="mt-12 max-w-md">
              <p className="font-serif text-xl italic text-text-soft-400">
                {formatMessage({
                  id: "public.fund.empty",
                  defaultMessage: "Funding destinations will appear here as Gardens enable them.",
                })}
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                <EditorialLinkArrow to="/gardens">
                  {formatMessage({
                    id: "public.fund.empty.browseGardens",
                    defaultMessage: "Browse all Gardens",
                  })}
                </EditorialLinkArrow>
                <EditorialLinkArrow to="/impact">
                  {formatMessage({
                    id: "public.fund.empty.viewImpact",
                    defaultMessage: "View public evidence",
                  })}
                </EditorialLinkArrow>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 2xl:grid-cols-3">
              {orderedGardens.map((garden) => {
                const isMatchedHighlight =
                  resolved.status === "match" && resolved.garden?.id === garden.id;
                return (
                  <div
                    key={garden.id}
                    ref={isMatchedHighlight ? matchHighlightRef : undefined}
                    className={
                      isMatchedHighlight
                        ? "ring-2 ring-primary-action ring-offset-4 ring-offset-bg-weak-50"
                        : undefined
                    }
                  >
                    <PublicGardenRow
                      garden={garden}
                      vaultSummary={getGardenVaultSummary(vaultSummary, garden)}
                      onSupport={handleSupport}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

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
            <PublicFundingCard
              open
              garden={selectorState.garden}
              intent={selectorState.intent}
              onClose={closeSelector}
            />
          ) : null}
        </Suspense>
      ) : null}

      <PublicEndowmentPanel
        open={isEndowmentPanelOpen}
        onOpenChange={handleEndowmentPanelOpenChange}
      />
    </>
  );
}

export default function FundPage() {
  return (
    <WalletRuntimeProviders>
      <FundPageContent />
    </WalletRuntimeProviders>
  );
}
